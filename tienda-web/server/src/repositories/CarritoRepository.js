'use strict';

const ItemCarrito = require('../domain/ItemCarrito');
const Producto = require('../domain/Producto');
const Categoria = require('../domain/Categoria');

/**
 * Repositorio del carrito. No hereda de BaseRepository porque su llave es compuesta
 * (id_usuario, id_producto) y sus operaciones son más específicas que un CRUD genérico.
 */
class CarritoRepository {
  constructor(bd) {
    this.bd = bd;
  }

  ejecutor(cx) {
    return cx ?? this.bd;
  }

  /** Carga el carrito con el precio y la categoría vigentes del producto. */
  async obtener(idUsuario, cx) {
    const filas = await this.ejecutor(cx).consultar(
      `SELECT ci.cantidad, ci.fecha_agregado, p.*, c.nombre AS categoria_nombre, c.activo AS categoria_activa
       FROM carrito_items ci
       JOIN productos p ON p.id_producto = ci.id_producto
       WHERE ci.id_usuario = ?
       ORDER BY ci.fecha_agregado`,
      [idUsuario],
    );
    return filas.map(
      (fila) =>
        new ItemCarrito({
          cantidad: fila.cantidad,
          fechaAgregado: fila.fecha_agregado,
          producto: new Producto({
            idProducto: fila.id_producto,
            nombre: fila.nombre,
            precio: Number(fila.precio),
            stock: fila.stock,
            activo: Boolean(fila.activo),
            idCategoria: fila.id_categoria,
            categoria: new Categoria({ idCategoria: fila.id_categoria, nombre: fila.categoria_nombre, activo: Boolean(fila.categoria_activa) }),
          }),
        }),
    );
  }

  async buscarItem(idUsuario, idProducto, cx) {
    const filas = await this.ejecutor(cx).consultar(
      'SELECT cantidad FROM carrito_items WHERE id_usuario = ? AND id_producto = ?',
      [idUsuario, idProducto],
    );
    return filas.length > 0 ? filas[0].cantidad : null;
  }

  /** Agrega el producto o, si ya estaba, suma la cantidad. */
  async agregar(idUsuario, idProducto, cantidad, cx) {
    await this.ejecutor(cx).consultar(
      `INSERT INTO carrito_items (id_usuario, id_producto, cantidad) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad)`,
      [idUsuario, idProducto, cantidad],
    );
  }

  async actualizarCantidad(idUsuario, idProducto, cantidad, cx) {
    const resultado = await this.ejecutor(cx).consultar(
      'UPDATE carrito_items SET cantidad = ? WHERE id_usuario = ? AND id_producto = ?',
      [cantidad, idUsuario, idProducto],
    );
    return resultado.affectedRows > 0;
  }

  async quitar(idUsuario, idProducto, cx) {
    const resultado = await this.ejecutor(cx).consultar(
      'DELETE FROM carrito_items WHERE id_usuario = ? AND id_producto = ?',
      [idUsuario, idProducto],
    );
    return resultado.affectedRows > 0;
  }

  async vaciar(idUsuario, cx) {
    await this.ejecutor(cx).consultar('DELETE FROM carrito_items WHERE id_usuario = ?', [idUsuario]);
  }
}

module.exports = CarritoRepository;
