'use strict';

const express = require('express');
const ControlAcceso = require('../middleware/ControlAcceso');
const ExigirConfirmacion = require('../middleware/ExigirConfirmacion');
const { envolver } = require('../utils/envolver');

/** Rutas de las direcciones del cliente, montadas en /api/mis-direcciones (CU-12). */
function crearRutasDirecciones(controlador) {
  const router = express.Router();
  const propio = ControlAcceso.requerirPermiso('cuenta:gestionar');

  router.get('/', propio, envolver(controlador.listarDirecciones));
  router.post('/', propio, envolver(controlador.crearDireccion));
  router.put('/:id', propio, envolver(controlador.actualizarDireccion));
  router.delete('/:id', propio, ExigirConfirmacion.exigir, envolver(controlador.eliminarDireccion));
  router.patch('/:id/principal', propio, envolver(controlador.principalDireccion));
  return router;
}

/** Rutas de los métodos de pago del cliente, montadas en /api/mis-metodos-pago (CU-13). */
function crearRutasMetodosPago(controlador) {
  const router = express.Router();
  const propio = ControlAcceso.requerirPermiso('cuenta:gestionar');

  router.get('/', propio, envolver(controlador.listarMetodosPago));
  router.post('/', propio, envolver(controlador.crearMetodoPago));
  router.put('/:id', propio, envolver(controlador.actualizarMetodoPago));
  router.delete('/:id', propio, ExigirConfirmacion.exigir, envolver(controlador.eliminarMetodoPago));
  router.patch('/:id/principal', propio, envolver(controlador.principalMetodoPago));
  return router;
}

module.exports = { crearRutasDirecciones, crearRutasMetodosPago };
