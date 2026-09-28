'use strict';

const express = require('express');
const ControlAcceso = require('../middleware/ControlAcceso');
const { envolver } = require('../utils/envolver');

/** Rutas de pedidos, montadas en /api/pedidos y /api/mis-pedidos. */
function crearRutasPedido(controlador) {
  const propio = express.Router();
  propio.post('/', ControlAcceso.requerirPermiso('pedidos:comprar'), envolver(controlador.comprar));
  propio.get('/', ControlAcceso.requerirPermiso('pedidos:propios'), envolver(controlador.misPedidos));
  propio.get('/:id', ControlAcceso.requerirPermiso('pedidos:propios'), envolver(controlador.detalle));

  const gestion = express.Router();
  gestion.get('/', ControlAcceso.requerirPermiso('pedidos:ventas_dia'), envolver(controlador.ventasDelDia));

  return { propio, gestion };
}

module.exports = { crearRutasPedido };
