'use strict';

const { ValidacionError } = require('../errors/errores');

const MAX_CARACTERES = 500;

/** Recomendación (comentario) que un cliente escribe sobre un producto que compró (CU-20). */
class Recomendacion {
  constructor({ idRecomendacion = null, idProducto, idUsuario, texto, autor = null, fecha = null }) {
    this.idRecomendacion = idRecomendacion;
    this.idProducto = idProducto;
    this.idUsuario = idUsuario;
    this.texto = texto;
    this.autor = autor;
    this.fecha = fecha;
  }

  validar() {
    const errores = [];
    const texto = (this.texto ?? '').trim();
    if (!texto) errores.push('Escribe tu recomendación.');
    else if (texto.length > MAX_CARACTERES) errores.push(`La recomendación no puede tener más de ${MAX_CARACTERES} caracteres.`);
    return errores;
  }

  exigirValida() {
    const errores = this.validar();
    if (errores.length > 0) throw new ValidacionError({ texto: errores[0] }, errores[0]);
  }

  paraJSON() {
    return { idRecomendacion: this.idRecomendacion, autor: this.autor, texto: this.texto, fecha: this.fecha };
  }
}

module.exports = Recomendacion;
