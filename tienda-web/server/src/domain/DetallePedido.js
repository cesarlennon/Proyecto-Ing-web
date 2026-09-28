'use strict';

/** Renglón de un pedido, con el precio vigente al momento de la compra (RNF-19). */
class DetallePedido {
  constructor({ idDetalle = null, producto, nombreProducto = null, cantidad, precioUnitario }) {
    this.idDetalle = idDetalle;
    this.producto = producto;
    this.nombreProducto = nombreProducto ?? producto?.nombre ?? null;
    this.cantidad = cantidad;
    this.precioUnitario = precioUnitario;
  }

  subtotal() {
    return Math.round(this.precioUnitario * this.cantidad * 100) / 100;
  }

  paraJSON() {
    return {
      idProducto: this.producto?.idProducto ?? null,
      nombre: this.nombreProducto,
      cantidad: this.cantidad,
      precioUnitario: this.precioUnitario,
      subtotal: this.subtotal(),
    };
  }
}

module.exports = DetallePedido;
