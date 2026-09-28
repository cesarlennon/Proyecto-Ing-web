'use strict';

const { NoAutenticadoError, NoAutorizadoError } = require('../errors/errores');
const ProteccionCSRF = require('../middleware/ProteccionCSRF');

const RUTAS_INICIO = {
  administrador: '/pages/admin/inicio.html',
  cliente: '/pages/cliente/inicio.html',
  inventarios: '/pages/inventarios/inicio.html',
};
const ALCANCE = ['openid', 'profile', 'email'];

const conPromesa = (fn) => new Promise((ok, fallo) => fn((error) => (error ? fallo(error) : ok())));

/** Controlador de acceso: recibe las peticiones HTTP y delega las reglas en AuthService. */
class AuthController {
  constructor({ authService, passport, nombreCookie = 'sid' }) {
    this.authService = authService;
    this.passport = passport;
    this.nombreCookie = nombreCookie;
    for (const metodo of ['callbackLogin', 'callbackRegistro', 'pendiente', 'registrar', 'sesion', 'csrf', 'cerrar']) {
      this[metodo] = this[metodo].bind(this);
    }
  }

  static rutaInicio(usuario) {
    return RUTAS_INICIO[usuario.rol] ?? '/';
  }

  /** Redirige a Google para iniciar sesión (CU-02). */
  iniciar() {
    return this.passport.authenticate('google-login', { scope: ALCANCE, prompt: 'select_account' });
  }

  /** Redirige a Google para verificar la identidad de quien se registra (CU-11). */
  iniciarRegistro() {
    return this.passport.authenticate('google-registro', { scope: ALCANCE, prompt: 'select_account' });
  }

  callbackLogin(req, res, next) {
    this.passport.authenticate('google-login', { session: false }, async (error, perfil) => {
      if (error || !perfil) return res.redirect('/login.html?error=oauth');
      try {
        const usuario = await this.authService.iniciarSesion(perfil, req.ip);
        if (!usuario) return res.redirect('/login.html?error=sin_cuenta');
        return req.login(usuario, (fallo) => (fallo ? next(fallo) : res.redirect(AuthController.rutaInicio(usuario))));
      } catch (e) {
        if (e instanceof NoAutorizadoError) {
          const motivo = e.codigo === 'CUENTA_DESHABILITADA' ? 'deshabilitada' : 'oauth';
          return res.redirect(`/login.html?error=${motivo}`);
        }
        return next(e);
      }
    })(req, res, next);
  }

  callbackRegistro(req, res, next) {
    this.passport.authenticate('google-registro', { session: false }, async (error, perfil) => {
      if (error || !perfil) return res.redirect('/login.html?error=oauth');
      try {
        if (await this.authService.existeCuenta(perfil)) return res.redirect('/login.html?error=ya_registrado');
        req.session.oauthPendiente = perfil;
        return req.session.save((fallo) => (fallo ? next(fallo) : res.redirect('/registro.html')));
      } catch (e) {
        return next(e);
      }
    })(req, res, next);
  }

  /** Datos de la identidad verificada, para prellenar el formulario de registro. */
  pendiente(req, res) {
    const perfil = req.session?.oauthPendiente;
    if (!perfil) {
      throw new NoAutorizadoError('Primero verifica tu identidad con Google.', 'SIN_IDENTIDAD');
    }
    res.json({ correo: perfil.correo, nombres: perfil.nombres });
  }

  async registrar(req, res) {
    const perfil = req.session?.oauthPendiente;
    if (!perfil) {
      throw new NoAutorizadoError('Primero verifica tu identidad con Google.', 'SIN_IDENTIDAD');
    }
    const usuario = await this.authService.registrarCliente(perfil, req.body ?? {}, req.ip);
    await conPromesa((cb) => req.login(usuario, cb));
    res.status(201).json({ mensaje: 'Tu cuenta fue creada.', rutaInicio: AuthController.rutaInicio(usuario) });
  }

  sesion(req, res) {
    if (!req.user) throw new NoAutenticadoError();
    res.json({ usuario: req.user.paraSesion() });
  }

  csrf(req, res) {
    res.json({ token: ProteccionCSRF.generarToken(req) });
  }

  async cerrar(req, res) {
    await this.authService.registrarCierreSesion(req.user, req.ip);
    await conPromesa((cb) => req.logout(cb));
    await new Promise((ok) => req.session.destroy(() => ok()));
    res.clearCookie(this.nombreCookie);
    res.status(204).end();
  }
}

module.exports = AuthController;
