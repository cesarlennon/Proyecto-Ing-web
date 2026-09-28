'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const CalificacionService = require('../../src/services/CalificacionService');
const RecomendacionService = require('../../src/services/RecomendacionService');
const Calificacion = require('../../src/domain/Calificacion');
const Recomendacion = require('../../src/domain/Recomendacion');
const { crearUsuario } = require('../../src/domain/crearUsuario');
const { NoAutorizadoError, NoEncontradoError, ValidacionError } = require('../../src/errors/errores');

const CLIENTE = crearUsuario({ idUsuario: 9, correo: 'ana@correo.com', nombres: 'Ana', apellidoPaterno: 'Pérez', rol: 'cliente' });

function crearFakes({ productoExiste = true, compraRecibida = true } = {}) {
  const f = { eventos: [] };
  f.productos = { async buscarPorId(id) { return productoExiste ? { idProducto: id } : null; } };
  f.pedidos = { llamadas: [], async existeCompraRecibida(idUsuario, idProducto) { this.llamadas.push([idUsuario, idProducto]); return compraRecibida; } };
  f.calificaciones = {
    guardadas: [],
    async guardar(idProducto, idUsuario, estrellas) { this.guardadas.push([idProducto, idUsuario, estrellas]); return new Calificacion({ idCalificacion: 1, idProducto, idUsuario, estrellas }); },
    async buscarDeCliente(idProducto, idUsuario) { return this.guardadas.length > 0 ? new Calificacion({ idProducto, idUsuario, estrellas: this.guardadas.at(-1)[2] }) : null; },
  };
  f.recomendaciones = {
    creadas: [],
    async listarPorProducto(idProducto) { return [new Recomendacion({ idRecomendacion: 1, idProducto, idUsuario: 5, texto: 'x', autor: 'Otro', fecha: null })]; },
    async crear(idProducto, idUsuario, texto) { this.creadas.push([idProducto, idUsuario, texto]); return new Recomendacion({ idRecomendacion: 2, idProducto, idUsuario, texto }); },
  };
  f.bitacora = { async registrar(...a) { f.eventos.push(a); } };
  f.calificacionService = new CalificacionService({ calificaciones: f.calificaciones, productos: f.productos, pedidos: f.pedidos, bitacora: f.bitacora });
  f.recomendacionService = new RecomendacionService({ recomendaciones: f.recomendaciones, productos: f.productos, pedidos: f.pedidos, bitacora: f.bitacora });
  return f;
}

describe('CalificacionService.calificar', () => {
  let f;
  beforeEach(() => { f = crearFakes(); });

  test('guarda la calificación cuando el cliente recibió el producto', async () => {
    const calificacion = await f.calificacionService.calificar(5, 9, 4, CLIENTE, '1.1.1.1');
    assert.deepEqual(f.calificaciones.guardadas, [[5, 9, 4]]);
    assert.equal(calificacion.estrellas, 4);
    assert.deepEqual(f.pedidos.llamadas, [[9, 5]]);
    assert.deepEqual(f.eventos[0], [9, 'producto_calificar', 'productos', 5, 'estrellas=4', '1.1.1.1']);
  });

  test('acepta 0 estrellas', async () => {
    await f.calificacionService.calificar(5, 9, 0, CLIENTE);
    assert.deepEqual(f.calificaciones.guardadas[0], [5, 9, 0]);
  });

  test('rechaza un valor de estrellas inválido antes de tocar el repositorio', async () => {
    for (const malo of [-1, 6, 2.5, 'x']) {
      await assert.rejects(() => f.calificacionService.calificar(5, 9, malo, CLIENTE), (e) => e instanceof ValidacionError && Boolean(e.campos.estrellas));
    }
    assert.equal(f.calificaciones.guardadas.length, 0);
  });

  test('rechaza calificar un producto que no existe', async () => {
    const g = crearFakes({ productoExiste: false });
    await assert.rejects(() => g.calificacionService.calificar(99, 9, 4, CLIENTE), NoEncontradoError);
  });

  test('rechaza calificar sin haber recibido el producto (CU-27)', async () => {
    const g = crearFakes({ compraRecibida: false });
    await assert.rejects(
      () => g.calificacionService.calificar(5, 9, 4, CLIENTE),
      (e) => e instanceof NoAutorizadoError && e.codigo === 'SIN_COMPRA_RECIBIDA',
    );
    assert.equal(g.calificaciones.guardadas.length, 0);
  });

  test('miCalificacion devuelve la calificación (o null) junto con si puede calificar (CU-27)', async () => {
    const r1 = await f.calificacionService.miCalificacion(5, 9);
    assert.equal(r1.calificacion, null);
    assert.equal(r1.puedeCalificar, true);
    await f.calificacionService.calificar(5, 9, 3, CLIENTE);
    const r2 = await f.calificacionService.miCalificacion(5, 9);
    assert.equal(r2.calificacion.estrellas, 3);
  });

  test('miCalificacion informa puedeCalificar en false si no ha recibido el producto', async () => {
    const g = crearFakes({ compraRecibida: false });
    const r = await g.calificacionService.miCalificacion(5, 9);
    assert.equal(r.puedeCalificar, false);
  });
});

describe('RecomendacionService', () => {
  let f;
  beforeEach(() => { f = crearFakes(); });

  test('listar exige que el producto exista', async () => {
    const lista = await f.recomendacionService.listar(5);
    assert.equal(lista.length, 1);
    const g = crearFakes({ productoExiste: false });
    await assert.rejects(() => g.recomendacionService.listar(99), NoEncontradoError);
  });

  test('recomendar guarda el texto normalizado y asigna el nombre del autor', async () => {
    const recomendacion = await f.recomendacionService.recomendar(5, 9, '  Excelente producto  ', CLIENTE, '1.1.1.1');
    assert.deepEqual(f.recomendaciones.creadas, [[5, 9, 'Excelente producto']]);
    assert.equal(recomendacion.autor, 'Ana Pérez');
    assert.deepEqual(f.eventos[0], [9, 'producto_recomendar', 'productos', 5, null, '1.1.1.1']);
  });

  test('rechaza texto vacío o demasiado largo antes de tocar el repositorio', async () => {
    await assert.rejects(() => f.recomendacionService.recomendar(5, 9, '', CLIENTE), (e) => e instanceof ValidacionError && Boolean(e.campos.texto));
    await assert.rejects(() => f.recomendacionService.recomendar(5, 9, 'x'.repeat(501), CLIENTE), ValidacionError);
    assert.equal(f.recomendaciones.creadas.length, 0);
  });

  test('rechaza recomendar un producto que no existe', async () => {
    const g = crearFakes({ productoExiste: false });
    await assert.rejects(() => g.recomendacionService.recomendar(99, 9, 'Bueno', CLIENTE), NoEncontradoError);
  });

  test('rechaza recomendar sin haber recibido el producto (CU-27)', async () => {
    const g = crearFakes({ compraRecibida: false });
    await assert.rejects(
      () => g.recomendacionService.recomendar(5, 9, 'Bueno', CLIENTE),
      (e) => e instanceof NoAutorizadoError && e.codigo === 'SIN_COMPRA_RECIBIDA',
    );
    assert.equal(g.recomendaciones.creadas.length, 0);
  });

  test('permite varias recomendaciones del mismo cliente para el mismo producto', async () => {
    await f.recomendacionService.recomendar(5, 9, 'Primera', CLIENTE);
    await f.recomendacionService.recomendar(5, 9, 'Segunda', CLIENTE);
    assert.equal(f.recomendaciones.creadas.length, 2);
  });
});
