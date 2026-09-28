'use strict';

const { idDeRuta } = require('../utils/parametros');

/** Controlador del carrito de compras (CU-16). */
class CarritoController {
  constructor({ carritoService }) {
    this.carritoService = carritoService;
    for (const metodo of ['obtener', 'agregar', 'actualizar', 'quitar']) this[metodo] = this[metodo].bind(this);
  }

  async obtener(req, res) {
    const carrito = await this.carritoService.obtener(req.user.idUsuario);
    res.json(carrito.paraJSON());
  }

  async agregar(req, res) {
    const carrito = await this.carritoService.agregar(req.user.idUsuario, idDeRuta(req.body?.idProducto), req.body?.cantidad);
    res.status(201).json(carrito.paraJSON());
  }

  async actualizar(req, res) {
    const carrito = await this.carritoService.actualizarCantidad(req.user.idUsuario, idDeRuta(req.params.idProducto), req.body?.cantidad);
    res.json(carrito.paraJSON());
  }

  async quitar(req, res) {
    const carrito = await this.carritoService.quitar(req.user.idUsuario, idDeRuta(req.params.idProducto));
    res.json(carrito.paraJSON());
  }
}

module.exports = CarritoController;
