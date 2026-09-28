'use strict';

/**
 * Clase abstracta con la identidad y el perfil de un usuario.
 * Cada perfil hereda de ella y define sus permisos; el control de acceso consulta `puede()`.
 */
class Usuario {
  constructor({
    idUsuario,
    correo,
    nombres,
    apellidoPaterno,
    apellidoMaterno = null,
    rol,
    activo = true,
    fechaAlta = null,
    ultimoAcceso = null,
    oauthProveedor = null,
    oauthId = null,
  }) {
    if (new.target === Usuario) {
      throw new TypeError('Usuario es una clase abstracta.');
    }
    this.idUsuario = idUsuario;
    this.correo = correo;
    this.nombres = nombres;
    this.apellidoPaterno = apellidoPaterno;
    this.apellidoMaterno = apellidoMaterno;
    this.rol = rol;
    this.activo = activo;
    this.fechaAlta = fechaAlta;
    this.ultimoAcceso = ultimoAcceso;
    this.oauthProveedor = oauthProveedor;
    this.oauthId = oauthId;
  }

  nombreCompleto() {
    return [this.nombres, this.apellidoPaterno, this.apellidoMaterno].filter(Boolean).join(' ');
  }

  tieneRol(rol) {
    return this.rol === rol;
  }

  /** Lista de permisos del perfil. Cada subclase la redefine. */
  permisos() {
    throw new Error('permisos() debe implementarse en la subclase.');
  }

  puede(permiso) {
    return this.permisos().includes(permiso);
  }

  /** Datos que se envían al navegador. No incluye identificadores de OAuth. */
  paraSesion() {
    return {
      idUsuario: this.idUsuario,
      nombre: this.nombreCompleto(),
      correo: this.correo,
      rol: this.rol,
      permisos: this.permisos(),
    };
  }

  /** Vista para la pantalla de administración de usuarios (CU-05). No incluye datos de OAuth. */
  paraAdmin() {
    return {
      idUsuario: this.idUsuario,
      nombre: this.nombreCompleto(),
      nombres: this.nombres,
      apellidoPaterno: this.apellidoPaterno,
      apellidoMaterno: this.apellidoMaterno,
      correo: this.correo,
      rol: this.rol,
      activo: this.activo,
      fechaAlta: this.fechaAlta,
      ultimoAcceso: this.ultimoAcceso,
    };
  }
}

module.exports = Usuario;
