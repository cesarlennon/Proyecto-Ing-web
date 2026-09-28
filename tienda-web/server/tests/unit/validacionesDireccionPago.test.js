'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const V = require('../../src/utils/validaciones');

const DIRECCION_VALIDA = {
  calle: 'Av. Universidad', numeroExterior: '1200', numeroInterior: '', colonia: 'Xoco',
  codigoPostal: '04310', municipio: 'Benito Juárez', ciudad: 'Ciudad de México', idPais: '1', esPrincipal: true,
};
// Número que pasa la suma de Luhn (tarjeta de prueba típica de Visa)
const TARJETA_VALIDA = '4111 1111 1111 1111';
const ANIO_FUTURO = new Date().getFullYear() + 2;
const METODO_VALIDO = { titular: 'Ana Pérez', numero: TARJETA_VALIDA, mesVencimiento: '08', anioVencimiento: String(ANIO_FUTURO), cvv: '123' };

describe('Validaciones de dirección', () => {
  test('validarCodigoPostal exige 5 dígitos', () => {
    assert.equal(V.validarCodigoPostal('04310'), '');
    for (const malo of ['', '1234', '123456', 'abcde', '0431a']) assert.ok(V.validarCodigoPostal(malo));
  });

  test('validarDireccion normaliza y acepta el número interior vacío', () => {
    const { errores, valores } = V.validarDireccion(DIRECCION_VALIDA);
    assert.deepEqual(errores, {});
    assert.equal(valores.numeroInterior, null);
    assert.equal(valores.idPais, 1);
    assert.equal(valores.esPrincipal, true);
  });

  test('validarDireccion conserva el número interior cuando se captura', () => {
    const { valores } = V.validarDireccion({ ...DIRECCION_VALIDA, numeroInterior: '4B' });
    assert.equal(valores.numeroInterior, '4B');
  });

  test('validarDireccion reporta un error por cada campo obligatorio faltante', () => {
    const { errores } = V.validarDireccion({});
    assert.deepEqual(
      Object.keys(errores).sort(),
      ['calle', 'ciudad', 'codigoPostal', 'colonia', 'idPais', 'municipio', 'numeroExterior'].sort(),
    );
    assert.ok(!errores.numeroInterior); // opcional
  });

  test('validarDireccion rechaza caracteres no permitidos', () => {
    assert.ok(V.validarDireccion({ ...DIRECCION_VALIDA, calle: '<script>' }).errores.calle);
  });
});

describe('Validaciones de método de pago', () => {
  test('validarNumeroTarjeta exige el formato y la suma de Luhn', () => {
    assert.equal(V.validarNumeroTarjeta(TARJETA_VALIDA), '');
    assert.equal(V.validarNumeroTarjeta('4111111111111111'), '');
    for (const malo of ['', 'abcd', '4111 1111 1111 1112', '123', '1'.repeat(20)]) {
      assert.ok(V.validarNumeroTarjeta(malo), `debía rechazar ${malo}`);
    }
  });

  test('validarVencimiento rechaza tarjetas vencidas y acepta el mes de vencimiento hasta su último día', () => {
    const hoy = new Date('2026-06-15');
    assert.equal(V.validarVencimiento('6', '2026', { hoy }), '');
    assert.match(V.validarVencimiento('5', '2026', { hoy }), /vencida/);
    assert.match(V.validarVencimiento('13', '2026', { hoy }), /MM\/AAAA/);
    assert.match(V.validarVencimiento('', '', { hoy }), /MM\/AAAA/);
  });

  test('validarCVV exige 3 o 4 dígitos', () => {
    assert.equal(V.validarCVV('123'), '');
    assert.equal(V.validarCVV('1234'), '');
    for (const malo of ['', '12', '12345', 'abc']) assert.ok(V.validarCVV(malo));
  });

  test('validarMetodoPago normaliza el número y no incluye el CVV en los valores', () => {
    const { errores, valores } = V.validarMetodoPago(METODO_VALIDO);
    assert.deepEqual(errores, {});
    assert.equal(valores.numero, '4111111111111111');
    assert.equal(valores.mesVencimiento, 8);
    assert.equal(valores.anioVencimiento, ANIO_FUTURO);
    assert.ok(!('cvv' in valores));
  });

  test('validarMetodoPago reporta el CVV inválido aunque no se guarde', () => {
    assert.ok(V.validarMetodoPago({ ...METODO_VALIDO, cvv: '12' }).errores.cvv);
  });
});
