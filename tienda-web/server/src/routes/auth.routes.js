'use strict';

const express = require('express');
const ControlAcceso = require('../middleware/ControlAcceso');
const { envolver } = require('../utils/envolver');

/** Rutas de autenticación, montadas en /api/auth. */
function crearRutasAuth(controlador, { limitador }) {
  const router = express.Router();

  router.get('/csrf', controlador.csrf);
  router.get('/sesion', controlador.sesion);
  router.post('/logout', ControlAcceso.requerirSesion, envolver(controlador.cerrar));

  // OAuth: inicio de sesión
  router.get('/google', limitador, controlador.iniciar());
  router.get('/google/callback', limitador, controlador.callbackLogin);

  // OAuth: registro de clientes
  router.get('/google/registro', limitador, controlador.iniciarRegistro());
  router.get('/google/registro/callback', limitador, controlador.callbackRegistro);
  router.get('/registro/pendiente', controlador.pendiente);
  router.post('/registro', limitador, envolver(controlador.registrar));

  return router;
}

module.exports = { crearRutasAuth };
