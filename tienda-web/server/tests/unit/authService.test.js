'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const AuthService = require('../../src/services/AuthService');
const { crearUsuario } = require('../../src/domain/crearUsuario');
const { NoAutorizadoError, ReglaNegocioError, ValidacionError } = require('../../src/errors/errores');

const PERFIL = { proveedor: 'google', id: 'g-123', correo: 'ana@correo.com', nombres: 'Ana', apellidos: '' };
const DATOS_VALIDOS = {
  nombres: 'Ana María',
  apellidoPaterno: 'Pérez',
  apellidoMaterno: 'Gómez',
  rfc: 'pega900101ab1',
  curp: 'pega900101hdfrrn09',
  aceptaAviso: true,
};

const usuarioDe = (extra = {}) =>
  crearUsuario({ idUsuario: 7, correo: 'ana@correo.com', nombres: 'Ana', apellidoPaterno: 'Pérez', rol: 'cliente', ...extra });

function crearFakes() {
  const f = {
    eventos: [],
    usuarios: {
      porOAuth: null,
      porCorreo: null,
      vinculado: null,
      accesos: [],
      creados: [],
      async buscarPorOAuth() { return this.porOAuth; },
      async buscarPorCorreo() { return this.porCorreo; },
      async vincularOAuth(...args) { this.vinculado = args; },
      async registrarAcceso(id) { this.accesos.push(id); },
      async crearUsuario(datos) { this.creados.push(datos); return 10; },
      async buscarPorId(id) { return usuarioDe({ idUsuario: id }); },
    },
    clientes: {
      creados: [],
      async crearCliente(datos) { this.creados.push(datos); },
    },
    bitacora: {
      async registrar(...args) { f.eventos.push(args); },
    },
    bd: {
      transacciones: 0,
      async transaccion(trabajo) { this.transacciones += 1; return trabajo({ fake: true }); },
    },
  };
  f.servicio = new AuthService({ bd: f.bd, usuarios: f.usuarios, clientes: f.clientes, bitacora: f.bitacora });
  return f;
}

describe('AuthService.iniciarSesion', () => {
  let f;
  beforeEach(() => { f = crearFakes(); });

  test('devuelve null cuando no existe una cuenta con ese correo', async () => {
    assert.equal(await f.servicio.iniciarSesion(PERFIL), null);
    assert.equal(f.eventos.length, 0);
  });

  test('vincula la identidad OAuth la primera vez y registra el acceso', async () => {
    f.usuarios.porCorreo = usuarioDe();
    const usuario = await f.servicio.iniciarSesion(PERFIL, '10.0.0.1');
    assert.equal(usuario.idUsuario, 7);
    assert.deepEqual(f.usuarios.vinculado, [7, 'google', 'g-123']);
    assert.deepEqual(f.usuarios.accesos, [7]);
    assert.equal(f.eventos[0][1], 'inicio_sesion');
    assert.equal(f.eventos[0][5], '10.0.0.1');
  });

  test('no vuelve a vincular si la identidad ya coincide', async () => {
    f.usuarios.porOAuth = usuarioDe({ oauthProveedor: 'google', oauthId: 'g-123' });
    await f.servicio.iniciarSesion(PERFIL);
    assert.equal(f.usuarios.vinculado, null);
    assert.deepEqual(f.usuarios.accesos, [7]);
  });

  test('rechaza una cuenta deshabilitada y lo registra (A3 de CU-02)', async () => {
    f.usuarios.porCorreo = usuarioDe({ activo: false });
    await assert.rejects(
      () => f.servicio.iniciarSesion(PERFIL),
      (e) => e instanceof NoAutorizadoError && e.codigo === 'CUENTA_DESHABILITADA',
    );
    assert.equal(f.eventos[0][1], 'inicio_sesion_rechazado');
    assert.deepEqual(f.usuarios.accesos, []);
  });

  test('rechaza un correo vinculado a otra identidad de OAuth', async () => {
    f.usuarios.porCorreo = usuarioDe({ oauthProveedor: 'google', oauthId: 'otra-persona' });
    await assert.rejects(
      () => f.servicio.iniciarSesion(PERFIL),
      (e) => e instanceof NoAutorizadoError && e.codigo === 'OAUTH_VINCULADA',
    );
  });

  test('rechaza un perfil incompleto', async () => {
    await assert.rejects(() => f.servicio.iniciarSesion({ proveedor: 'google' }), NoAutorizadoError);
    await assert.rejects(() => f.servicio.iniciarSesion(null), NoAutorizadoError);
  });
});

describe('AuthService.registrarCliente', () => {
  let f;
  beforeEach(() => { f = crearFakes(); });

  test('crea el usuario y el cliente en una sola transacción, con datos normalizados', async () => {
    const usuario = await f.servicio.registrarCliente(PERFIL, DATOS_VALIDOS, '10.0.0.1');
    assert.equal(f.bd.transacciones, 1);
    assert.equal(f.usuarios.creados.length, 1);
    assert.deepEqual(f.usuarios.creados[0], {
      rol: 'cliente',
      correo: 'ana@correo.com',
      nombres: 'Ana María',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: 'Gómez',
      oauthProveedor: 'google',
      oauthId: 'g-123',
    });
    assert.deepEqual(f.clientes.creados, [{ idUsuario: 10, rfc: 'PEGA900101AB1', curp: 'PEGA900101HDFRRN09' }]);
    assert.equal(usuario.idUsuario, 10);
    assert.equal(f.eventos[0][1], 'registro_cliente');
  });

  test('rechaza datos inválidos con el detalle por campo y sin escribir en la base', async () => {
    await assert.rejects(
      () => f.servicio.registrarCliente(PERFIL, { ...DATOS_VALIDOS, rfc: 'mal', aceptaAviso: false }),
      (e) => e instanceof ValidacionError && Boolean(e.campos.rfc) && Boolean(e.campos.aceptaAviso),
    );
    assert.equal(f.bd.transacciones, 0);
    assert.equal(f.usuarios.creados.length, 0);
  });

  test('rechaza el registro si ya existe una cuenta con ese correo (A2 de CU-11)', async () => {
    f.usuarios.porCorreo = usuarioDe();
    await assert.rejects(
      () => f.servicio.registrarCliente(PERFIL, DATOS_VALIDOS),
      (e) => e instanceof ReglaNegocioError && e.codigo === 'CUENTA_EXISTENTE',
    );
    assert.equal(f.bd.transacciones, 0);
  });

  test('convierte el error de RFC duplicado en un error de validación del campo', async () => {
    f.bd.transaccion = async () => {
      const error = new Error('Duplicate entry');
      error.code = 'ER_DUP_ENTRY';
      error.sqlMessage = "Duplicate entry 'PEGA900101AB1' for key 'clientes.uk_clientes_rfc'";
      throw error;
    };
    await assert.rejects(
      () => f.servicio.registrarCliente(PERFIL, DATOS_VALIDOS),
      (e) => e instanceof ValidacionError && /RFC/.test(e.campos.rfc),
    );
  });

  test('convierte el error de CURP duplicada en un error de validación del campo', async () => {
    f.bd.transaccion = async () => {
      const error = new Error('Duplicate entry');
      error.code = 'ER_DUP_ENTRY';
      error.sqlMessage = "Duplicate entry 'X' for key 'clientes.uk_clientes_curp'";
      throw error;
    };
    await assert.rejects(
      () => f.servicio.registrarCliente(PERFIL, DATOS_VALIDOS),
      (e) => e instanceof ValidacionError && /CURP/.test(e.campos.curp),
    );
  });

  test('un correo duplicado por carrera se informa como cuenta existente', async () => {
    f.bd.transaccion = async () => {
      const error = new Error('Duplicate entry');
      error.code = 'ER_DUP_ENTRY';
      error.sqlMessage = "Duplicate entry 'ana@correo.com' for key 'usuarios.uk_usuarios_correo'";
      throw error;
    };
    await assert.rejects(
      () => f.servicio.registrarCliente(PERFIL, DATOS_VALIDOS),
      (e) => e instanceof ReglaNegocioError && e.codigo === 'CUENTA_EXISTENTE',
    );
  });

  test('los errores inesperados no se ocultan', async () => {
    f.bd.transaccion = async () => { throw new Error('se cayó la base'); };
    await assert.rejects(() => f.servicio.registrarCliente(PERFIL, DATOS_VALIDOS), /se cayó la base/);
  });
});

describe('AuthService.registrarCierreSesion', () => {
  test('registra el evento en la bitácora', async () => {
    const f = crearFakes();
    await f.servicio.registrarCierreSesion(usuarioDe(), '10.0.0.2');
    assert.equal(f.eventos[0][1], 'cierre_sesion');
    assert.equal(f.eventos[0][0], 7);
  });
});
