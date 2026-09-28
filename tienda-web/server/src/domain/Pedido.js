'use strict';

const { ESTATUS, siguienteEstatus } = require('./EstatusPedido');
const { ReglaNegocioError } = require('../errors/errores');

/** Pedido generado por un cliente (CU-17, CU-18). Controla el avance de su propio estatus. */
class Pedido {
  constructor({
    idPedido,
    idUsuario,
    direccionEnvio,
    tarjetaUltimos4,
    total,
    estatus,
    fechaPedido = null,
    fechaPago = null,
    fechaEnvio = null,
    fechaRecepcion = null,
    detalles = [],
  }) {
    this.idPedido = idPedido;
    this.idUsuario = idUsuario;
    this.direccionEnvio = direccionEnvio;
    this.tarjetaUltimos4 = tarjetaUltimos4;
    this.total = total;
    this.estatus = estatus;
    this.fechaPedido = fechaPedido;
    this.fechaPago = fechaPago;
    this.fechaEnvio = fechaEnvio;
    this.fechaRecepcion = fechaRecepcion;
    this.detalles = detalles;
  }

  calcularTotal() {
    return Math.round(this.detalles.reduce((suma, d) => suma + d.subtotal(), 0) * 100) / 100;
  }

  contieneProducto(idProducto) {
    return this.detalles.some((d) => d.producto?.idProducto === idProducto);
  }

  estaRecibido() {
    return this.estatus === ESTATUS.RECIBIDO;
  }

  /** Avanza al siguiente estatus del flujo. Lanza un error si `nuevo` no es el que sigue. */
  avanzarEstatus(nuevo) {
    const siguiente = siguienteEstatus(this.estatus);
    if (nuevo !== siguiente) {
      throw new ReglaNegocioError(
        siguiente
          ? `El pedido solo puede pasar de «${this.estatus}» a «${siguiente}».`
          : `El pedido ya está en el último estatus (${this.estatus}).`,
        'ESTATUS_INVALIDO',
      );
    }
    this.estatus = nuevo;
  }

  paraJSON() {
    return {
      idPedido: this.idPedido,
      fechaPedido: this.fechaPedido,
      total: this.total,
      estatus: this.estatus,
      direccionEnvio: this.direccionEnvio,
      tarjetaUltimos4: this.tarjetaUltimos4,
      fechaPago: this.fechaPago,
      fechaEnvio: this.fechaEnvio,
      fechaRecepcion: this.fechaRecepcion,
      detalles: this.detalles.map((d) => d.paraJSON()),
    };
  }
}

module.exports = Pedido;
