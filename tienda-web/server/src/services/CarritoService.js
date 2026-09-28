'use strict';

const Carrito = require('../domain/Carrito');
const { NoEncontradoError, ValidacionError } = require('../errors/errores');

function validarCantidad(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    const mensaje = 'La cantidad debe ser un número entero mayor que cero.';
    throw new ValidacionError({ cantidad: mensaje }, mensaje);
  }
  return n;
}

/** Carrito de compras del cliente (CU-16). La existencia de stock se valida hasta comprar (CU-17). */
class CarritoService {
  constructor({ carrito, productos }) {
    this.carritoRepo = carrito;
    this.productos = productos;
  }

  async obtener(idUsuario) {
    return new Carrito({ items: await this.carritoRepo.obtener(idUsuario) });
  }

  async agregar(idUsuario, idProducto, cantidad) {
    const n = validarCantidad(cantidad);
    const producto = await this.productos.buscarPorId(idProducto);
    if (!producto || !producto.activo) throw new NoEncontradoError('El producto no existe.');
    await this.carritoRepo.agregar(idUsuario, idProducto, n);
    return this.obtener(idUsuario);
  }

  async actualizarCantidad(idUsuario, idProducto, cantidad) {
    const n = validarCantidad(cantidad);
    const actualizado = await this.carritoRepo.actualizarCantidad(idUsuario, idProducto, n);
    if (!actualizado) throw new NoEncontradoError('El producto no está en tu carrito.');
    return this.obtener(idUsuario);
  }

  async quitar(idUsuario, idProducto) {
    const quitado = await this.carritoRepo.quitar(idUsuario, idProducto);
    if (!quitado) throw new NoEncontradoError('El producto no está en tu carrito.');
    return this.obtener(idUsuario);
  }
}

module.exports = CarritoService;
