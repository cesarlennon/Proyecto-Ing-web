'use strict';

const express = require('express');
const ControlAcceso = require('../middleware/ControlAcceso');
const ExigirConfirmacion = require('../middleware/ExigirConfirmacion');
const { envolver } = require('../utils/envolver');

/** Rutas de usuarios, montadas en /api/usuarios (CU-05). */
function crearRutasUsuario(controlador) {
  const router = express.Router();
  const gestionar = ControlAcceso.requerirPermiso('usuarios:gestionar');

  router.get('/', gestionar, envolver(controlador.listar));
  router.post('/', gestionar, envolver(controlador.crear));
  router.put('/:id', gestionar, envolver(controlador.actualizar));
  router.patch('/:id/estado', gestionar, ExigirConfirmacion.exigir, envolver(controlador.cambiarEstado));

  return router;
}

module.exports = { crearRutasUsuario };
