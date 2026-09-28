'use strict';

const { ReglaNegocioError } = require('../errors/errores');

/**
 * Exige la confirmación explícita del usuario en las operaciones delicadas (RF-05, CU-04).
 * El navegador la envía como `confirmado: true` en el cuerpo o como `?confirmado=true` en la URL
 * (las peticiones DELETE no llevan cuerpo). La ventana de confirmación se muestra en el navegador;
 * esto evita que la operación se ejecute si alguien llama a la API sin pasar por ella.
 */
class ExigirConfirmacion {
  static exigir(req, res, next) {
    const confirmado = req.body?.confirmado === true || req.query?.confirmado === 'true';
    if (!confirmado) {
      return next(new ReglaNegocioError('Confirma la operación para continuar.', 'CONFIRMACION_REQUERIDA'));
    }
    return next();
  }
}

module.exports = ExigirConfirmacion;
