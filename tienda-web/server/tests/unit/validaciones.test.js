'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const V = require('../../src/utils/validaciones');

const CURP_VALIDA = 'PEGA900101HDFRRN09';
const RFC_VALIDO = 'PEGA900101AB1';

describe('Validaciones compartidas', () => {
  test('limpiar recorta y colapsa espacios', () => {
    assert.equal(V.limpiar('  Ana   María '), 'Ana María');
    assert.equal(V.limpiar(null), '');
    assert.equal(V.limpiar(undefined), '');
  });

  test('validarCorreo', () => {
    assert.equal(V.validarCorreo('ana@correo.com'), '');
    assert.match(V.validarCorreo(''), /obligatorio/);
    assert.match(V.validarCorreo('ana@correo'), /formato/);
    assert.match(V.validarCorreo('ana correo@x.com'), /formato/);
  });

  test('validarNombre acepta acentos, apóstrofos y guiones', () => {
    assert.equal(V.validarNombre('José Ángel'), '');
    assert.equal(V.validarNombre("D'Angelo-Núñez"), '');
    assert.match(V.validarNombre(''), /obligatorio/);
    assert.equal(V.validarNombre('', { obligatorio: false }), '');
    assert.match(V.validarNombre('Ana123'), /solo puede contener letras/);
    assert.match(V.validarNombre('x'.repeat(81)), /más de 80/);
  });

  test('validarRFC acepta personas físicas y morales, en mayúsculas o minúsculas', () => {
    assert.equal(V.validarRFC(RFC_VALIDO), '');
    assert.equal(V.validarRFC('pega900101ab1'), '');
    assert.equal(V.validarRFC('ABC850101XY9'), '');
    assert.match(V.validarRFC('PEGA900101'), /formato válido/);
    assert.match(V.validarRFC('PEGA901301AB1'), /formato válido/); // mes 13
    assert.match(V.validarRFC(''), /obligatorio/);
  });

  test('validarCURP', () => {
    assert.equal(V.validarCURP(CURP_VALIDA), '');
    assert.equal(V.validarCURP(CURP_VALIDA.toLowerCase()), '');
    assert.match(V.validarCURP('PEGA900101HDFRRN0'), /formato válido/);
    assert.match(V.validarCURP('PEGA900101XXXRRN09'), /formato válido/); // entidad inexistente
    assert.match(V.validarCURP(''), /obligatoria/);
  });

  test('validarRegistroCliente normaliza los valores cuando todo es válido', () => {
    const { errores, valores } = V.validarRegistroCliente({
      nombres: '  Ana   María ',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: '',
      rfc: 'pega900101ab1',
      curp: CURP_VALIDA.toLowerCase(),
      aceptaAviso: true,
    });
    assert.deepEqual(errores, {});
    assert.deepEqual(valores, {
      nombres: 'Ana María',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: null,
      rfc: RFC_VALIDO,
      curp: CURP_VALIDA,
    });
  });

  test('validarRegistroCliente reporta los errores por campo', () => {
    const { errores } = V.validarRegistroCliente({ nombres: '', rfc: 'X', curp: '', aceptaAviso: false });
    assert.deepEqual(Object.keys(errores).sort(), ['aceptaAviso', 'apellidoPaterno', 'curp', 'nombres', 'rfc']);
  });

  test('validarRegistroCliente tolera datos ausentes', () => {
    const { errores } = V.validarRegistroCliente(undefined);
    assert.ok(errores.nombres);
    assert.ok(errores.aceptaAviso);
  });

  test('aceptaAviso debe ser exactamente true', () => {
    const base = { nombres: 'Ana', apellidoPaterno: 'Pérez', rfc: RFC_VALIDO, curp: CURP_VALIDA };
    assert.ok(V.validarRegistroCliente({ ...base, aceptaAviso: 'true' }).errores.aceptaAviso);
    assert.deepEqual(V.validarRegistroCliente({ ...base, aceptaAviso: true }).errores, {});
  });
});
