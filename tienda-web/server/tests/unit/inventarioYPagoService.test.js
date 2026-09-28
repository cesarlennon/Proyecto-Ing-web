'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const InventarioService = require('../../src/services/InventarioService');
const PagoSimuladoService = require('../../src/services/PagoSimuladoService');
const ItemCarrito = require('../../src/domain/ItemCarrito');
const Producto = require('../../src/domain/Producto');
const MetodoPago = require('../../src/domain/MetodoPago');
const { ExistenciasInsuficientesError, ReglaNegocioError } = require('../../src/errors/errores');

const item = (idProducto, cantidad) => new ItemCarrito({ producto: new Producto({ idProducto, nombre: 'A' }), cantidad });

function productosFalso(disponibles) {
  return {
    bloqueados: null,
    descontados: [],
    async bloquearParaCompra(ids) {
      this.bloqueados = ids;
      return disponibles.filter((p) => ids.includes(p.idProducto));
    },
    async descontarStockEnBD(idProducto, cantidad, cx) {
      this.descontados.push([idProducto, cantidad, cx]);
    },
  };
}

describe('InventarioService.validarExistencias', () => {
  test('bloquea los productos del carrito y los devuelve indexados por id', async () => {
    const productos = productosFalso([new Producto({ idProducto: 1, nombre: 'A', precio: 10, stock: 5, activo: true })]);
    const servicio = new InventarioService({ productos });
    const mapa = await servicio.validarExistencias([item(1, 3)], { tx: true });
    assert.deepEqual(productos.bloqueados, [1]);
    assert.equal(mapa.get(1).stock, 5);
  });

  test('rechaza si no alcanza el stock, si el producto no existe o está inactivo', async () => {
    const casos = [
      [new Producto({ idProducto: 1, stock: 1, activo: true })],
      [],
      [new Producto({ idProducto: 1, stock: 10, activo: false })],
    ];
    for (const disponibles of casos) {
      const servicio = new InventarioService({ productos: productosFalso(disponibles) });
      await assert.rejects(() => servicio.validarExistencias([item(1, 5)], {}), ExistenciasInsuficientesError);
    }
  });

  test('no revela el stock exacto en el mensaje de error', async () => {
    const servicio = new InventarioService({ productos: productosFalso([new Producto({ idProducto: 1, stock: 2, activo: true })]) });
    await assert.rejects(() => servicio.validarExistencias([item(1, 5)], {}), (e) => !/\d/.test(e.message));
  });
});

describe('InventarioService.descontar', () => {
  test('descuenta cada producto del carrito dentro de la misma conexión', async () => {
    const productos = productosFalso([]);
    const servicio = new InventarioService({ productos });
    const cx = { marca: true };
    await servicio.descontar([item(1, 2), item(2, 1)], cx);
    assert.deepEqual(productos.descontados, [[1, 2, cx], [2, 1, cx]]);
  });
});

describe('PagoSimuladoService', () => {
  test('aprueba el pago cuando hay método y monto válidos', async () => {
    const resultado = await new PagoSimuladoService().procesarPago(new MetodoPago({ idMetodoPago: 1, ultimos4: '1111' }), 100);
    assert.equal(resultado.aprobado, true);
    assert.match(resultado.referencia, /^SIM-/);
  });

  test('rechaza sin método de pago o con un monto inválido', async () => {
    const servicio = new PagoSimuladoService();
    await assert.rejects(() => servicio.procesarPago(null, 100), ReglaNegocioError);
    await assert.rejects(() => servicio.procesarPago(new MetodoPago({ idMetodoPago: 1 }), 0), ReglaNegocioError);
    await assert.rejects(() => servicio.procesarPago(new MetodoPago({ idMetodoPago: 1 }), -5), ReglaNegocioError);
  });
});
