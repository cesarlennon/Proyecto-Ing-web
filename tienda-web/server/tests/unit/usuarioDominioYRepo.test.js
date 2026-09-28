'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { crearUsuario } = require('../../src/domain/crearUsuario');
const UsuarioRepository = require('../../src/repositories/UsuarioRepository');

const BASE = { idUsuario: 3, correo: 'luis.r@correo.com', nombres: 'Luis', apellidoPaterno: 'Ramos', apellidoMaterno: 'Solís', rol: 'inventarios', activo: true, oauthProveedor: 'google', oauthId: 'g-9' };

describe('Usuario.paraAdmin', () => {
  test('incluye el estado y el rol, pero nunca datos de OAuth', () => {
    const json = crearUsuario(BASE).paraAdmin();
    assert.equal(json.nombre, 'Luis Ramos Solís');
    assert.equal(json.rol, 'inventarios');
    assert.equal(json.activo, true);
    assert.ok(!('oauthId' in json));
    assert.ok(!('oauthProveedor' in json));
  });
});

function bdFalsa(filas = []) {
  return { llamadas: [], filas, async consultar(sql, parametros) { this.llamadas.push({ sql: sql.replace(/\s+/g, ' ').trim(), parametros }); return this.filas; } };
}

describe('UsuarioRepository.listarTodos', () => {
  test('sin filtro lista a todos, ordenados por nombre', async () => {
    const bd = bdFalsa([]);
    await new UsuarioRepository(bd).listarTodos({});
    assert.equal(bd.llamadas[0].sql, 'SELECT * FROM usuarios ORDER BY nombres, apellido_paterno');
    assert.deepEqual(bd.llamadas[0].parametros, []);
  });

  test('con filtro de rol agrega la condición con el identificador correcto', async () => {
    const bd = bdFalsa([]);
    await new UsuarioRepository(bd).listarTodos({ rol: 'inventarios' });
    assert.match(bd.llamadas[0].sql, /WHERE id_rol = \? ORDER BY/);
    assert.deepEqual(bd.llamadas[0].parametros, [3]);
  });
});

describe('UsuarioRepository.cambiarEstado', () => {
  test('activa y desactiva escribiendo 1 o 0', async () => {
    const bd = bdFalsa();
    bd.consultar = async (sql, parametros) => { bd.llamadas.push({ sql, parametros }); return { affectedRows: 1 }; };
    const repo = new UsuarioRepository(bd);
    await repo.cambiarEstado(3, true);
    assert.deepEqual(bd.llamadas[0].parametros, [1, 3]);
    await repo.cambiarEstado(3, false);
    assert.deepEqual(bd.llamadas[1].parametros, [0, 3]);
  });
});
