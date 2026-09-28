'use strict';

/** Renglón del carrito: un producto y la cantidad deseada. */
class ItemCarrito {
  constructor({ producto, cantidad, fechaAgregado = null }) {
    this.producto = producto;
    this.cantidad = cantidad;
    this.fechaAgregado = fechaAgregado;
  }

  subtotal() {
    return Math.round(this.producto.precio * this.cantidad * 100) / 100;
  }

  paraJSON() {
    return {
      idProducto: this.producto.idProducto,
      nombre: this.producto.nombre,
      precio: this.producto.precio,
      imagen: this.producto.imagenes?.[0]?.paraJSON() ?? null,
      cantidad: this.cantidad,
      subtotal: this.subtotal(),
    };
  }
}

module.exports = ItemCarrito;
