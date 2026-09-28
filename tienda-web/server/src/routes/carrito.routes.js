'use strict';

const express = require('express');
const ControlAcceso = require('../middleware/ControlAcceso');
const ExigirConfirmacion = require('../middleware/ExigirConfirmacion');
const { envolver } = require('../utils/envolver');

/** Rutas del carrito de compras, montadas en /api/carrito. */
function crearRutasCarrito(controlador) {
  const router = express.Router();
  const propio = ControlAcceso.requerirPermiso('carrito:gestionar');

  router.get('/', propio, envolver(controlador.obtener));
  router.post('/', propio, envolver(controlador.agregar));
  router.put('/:idProducto', propio, envolver(controlador.actualizar));
  router.delete('/:idProducto', propio, ExigirConfirmacion.exigir, envolver(controlador.quitar));

  return router;
}

module.exports = { crearRutasCarrito };
