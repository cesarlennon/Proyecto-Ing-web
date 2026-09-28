'use strict';

const { NoEncontradoError, ValidacionError } = require('../errors/errores');
const { validarMetodoPago } = require('../utils/validaciones');
const CifradoServiceClase = require('./CifradoService');

/**
 * Métodos de pago del cliente (CU-13). El número de tarjeta se cifra antes de guardarse y el
 * CVV nunca llega aquí desde el formulario de guardado: solo se usa al confirmar una compra.
 */
class MetodoPagoService {
  constructor({ bd, metodosPago, cifrado, bitacora }) {
    this.bd = bd;
    this.metodosPago = metodosPago;
    this.cifrado = cifrado;
    this.bitacora = bitacora;
  }

  async listar(idUsuario) {
    return this.metodosPago.listarPorCliente(idUsuario);
  }

  async exigir(id, idUsuario, cx) {
    const metodo = await this.metodosPago.buscarDeCliente(id, idUsuario, cx);
    if (!metodo) throw new NoEncontradoError('El método de pago no existe.');
    return metodo;
  }

  validar(datos) {
    const { errores, valores } = validarMetodoPago(datos);
    if (Object.keys(errores).length > 0) throw new ValidacionError(errores);
    return valores;
  }

  async crear(idUsuario, datos, usuario, ip = null) {
    const valores = this.validar(datos);
    const esPrimero = (await this.metodosPago.listarPorCliente(idUsuario)).length === 0;
    const principal = valores.esPrincipal || esPrimero;
    const numeroCifrado = this.cifrado.cifrar(valores.numero);
    const ultimos4 = CifradoServiceClase.ultimos4(valores.numero);

    const id = await this.bd.transaccion(async (cx) => {
      if (principal) await this.metodosPago.limpiarPrincipal(idUsuario, cx);
      return this.metodosPago.crearMetodo(
        idUsuario,
        { titular: valores.titular, numeroCifrado, ultimos4, mesVencimiento: valores.mesVencimiento, anioVencimiento: valores.anioVencimiento, esPrincipal: principal },
        cx,
      );
    });
    await this.bitacora.registrar(usuario.idUsuario, 'metodo_pago_crear', 'metodos_pago', id, null, ip);
    return this.metodosPago.buscarDeCliente(id, idUsuario);
  }

  async actualizar(id, idUsuario, datos, usuario, ip = null) {
    await this.exigir(id, idUsuario);
    const valores = this.validar(datos);
    const numeroCifrado = this.cifrado.cifrar(valores.numero);
    const ultimos4 = CifradoServiceClase.ultimos4(valores.numero);
    await this.metodosPago.actualizarMetodo(id, {
      titular: valores.titular, numeroCifrado, ultimos4, mesVencimiento: valores.mesVencimiento, anioVencimiento: valores.anioVencimiento,
    });
    await this.bitacora.registrar(usuario.idUsuario, 'metodo_pago_actualizar', 'metodos_pago', id, null, ip);
    return this.metodosPago.buscarDeCliente(id, idUsuario);
  }

  async eliminar(id, idUsuario, usuario, ip = null) {
    await this.exigir(id, idUsuario);
    await this.metodosPago.desactivar(id);
    await this.bitacora.registrar(usuario.idUsuario, 'metodo_pago_eliminar', 'metodos_pago', id, null, ip);
  }

  async establecerPrincipal(id, idUsuario, usuario, ip = null) {
    await this.exigir(id, idUsuario);
    await this.bd.transaccion(async (cx) => {
      await this.metodosPago.limpiarPrincipal(idUsuario, cx);
      await this.metodosPago.marcarPrincipal(id, cx);
    });
    await this.bitacora.registrar(usuario.idUsuario, 'metodo_pago_principal', 'metodos_pago', id, null, ip);
    return this.metodosPago.buscarDeCliente(id, idUsuario);
  }
}

module.exports = MetodoPagoService;
