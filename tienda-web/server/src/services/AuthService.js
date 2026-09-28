'use strict';

const { ROLES } = require('../domain/Rol');
const { NoAutorizadoError, ReglaNegocioError, ValidacionError } = require('../errors/errores');
const { validarRegistroCliente } = require('../utils/validaciones');

function exigirPerfil(perfil) {
  if (!perfil || !perfil.proveedor || !perfil.id || !perfil.correo) {
    throw new NoAutorizadoError('No se pudo verificar tu identidad.', 'OAUTH_PERFIL_INVALIDO');
  }
}

/** Traduce un error de llave duplicada de MySQL en un mensaje comprensible. */
function errorPorDuplicado(error) {
  const llave = /for key '([^']+)'/.exec(error.sqlMessage ?? '')?.[1] ?? '';
  if (llave.includes('rfc')) {
    const mensaje = 'Ya existe un cliente registrado con ese RFC.';
    return new ValidacionError({ rfc: mensaje }, mensaje);
  }
  if (llave.includes('curp')) {
    const mensaje = 'Ya existe un cliente registrado con esa CURP.';
    return new ValidacionError({ curp: mensaje }, mensaje);
  }
  return new ReglaNegocioError('Ya existe una cuenta con ese correo. Inicia sesión.', 'CUENTA_EXISTENTE');
}

/** Reglas de negocio de la autenticación: inicio de sesión (CU-02) y registro de clientes (CU-11). */
class AuthService {
  constructor({ bd, usuarios, clientes, bitacora }) {
    this.bd = bd;
    this.usuarios = usuarios;
    this.clientes = clientes;
    this.bitacora = bitacora;
  }

  /** Busca al usuario por su identidad OAuth y, si no la tiene aún, por su correo. */
  async localizar(perfil, cx) {
    exigirPerfil(perfil);
    const porOAuth = await this.usuarios.buscarPorOAuth(perfil.proveedor, perfil.id, cx);
    if (porOAuth) return porOAuth;
    return this.usuarios.buscarPorCorreo(perfil.correo, cx);
  }

  async existeCuenta(perfil) {
    return (await this.localizar(perfil)) !== null;
  }

  /**
   * Devuelve el usuario que inicia sesión o null si no existe una cuenta con ese correo.
   * Lanza NoAutorizadoError si la cuenta está deshabilitada.
   */
  async iniciarSesion(perfil, ip = null) {
    const usuario = await this.localizar(perfil);
    if (!usuario) return null;

    if (!usuario.activo) {
      await this.bitacora.registrar(usuario.idUsuario, 'inicio_sesion_rechazado', 'usuarios', usuario.idUsuario, 'Cuenta deshabilitada', ip);
      throw new NoAutorizadoError('Tu cuenta está deshabilitada.', 'CUENTA_DESHABILITADA');
    }

    if (!usuario.oauthId) {
      // Primer inicio de sesión de un usuario dado de alta por el administrador.
      await this.usuarios.vincularOAuth(usuario.idUsuario, perfil.proveedor, perfil.id);
    } else if (usuario.oauthProveedor !== perfil.proveedor || usuario.oauthId !== perfil.id) {
      throw new NoAutorizadoError('Esta cuenta está vinculada a otra identidad.', 'OAUTH_VINCULADA');
    }

    await this.usuarios.registrarAcceso(usuario.idUsuario);
    await this.bitacora.registrar(usuario.idUsuario, 'inicio_sesion', 'usuarios', usuario.idUsuario, null, ip);
    return usuario;
  }

  /** Crea la cuenta de un cliente a partir de la identidad verificada y los datos del formulario. */
  async registrarCliente(perfil, datos, ip = null) {
    exigirPerfil(perfil);

    const { errores, valores } = validarRegistroCliente(datos);
    if (Object.keys(errores).length > 0) throw new ValidacionError(errores);

    if (await this.localizar(perfil)) {
      throw new ReglaNegocioError('Ya existe una cuenta con ese correo. Inicia sesión.', 'CUENTA_EXISTENTE');
    }

    let usuario;
    try {
      usuario = await this.bd.transaccion(async (cx) => {
        const idUsuario = await this.usuarios.crearUsuario(
          {
            rol: ROLES.CLIENTE,
            correo: perfil.correo,
            nombres: valores.nombres,
            apellidoPaterno: valores.apellidoPaterno,
            apellidoMaterno: valores.apellidoMaterno,
            oauthProveedor: perfil.proveedor,
            oauthId: perfil.id,
          },
          cx,
        );
        await this.clientes.crearCliente({ idUsuario, rfc: valores.rfc, curp: valores.curp }, cx);
        return this.usuarios.buscarPorId(idUsuario, cx);
      });
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') throw errorPorDuplicado(error);
      throw error;
    }

    await this.bitacora.registrar(usuario.idUsuario, 'registro_cliente', 'usuarios', usuario.idUsuario, null, ip);
    return usuario;
  }

  async registrarCierreSesion(usuario, ip = null) {
    await this.bitacora.registrar(usuario.idUsuario, 'cierre_sesion', 'usuarios', usuario.idUsuario, null, ip);
  }
}

module.exports = AuthService;
