'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Calificacion = require('../../src/domain/Calificacion');
const Recomendacion = require('../../src/domain/Recomendacion');
const { ValidacionError } = require('../../src/errors/errores');

describe('Calificacion', () => {
  test('validar() acepta 0 a 5 y rechaza fuera de rango o no entero', () => {
    for (const n of [0, 1, 5]) assert.deepEqual(new Calificacion({ idProducto: 1, idUsuario: 1, estrellas: n }).validar(), []);
    for (const n of [-1, 6, 2.5, NaN]) assert.equal(new Calificacion({ idProducto: 1, idUsuario: 1, estrellas: n }).validar().length, 1);
  });

  test('exigirValida lanza ValidacionError con el campo estrellas', () => {
    assert.throws(() => new Calificacion({ idProducto: 1, idUsuario: 1, estrellas: 9 }).exigirValida(),
      (e) => e instanceof ValidacionError && Boolean(e.campos.estrellas));
    new Calificacion({ idProducto: 1, idUsuario: 1, estrellas: 4 }).exigirValida(); // no lanza
  });

  test('paraJSON no incluye el identificador del cliente', () => {
    const json = new Calificacion({ idCalificacion: 1, idProducto: 5, idUsuario: 9, estrellas: 4, fecha: 'x' }).paraJSON();
    assert.ok(!('idUsuario' in json));
    assert.equal(json.estrellas, 4);
  });
});

describe('Recomendacion', () => {
  test('validar() rechaza texto vacío o demasiado largo', () => {
    assert.deepEqual(new Recomendacion({ idProducto: 1, idUsuario: 1, texto: 'Buen producto' }).validar(), []);
    assert.equal(new Recomendacion({ idProducto: 1, idUsuario: 1, texto: '' }).validar().length, 1);
    assert.equal(new Recomendacion({ idProducto: 1, idUsuario: 1, texto: 'x'.repeat(501) }).validar().length, 1);
  });

  test('exigirValida lanza ValidacionError con el campo texto', () => {
    assert.throws(() => new Recomendacion({ idProducto: 1, idUsuario: 1, texto: '' }).exigirValida(),
      (e) => e instanceof ValidacionError && Boolean(e.campos.texto));
  });

  test('paraJSON expone el autor pero no el identificador del cliente', () => {
    const json = new Recomendacion({ idRecomendacion: 3, idProducto: 1, idUsuario: 9, texto: 'x', autor: 'Ana Pérez', fecha: 'f' }).paraJSON();
    assert.equal(json.autor, 'Ana Pérez');
    assert.ok(!('idUsuario' in json));
  });
});
