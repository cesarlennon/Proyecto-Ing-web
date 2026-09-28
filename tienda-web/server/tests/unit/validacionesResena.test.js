'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const V = require('../../src/utils/validaciones');

describe('validarEstrellas', () => {
  test('acepta enteros de 0 a 5', () => {
    for (const bueno of ['0', '1', '5', 0, 5]) assert.equal(V.validarEstrellas(bueno), '');
  });
  test('rechaza cualquier otro valor', () => {
    for (const malo of ['', '6', '-1', '2.5', 'tres', undefined, null]) assert.ok(V.validarEstrellas(malo), `debía rechazar ${malo}`);
  });
});

describe('validarTextoRecomendacion', () => {
  test('acepta texto no vacío hasta 500 caracteres', () => {
    assert.equal(V.validarTextoRecomendacion('Muy buen producto.'), '');
    assert.equal(V.validarTextoRecomendacion('x'.repeat(500)), '');
  });
  test('rechaza vacío, demasiado largo o con caracteres de control', () => {
    assert.match(V.validarTextoRecomendacion(''), /Escribe/);
    assert.match(V.validarTextoRecomendacion('   '), /Escribe/);
    assert.match(V.validarTextoRecomendacion('x'.repeat(501)), /500/);
    assert.match(V.validarTextoRecomendacion('mal\u0007texto'), /no permitidos/);
  });
});
