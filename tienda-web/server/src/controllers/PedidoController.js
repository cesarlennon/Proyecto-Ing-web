'use strict';

const { idDeRuta } = require('../utils/parametros');
const { ReglaNegocioError } = require('../errors/errores');

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Controlador de pedidos (CU-17, CU-18, CU-24). */
class PedidoController {
  constructor({ pedidoService }) {
    this.pedidoService = pedidoService;
    for (const metodo of ['comprar', 'misPedidos', 'detalle', 'ventasDelDia']) this[metodo] = this[metodo].bind(this);
  }

  async comprar(req, res) {
    const pedido = await this.pedidoService.realizarCompra(
      req.user.idUsuario,
      idDeRuta(req.body?.idDireccion),
      idDeRuta(req.body?.idMetodoPago),
      req.user,
      req.ip,
    );
    res.status(201).json({ pedido: pedido.paraJSON() });
  }

  async misPedidos(req, res) {
    const pedidos = await this.pedidoService.misPedidos(req.user.idUsuario);
    res.json({ pedidos: pedidos.map((p) => p.paraJSON()) });
  }

  async detalle(req, res) {
    const pedido = await this.pedidoService.detalle(idDeRuta(req.params.id), req.user.idUsuario);
    res.json({ pedido: pedido.paraJSON() });
  }

  async ventasDelDia(req, res) {
    const fecha = req.query.fecha;
    if (!RE_FECHA.test(String(fecha))) throw new ReglaNegocioError('Indica la fecha en formato AAAA-MM-DD.', 'FECHA_INVALIDA');
    const pedidos = await this.pedidoService.ventasDelDia(fecha);
    res.json({ pedidos: pedidos.map((p) => p.paraJSON()) });
  }
}

module.exports = PedidoController;
