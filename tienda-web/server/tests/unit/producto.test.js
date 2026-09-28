'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Producto = require('../../src/domain/Producto');
const Categoria = require('../../src/domain/Categoria');
const ImagenProducto = require('../../src/domain/ImagenProducto');
const { ExistenciasInsuficientesError } = require('../../src/errors/errores');

const nuevo = (extra = {}) =>
  new Producto({
    idProducto: 1,
    nombre: 'Lámpara',
    descripcion: 'De escritorio',
    precio: 449,
    stock: 10,
    diasEntrega: 3,
    idCategoria: 2,
    categoria: new Categoria({ idCategoria: 2, nombre: 'Hogar' }),
    imagenes: [new ImagenProducto({ idImagen: 7, ruta: 'a.jpg', orden: 1 })],
    calificacionPromedio: 4.5,
    totalCalificaciones: 12,
    ...extra,
  });

describe('Producto', () => {
  test('hayExistencias compara con el stock y exige una cantidad entera positiva', () => {
    const p = nuevo();
    assert.ok(p.hayExistencias(1));
    assert.ok(p.hayExistencias(10));
    assert.ok(!p.hayExistencias(11));
    assert.ok(!p.hayExistencias(0));
    assert.ok(!p.hayExistencias(-1));
    assert.ok(!p.hayExistencias(1.5));
    assert.ok(!p.hayExistencias('2'));
  });

  test('descontarStock reduce el stock o lanza un error sin modificarlo', () => {
    const p = nuevo();
    p.descontarStock(4);
    assert.equal(p.stock, 6);
    assert.throws(() => p.descontarStock(7), ExistenciasInsuficientesError);
    assert.equal(p.stock, 6);
  });

  test('fechaEntregaEstimada suma los días a la fecha de compra', () => {
    const desde = new Date('2026-09-19T12:00:00Z');
    assert.equal(nuevo().fechaEntregaEstimada(desde).toISOString().slice(0, 10), '2026-09-22');
    assert.equal(nuevo({ diasEntrega: null }).fechaEntregaEstimada(desde), null);
  });

  test('paraCliente nunca incluye el stock ni el estado interno (RF-10)', () => {
    const json = nuevo().paraCliente(new Date('2026-09-19T12:00:00Z'));
    assert.ok(!('stock' in json));
    assert.ok(!('activo' in json));
    assert.equal(json.precio, 449);
    assert.deepEqual(json.categoria, { idCategoria: 2, nombre: 'Hogar' });
    assert.equal(json.entregaEstimada, '2026-09-22');
    assert.deepEqual(json.imagenes, [{ idImagen: 7, url: '/imagenes/a.jpg', orden: 1 }]);
    assert.deepEqual(json.calificacion, { promedio: 4.5, total: 12 });
    assert.ok(!JSON.stringify(json).includes('"stock"'));
  });

  test('paraGestion agrega el stock y los datos de administración', () => {
    const json = nuevo({ activo: false }).paraGestion();
    assert.equal(json.stock, 10);
    assert.equal(json.activo, false);
    assert.equal(json.idCategoria, 2);
    assert.equal(json.nombre, 'Lámpara');
  });

  test('sin categoría ni fecha de entrega la vista sigue siendo válida', () => {
    const json = nuevo({ categoria: null, diasEntrega: null }).paraCliente();
    assert.equal(json.categoria, null);
    assert.equal(json.entregaEstimada, null);
  });
});

describe('ImagenProducto', () => {
  test('url apunta a /imagenes y paraJSON no expone la ruta interna', () => {
    const i = new ImagenProducto({ idImagen: 3, idProducto: 9, ruta: 'x.png', orden: 2 });
    assert.equal(i.url(), '/imagenes/x.png');
    assert.deepEqual(i.paraJSON(), { idImagen: 3, url: '/imagenes/x.png', orden: 2 });
  });
});
