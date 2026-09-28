'use strict';

const express = require('express');
const ControlAcceso = require('../middleware/ControlAcceso');
const ExigirConfirmacion = require('../middleware/ExigirConfirmacion');
const { envolver } = require('../utils/envolver');

/** Rutas de productos, montadas en /api/productos. */
function crearRutasProducto(controlador, { subida, resena }) {
  const router = express.Router();
  const puede = ControlAcceso.requerirPermiso;

  router.get('/', puede('productos:consultar'), envolver(controlador.listar));
  router.post('/', puede('productos:gestionar'), envolver(controlador.crear));

  router.get('/:id', puede('productos:consultar'), envolver(controlador.obtener));
  router.put('/:id', puede('productos:gestionar'), envolver(controlador.actualizar));
  router.delete('/:id', puede('productos:gestionar'), ExigirConfirmacion.exigir, envolver(controlador.eliminar));

  router.patch('/:id/precio', puede('productos:precio'), ExigirConfirmacion.exigir, envolver(controlador.cambiarPrecio));
  router.patch('/:id/stock', puede('productos:stock'), ExigirConfirmacion.exigir, envolver(controlador.cambiarStock));
  router.patch('/:id/entrega', puede('productos:gestionar'), envolver(controlador.definirEntrega));

  router.post('/:id/imagenes', puede('productos:imagenes'), subida, envolver(controlador.agregarImagenes));
  router.delete(
    '/:id/imagenes/:idImagen',
    puede('productos:imagenes'),
    ExigirConfirmacion.exigir,
    envolver(controlador.eliminarImagen),
  );

  // Calificaciones y recomendaciones (CU-19, CU-20)
  router.put('/:id/calificacion', puede('productos:calificar'), envolver(resena.calificar));
  router.get('/:id/calificacion', puede('productos:calificar'), envolver(resena.miCalificacion));
  router.get('/:id/recomendaciones', puede('productos:consultar'), envolver(resena.listarRecomendaciones));
  router.post('/:id/recomendaciones', puede('productos:calificar'), envolver(resena.recomendar));

  return router;
}

module.exports = { crearRutasProducto };
