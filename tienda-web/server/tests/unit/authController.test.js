'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const AuthController = require('../../src/controllers/AuthController');
const { crearUsuario } = require('../../src/domain/crearUsuario');
const { NoAutenticadoError, NoAutorizadoError } = require('../../src/errors/errores');

const PERFIL = { proveedor: 'google', id: 'g-1', correo: 'ana@correo.com', nombres: 'Ana' };
const usuarioDe = (rol) =>
  crearUsuario({ idUsuario: 5, correo: 'ana@correo.com', nombres: 'Ana', apellidoPaterno: 'Pérez', rol, oauthId: 'g-1' });

/** Passport simulado: entrega el resultado configurado al callback de authenticate. */
function passportFalso({ error = null, perfil = PERFIL } = {}) {
  return {
    llamadas: [],
    authenticate(nombre, opciones, callback) {
      this.llamadas.push({ nombre, opciones });
      if (!callback) return () => {};
      return () => callback(error, perfil);
    },
  };
}

function respuestaFalsa() {
  const r = {
    redirigido: null, estado: null, cuerpo: null, cookieLimpia: null, terminada: false,
    redirect(url) { this.redirigido = url; },
    status(codigo) { this.estado = codigo; return this; },
    json(cuerpo) { this.cuerpo = cuerpo; return this; },
    clearCookie(nombre) { this.cookieLimpia = nombre; },
    end() { this.terminada = true; },
  };
  return r;
}

const esperarTurno = () => new Promise((ok) => setImmediate(ok));

function crear({ passport = passportFalso(), servicio = {} } = {}) {
  const authService = {
    iniciarSesion: async () => null,
    existeCuenta: async () => false,
    registrarCliente: async () => usuarioDe('cliente'),
    registrarCierreSesion: async () => {},
    ...servicio,
  };
  return { controlador: new AuthController({ authService, passport }), passport, authService };
}

describe('AuthController', () => {
  test('iniciar y iniciarRegistro usan la estrategia correcta con los alcances de Google', () => {
    const { controlador, passport } = crear();
    controlador.iniciar();
    controlador.iniciarRegistro();
    assert.equal(passport.llamadas[0].nombre, 'google-login');
    assert.equal(passport.llamadas[1].nombre, 'google-registro');
    assert.deepEqual(passport.llamadas[0].opciones.scope, ['openid', 'profile', 'email']);
  });

  test('rutaInicio depende del perfil', () => {
    assert.equal(AuthController.rutaInicio(usuarioDe('cliente')), '/pages/cliente/inicio.html');
    assert.equal(AuthController.rutaInicio(usuarioDe('administrador')), '/pages/admin/inicio.html');
    assert.equal(AuthController.rutaInicio(usuarioDe('inventarios')), '/pages/inventarios/inicio.html');
  });

  describe('callbackLogin', () => {
    test('inicia la sesión y redirige a la pantalla del perfil', async () => {
      const usuario = usuarioDe('administrador');
      const { controlador } = crear({ servicio: { iniciarSesion: async () => usuario } });
      const res = respuestaFalsa();
      let iniciado = null;
      const req = { ip: '1.1.1.1', login: (u, cb) => { iniciado = u; cb(); } };
      controlador.callbackLogin(req, res, (e) => { throw e; });
      await esperarTurno();
      assert.equal(iniciado, usuario);
      assert.equal(res.redirigido, '/pages/admin/inicio.html');
    });

    test('sin cuenta redirige al inicio de sesión con el motivo', async () => {
      const { controlador } = crear();
      const res = respuestaFalsa();
      controlador.callbackLogin({ ip: '1.1.1.1', login: () => assert.fail('no debe iniciar sesión') }, res, () => {});
      await esperarTurno();
      assert.equal(res.redirigido, '/login.html?error=sin_cuenta');
    });

    test('cuenta deshabilitada', async () => {
      const { controlador } = crear({
        servicio: { iniciarSesion: async () => { throw new NoAutorizadoError('x', 'CUENTA_DESHABILITADA'); } },
      });
      const res = respuestaFalsa();
      controlador.callbackLogin({ ip: '1.1.1.1' }, res, () => {});
      await esperarTurno();
      assert.equal(res.redirigido, '/login.html?error=deshabilitada');
    });

    test('otro rechazo de autorización se informa como fallo de OAuth', async () => {
      const { controlador } = crear({
        servicio: { iniciarSesion: async () => { throw new NoAutorizadoError('x', 'OAUTH_VINCULADA'); } },
      });
      const res = respuestaFalsa();
      controlador.callbackLogin({ ip: '1.1.1.1' }, res, () => {});
      await esperarTurno();
      assert.equal(res.redirigido, '/login.html?error=oauth');
    });

    test('si Google falla o el usuario cancela redirige con error=oauth', async () => {
      const { controlador } = crear({ passport: passportFalso({ perfil: false }) });
      const res = respuestaFalsa();
      controlador.callbackLogin({}, res, () => {});
      await esperarTurno();
      assert.equal(res.redirigido, '/login.html?error=oauth');
    });

    test('los errores inesperados pasan al manejador de errores', async () => {
      const falla = new Error('se cayó');
      const { controlador } = crear({ servicio: { iniciarSesion: async () => { throw falla; } } });
      let recibido = null;
      controlador.callbackLogin({ ip: '1.1.1.1' }, respuestaFalsa(), (e) => { recibido = e; });
      await esperarTurno();
      assert.equal(recibido, falla);
    });
  });

  describe('callbackRegistro', () => {
    test('si ya existe una cuenta, ofrece iniciar sesión', async () => {
      const { controlador } = crear({ servicio: { existeCuenta: async () => true } });
      const res = respuestaFalsa();
      const req = { session: {} };
      controlador.callbackRegistro(req, res, () => {});
      await esperarTurno();
      assert.equal(res.redirigido, '/login.html?error=ya_registrado');
      assert.equal(req.session.oauthPendiente, undefined);
    });

    test('guarda la identidad verificada en la sesión y muestra el formulario', async () => {
      const { controlador } = crear();
      const res = respuestaFalsa();
      const req = { session: { save: (cb) => cb() } };
      controlador.callbackRegistro(req, res, () => {});
      await esperarTurno();
      assert.deepEqual(req.session.oauthPendiente, PERFIL);
      assert.equal(res.redirigido, '/registro.html');
    });
  });

  describe('pendiente y registrar', () => {
    test('pendiente sin identidad verificada lanza un error de autorización', () => {
      const { controlador } = crear();
      assert.throws(
        () => controlador.pendiente({ session: {} }, respuestaFalsa()),
        (e) => e instanceof NoAutorizadoError && e.codigo === 'SIN_IDENTIDAD',
      );
    });

    test('pendiente devuelve solo el correo y el nombre', () => {
      const { controlador } = crear();
      const res = respuestaFalsa();
      controlador.pendiente({ session: { oauthPendiente: PERFIL } }, res);
      assert.deepEqual(res.cuerpo, { correo: 'ana@correo.com', nombres: 'Ana' });
    });

    test('registrar crea la cuenta, inicia la sesión y responde 201', async () => {
      const usuario = usuarioDe('cliente');
      let datosRecibidos = null;
      const { controlador } = crear({
        servicio: { registrarCliente: async (perfil, datos) => { datosRecibidos = { perfil, datos }; return usuario; } },
      });
      const res = respuestaFalsa();
      let iniciado = null;
      const req = { ip: '1.1.1.1', body: { nombres: 'Ana' }, session: { oauthPendiente: PERFIL }, login: (u, cb) => { iniciado = u; cb(); } };
      await controlador.registrar(req, res);
      assert.equal(res.estado, 201);
      assert.equal(res.cuerpo.rutaInicio, '/pages/cliente/inicio.html');
      assert.equal(iniciado, usuario);
      assert.deepEqual(datosRecibidos, { perfil: PERFIL, datos: { nombres: 'Ana' } });
    });

    test('registrar sin identidad verificada se rechaza', async () => {
      const { controlador } = crear();
      await assert.rejects(() => controlador.registrar({ body: {}, session: {} }, respuestaFalsa()), NoAutorizadoError);
    });
  });

  describe('sesion, csrf y cerrar', () => {
    test('sesion sin usuario lanza NoAutenticadoError', () => {
      const { controlador } = crear();
      assert.throws(() => controlador.sesion({}, respuestaFalsa()), NoAutenticadoError);
    });

    test('sesion devuelve los datos del usuario sin identificadores de OAuth', () => {
      const { controlador } = crear();
      const res = respuestaFalsa();
      controlador.sesion({ user: usuarioDe('cliente') }, res);
      assert.equal(res.cuerpo.usuario.rol, 'cliente');
      assert.ok(!('oauthId' in res.cuerpo.usuario));
    });

    test('csrf devuelve un token y lo conserva en la sesión', () => {
      const { controlador } = crear();
      const req = { session: {} };
      const res = respuestaFalsa();
      controlador.csrf(req, res);
      assert.match(res.cuerpo.token, /^[0-9a-f]{64}$/);
      assert.equal(req.session.csrfToken, res.cuerpo.token);
    });

    test('cerrar registra el evento, destruye la sesión y limpia la cookie', async () => {
      let registrado = null;
      const { controlador } = crear({ servicio: { registrarCierreSesion: async (u, ip) => { registrado = [u.idUsuario, ip]; } } });
      const res = respuestaFalsa();
      let destruida = false;
      const req = { ip: '2.2.2.2', user: usuarioDe('cliente'), logout: (cb) => cb(), session: { destroy: (cb) => { destruida = true; cb(); } } };
      await controlador.cerrar(req, res);
      assert.deepEqual(registrado, [5, '2.2.2.2']);
      assert.ok(destruida);
      assert.equal(res.cookieLimpia, 'sid');
      assert.equal(res.estado, 204);
      assert.ok(res.terminada);
    });
  });
});
