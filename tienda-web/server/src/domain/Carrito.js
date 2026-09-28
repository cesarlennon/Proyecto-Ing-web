'use strict';

/** Carrito de compras de un cliente (CU-16). */
class Carrito {
  constructor({ items = [] } = {}) {
    this.items = items;
  }

  estaVacio() {
    return this.items.length === 0;
  }

  total() {
    return Math.round(this.items.reduce((suma, item) => suma + item.subtotal(), 0) * 100) / 100;
  }

  paraJSON() {
    return { items: this.items.map((i) => i.paraJSON()), total: this.total() };
  }
}

module.exports = Carrito;
