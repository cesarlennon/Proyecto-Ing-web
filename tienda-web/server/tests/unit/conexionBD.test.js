'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { ConexionBD } = require('../../src/config/bd');

function poolFalso() {
  const registro = [];
  const conexion = {
    async beginTransaction() { registro.push('begin'); },
    async commit() { registro.push('commit'); },
    async rollback() { registro.push('rollback'); },
    release() { registro.push('release'); },
    async execute(sql, parametros) { registro.push(['execute', sql, parametros]); return [[{ ok: 1 }]]; },
  };
  const pool = {
    registro,
    async execute(sql, parametros) { registro.push(['pool', sql, parametros]); return [[{ ok: 1 }]]; },
    async getConnection() { registro.push('getConnection'); return conexion; },
    async end() { registro.push('end'); },
  };
  return pool;
}

describe('ConexionBD', () => {
  test('consultar devuelve las filas y convierte undefined en NULL', async () => {
    const pool = poolFalso();
    const bd = new ConexionBD(pool);
    const filas = await bd.consultar('SELECT ?, ?', [1, undefined]);
    assert.deepEqual(filas, [{ ok: 1 }]);
    assert.deepEqual(pool.registro[0], ['pool', 'SELECT ?, ?', [1, null]]);
  });

  test('transaccion confirma cuando el trabajo termina bien', async () => {
    const pool = poolFalso();
    const bd = new ConexionBD(pool);
    const resultado = await bd.transaccion(async (cx) => {
      await cx.consultar('INSERT ...', [1]);
      return 'listo';
    });
    assert.equal(resultado, 'listo');
    assert.deepEqual(pool.registro.map((r) => (Array.isArray(r) ? r[0] : r)), ['getConnection', 'begin', 'execute', 'commit', 'release']);
  });

  test('transaccion revierte, vuelve a lanzar el error y libera la conexión', async () => {
    const pool = poolFalso();
    const bd = new ConexionBD(pool);
    await assert.rejects(
      () => bd.transaccion(async () => { throw new Error('falló el pago'); }),
      /falló el pago/,
    );
    const pasos = pool.registro.map((r) => (Array.isArray(r) ? r[0] : r));
    assert.deepEqual(pasos, ['getConnection', 'begin', 'rollback', 'release']);
    assert.ok(!pasos.includes('commit'));
  });

  test('cerrar termina el pool', async () => {
    const pool = poolFalso();
    await new ConexionBD(pool).cerrar();
    assert.ok(pool.registro.includes('end'));
  });
});
