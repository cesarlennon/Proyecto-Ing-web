'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const ControlAcceso = require('../../src/middleware/ControlAcceso');
const ProteccionCSRF = require('../../src/middleware/ProteccionCSRF');
const ManejadorErrores = require('../../src/middleware/ManejadorErrores');
const { crearUsuario } = require('../../src/domain/crearUsuario');
const {
  NoAutenticadoError, NoAutorizadoError, ReglaNegocioError, ValidacionError, ExistenciasInsuficientesError,
  NoEncontradoError, ErrorAplicacion,
} = require('../../src/errors/errores');

const usuarioDe = (rol) =>
  crearUsuario({ idUsuario: 1, correo: 'a@b.com', nombres: 'Ana', apellidoPaterno: 'Pérez', rol });

const conSiguiente = () => {
  const r = { error: undefined, llamado: false };
  r.next = (e) => { r.llamado = true; r.error = e; };
  return r;
};

describe('ControlAcceso', () => {
  test('requerirSesion deja pasar a quien tiene sesión', () => {
    const s = conSiguiente();
    ControlAcceso.requerirSesion({ isAuthenticated: () => true, user: usuarioDe('cliente') }, {}, s.next);
    assert.ok(s.llamado);
    assert.equal(s.error, undefined);
  });

  test('requerirSesion rechaza con NoAutenticadoError si no hay sesión', () => {
    const s = conSiguiente();
    ControlAcceso.requerirSesion({ isAuthenticated: () => false }, {}, s.next);
    assert.ok(s.error instanceof NoAutenticadoError);
    const s2 = conSiguiente();
    ControlAcceso.requerirSesion({}, {}, s2.next);
    assert.ok(s2.error instanceof NoAutenticadoError);
  });

  test('requerirRol solo permite los perfiles indicados', () => {
    const middleware = ControlAcceso.requerirRol('administrador', 'inventarios');

    const permitido = conSiguiente();
    middleware({ user: usuarioDe('inventarios') }, {}, permitido.next);
    assert.equal(permitido.error, undefined);

    const denegado = conSiguiente();
    middleware({ user: usuarioDe('cliente') }, {}, denegado.next);
    assert.ok(denegado.error instanceof NoAutorizadoError);

    const anonimo = conSiguiente();
    middleware({}, {}, anonimo.next);
    assert.ok(anonimo.error instanceof NoAutenticadoError);
  });

  test('requerirPermiso usa los permisos del perfil', () => {
    const middleware = ControlAcceso.requerirPermiso('productos:precio');

    const inventarios = conSiguiente();
    middleware({ user: usuarioDe('inventarios') }, {}, inventarios.next);
    assert.equal(inventarios.error, undefined);

    const cliente = conSiguiente();
    middleware({ user: usuarioDe('cliente') }, {}, cliente.next);
    assert.ok(cliente.error instanceof NoAutorizadoError);
  });
});

describe('ProteccionCSRF', () => {
  const reqCon = (metodo, sesion, encabezado) => ({
    method: metodo,
    session: sesion,
    get: (nombre) => (nombre.toLowerCase() === 'x-csrf-token' ? encabezado : undefined),
  });

  test('generarToken crea un token aleatorio y lo reutiliza', () => {
    const req = { session: {} };
    const a = ProteccionCSRF.generarToken(req);
    const b = ProteccionCSRF.generarToken(req);
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.equal(a, b);
    assert.notEqual(a, ProteccionCSRF.generarToken({ session: {} }));
  });

  test('generarToken exige sesión', () => {
    assert.throws(() => ProteccionCSRF.generarToken({}), /sesiones/);
  });

  test('las peticiones de solo lectura no requieren token', () => {
    const mw = ProteccionCSRF.middleware();
    for (const metodo of ['GET', 'HEAD', 'OPTIONS']) {
      const s = conSiguiente();
      mw(reqCon(metodo, {}, undefined), {}, s.next);
      assert.equal(s.error, undefined);
    }
  });

  test('las peticiones que modifican datos exigen el token correcto', () => {
    const mw = ProteccionCSRF.middleware();
    const token = 'a'.repeat(64);

    const ok = conSiguiente();
    mw(reqCon('POST', { csrfToken: token }, token), {}, ok.next);
    assert.equal(ok.error, undefined);

    for (const enc of [undefined, 'b'.repeat(64), 'corto', '']) {
      const mal = conSiguiente();
      mw(reqCon('POST', { csrfToken: token }, enc), {}, mal.next);
      assert.ok(mal.error instanceof NoAutorizadoError, `debía rechazar ${String(enc)}`);
      assert.equal(mal.error.codigo, 'CSRF_INVALIDO');
    }

    const sinToken = conSiguiente();
    mw(reqCon('DELETE', {}, token), {}, sinToken.next);
    assert.equal(sinToken.error.codigo, 'CSRF_INVALIDO');
  });
});

describe('ManejadorErrores', () => {
  const registro = () => ({ errores: [], error(...a) { this.errores.push(a); } });
  const res = () => ({
    headersSent: false, estado: null, cuerpo: null,
    status(c) { this.estado = c; return this; },
    json(c) { this.cuerpo = c; return this; },
  });
  const req = { method: 'GET', originalUrl: '/api/x' };

  test('los errores de la aplicación se responden con su estado y su mensaje', () => {
    const r = res();
    ManejadorErrores.manejar(registro())(new NoEncontradoError('No existe.'), req, r, () => {});
    assert.equal(r.estado, 404);
    assert.deepEqual(r.cuerpo, { error: { codigo: 'NO_ENCONTRADO', mensaje: 'No existe.' } });
  });

  test('los errores de validación incluyen los campos', () => {
    const r = res();
    ManejadorErrores.manejar(registro())(new ValidacionError({ rfc: 'mal' }), req, r, () => {});
    assert.equal(r.estado, 400);
    assert.deepEqual(r.cuerpo.error.campos, { rfc: 'mal' });
    assert.equal(r.cuerpo.error.codigo, 'VALIDACION');
  });

  test('los errores de existencias son de negocio y no revelan cifras', () => {
    const r = res();
    ManejadorErrores.manejar(registro())(new ExistenciasInsuficientesError(), req, r, () => {});
    assert.equal(r.estado, 400);
    assert.equal(r.cuerpo.error.codigo, 'SIN_EXISTENCIAS');
    assert.doesNotMatch(r.cuerpo.error.mensaje, /\d/);
  });

  test('un error inesperado responde con un mensaje genérico y registra el detalle', () => {
    const log = registro();
    const r = res();
    ManejadorErrores.manejar(log)(new Error('SELECT * FROM secreto falló en /srv/app.js'), req, r, () => {});
    assert.equal(r.estado, 500);
    assert.equal(r.cuerpo.error.codigo, 'ERROR_INTERNO');
    assert.doesNotMatch(JSON.stringify(r.cuerpo), /SELECT|srv|secreto/);
    assert.equal(log.errores.length, 1);
    assert.match(log.errores[0][1].mensaje, /SELECT/);
  });

  test('un JSON mal formado responde 400', () => {
    const r = res();
    const e = new SyntaxError('x');
    e.type = 'entity.parse.failed';
    ManejadorErrores.manejar(registro())(e, req, r, () => {});
    assert.equal(r.estado, 400);
    assert.equal(r.cuerpo.error.codigo, 'JSON_INVALIDO');
  });

  test('si ya se enviaron las cabeceras delega en Express', () => {
    const r = res();
    r.headersSent = true;
    const s = conSiguiente();
    const e = new Error('x');
    ManejadorErrores.manejar(registro())(e, req, r, s.next);
    assert.equal(s.error, e);
  });
});

describe('Errores de la aplicación', () => {
  test('ErrorAplicacion es abstracta y las derivadas conservan su estado', () => {
    assert.throws(() => new ErrorAplicacion('x'), TypeError);
    assert.equal(new ReglaNegocioError('x').estado, 400);
    assert.equal(new NoAutenticadoError().estado, 401);
    assert.equal(new NoAutorizadoError().estado, 403);
    assert.equal(new NoEncontradoError().estado, 404);
    assert.ok(new ExistenciasInsuficientesError() instanceof ReglaNegocioError);
    assert.equal(new ValidacionError({}).name, 'ValidacionError');
  });
});
