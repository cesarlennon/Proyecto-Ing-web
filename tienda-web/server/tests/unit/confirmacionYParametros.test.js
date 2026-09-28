'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const ExigirConfirmacion = require('../../src/middleware/ExigirConfirmacion');
const ManejadorErrores = require('../../src/middleware/ManejadorErrores');
const { idDeRuta, enteroOpcional } = require('../../src/utils/parametros');
const { ReglaNegocioError, NoEncontradoError } = require('../../src/errors/errores');

const siguiente = () => {
  const r = { error: undefined };
  r.next = (e) => { r.error = e; };
  return r;
};

describe('ExigirConfirmacion', () => {
  test('deja pasar si el cuerpo trae confirmado: true o la URL trae ?confirmado=true', () => {
    for (const req of [{ body: { confirmado: true }, query: {} }, { body: {}, query: { confirmado: 'true' } }]) {
      const s = siguiente();
      ExigirConfirmacion.exigir(req, {}, s.next);
      assert.equal(s.error, undefined);
    }
  });

  test('rechaza cualquier otra cosa', () => {
    const casos = [
      { body: {}, query: {} },
      { body: { confirmado: 'true' }, query: {} },
      { body: { confirmado: 1 }, query: {} },
      { body: { confirmado: false }, query: { confirmado: 'false' } },
      { query: {} },
      {},
    ];
    for (const req of casos) {
      const s = siguiente();
      ExigirConfirmacion.exigir(req, {}, s.next);
      assert.ok(s.error instanceof ReglaNegocioError, JSON.stringify(req));
      assert.equal(s.error.codigo, 'CONFIRMACION_REQUERIDA');
    }
  });
});

describe('Errores de carga de archivos', () => {
  const res = () => ({ estado: null, cuerpo: null, status(c) { this.estado = c; return this; }, json(c) { this.cuerpo = c; return this; } });
  const manejar = ManejadorErrores.manejar({ error() {} });
  const multer = (code) => Object.assign(new Error('x'), { name: 'MulterError', code });

  test('los errores de multer se responden como 400 con un mensaje claro', () => {
    const casos = { LIMIT_FILE_SIZE: /5 MB/, LIMIT_FILE_COUNT: /10 imágenes/, LIMIT_UNEXPECTED_FILE: /campo/, OTRO: /No se pudo procesar/ };
    for (const [code, patron] of Object.entries(casos)) {
      const r = res();
      manejar(multer(code), { method: 'POST', originalUrl: '/api/x' }, r, () => {});
      assert.equal(r.estado, 400);
      assert.equal(r.cuerpo.error.codigo, 'ARCHIVO_INVALIDO');
      assert.match(r.cuerpo.error.mensaje, patron);
    }
  });
});

describe('Parámetros de ruta y de consulta', () => {
  test('idDeRuta acepta enteros positivos', () => {
    assert.equal(idDeRuta('5'), 5);
    assert.equal(idDeRuta(12), 12);
    assert.equal(idDeRuta('999999999'), 999999999);
  });

  test('idDeRuta trata cualquier otro valor como recurso inexistente', () => {
    for (const malo of ['0', '-1', '1.5', 'abc', '', '1e3', '9999999999', undefined, null, '5 OR 1=1']) {
      assert.throws(() => idDeRuta(malo), NoEncontradoError, String(malo));
    }
  });

  test('enteroOpcional devuelve el valor por omisión cuando no es válido', () => {
    assert.equal(enteroOpcional('7', 1), 7);
    assert.equal(enteroOpcional(undefined, 1), 1);
    assert.equal(enteroOpcional('', 4), 4);
    assert.equal(enteroOpcional('0', 1), 1);
    assert.equal(enteroOpcional('-2', 1), 1);
    assert.equal(enteroOpcional('x', null), null);
  });
});
