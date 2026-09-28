'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const BaseRepository = require('../../src/repositories/BaseRepository');

class ProductosFalso extends BaseRepository {
  constructor(bd) {
    super(bd, 'productos', 'id_producto', ['nombre', 'precio', 'activo']);
  }
  mapear(fila) {
    return { id: fila.id_producto, nombre: fila.nombre };
  }
}

function bdFalsa(respuesta = []) {
  return {
    llamadas: [],
    async consultar(sql, parametros) {
      this.llamadas.push({ sql, parametros });
      return respuesta;
    },
  };
}

describe('BaseRepository', () => {
  let bd;
  let repo;
  beforeEach(() => {
    bd = bdFalsa();
    repo = new ProductosFalso(bd);
  });

  test('es una clase abstracta', () => {
    assert.throws(() => new BaseRepository(bd, 't', 'id', []), TypeError);
  });

  test('rechaza identificadores que no sean nombres simples de tabla o columna', () => {
    class Malo extends BaseRepository {
      constructor() {
        super(bd, 'productos; DROP TABLE x', 'id', []);
      }
    }
    assert.throws(() => new Malo(), /Identificador no válido/);
  });

  test('buscarPorId usa parámetros y mapea la fila', async () => {
    bd.consultar = async (sql, parametros) => {
      bd.llamadas.push({ sql, parametros });
      return [{ id_producto: 3, nombre: 'Lámpara' }];
    };
    const producto = await repo.buscarPorId(3);
    assert.deepEqual(producto, { id: 3, nombre: 'Lámpara' });
    assert.equal(bd.llamadas[0].sql, 'SELECT * FROM `productos` WHERE `id_producto` = ?');
    assert.deepEqual(bd.llamadas[0].parametros, [3]);
  });

  test('buscarPorId devuelve null si no hay resultados', async () => {
    assert.equal(await repo.buscarPorId(99), null);
  });

  test('listar construye el WHERE solo con columnas permitidas', async () => {
    await repo.listar({ activo: 1, nombre: 'x' });
    assert.equal(bd.llamadas[0].sql, 'SELECT * FROM `productos` WHERE `activo` = ? AND `nombre` = ?');
    assert.deepEqual(bd.llamadas[0].parametros, [1, 'x']);
    await repo.listar();
    assert.equal(bd.llamadas[1].sql, 'SELECT * FROM `productos`');
    await assert.rejects(() => repo.listar({ 'activo = 1 OR 1': 1 }), /Columna no permitida/);
  });

  test('crear devuelve el identificador generado y usa parámetros', async () => {
    bd.consultar = async (sql, parametros) => {
      bd.llamadas.push({ sql, parametros });
      return { insertId: 42 };
    };
    const id = await repo.crear({ nombre: "O'Brien'); DROP TABLE productos;--", precio: 10 });
    assert.equal(id, 42);
    assert.equal(bd.llamadas[0].sql, 'INSERT INTO `productos` (`nombre`, `precio`) VALUES (?, ?)');
    assert.deepEqual(bd.llamadas[0].parametros, ["O'Brien'); DROP TABLE productos;--", 10]);
  });

  test('crear rechaza columnas desconocidas y datos vacíos', async () => {
    await assert.rejects(() => repo.crear({ nombre: 'x', admin: 1 }), /Columna no permitida: admin/);
    await assert.rejects(() => repo.crear({}), /No hay datos/);
  });

  test('crear acepta la llave primaria (necesario en tablas 1 a 1)', async () => {
    bd.consultar = async () => ({ insertId: 0 });
    await repo.crear({ id_producto: 5, nombre: 'x' });
  });

  test('actualizar y eliminar indican si se modificó una fila', async () => {
    bd.consultar = async (sql, parametros) => {
      bd.llamadas.push({ sql, parametros });
      return { affectedRows: 1 };
    };
    assert.equal(await repo.actualizar(7, { precio: 5 }), true);
    assert.equal(bd.llamadas[0].sql, 'UPDATE `productos` SET `precio` = ? WHERE `id_producto` = ?');
    assert.deepEqual(bd.llamadas[0].parametros, [5, 7]);
    assert.equal(await repo.eliminar(7), true);
    assert.equal(bd.llamadas[1].sql, 'DELETE FROM `productos` WHERE `id_producto` = ?');

    bd.consultar = async () => ({ affectedRows: 0 });
    assert.equal(await repo.actualizar(8, { precio: 5 }), false);
    await assert.rejects(() => repo.actualizar(1, { id_producto: 2 }), /Columna no permitida/);
  });

  test('con una conexión de transacción, la consulta se ejecuta en ella y no en el pool', async () => {
    const cx = bdFalsa([{ id_producto: 1, nombre: 'a' }]);
    const resultado = await repo.buscarPorId(1, cx);
    assert.equal(resultado.id, 1);
    assert.equal(cx.llamadas.length, 1);
    assert.equal(bd.llamadas.length, 0);
  });
});
