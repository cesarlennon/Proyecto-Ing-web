'use strict';

const express = require('express');
const helmet = require('helmet');
const { NoEncontradoError } = require('./errors/errores');
const ProteccionCSRF = require('./middleware/ProteccionCSRF');
const ManejadorErrores = require('./middleware/ManejadorErrores');
const { opcionesHelmet } = require('./middleware/seguridad');
const { crearRutasAuth } = require('./routes/auth.routes');
const { crearRutasCatalogo } = require('./routes/catalogo.routes');
const { crearRutasProducto } = require('./routes/producto.routes');
const { crearRutasDirecciones, crearRutasMetodosPago } = require('./routes/cliente.routes');
const { crearRutasCarrito } = require('./routes/carrito.routes');
const { crearRutasPedido } = require('./routes/pedido.routes');
const { crearRutasUsuario } = require('./routes/usuario.routes');

/** Arma la aplicación de Express con todos sus middleware y rutas. */
function crearApp({ config, passport, sesion, controladores, limitadorAuth, subidaImagenes, logger }) {
  const app = express();

  if (config.produccion) app.set('trust proxy', 1); // detrás de Nginx

  app.use(helmet(opcionesHelmet(config)));
  app.use(express.json({ limit: '100kb' }));
  app.use(sesion);
  app.use(passport.initialize());
  app.use(passport.session());

  // API
  app.use('/api', ProteccionCSRF.middleware());
  app.use('/api/auth', crearRutasAuth(controladores.auth, { limitador: limitadorAuth }));
  app.use('/api/usuarios', crearRutasUsuario(controladores.usuario));
  app.use('/api/categorias', crearRutasCatalogo(controladores.catalogo, 'categorias'));
  app.use('/api/paises', crearRutasCatalogo(controladores.catalogo, 'paises'));
  app.use('/api/productos', crearRutasProducto(controladores.producto, { subida: subidaImagenes, resena: controladores.resena }));
  app.use('/api/mis-direcciones', crearRutasDirecciones(controladores.cliente));
  app.use('/api/mis-metodos-pago', crearRutasMetodosPago(controladores.cliente));
  app.use('/api/carrito', crearRutasCarrito(controladores.carrito));
  { const rutasPedido = crearRutasPedido(controladores.pedido);
    app.use('/api/mis-pedidos', rutasPedido.propio);
    app.use('/api/pedidos', rutasPedido.gestion); }
  app.use('/api', (req, res, next) => next(new NoEncontradoError('Recurso no encontrado.')));

  // Imágenes de los productos
  app.use('/imagenes', express.static(config.rutaImagenes, { dotfiles: 'deny', index: false, maxAge: '7d' }));

  // Sitio estático (HTML, CSS y JavaScript del cliente)
  app.use(express.static(config.rutaCliente, { index: 'index.html' }));
  app.use((req, res) => res.status(404).type('text/plain; charset=utf-8').send('Página no encontrada.'));

  app.use(ManejadorErrores.manejar(logger));
  return app;
}

module.exports = { crearApp };
