'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const ResenaController = require('../../src/controllers/ResenaController');
const Calificacion = require('../../src/domain/Calificacion');
const Recomendacion = require('../../src/domain/Recomendacion');
const { NoEncontradoError } = require('../../src/errors/errores');

const respuesta = () => ({
  estado: 200, cuerpo: undefined,
  status(c) { this.estado = c; return this; },
  json(c) { this.cuerpo = c; return this; },
});
const req = (extra) => ({ user: { idUsuario: 9 }, ip: '1.1.1.1', ...extra });

function crear() {
  const llamadas = [];
  const calificacionService = {
    calificar: async (...a) => { llamadas.push(['calificar', ...a]); return new Calificacion({ idProducto: 5, idUsuario: 9, estrellas: 4 }); },
    miCalificacion: async (...a) => { llamadas.push(['miCalificacion', ...a]); return { calificacion: new Calificacion({ idProducto: 5, idUsuario: 9, estrellas: 4 }), puedeCalificar: true }; },
  };
  const recomendacionService = {
    listar: async (...a) => { llamadas.push(['listar', ...a]); return [new Recomendacion({ idRecomendacion: 1, idProducto: 5, idUsuario: 1, texto: 'x', autor: 'Otro' })]; },
    recomendar: async (...a) => { llamadas.push(['recomendar', ...a]); return new Recomendacion({ idRecomendacion: 2, idProducto: 5, idUsuario: 9, texto: 'y', autor: 'Ana' }); },
  };
  return { controlador: new ResenaController({ calificacionService, recomendacionService }), llamadas };
}

describe('ResenaController', () => {
  test('calificar toma el producto de la ruta, las estrellas del cuerpo y al usuario de la sesión', async () => {
    const { controlador, llamadas } = crear();
    const r = respuesta();
    await controlador.calificar(req({ params: { id: '5' }, body: { estrellas: 4 } }), r);
    assert.deepEqual(llamadas[0], ['calificar', 5, 9, 4, req().user, '1.1.1.1']);
    assert.equal(r.cuerpo.calificacion.estrellas, 4);
  });

  test('un identificador de producto inválido no llega al servicio', async () => {
    const { controlador } = crear();
    await assert.rejects(() => controlador.calificar(req({ params: { id: 'x' }, body: { estrellas: 4 } }), respuesta()), NoEncontradoError);
  });

  test('miCalificacion devuelve null cuando el servicio no encuentra ninguna', async () => {
    const llamadas = [];
    const calificacionService = { miCalificacion: async (...a) => { llamadas.push(a); return { calificacion: null, puedeCalificar: false }; } };
    const controlador = new ResenaController({ calificacionService, recomendacionService: {} });
    const r = respuesta();
    await controlador.miCalificacion(req({ params: { id: '5' } }), r);
    assert.deepEqual(r.cuerpo, { calificacion: null, puedeCalificar: false });
  });

  test('listarRecomendaciones y recomendar', async () => {
    const { controlador, llamadas } = crear();
    const r1 = respuesta();
    await controlador.listarRecomendaciones(req({ params: { id: '5' } }), r1);
    assert.equal(r1.cuerpo.recomendaciones.length, 1);
    assert.ok(!('idUsuario' in r1.cuerpo.recomendaciones[0]));

    const r2 = respuesta();
    await controlador.recomendar(req({ params: { id: '5' }, body: { texto: 'Muy bueno' } }), r2);
    assert.equal(r2.estado, 201);
    assert.deepEqual(llamadas[1], ['recomendar', 5, 9, 'Muy bueno', req().user, '1.1.1.1']);
  });
});
