'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Direccion = require('../../src/domain/Direccion');
const Pais = require('../../src/domain/Pais');
const MetodoPago = require('../../src/domain/MetodoPago');
const Carrito = require('../../src/domain/Carrito');
const ItemCarrito = require('../../src/domain/ItemCarrito');
const Producto = require('../../src/domain/Producto');
const Pedido = require('../../src/domain/Pedido');
const DetallePedido = require('../../src/domain/DetallePedido');
const { ESTATUS, ORDEN, siguienteEstatus, estatusPorId, IDS_ESTATUS } = require('../../src/domain/EstatusPedido');
const { ReglaNegocioError } = require('../../src/errors/errores');

describe('EstatusPedido', () => {
  test('el orden es el que exige el proyecto', () => {
    assert.deepEqual(ORDEN, ['En proceso', 'Pagada', 'Enviado', 'Recibido']);
  });

  test('siguienteEstatus avanza uno a la vez y es null al final', () => {
    assert.equal(siguienteEstatus(ESTATUS.EN_PROCESO), ESTATUS.PAGADA);
    assert.equal(siguienteEstatus(ESTATUS.ENVIADO), ESTATUS.RECIBIDO);
    assert.equal(siguienteEstatus(ESTATUS.RECIBIDO), null);
    assert.throws(() => siguienteEstatus('Cancelada'));
  });

  test('estatusPorId y IDS_ESTATUS son coherentes entre sí', () => {
    for (const nombre of ORDEN) assert.equal(estatusPorId(IDS_ESTATUS[nombre]), nombre);
    assert.throws(() => estatusPorId(9));
  });
});

describe('Direccion', () => {
  test('textoCompleto arma la dirección legible, con y sin número interior', () => {
    const pais = new Pais({ idPais: 1, nombre: 'México' });
    const conInterior = new Direccion({
      idDireccion: 1, idUsuario: 1, calle: 'Av. Universidad', numeroExterior: '1200', numeroInterior: '4B',
      colonia: 'Xoco', codigoPostal: '04310', municipio: 'Benito Juárez', ciudad: 'CDMX', idPais: 1, pais,
    });
    assert.equal(conInterior.textoCompleto(), 'Av. Universidad 1200 Int. 4B, Col. Xoco, Benito Juárez, CDMX, México, C.P. 04310');

    const sinInterior = new Direccion({ ...conInterior, numeroInterior: null });
    assert.match(sinInterior.textoCompleto(), /^Av\. Universidad 1200,/);
  });

  test('paraJSON incluye el país y el texto completo', () => {
    const d = new Direccion({
      idDireccion: 1, idUsuario: 1, calle: 'Reforma', numeroExterior: '10', colonia: 'Centro',
      codigoPostal: '06000', municipio: 'Cuauhtémoc', ciudad: 'CDMX', idPais: 1,
      pais: new Pais({ idPais: 1, nombre: 'México' }), esPrincipal: true,
    });
    const json = d.paraJSON();
    assert.equal(json.pais.nombre, 'México');
    assert.equal(json.esPrincipal, true);
    assert.ok(json.textoCompleto.includes('Reforma'));
  });
});

describe('MetodoPago', () => {
  const metodo = (extra = {}) =>
    new MetodoPago({ idMetodoPago: 1, idUsuario: 1, titular: 'Ana Pérez', ultimos4: '1111', mesVencimiento: 8, anioVencimiento: 2026, ...extra });

  test('numeroEnmascarado y vencimientoTexto', () => {
    assert.equal(metodo().numeroEnmascarado(), '•••• 1111');
    assert.equal(metodo().vencimientoTexto(), '08/26');
  });

  test('estaVigente compara con el fin del mes de vencimiento', () => {
    assert.ok(metodo().estaVigente(new Date('2026-08-31T23:00:00')));
    assert.ok(!metodo().estaVigente(new Date('2026-09-01T00:00:01')));
  });

  test('paraJSON nunca incluye el número cifrado ni el CVV', () => {
    const json = metodo({ numeroCifrado: Buffer.from('secreto') }).paraJSON();
    assert.ok(!('numeroCifrado' in json));
    assert.ok(!('cvv' in json));
    assert.equal(json.numeroEnmascarado, '•••• 1111');
  });
});

describe('Carrito e ItemCarrito', () => {
  const producto = (precio) => new Producto({ idProducto: 1, nombre: 'A', precio, stock: 10 });

  test('subtotal y total redondean a centavos', () => {
    const item = new ItemCarrito({ producto: producto(19.999), cantidad: 3 });
    assert.equal(item.subtotal(), 60); // 19.999 * 3 = 59.997 -> redondeado a 60.00
    const carrito = new Carrito({ items: [item, new ItemCarrito({ producto: producto(10), cantidad: 2 })] });
    assert.equal(carrito.total(), 80);
  });

  test('estaVacio', () => {
    assert.ok(new Carrito().estaVacio());
    assert.ok(!new Carrito({ items: [new ItemCarrito({ producto: producto(1), cantidad: 1 })] }).estaVacio());
  });

  test('paraJSON expone los renglones y el total', () => {
    const carrito = new Carrito({ items: [new ItemCarrito({ producto: producto(100), cantidad: 2 })] });
    assert.deepEqual(carrito.paraJSON().items[0], { idProducto: 1, nombre: 'A', precio: 100, imagen: null, cantidad: 2, subtotal: 200 });
    assert.equal(carrito.paraJSON().total, 200);
  });
});

describe('DetallePedido y Pedido', () => {
  const detalle = (cantidad, precio) => new DetallePedido({ producto: new Producto({ idProducto: 1, nombre: 'A' }), cantidad, precioUnitario: precio });

  test('DetallePedido.subtotal', () => {
    assert.equal(detalle(3, 10.5).subtotal(), 31.5);
  });

  test('calcularTotal suma los subtotales de los detalles', () => {
    const pedido = new Pedido({ idPedido: 1, idUsuario: 1, estatus: ESTATUS.EN_PROCESO, detalles: [detalle(2, 100), detalle(1, 50)] });
    assert.equal(pedido.calcularTotal(), 250);
  });

  test('contieneProducto y estaRecibido', () => {
    const pedido = new Pedido({ idPedido: 1, idUsuario: 1, estatus: ESTATUS.RECIBIDO, detalles: [detalle(1, 10)] });
    assert.ok(pedido.contieneProducto(1));
    assert.ok(!pedido.contieneProducto(99));
    assert.ok(pedido.estaRecibido());
  });

  test('avanzarEstatus solo permite el siguiente estatus del flujo', () => {
    const pedido = new Pedido({ idPedido: 1, idUsuario: 1, estatus: ESTATUS.EN_PROCESO });
    pedido.avanzarEstatus(ESTATUS.PAGADA);
    assert.equal(pedido.estatus, ESTATUS.PAGADA);
    assert.throws(() => pedido.avanzarEstatus(ESTATUS.RECIBIDO), ReglaNegocioError);
    assert.equal(pedido.estatus, ESTATUS.PAGADA); // no cambia si falla
  });

  test('avanzarEstatus informa cuando ya está en el último estatus', () => {
    const pedido = new Pedido({ idPedido: 1, idUsuario: 1, estatus: ESTATUS.RECIBIDO });
    assert.throws(() => pedido.avanzarEstatus(ESTATUS.RECIBIDO), /último estatus/);
  });

  test('paraJSON incluye los detalles serializados', () => {
    const pedido = new Pedido({ idPedido: 1, idUsuario: 1, estatus: ESTATUS.PAGADA, total: 100, detalles: [detalle(1, 100)] });
    assert.equal(pedido.paraJSON().detalles.length, 1);
    assert.equal(pedido.paraJSON().estatus, 'Pagada');
  });
});
