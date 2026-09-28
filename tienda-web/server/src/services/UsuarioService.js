'use strict';

const { ROLES } = require('../domain/Rol');
const { NoEncontradoError, ReglaNegocioError, ValidacionError } = require('../errors/errores');
const { validarUsuarioNuevo, validarUsuarioEdicion } = require('../utils/validaciones');

const ROLES_ADMINISTRABLES = [ROLES.ADMINISTRADOR, ROLES.INVENTARIOS];

/**
 * Gestión de usuarios (CU-05). El administrador solo da de alta perfiles de administrador y de
 * personal de inventarios; los clientes se autoregistran con identidad verificada (CU-11). El
 * administrador nunca borra un usuario físicamente: lo da de baja (activo = 0), igual que con
 * productos y catálogos, para conservar la bitácora y el historial del sistema.
 */
class UsuarioService {
  constructor({ usuarios, bitacora }) {
    this.usuarios = usuarios;
    this.bitacora = bitacora;
  }

  async listar({ rol } = {}) {
    if (rol && ![...ROLES_ADMINISTRABLES, ROLES.CLIENTE].includes(rol)) {
      throw new ValidacionError({ rol: 'El perfil indicado no es válido.' });
    }
    return this.usuarios.listarTodos({ rol: rol || null });
  }

  async exigir(id) {
    const usuario = await this.usuarios.buscarPorId(id);
    if (!usuario) throw new NoEncontradoError('El usuario no existe.');
    return usuario;
  }

  async crear(datos, quienCrea, ip = null) {
    const { errores, valores } = validarUsuarioNuevo(datos);
    if (Object.keys(errores).length > 0) throw new ValidacionError(errores);

    if (await this.usuarios.buscarPorCorreo(valores.correo)) {
      const mensaje = 'Ya existe un usuario registrado con ese correo.';
      throw new ValidacionError({ correo: mensaje }, mensaje);
    }

    let id;
    try {
      id = await this.usuarios.crearUsuario({
        rol: valores.rol,
        correo: valores.correo,
        nombres: valores.nombres,
        apellidoPaterno: valores.apellidoPaterno,
        apellidoMaterno: valores.apellidoMaterno,
      });
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') {
        const mensaje = 'Ya existe un usuario registrado con ese correo.';
        throw new ValidacionError({ correo: mensaje }, mensaje);
      }
      throw error;
    }

    await this.bitacora.registrar(quienCrea.idUsuario, 'usuario_crear', 'usuarios', id, `rol=${valores.rol}`, ip);
    return this.usuarios.buscarPorId(id);
  }

  async actualizar(id, datos, quienActualiza, ip = null) {
    await this.exigir(id);
    const { errores, valores } = validarUsuarioEdicion(datos);
    if (Object.keys(errores).length > 0) throw new ValidacionError(errores);

    await this.usuarios.actualizar(id, {
      nombres: valores.nombres,
      apellido_paterno: valores.apellidoPaterno,
      apellido_materno: valores.apellidoMaterno,
    });
    await this.bitacora.registrar(quienActualiza.idUsuario, 'usuario_actualizar', 'usuarios', id, null, ip);
    return this.usuarios.buscarPorId(id);
  }

  /** Da de baja o reactiva la cuenta. El administrador no puede desactivar su propia cuenta. */
  async cambiarEstado(id, activo, quienActualiza, ip = null) {
    const usuario = await this.exigir(id);
    if (!activo && id === quienActualiza.idUsuario) {
      throw new ReglaNegocioError('No puedes deshabilitar tu propia cuenta.', 'AUTOBAJA');
    }
    if (usuario.activo === activo) return usuario;

    await this.usuarios.cambiarEstado(id, activo);
    await this.bitacora.registrar(
      quienActualiza.idUsuario,
      activo ? 'usuario_alta' : 'usuario_baja',
      'usuarios',
      id,
      null,
      ip,
    );
    return this.usuarios.buscarPorId(id);
  }
}

module.exports = UsuarioService;
