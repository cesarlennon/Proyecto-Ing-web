'use strict';

const Calificacion = require('../domain/Calificacion');
const { NoAutorizadoError, NoEncontradoError, ValidacionError } = require('../errors/errores');
const { validarEstrellas } = require('../utils/validaciones');

/** Calificaciones de producto (CU-19). Solo puede calificar quien ya recibió el producto (CU-27). */
class CalificacionService {
  constructor({ calificaciones, productos, pedidos, bitacora }) {
    this.calificaciones = calificaciones;
    this.productos = productos;
    this.pedidos = pedidos;
    this.bitacora = bitacora;
  }

  async calificar(idProducto, idCliente, estrellas, usuario, ip = null) {
    const mensaje = validarEstrellas(estrellas);
    if (mensaje) throw new ValidacionError({ estrellas: mensaje }, mensaje);
    const valor = Number(estrellas);

    if (!(await this.productos.buscarPorId(idProducto))) throw new NoEncontradoError('El producto no existe.');
    if (!(await this.pedidos.existeCompraRecibida(idCliente, idProducto))) {
      throw new NoAutorizadoError('Solo puedes calificar productos que ya hayas recibido.', 'SIN_COMPRA_RECIBIDA');
    }

    // La instancia valida su propia regla (0 a 5) antes de guardar, aunque validarEstrellas ya la cubrió.
    new Calificacion({ idProducto, idUsuario: idCliente, estrellas: valor }).exigirValida();

    const calificacion = await this.calificaciones.guardar(idProducto, idCliente, valor);
    await this.bitacora.registrar(usuario.idUsuario, 'producto_calificar', 'productos', idProducto, `estrellas=${valor}`, ip);
    return calificacion;
  }

  /** Además de la calificación propia, indica si el cliente puede calificar (ya recibió el producto). */
  async miCalificacion(idProducto, idCliente) {
    const [calificacion, puedeCalificar] = await Promise.all([
      this.calificaciones.buscarDeCliente(idProducto, idCliente),
      this.pedidos.existeCompraRecibida(idCliente, idProducto),
    ]);
    return { calificacion, puedeCalificar };
  }
}

module.exports = CalificacionService;
