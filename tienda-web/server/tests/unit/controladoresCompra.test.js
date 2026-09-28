'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const ClienteController = require('../../src/controllers/ClienteController');
const CarritoController = require('../../src/controllers/CarritoController');
const PedidoController = require('../../src/controllers/PedidoController');
const Direccion = require('../../src/domain/Direccion');
const MetodoPago = require('../../src/domain/MetodoPago');
const Carrito = require('../../src/domain/Carrito');
const Pedido = require('../../src/domain/Pedido');
const { NoEncontradoError, ReglaNegocioError } = require('../../src/errors/errores');

const respuesta = () => ({
  estado: 200, cuerpo: undefined, terminada: false,
  status(c) { this.estado = c; return this; },
  json(c) { this.cuerpo = c; return this; },
  end() { this.terminada = true; return this; },
});
const direccion = () => new Direccion({ idDireccion: 1, idUsuario: 7, calle: 'Reforma', numeroExterior: '1', colonia: 'C', codigoPostal: '00000', municipio: 'M', ciudad: 'CD', idPais: 1 });
const metodo = () => new MetodoPago({ idMetodoPago: 2, idUsuario: 7, titular: 'Ana', ultimos4: '1111', mesVencimiento: 8, anioVencimiento: 2030 });

describe('ClienteController', () => {
  function crear() {
    const llamadas = [];
    const direccionService = {
      listar: async (...a) => { llamadas.push(['listarDir', ...a]); return [direccion()]; },
      crear: async (...a) => { llamadas.push(['crearDir', ...a]); return direccion(); },
      actualizar: async (...a) => { llamadas.push(['actualizarDir', ...a]); return direccion(); },
      eliminar: async (...a) => { llamadas.push(['eliminarDir', ...a]); },
      establecerPrincipal: async (...a) => { llamadas.push(['principalDir', ...a]); return direccion(); },
    };
    const metodoPagoService = {
      listar: async (...a) => { llamadas.push(['listarMet', ...a]); return [metodo()]; },
      crear: async (...a) => { llamadas.push(['crearMet', ...a]); return metodo(); },
      actualizar: async (...a) => { llamadas.push(['actualizarMet', ...a]); return metodo(); },
      eliminar: async (...a) => { llamadas.push(['eliminarMet', ...a]); },
      establecerPrincipal: async (...a) => { llamadas.push(['principalMet', ...a]); return metodo(); },
    };
    return { controlador: new ClienteController({ direccionService, metodoPagoService }), llamadas };
  }
  const req = (extra) => ({ user: { idUsuario: 7 }, ip: '1.1.1.1', ...extra });

  test('direcciones: listar, crear, actualizar, eliminar y principal usan el usuario de la sesión', async () => {
    const { controlador, llamadas } = crear();
    await controlador.listarDirecciones(req(), respuesta());
    const c = respuesta();
    await controlador.crearDireccion(req({ body: { calle: 'x' } }), c);
    assert.equal(c.estado, 201);
    await controlador.actualizarDireccion(req({ params: { id: '1' }, body: {} }), respuesta());
    const e = respuesta();
    await controlador.eliminarDireccion(req({ params: { id: '1' } }), e);
    assert.equal(e.estado, 204);
    await controlador.principalDireccion(req({ params: { id: '1' } }), respuesta());

    assert.deepEqual(llamadas[0], ['listarDir', 7]);
    assert.deepEqual(llamadas[1], ['crearDir', 7, { calle: 'x' }, req().user, '1.1.1.1']);
    assert.deepEqual(llamadas[2].slice(0, 2), ['actualizarDir', 1]);
    assert.deepEqual(llamadas[3].slice(0, 2), ['eliminarDir', 1]);
    assert.deepEqual(llamadas[4].slice(0, 2), ['principalDir', 1]);
  });

  test('métodos de pago: mismas operaciones, aisladas de otro cliente', async () => {
    const { controlador, llamadas } = crear();
    await controlador.listarMetodosPago(req(), respuesta());
    const c = respuesta();
    await controlador.crearMetodoPago(req({ body: {} }), c);
    assert.equal(c.estado, 201);
    await controlador.actualizarMetodoPago(req({ params: { id: '2' }, body: {} }), respuesta());
    const e = respuesta();
    await controlador.eliminarMetodoPago(req({ params: { id: '2' } }), e);
    assert.equal(e.estado, 204);
    await controlador.principalMetodoPago(req({ params: { id: '2' } }), respuesta());
    assert.equal(llamadas.filter((l) => l[0].endsWith('Met')).length, 5);
  });
});

describe('CarritoController', () => {
  function crear() {
    const llamadas = [];
    const carritoService = {
      obtener: async (...a) => { llamadas.push(['obtener', ...a]); return new Carrito(); },
      agregar: async (...a) => { llamadas.push(['agregar', ...a]); return new Carrito(); },
      actualizarCantidad: async (...a) => { llamadas.push(['actualizarCantidad', ...a]); return new Carrito(); },
      quitar: async (...a) => { llamadas.push(['quitar', ...a]); return new Carrito(); },
    };
    return { controlador: new CarritoController({ carritoService }), llamadas };
  }
  const req = (extra) => ({ user: { idUsuario: 7 }, ...extra });

  test('obtener y agregar', async () => {
    const { controlador, llamadas } = crear();
    await controlador.obtener(req(), respuesta());
    const r = respuesta();
    await controlador.agregar(req({ body: { idProducto: '5', cantidad: 2 } }), r);
    assert.equal(r.estado, 201);
    assert.deepEqual(llamadas[1], ['agregar', 7, 5, 2]);
  });

  test('actualizar y quitar toman el producto de la ruta', async () => {
    const { controlador, llamadas } = crear();
    await controlador.actualizar(req({ params: { idProducto: '5' }, body: { cantidad: 3 } }), respuesta());
    await controlador.quitar(req({ params: { idProducto: '5' } }), respuesta());
    assert.deepEqual(llamadas[0], ['actualizarCantidad', 7, 5, 3]);
    assert.deepEqual(llamadas[1], ['quitar', 7, 5]);
  });

  test('un identificador de producto inválido no llega al servicio', async () => {
    const { controlador } = crear();
    await assert.rejects(() => controlador.agregar(req({ body: { idProducto: 'x', cantidad: 1 } }), respuesta()), NoEncontradoError);
  });
});

describe('PedidoController', () => {
  function crear() {
    const llamadas = [];
    const pedidoService = {
      realizarCompra: async (...a) => { llamadas.push(['comprar', ...a]); return new Pedido({ idPedido: 1, idUsuario: 7, estatus: 'Pagada', detalles: [] }); },
      misPedidos: async (...a) => { llamadas.push(['mis', ...a]); return [new Pedido({ idPedido: 1, idUsuario: 7, estatus: 'Pagada', detalles: [] })]; },
      detalle: async (...a) => { llamadas.push(['detalle', ...a]); return new Pedido({ idPedido: 1, idUsuario: 7, estatus: 'Pagada', detalles: [] }); },
      ventasDelDia: async (...a) => { llamadas.push(['ventas', ...a]); return []; },
    };
    return { controlador: new PedidoController({ pedidoService }), llamadas };
  }
  const req = (extra) => ({ user: { idUsuario: 7 }, ip: '1.1.1.1', ...extra });

  test('comprar toma la dirección y el método de pago del cuerpo', async () => {
    const { controlador, llamadas } = crear();
    const r = respuesta();
    await controlador.comprar(req({ body: { idDireccion: '1', idMetodoPago: '2' } }), r);
    assert.equal(r.estado, 201);
    assert.deepEqual(llamadas[0], ['comprar', 7, 1, 2, req().user, '1.1.1.1']);
  });

  test('misPedidos y detalle', async () => {
    const { controlador, llamadas } = crear();
    const r1 = respuesta();
    await controlador.misPedidos(req(), r1);
    assert.equal(r1.cuerpo.pedidos.length, 1);
    const r2 = respuesta();
    await controlador.detalle(req({ params: { id: '1' } }), r2);
    assert.equal(r2.cuerpo.pedido.idPedido, 1);
    assert.deepEqual(llamadas[1], ['detalle', 1, 7]);
  });

  test('ventasDelDia exige una fecha con formato AAAA-MM-DD', async () => {
    const { controlador } = crear();
    await controlador.ventasDelDia(req({ query: { fecha: '2026-09-19' } }), respuesta());
    for (const mala of [undefined, '', '19/09/2026', '2026-9-19']) {
      await assert.rejects(() => controlador.ventasDelDia(req({ query: { fecha: mala } }), respuesta()), ReglaNegocioError);
    }
  });
});
