'use strict';

const { NoAutenticadoError, NoAutorizadoError } = require('../errors/errores');

/**
 * Control de acceso (RF-04, RNF-07): se verifica en el servidor en cada ruta protegida;
 * ocultar opciones en la interfaz no es suficiente.
 */
class ControlAcceso {
  static requerirSesion(req, res, next) {
    if (typeof req.isAuthenticated === 'function' && req.isAuthenticated() && req.user) {
      return next();
    }
    return next(new NoAutenticadoError());
  }

  /** Permite el paso solo a los perfiles indicados (ejemplo: requerirRol('administrador')). */
  static requerirRol(...roles) {
    return (req, res, next) => {
      if (!req.user) return next(new NoAutenticadoError());
      if (!roles.includes(req.user.rol)) return next(new NoAutorizadoError());
      return next();
    };
  }

  /** Permite el paso a quien tenga el permiso indicado (ejemplo: requerirPermiso('productos:precio')). */
  static requerirPermiso(permiso) {
    return (req, res, next) => {
      if (!req.user) return next(new NoAutenticadoError());
      if (!req.user.puede(permiso)) return next(new NoAutorizadoError());
      return next();
    };
  }
}

module.exports = ControlAcceso;
