'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const PedidoService = require('../../src/services/PedidoService');
const ItemCarrito = require('../../src/domain/ItemCarrito');
const Producto = require('../../src/domain/Producto');
const Direccion = require('../../src/domain/Direccion');
const MetodoPago = require('../../src/domain/MetodoPago');
const Pedido = require('../../src/domain/Pedido');
const DetallePedido = require('../../src/domain/DetallePedido');
const { ESTATUS } = require('../../src/domain/EstatusPedido');
const { NoEncontradoError, ReglaNegocioError, ExistenciasInsuficientesError } = require('../../src/errors/errores');

const USUARIO = { idUsuario: 7 };
const producto = (id, precio, stock) => new Producto({ idProducto: id, nombre: 'Producto ' + id, precio, stock, activo: true });
const direccion = () => new Direccion({ idDireccion: 1, idUsuario: 7, calle: 'Reforma', numeroExterior: '1', colonia: 'C', codigoPostal: '00000', municipio: 'M', ciudad: 'CD', idPais: 1 });
const metodoPago = () => new MetodoPago({ idMetodoPago: 2, idUsuario: 7, titular: 'Ana', ultimos4: '1111', mesVencimiento: 8, anioVencimiento: 2030 });

function crearFakes({ carrito = [], direccionValida = true, metodoValido = true, existencias = null, pagoAprobado = true } = {}) {
  const f = { eventos: [], acciones: [] };
  f.carritoRepo = {
    async obtener() { return carrito; },
    async vaciar() { f.acciones.push('vaciar'); },
  };
  f.direcciones = { async buscarDeCliente(id, idUsuario) { return direccionValida ? direccion() : null; } };
  f.metodosPago = { async buscarDeCliente(id, idUsuario) { return metodoValido ? metodoPago() : null; } };
  f.pedidos = {
    creado: null,
    estatusActualizado: [],
    async crearPedido(datos, cx) { f.acciones.push('crearPedido'); this.creado = datos; return 100; },
    async actualizarEstatus(id, estatus, cx) { this.estatusActualizado.push([id, estatus]); f.acciones.push('actualizarEstatus:' + estatus); },
    async listarPorCliente(idUsuario) { return [new Pedido({ idPedido: 100, idUsuario, estatus: ESTATUS.PAGADA, total: 100, detalles: [] })]; },
    async buscarConDetalle(id) {
      if (id !== 100) return null;
      return new Pedido({ idPedido: 100, idUsuario: 7, estatus: ESTATUS.PAGADA, total: 100, direccionEnvio: direccion().textoCompleto(), tarjetaUltimos4: '1111', detalles: [new DetallePedido({ producto: producto(1, 100, 5), cantidad: 1, precioUnitario: 100 })] });
    },
    async listarPorFecha(fecha) { return [new Pedido({ idPedido: 100, idUsuario: 7, estatus: ESTATUS.PAGADA, total: 100, detalles: [] })]; },
  };
  f.inventario = {
    async validarExistencias(items, cx) {
      f.acciones.push('validarExistencias');
      if (existencias === false) throw new ExistenciasInsuficientesError();
      return new Map(items.map((i) => [i.producto.idProducto, i.producto]));
    },
    async descontar() { f.acciones.push('descontar'); },
  };
  f.pagos = {
    async procesarPago(metodo, total) {
      f.acciones.push('procesarPago');
      return { aprobado: pagoAprobado, referencia: 'SIM-1' };
    },
  };
  f.bd = {
    async transaccion(trabajo) {
      try {
        return await trabajo({ tx: true });
      } catch (error) {
        f.acciones.push('rollback');
        throw error;
      }
    },
  };
  f.bitacora = { async registrar(...a) { f.eventos.push(a); } };
  f.servicio = new PedidoService({
    bd: f.bd, pedidos: f.pedidos, carritoRepo: f.carritoRepo, direcciones: f.direcciones, metodosPago: f.metodosPago,
    inventario: f.inventario, pagos: f.pagos, bitacora: f.bitacora,
  });
  return f;
}

const CARRITO_NORMAL = [new ItemCarrito({ producto: producto(1, 100, 5), cantidad: 2 }), new ItemCarrito({ producto: producto(2, 50, 5), cantidad: 1 })];

describe('PedidoService.realizarCompra: camino exitoso', () => {
  let f;
  beforeEach(() => { f = crearFakes({ carrito: CARRITO_NORMAL }); });

  test('sigue el orden: valida existencias, crea el pedido, cobra, pasa a Pagada, descuenta y vacía', async () => {
    await f.servicio.realizarCompra(7, 1, 2, USUARIO, '1.1.1.1');
    assert.deepEqual(f.acciones, ['validarExistencias', 'crearPedido', 'procesarPago', 'actualizarEstatus:Pagada', 'descontar', 'vaciar']);
  });

  test('el pedido se crea con el total, la dirección y los últimos 4 dígitos correctos', async () => {
    await f.servicio.realizarCompra(7, 1, 2, USUARIO);
    assert.equal(f.pedidos.creado.idUsuario, 7);
    assert.equal(f.pedidos.creado.total, 250); // 2*100 + 1*50
    assert.equal(f.pedidos.creado.tarjetaUltimos4, '1111');
    assert.ok(f.pedidos.creado.direccionEnvio.includes('Reforma'));
    assert.equal(f.pedidos.creado.detalles.length, 2);
  });

  test('registra el evento de compra en la bitácora y devuelve el detalle', async () => {
    const pedido = await f.servicio.realizarCompra(7, 1, 2, USUARIO, '1.1.1.1');
    assert.equal(pedido.idPedido, 100);
    assert.deepEqual(f.eventos[0], [7, 'pedido_compra', 'pedidos', 100, null, '1.1.1.1']);
  });
});

describe('PedidoService.realizarCompra: casos de error', () => {
  test('un carrito vacío se rechaza antes de abrir una transacción', async () => {
    const f = crearFakes({ carrito: [] });
    await assert.rejects(() => f.servicio.realizarCompra(7, 1, 2, USUARIO), (e) => e instanceof ReglaNegocioError && e.codigo === 'CARRITO_VACIO');
    assert.deepEqual(f.acciones, []);
  });

  test('una dirección que no es del cliente se rechaza sin tocar el inventario', async () => {
    const f = crearFakes({ carrito: CARRITO_NORMAL, direccionValida: false });
    await assert.rejects(() => f.servicio.realizarCompra(7, 999, 2, USUARIO), NoEncontradoError);
    assert.deepEqual(f.acciones, []);
  });

  test('un método de pago que no es del cliente se rechaza', async () => {
    const f = crearFakes({ carrito: CARRITO_NORMAL, metodoValido: false });
    await assert.rejects(() => f.servicio.realizarCompra(7, 1, 999, USUARIO), NoEncontradoError);
  });

  test('sin existencias suficientes, la transacción se revierte y no se cobra ni se vacía el carrito', async () => {
    const f = crearFakes({ carrito: CARRITO_NORMAL, existencias: false });
    await assert.rejects(() => f.servicio.realizarCompra(7, 1, 2, USUARIO), ExistenciasInsuficientesError);
    assert.deepEqual(f.acciones, ['validarExistencias', 'rollback']);
    assert.equal(f.eventos.length, 0);
  });

  test('un pago rechazado revierte todo: no cambia el estatus, no descuenta y no vacía el carrito', async () => {
    const f = crearFakes({ carrito: CARRITO_NORMAL, pagoAprobado: false });
    await assert.rejects(
      () => f.servicio.realizarCompra(7, 1, 2, USUARIO),
      (e) => e instanceof ReglaNegocioError && e.codigo === 'PAGO_RECHAZADO',
    );
    assert.deepEqual(f.acciones, ['validarExistencias', 'crearPedido', 'procesarPago', 'rollback']);
    assert.equal(f.pedidos.estatusActualizado.length, 0);
  });
});

describe('PedidoService: consulta de pedidos', () => {
  let f;
  beforeEach(() => { f = crearFakes(); });

  test('misPedidos delega en el repositorio', async () => {
    const pedidos = await f.servicio.misPedidos(7);
    assert.equal(pedidos.length, 1);
  });

  test('detalle exige que el pedido pertenezca al cliente que lo consulta', async () => {
    const pedido = await f.servicio.detalle(100, 7);
    assert.equal(pedido.idPedido, 100);
    await assert.rejects(() => f.servicio.detalle(100, 99), NoEncontradoError); // es de otro cliente
    await assert.rejects(() => f.servicio.detalle(999, 7), NoEncontradoError); // no existe
  });

  test('ventasDelDia delega en el repositorio con la fecha', async () => {
    const pedidos = await f.servicio.ventasDelDia('2026-09-19');
    assert.equal(pedidos.length, 1);
  });
});
