'use strict';

/** Express 4 no captura los errores de funciones asíncronas; esta función los envía a next(). */
function envolver(manejador) {
  return (req, res, next) => Promise.resolve(manejador(req, res, next)).catch(next);
}

module.exports = { envolver };
