'use strict';

const express = require('express');
const ControlAcceso = require('../middleware/ControlAcceso');
const ExigirConfirmacion = require('../middleware/ExigirConfirmacion');
const { envolver } = require('../utils/envolver');

/** Rutas de un catálogo (categorías o países). Todos los perfiles consultan; solo el administrador modifica. */
function crearRutasCatalogo(controlador, catalogo) {
  const router = express.Router();
  const gestionar = ControlAcceso.requerirPermiso('catalogos:gestionar');

  router.use((req, res, next) => {
    req.catalogo = catalogo;
    next();
  });

  router.get('/', ControlAcceso.requerirSesion, envolver(controlador.listar));
  router.post('/', gestionar, envolver(controlador.crear));
  router.put('/:id', gestionar, envolver(controlador.actualizar));
  router.delete('/:id', gestionar, ExigirConfirmacion.exigir, envolver(controlador.eliminar));
  return router;
}

module.exports = { crearRutasCatalogo };
