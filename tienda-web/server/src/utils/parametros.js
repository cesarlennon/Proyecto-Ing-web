'use strict';

const { NoEncontradoError } = require('../errors/errores');

/** Convierte un parámetro de la ruta en un entero positivo; si no lo es, el recurso no existe. */
function idDeRuta(valor) {
  if (!/^\d{1,9}$/.test(String(valor)) || Number(valor) < 1) {
    throw new NoEncontradoError('Recurso no encontrado.');
  }
  return Number(valor);
}

/** Convierte un parámetro opcional de la consulta en un entero positivo, o devuelve `porDefecto`. */
function enteroOpcional(valor, porDefecto = null) {
  if (valor === undefined || valor === null || valor === '') return porDefecto;
  return /^\d{1,9}$/.test(String(valor)) && Number(valor) >= 1 ? Number(valor) : porDefecto;
}

module.exports = { idDeRuta, enteroOpcional };
