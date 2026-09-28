'use strict';

const BaseRepository = require('./BaseRepository');
const { crearUsuario } = require('../domain/crearUsuario');
const { IDS_ROL, rolPorId } = require('../domain/Rol');

class UsuarioRepository extends BaseRepository {
  constructor(bd) {
    super(bd, 'usuarios', 'id_usuario', [
      'id_rol',
      'correo',
      'nombres',
      'apellido_paterno',
      'apellido_materno',
      'oauth_proveedor',
      'oauth_id',
      'activo',
      'ultimo_acceso',
    ]);
  }

  mapear(fila) {
    return crearUsuario({
      idUsuario: fila.id_usuario,
      correo: fila.correo,
      nombres: fila.nombres,
      apellidoPaterno: fila.apellido_paterno,
      apellidoMaterno: fila.apellido_materno,
      rol: rolPorId(fila.id_rol),
      activo: Boolean(fila.activo),
      fechaAlta: fila.fecha_alta,
      ultimoAcceso: fila.ultimo_acceso,
      oauthProveedor: fila.oauth_proveedor,
      oauthId: fila.oauth_id,
    });
  }

  async buscarPorCorreo(correo, cx) {
    const filas = await this.ejecutor(cx).consultar('SELECT * FROM usuarios WHERE correo = ?', [correo]);
    return filas.length > 0 ? this.mapear(filas[0]) : null;
  }

  /** Lista los usuarios para la pantalla de administración (CU-05), opcionalmente filtrados por rol. */
  async listarTodos({ rol = null } = {}, cx) {
    const condiciones = [];
    const parametros = [];
    if (rol) {
      condiciones.push('id_rol = ?');
      parametros.push(IDS_ROL[rol]);
    }
    const donde = condiciones.length > 0 ? ` WHERE ${condiciones.join(' AND ')}` : '';
    const filas = await this.ejecutor(cx).consultar(
      `SELECT * FROM usuarios${donde} ORDER BY nombres, apellido_paterno`,
      parametros,
    );
    return filas.map((f) => this.mapear(f));
  }

  /** Cambia el estado activo/inactivo (alta o baja lógica del usuario). */
  async cambiarEstado(id, activo, cx) {
    return this.actualizar(id, { activo: activo ? 1 : 0 }, cx);
  }

  async buscarPorOAuth(proveedor, id, cx) {
    const filas = await this.ejecutor(cx).consultar(
      'SELECT * FROM usuarios WHERE oauth_proveedor = ? AND oauth_id = ?',
      [proveedor, id],
    );
    return filas.length > 0 ? this.mapear(filas[0]) : null;
  }

  /** Asocia la identidad de OAuth al usuario la primera vez que inicia sesión. */
  async vincularOAuth(idUsuario, proveedor, id, cx) {
    return this.actualizar(idUsuario, { oauth_proveedor: proveedor, oauth_id: id }, cx);
  }

  async registrarAcceso(idUsuario, cx) {
    await this.ejecutor(cx).consultar(
      'UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id_usuario = ?',
      [idUsuario],
    );
  }

  /** Crea un usuario a partir de datos del dominio (nombres en camelCase). Devuelve su identificador. */
  async crearUsuario(datos, cx) {
    return this.crear(
      {
        id_rol: IDS_ROL[datos.rol],
        correo: datos.correo,
        nombres: datos.nombres,
        apellido_paterno: datos.apellidoPaterno,
        apellido_materno: datos.apellidoMaterno ?? null,
        oauth_proveedor: datos.oauthProveedor ?? null,
        oauth_id: datos.oauthId ?? null,
      },
      cx,
    );
  }
}

module.exports = UsuarioRepository;
