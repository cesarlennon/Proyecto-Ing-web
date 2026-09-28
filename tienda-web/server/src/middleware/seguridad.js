'use strict';

const rateLimit = require('express-rate-limit');
const { LimiteExcedidoError } = require('../errors/errores');

/** Cabeceras de seguridad con helmet y una política de contenido estricta (RNF-04). */
function opcionesHelmet(configuracion) {
  return {
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        // En desarrollo se usa http://localhost, que no admite esta directiva.
        'upgrade-insecure-requests': configuracion.produccion ? [] : null,
      },
    },
  };
}

/** Limita los intentos de inicio de sesión y de registro por dirección IP (RNF-12). */
function crearLimitadorAuth() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res, next) => next(new LimiteExcedidoError()),
  });
}

module.exports = { opcionesHelmet, crearLimitadorAuth };
