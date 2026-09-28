'use strict';

const { NoEncontradoError, ValidacionError } = require('../errors/errores');
const { validarDireccion } = require('../utils/validaciones');

/** Direcciones de entrega del cliente (CU-12): alta, edición, baja y dirección principal. */
class DireccionService {
  constructor({ bd, direcciones, paises, bitacora }) {
    this.bd = bd;
    this.direcciones = direcciones;
    this.paises = paises;
    this.bitacora = bitacora;
  }

  async listar(idUsuario) {
    return this.direcciones.listarPorCliente(idUsuario);
  }

  async exigir(id, idUsuario, cx) {
    const direccion = await this.direcciones.buscarDeCliente(id, idUsuario, cx);
    if (!direccion) throw new NoEncontradoError('La dirección no existe.');
    return direccion;
  }

  async validar(datos) {
    const { errores, valores } = validarDireccion(datos);
    if (Object.keys(errores).length === 0) {
      const pais = await this.paises.buscarPorId(valores.idPais);
      if (!pais || !pais.activo) errores.idPais = 'El país seleccionado no existe o no está disponible.';
    }
    if (Object.keys(errores).length > 0) throw new ValidacionError(errores);
    return valores;
  }

  async crear(idUsuario, datos, usuario, ip = null) {
    const valores = await this.validar(datos);
    const esPrimera = (await this.direcciones.listarPorCliente(idUsuario)).length === 0;
    const principal = valores.esPrincipal || esPrimera;

    const id = await this.bd.transaccion(async (cx) => {
      if (principal) await this.direcciones.limpiarPrincipal(idUsuario, cx);
      return this.direcciones.crearDireccion(idUsuario, { ...valores, esPrincipal: principal }, cx);
    });
    await this.bitacora.registrar(usuario.idUsuario, 'direccion_crear', 'direcciones', id, null, ip);
    return this.direcciones.buscarDeCliente(id, idUsuario);
  }

  async actualizar(id, idUsuario, datos, usuario, ip = null) {
    await this.exigir(id, idUsuario);
    const valores = await this.validar(datos);
    await this.direcciones.actualizarDireccion(id, valores);
    await this.bitacora.registrar(usuario.idUsuario, 'direccion_actualizar', 'direcciones', id, null, ip);
    return this.direcciones.buscarDeCliente(id, idUsuario);
  }

  async eliminar(id, idUsuario, usuario, ip = null) {
    await this.exigir(id, idUsuario);
    await this.direcciones.desactivar(id);
    await this.bitacora.registrar(usuario.idUsuario, 'direccion_eliminar', 'direcciones', id, null, ip);
  }

  async establecerPrincipal(id, idUsuario, usuario, ip = null) {
    await this.exigir(id, idUsuario);
    await this.bd.transaccion(async (cx) => {
      await this.direcciones.limpiarPrincipal(idUsuario, cx);
      await this.direcciones.marcarPrincipal(id, cx);
    });
    await this.bitacora.registrar(usuario.idUsuario, 'direccion_principal', 'direcciones', id, null, ip);
    return this.direcciones.buscarDeCliente(id, idUsuario);
  }
}

module.exports = DireccionService;
