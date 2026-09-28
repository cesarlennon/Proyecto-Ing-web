'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const V = require('../../src/utils/validaciones');

describe('Validaciones de catálogos', () => {
  test('validarNombreCatalogo', () => {
    assert.equal(V.validarNombreCatalogo('Electrónica'), '');
    assert.equal(V.validarNombreCatalogo('Hogar y jardín (nuevo)'), '');
    assert.equal(V.validarNombreCatalogo('Ropa & calzado'), '');
    assert.match(V.validarNombreCatalogo(''), /obligatorio/);
    assert.match(V.validarNombreCatalogo('x'.repeat(61)), /más de 60/);
    assert.match(V.validarNombreCatalogo('<script>'), /no permitidos/);
    assert.match(V.validarNombreCatalogo('  ', { etiqueta: 'El país' }), /^El país es obligatorio/);
  });

  test('validarCatalogo completo normaliza el nombre', () => {
    const { errores, valores } = V.validarCatalogo({ nombre: '  Ropa   deportiva ' });
    assert.deepEqual(errores, {});
    assert.deepEqual(valores, { nombre: 'Ropa deportiva' });
  });

  test('validarCatalogo parcial solo revisa los campos presentes', () => {
    assert.deepEqual(V.validarCatalogo({ activo: false }, { parcial: true }), { errores: {}, valores: { activo: false } });
    assert.ok(V.validarCatalogo({ nombre: '' }, { parcial: true }).errores.nombre);
    assert.ok(V.validarCatalogo({ activo: 'no' }, { parcial: true }).errores.activo);
    assert.ok(V.validarCatalogo({}).errores.nombre);
    assert.deepEqual(V.validarCatalogo(undefined, { parcial: true }), { errores: {}, valores: {} });
  });
});

describe('Validaciones de producto', () => {
  test('validarPrecio', () => {
    for (const bueno of ['1299', '1299.5', '0.01', 449.99, '99999999.99']) assert.equal(V.validarPrecio(bueno), '', String(bueno));
    for (const malo of ['', '0', '0.00', '-5', '12.345', 'abc', '1,299.00', '100000000', '1e3', ' ']) {
      assert.ok(V.validarPrecio(malo), `debía rechazar ${JSON.stringify(malo)}`);
    }
  });

  test('validarStock', () => {
    for (const bueno of ['0', '35', 12, '9999999']) assert.equal(V.validarStock(bueno), '', String(bueno));
    for (const malo of ['', '-1', '1.5', 'diez', '10000000']) assert.ok(V.validarStock(malo), `debía rechazar ${malo}`);
  });

  test('validarDiasEntrega', () => {
    for (const bueno of ['1', 3, '365']) assert.equal(V.validarDiasEntrega(bueno), '');
    for (const malo of ['', '0', '366', '2.5', 'x', '-1']) assert.ok(V.validarDiasEntrega(malo), `debía rechazar ${malo}`);
  });

  test('validarIdCategoria', () => {
    assert.equal(V.validarIdCategoria('3'), '');
    assert.equal(V.validarIdCategoria(3), '');
    for (const malo of ['', '0', 'abc', '-2', undefined]) assert.match(V.validarIdCategoria(malo), /Selecciona/);
  });

  test('validarNombreProducto y validarDescripcion', () => {
    assert.equal(V.validarNombreProducto('Audífonos inalámbricos X-200 (negro)'), '');
    assert.match(V.validarNombreProducto(''), /obligatorio/);
    assert.match(V.validarNombreProducto('x'.repeat(121)), /120/);
    assert.match(V.validarNombreProducto('mal\u0000nombre'), /no permitidos/);
    assert.equal(V.validarDescripcion(''), '');
    assert.equal(V.validarDescripcion('Línea 1\nLínea 2'), '');
    assert.match(V.validarDescripcion('x'.repeat(2001)), /2000/);
    assert.match(V.validarDescripcion('mal\u0007'), /no permitidos/);
  });

  test('validarProducto normaliza los valores cuando todo es válido', () => {
    const { errores, valores } = V.validarProducto({
      nombre: '  Lámpara   de escritorio ',
      descripcion: '  Con brazo articulado  ',
      precio: '449.00',
      stock: '12',
      idCategoria: '2',
      diasEntrega: '3',
    });
    assert.deepEqual(errores, {});
    assert.deepEqual(valores, {
      nombre: 'Lámpara de escritorio',
      descripcion: 'Con brazo articulado',
      precio: 449,
      stock: 12,
      idCategoria: 2,
      diasEntrega: 3,
    });
  });

  test('la descripción vacía se guarda como null y conserva los saltos de línea', () => {
    const base = { nombre: 'A', precio: '1', stock: '0', idCategoria: '1', diasEntrega: '1' };
    assert.equal(V.validarProducto({ ...base, descripcion: '   ' }).valores.descripcion, null);
    assert.equal(V.validarProducto({ ...base, descripcion: 'a\nb' }).valores.descripcion, 'a\nb');
  });

  test('validarProducto reporta un error por campo inválido', () => {
    const { errores } = V.validarProducto({ nombre: '', precio: '0', stock: '-1', idCategoria: '', diasEntrega: '0' });
    assert.deepEqual(Object.keys(errores).sort(), ['diasEntrega', 'idCategoria', 'nombre', 'precio', 'stock']);
    assert.ok(Object.keys(V.validarProducto(undefined).errores).length >= 5);
  });
});
