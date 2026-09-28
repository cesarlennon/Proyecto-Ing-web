'use strict';

const Pedido = require('../domain/Pedido');
const DetallePedido = require('../domain/DetallePedido');
const Producto = require('../domain/Producto');
const { estatusPorId, IDS_ESTATUS } = require('../domain/EstatusPedido');

const SELECT_PEDIDO = 'SELECT p.*, e.nombre AS estatus_nombre FROM pedidos p JOIN estatus_pedido e ON e.id_estatus = p.id_estatus';

/** Repositorio de pedidos. La llave de negocio son los productos comprados, no una tabla simple. */
class PedidoRepository {
  constructor(bd) {
    this.bd = bd;
  }

  ejecutor(cx) {
    return cx ?? this.bd;
  }

  mapearPedido(fila) {
    return new Pedido({
      idPedido: fila.id_pedido,
      idUsuario: fila.id_usuario,
      direccionEnvio: fila.direccion_envio,
      tarjetaUltimos4: fila.tarjeta_ultimos4,
      total: Number(fila.total),
      estatus: fila.estatus_nombre ?? estatusPorId(fila.id_estatus),
      fechaPedido: fila.fecha_pedido,
      fechaPago: fila.fecha_pago,
      fechaEnvio: fila.fecha_envio,
      fechaRecepcion: fila.fecha_recepcion,
    });
  }

  mapearDetalle(fila) {
    return new DetallePedido({
      idDetalle: fila.id_detalle,
      producto: new Producto({ idProducto: fila.id_producto, nombre: fila.nombre_producto }),
      nombreProducto: fila.nombre_producto,
      cantidad: fila.cantidad,
      precioUnitario: Number(fila.precio_unitario),
    });
  }

  async listarDetalles(idPedido, cx) {
    const filas = await this.ejecutor(cx).consultar(
      `SELECT d.*, p.nombre AS nombre_producto
       FROM pedido_detalle d JOIN productos p ON p.id_producto = d.id_producto
       WHERE d.id_pedido = ?`,
      [idPedido],
    );
    return filas.map((f) => this.mapearDetalle(f));
  }

  async listarPorCliente(idUsuario, cx) {
    const filas = await this.ejecutor(cx).consultar(`${SELECT_PEDIDO} WHERE p.id_usuario = ? ORDER BY p.fecha_pedido DESC`, [idUsuario]);
    return filas.map((f) => this.mapearPedido(f));
  }

  async buscarConDetalle(idPedido, cx) {
    const filas = await this.ejecutor(cx).consultar(`${SELECT_PEDIDO} WHERE p.id_pedido = ?`, [idPedido]);
    if (filas.length === 0) return null;
    const pedido = this.mapearPedido(filas[0]);
    pedido.detalles = await this.listarDetalles(idPedido, cx);
    return pedido;
  }

  async listarPorFecha(fechaISO, cx) {
    const filas = await this.ejecutor(cx).consultar(
      `${SELECT_PEDIDO} WHERE DATE(p.fecha_pedido) = ? ORDER BY p.fecha_pedido DESC`,
      [fechaISO],
    );
    return filas.map((f) => this.mapearPedido(f));
  }

  /** Comprueba que el cliente tenga un pedido «Recibido» que incluya el producto (CU-27). */
  async existeCompraRecibida(idUsuario, idProducto, cx) {
    const filas = await this.ejecutor(cx).consultar(
      `SELECT 1 FROM pedidos p
       JOIN pedido_detalle d ON d.id_pedido = p.id_pedido
       WHERE p.id_usuario = ? AND d.id_producto = ? AND p.id_estatus = ?
       LIMIT 1`,
      [idUsuario, idProducto, IDS_ESTATUS.Recibido],
    );
    return filas.length > 0;
  }

  async crearPedido({ idUsuario, direccionEnvio, tarjetaUltimos4, total, detalles }, cx) {
    const resultado = await this.ejecutor(cx).consultar(
      `INSERT INTO pedidos (id_usuario, direccion_envio, tarjeta_ultimos4, total, id_estatus)
       VALUES (?, ?, ?, ?, ?)`,
      [idUsuario, direccionEnvio, tarjetaUltimos4, total, IDS_ESTATUS['En proceso']],
    );
    const idPedido = resultado.insertId;
    for (const detalle of detalles) {
      await this.ejecutor(cx).consultar(
        'INSERT INTO pedido_detalle (id_pedido, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
        [idPedido, detalle.producto.idProducto, detalle.cantidad, detalle.precioUnitario],
      );
    }
    return idPedido;
  }

  /** Actualiza el estatus y, según cuál sea, la fecha correspondiente. */
  async actualizarEstatus(idPedido, estatus, cx) {
    const columnaFecha = { Pagada: 'fecha_pago', Enviado: 'fecha_envio', Recibido: 'fecha_recepcion' }[estatus];
    const asignacionFecha = columnaFecha ? `, ${columnaFecha} = CURRENT_TIMESTAMP` : '';
    await this.ejecutor(cx).consultar(
      `UPDATE pedidos SET id_estatus = ?${asignacionFecha} WHERE id_pedido = ?`,
      [IDS_ESTATUS[estatus], idPedido],
    );
  }
}

module.exports = PedidoRepository;
