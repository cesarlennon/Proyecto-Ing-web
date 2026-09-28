'use strict';

const { ValidacionError } = require('../errors/errores');

/** Calificación de 0 a 5 estrellas de un cliente a un producto (CU-19). Una por cliente y producto. */
class Calificacion {
  constructor({ idCalificacion = null, idProducto, idUsuario, estrellas, fecha = null }) {
    this.idCalificacion = idCalificacion;
    this.idProducto = idProducto;
    this.idUsuario = idUsuario;
    this.estrellas = estrellas;
    this.fecha = fecha;
  }

  /** Devuelve los mensajes de error, o [] si la calificación es válida. */
  validar() {
    const errores = [];
    if (!Number.isInteger(this.estrellas) || this.estrellas < 0 || this.estrellas > 5) {
      errores.push('La calificación debe ser un número entero de 0 a 5.');
    }
    return errores;
  }

  /** Lanza ValidacionError si la calificación no es válida; se usa antes de guardar. */
  exigirValida() {
    const errores = this.validar();
    if (errores.length > 0) throw new ValidacionError({ estrellas: errores[0] }, errores[0]);
  }

  paraJSON() {
    return { idProducto: this.idProducto, estrellas: this.estrellas, fecha: this.fecha };
  }
}

module.exports = Calificacion;
