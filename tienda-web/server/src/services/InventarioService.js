'use strict';

const { ExistenciasInsuficientesError } = require('../errors/errores');

/** Valida y descuenta existencias al generar un pedido (CU-26). Siempre se usa dentro de una transacción. */
class InventarioService {
  constructor({ productos }) {
    this.productos = productos;
  }

  /**
   * Bloquea las filas de los productos del carrito (FOR UPDATE) y comprueba que alcance el stock.
   * Devuelve los productos bloqueados, en el mismo orden que `items`, para que el pedido use su
   * precio vigente sin volver a consultarlos.
   */
  async validarExistencias(items, cx) {
    const ids = items.map((i) => i.producto.idProducto);
    const bloqueados = await this.productos.bloquearParaCompra(ids, cx);
    const porId = new Map(bloqueados.map((p) => [p.idProducto, p]));

    for (const item of items) {
      const actual = porId.get(item.producto.idProducto);
      if (!actual || !actual.activo || !actual.hayExistencias(item.cantidad)) {
        throw new ExistenciasInsuficientesError();
      }
    }
    return porId;
  }

  async descontar(items, cx) {
    for (const item of items) {
      await this.productos.descontarStockEnBD(item.producto.idProducto, item.cantidad, cx);
    }
  }
}

module.exports = InventarioService;
