'use strict';

const crypto = require('node:crypto');
const { NoAutorizadoError } = require('../errors/errores');

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protección CSRF por token (RNF-05). El token se guarda en la sesión y el navegador debe
 * enviarlo en el encabezado X-CSRF-Token en toda petición que modifique datos.
 */
class ProteccionCSRF {
  static generarToken(req) {
    if (!req.session) throw new Error('La protección CSRF requiere sesiones.');
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    return req.session.csrfToken;
  }

  static verificar(req) {
    const esperado = req.session?.csrfToken;
    const recibido = req.get('x-csrf-token');
    if (!esperado || typeof recibido !== 'string') return false;
    const a = Buffer.from(esperado);
    const b = Buffer.from(recibido);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  static middleware() {
    return (req, res, next) => {
      if (METODOS_SEGUROS.has(req.method)) return next();
      if (!ProteccionCSRF.verificar(req)) {
        return next(
          new NoAutorizadoError('No se pudo verificar la solicitud. Recarga la página e inténtalo de nuevo.', 'CSRF_INVALIDO'),
        );
      }
      return next();
    };
  }
}

module.exports = ProteccionCSRF;
