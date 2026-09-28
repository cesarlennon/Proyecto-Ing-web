'use strict';

const Recomendacion = require('../domain/Recomendacion');
const { NoAutorizadoError, NoEncontradoError, ValidacionError } = require('../errors/errores');
const { validarTextoRecomendacion, limpiar } = require('../utils/validaciones');

/** Recomendaciones (comentarios) de producto (CU-20). Solo puede escribir quien ya lo recibió (CU-27). */
class RecomendacionService {
  constructor({ recomendaciones, productos, pedidos, bitacora }) {
    this.recomendaciones = recomendaciones;
    this.productos = productos;
    this.pedidos = pedidos;
    this.bitacora = bitacora;
  }

  async listar(idProducto) {
    if (!(await this.productos.buscarPorId(idProducto))) throw new NoEncontradoError('El producto no existe.');
    return this.recomendaciones.listarPorProducto(idProducto);
  }

  async recomendar(idProducto, idCliente, texto, usuario, ip = null) {
    const mensaje = validarTextoRecomendacion(texto);
    if (mensaje) throw new ValidacionError({ texto: mensaje }, mensaje);
    const valor = limpiar(texto);

    if (!(await this.productos.buscarPorId(idProducto))) throw new NoEncontradoError('El producto no existe.');
    if (!(await this.pedidos.existeCompraRecibida(idCliente, idProducto))) {
      throw new NoAutorizadoError('Solo puedes recomendar productos que ya hayas recibido.', 'SIN_COMPRA_RECIBIDA');
    }

    // La instancia valida su propia regla (texto no vacío, máximo 500 caracteres) antes de guardar.
    new Recomendacion({ idProducto, idUsuario: idCliente, texto: valor }).exigirValida();

    const recomendacion = await this.recomendaciones.crear(idProducto, idCliente, valor);
    recomendacion.autor = usuario.nombreCompleto();
    await this.bitacora.registrar(usuario.idUsuario, 'producto_recomendar', 'productos', idProducto, null, ip);
    return recomendacion;
  }
}

module.exports = RecomendacionService;
