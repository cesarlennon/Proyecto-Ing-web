'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CifradoService = require('../../src/services/CifradoService');

const CLAVE = 'a'.repeat(64);

describe('CifradoService', () => {
  test('exige una clave hexadecimal de 64 caracteres', () => {
    assert.throws(() => new CifradoService('corta'), /64 caracteres/);
    assert.throws(() => new CifradoService('z'.repeat(64)), /64 caracteres/);
    assert.throws(() => new CifradoService(undefined), /64 caracteres/);
  });

  test('cifrar y descifrar recuperan el texto original', () => {
    const servicio = new CifradoService(CLAVE);
    const cifrado = servicio.cifrar('4111111111111111');
    assert.ok(Buffer.isBuffer(cifrado));
    assert.ok(!cifrado.toString('latin1').includes('4111111111111111'));
    assert.equal(servicio.descifrar(cifrado), '4111111111111111');
  });

  test('cada cifrado es distinto (usa un IV aleatorio), aunque el texto sea el mismo', () => {
    const servicio = new CifradoService(CLAVE);
    const a = servicio.cifrar('mismo texto');
    const b = servicio.cifrar('mismo texto');
    assert.notEqual(a.toString('hex'), b.toString('hex'));
  });

  test('no se puede descifrar con una clave distinta ni si los datos fueron alterados', () => {
    const servicio = new CifradoService(CLAVE);
    const otro = new CifradoService('b'.repeat(64));
    const cifrado = servicio.cifrar('secreto');
    assert.throws(() => otro.descifrar(cifrado));

    const alterado = Buffer.from(cifrado);
    alterado[alterado.length - 1] ^= 0xff;
    assert.throws(() => servicio.descifrar(alterado));
  });

  test('ultimos4 toma los últimos cuatro dígitos', () => {
    assert.equal(CifradoService.ultimos4('4111111111111111'), '1111');
    assert.equal(CifradoService.ultimos4('123'), '123');
  });
});
