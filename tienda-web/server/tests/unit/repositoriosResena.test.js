'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const CalificacionRepository = require('../../src/repositories/CalificacionRepository');
const RecomendacionRepository = require('../../src/repositories/RecomendacionRepository');

function bdFalsa(filas = []) {
  return { llamadas: [], filas, async consultar(sql, parametros) { this.llamadas.push({ sql: sql.replace(/\s+/g, ' ').trim(), parametros }); return this.filas; } };
}

describe('CalificacionRepository', () => {
  test('guardar usa ON DUPLICATE KEY para permitir una sola calificación por cliente y producto', async () => {
    const bd = bdFalsa([{ id_calificacion: 1, id_producto: 5, id_usuario: 9, estrellas: 4, fecha: null }]);
    const calificacion = await new CalificacionRepository(bd).guardar(5, 9, 4);
    assert.match(bd.llamadas[0].sql, /ON DUPLICATE KEY UPDATE estrellas = VALUES\(estrellas\)/);
    assert.deepEqual(bd.llamadas[0].parametros, [5, 9, 4]);
    assert.equal(calificacion.estrellas, 4);
  });

  test('promedio devuelve null cuando el producto no tiene calificaciones', async () => {
    const bd = bdFalsa([{ promedio: null, total: 0 }]);
    assert.deepEqual(await new CalificacionRepository(bd).promedio(5), { promedio: null, total: 0 });
  });

  test('promedio convierte el resultado a número', async () => {
    const bd = bdFalsa([{ promedio: '4.5', total: '3' }]);
    assert.deepEqual(await new CalificacionRepository(bd).promedio(5), { promedio: 4.5, total: 3 });
  });

  test('buscarDeCliente filtra por producto y por cliente', async () => {
    const bd = bdFalsa([]);
    assert.equal(await new CalificacionRepository(bd).buscarDeCliente(5, 9), null);
    assert.deepEqual(bd.llamadas[0].parametros, [5, 9]);
  });
});

describe('RecomendacionRepository', () => {
  test('listarPorProducto arma el nombre del autor y ordena de la más reciente a la más antigua', async () => {
    const bd = bdFalsa([{ id_recomendacion: 1, id_producto: 5, id_usuario: 9, texto: 'Excelente', fecha: '2026-09-01', autor_nombres: 'Ana', autor_apellido: 'Pérez' }]);
    const lista = await new RecomendacionRepository(bd).listarPorProducto(5);
    assert.match(bd.llamadas[0].sql, /ORDER BY r\.fecha DESC/);
    assert.equal(lista[0].autor, 'Ana Pérez');
    assert.ok(!('idUsuario' in lista[0].paraJSON()));
  });

  test('crear inserta y devuelve la recomendación recién creada', async () => {
    const bd = bdFalsa();
    let paso = 0;
    bd.consultar = async (sql, parametros) => {
      paso += 1;
      bd.llamadas.push({ sql, parametros });
      if (paso === 1) return { insertId: 7 };
      return [{ id_recomendacion: 7, id_producto: 5, id_usuario: 9, texto: 'Buen producto', fecha: '2026-09-01' }];
    };
    const recomendacion = await new RecomendacionRepository(bd).crear(5, 9, 'Buen producto');
    assert.equal(recomendacion.idRecomendacion, 7);
    assert.equal(recomendacion.texto, 'Buen producto');
  });
});
