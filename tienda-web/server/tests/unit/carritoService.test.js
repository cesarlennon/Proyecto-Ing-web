'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const CarritoService = require('../../src/services/CarritoService');
const ItemCarrito = require('../../src/domain/ItemCarrito');
const Producto = require('../../src/domain/Producto');
const { NoEncontradoError, ValidacionError } = require('../../src/errors/errores');

function crearFakes() {
  const f = {};
  f.items = [];
  f.carrito = {
    async obtener() { return f.items; },
    async agregar(idUsuario, idProducto, cantidad) {
      const existente = f.items.find((i) => i.producto.idProducto === idProducto);
      if (existente) existente.cantidad += cantidad;
      else f.items.push(new ItemCarrito({ producto: new Producto({ idProducto, nombre: 'A', precio: 10, stock: 99 }), cantidad }));
    },
    async actualizarCantidad(idUsuario, idProducto, cantidad) {
      const item = f.items.find((i) => i.producto.idProducto === idProducto);
      if (!item) return false;
      item.cantidad = cantidad;
      return true;
    },
    async quitar(idUsuario, idProducto) {
      const antes = f.items.length;
      f.items = f.items.filter((i) => i.producto.idProducto !== idProducto);
      return f.items.length < antes;
    },
  };
  f.productos = { async buscarPorId(id) { return id === 1 ? new Producto({ idProducto: 1, nombre: 'A', precio: 10, stock: 5, activo: true }) : (id === 2 ? new Producto({ idProducto: 2, activo: false }) : null); } };
  f.servicio = new CarritoService({ carrito: f.carrito, productos: f.productos });
  return f;
}

describe('CarritoService', () => {
  let f;
  beforeEach(() => { f = crearFakes(); });

  test('agregar valida que el producto exista y esté activo', async () => {
    const carrito = await f.servicio.agregar(7, 1, 2);
    assert.equal(carrito.items.length, 1);
    await assert.rejects(() => f.servicio.agregar(7, 2, 1), NoEncontradoError); // inactivo
    await assert.rejects(() => f.servicio.agregar(7, 99, 1), NoEncontradoError); // no existe
  });

  test('agregar el mismo producto otra vez suma las cantidades', async () => {
    await f.servicio.agregar(7, 1, 2);
    const carrito = await f.servicio.agregar(7, 1, 3);
    assert.equal(carrito.items[0].cantidad, 5);
  });

  test('la cantidad debe ser un entero positivo', async () => {
    for (const mala of [0, -1, 1.5, 'dos', NaN]) {
      await assert.rejects(() => f.servicio.agregar(7, 1, mala), (e) => e instanceof ValidacionError && Boolean(e.campos.cantidad));
    }
  });

  test('actualizarCantidad exige que el producto esté en el carrito', async () => {
    await f.servicio.agregar(7, 1, 1);
    const carrito = await f.servicio.actualizarCantidad(7, 1, 4);
    assert.equal(carrito.items[0].cantidad, 4);
    await assert.rejects(() => f.servicio.actualizarCantidad(7, 99, 1), NoEncontradoError);
  });

  test('quitar exige que el producto esté en el carrito', async () => {
    await f.servicio.agregar(7, 1, 1);
    const carrito = await f.servicio.quitar(7, 1);
    assert.equal(carrito.items.length, 0);
    await assert.rejects(() => f.servicio.quitar(7, 1), NoEncontradoError);
  });

  test('obtener devuelve un Carrito con su total calculado', async () => {
    await f.servicio.agregar(7, 1, 3);
    const carrito = await f.servicio.obtener(7);
    assert.equal(carrito.total(), 30);
  });
});
