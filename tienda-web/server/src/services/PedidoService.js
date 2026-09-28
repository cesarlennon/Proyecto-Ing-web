'use strict';

const Pedido = require('../domain/Pedido');
const DetallePedido = require('../domain/DetallePedido');
const { ESTATUS } = require('../domain/EstatusPedido');
const CifradoServiceClase = require('./CifradoService');
const { NoEncontradoError, ReglaNegocioError } = require('../errors/errores');

/** Reglas de negocio de la compra y del seguimiento de pedidos (CU-17, CU-18, CU-24). */
class PedidoService {
  constructor({ bd, pedidos, carritoRepo, direcciones, metodosPago, inventario, pagos, bitacora }) {
    this.bd = bd;
    this.pedidos = pedidos;
    this.carritoRepo = carritoRepo;
    this.direcciones = direcciones;
    this.metodosPago = metodosPago;
    this.inventario = inventario;
    this.pagos = pagos;
    this.bitacora = bitacora;
  }

  /** Genera el pedido a partir del carrito, en una sola transacción (CU-17, RNF-19). */
  async realizarCompra(idUsuario, idDireccion, idMetodoPago, usuario, ip = null) {
    const items = await this.carritoRepo.obtener(idUsuario);
    if (items.length === 0) throw new ReglaNegocioError('Tu carrito está vacío.', 'CARRITO_VACIO');

    const direccion = await this.direcciones.buscarDeCliente(idDireccion, idUsuario);
    if (!direccion) throw new NoEncontradoError('La dirección seleccionada no existe.');
    const metodoPago = await this.metodosPago.buscarDeCliente(idMetodoPago, idUsuario);
    if (!metodoPago) throw new NoEncontradoError('El método de pago seleccionado no existe.');

    const pedido = await this.bd.transaccion(async (cx) => {
      const bloqueados = await this.inventario.validarExistencias(items, cx); // CU-26

      const detalles = items.map(
        (item) =>
          new DetallePedido({
            producto: bloqueados.get(item.producto.idProducto),
            cantidad: item.cantidad,
            precioUnitario: bloqueados.get(item.producto.idProducto).precio,
          }),
      );
      const total = detalles.reduce((suma, d) => suma + d.subtotal(), 0);

      const idPedido = await this.pedidos.crearPedido(
        {
          idUsuario,
          direccionEnvio: direccion.textoCompleto(),
          tarjetaUltimos4: metodoPago.ultimos4,
          total,
          detalles,
        },
        cx,
      );

      const resultado = await this.pagos.procesarPago(metodoPago, total); // CU-28
      if (!resultado.aprobado) throw new ReglaNegocioError('El pago fue rechazado. Intenta con otro método de pago.', 'PAGO_RECHAZADO');

      const nuevo = new Pedido({ idPedido, idUsuario, direccionEnvio: direccion.textoCompleto(), tarjetaUltimos4: metodoPago.ultimos4, total, estatus: ESTATUS.EN_PROCESO, detalles });
      nuevo.avanzarEstatus(ESTATUS.PAGADA);
      await this.pedidos.actualizarEstatus(idPedido, ESTATUS.PAGADA, cx);

      await this.inventario.descontar(items, cx);
      await this.carritoRepo.vaciar(idUsuario, cx);
      return idPedido;
    });

    await this.bitacora.registrar(usuario.idUsuario, 'pedido_compra', 'pedidos', pedido, null, ip);
    return this.detalle(pedido, idUsuario);
  }

  async misPedidos(idUsuario) {
    return this.pedidos.listarPorCliente(idUsuario);
  }

  async detalle(idPedido, idUsuario) {
    const pedido = await this.pedidos.buscarConDetalle(idPedido);
    if (!pedido || pedido.idUsuario !== idUsuario) throw new NoEncontradoError('El pedido no existe.');
    return pedido;
  }

  async ventasDelDia(fechaISO) {
    return this.pedidos.listarPorFecha(fechaISO);
  }
}

module.exports = PedidoService;
