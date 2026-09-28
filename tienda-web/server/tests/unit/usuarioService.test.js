'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const UsuarioService = require('../../src/services/UsuarioService');
const { crearUsuario } = require('../../src/domain/crearUsuario');
const { NoEncontradoError, ReglaNegocioError, ValidacionError } = require('../../src/errors/errores');

const ADMIN = { idUsuario: 1 };
const DATOS = { correo: 'luis.r@correo.com', rol: 'inventarios', nombres: 'Luis', apellidoPaterno: 'Ramos', apellidoMaterno: 'Solís' };

function usuarioDe(extra = {}) {
  return crearUsuario({ idUsuario: 1, correo: 'admin@correo.com', nombres: 'Marta', apellidoPaterno: 'Solís', rol: 'administrador', activo: true, ...extra });
}

function crearFakes() {
  const f = { eventos: [] };
  f.usuarios = {
    filas: new Map([[1, usuarioDe()]]),
    siguiente: 2,
    async listarTodos(filtro) { f.ultimoFiltro = filtro; return [...this.filas.values()]; },
    async buscarPorId(id) { return this.filas.get(id) ?? null; },
    async buscarPorCorreo(correo) { return [...this.filas.values()].find((u) => u.correo === correo) ?? null; },
    async crearUsuario(datos) {
      const id = this.siguiente++;
      this.filas.set(id, crearUsuario({ idUsuario: id, correo: datos.correo, nombres: datos.nombres, apellidoPaterno: datos.apellidoPaterno, apellidoMaterno: datos.apellidoMaterno, rol: datos.rol, activo: true }));
      return id;
    },
    async actualizar(id, cambios) {
      const actual = this.filas.get(id);
      this.filas.set(id, crearUsuario({ idUsuario: id, correo: actual.correo, rol: actual.rol, activo: actual.activo,
        nombres: cambios.nombres ?? actual.nombres, apellidoPaterno: cambios.apellido_paterno ?? actual.apellidoPaterno, apellidoMaterno: cambios.apellido_materno !== undefined ? cambios.apellido_materno : actual.apellidoMaterno }));
    },
    async cambiarEstado(id, activo) {
      const actual = this.filas.get(id);
      this.filas.set(id, crearUsuario({ ...actual, activo }));
    },
  };
  f.bitacora = { async registrar(...a) { f.eventos.push(a); } };
  f.servicio = new UsuarioService({ usuarios: f.usuarios, bitacora: f.bitacora });
  return f;
}

describe('UsuarioService.listar', () => {
  test('sin filtro devuelve a todos', async () => {
    const f = crearFakes();
    await f.servicio.listar({});
    assert.deepEqual(f.ultimoFiltro, { rol: null });
  });

  test('acepta cliente como filtro de consulta aunque no se pueda crear desde aquí', async () => {
    const f = crearFakes();
    await f.servicio.listar({ rol: 'cliente' });
    assert.deepEqual(f.ultimoFiltro, { rol: 'cliente' });
  });

  test('rechaza un rol de filtro que no existe', async () => {
    const f = crearFakes();
    await assert.rejects(() => f.servicio.listar({ rol: 'root' }), ValidacionError);
  });
});

describe('UsuarioService.crear', () => {
  let f;
  beforeEach(() => { f = crearFakes(); });

  test('crea un usuario administrador o de inventarios y registra el evento', async () => {
    const usuario = await f.servicio.crear(DATOS, ADMIN, '1.1.1.1');
    assert.equal(usuario.correo, 'luis.r@correo.com');
    assert.equal(usuario.rol, 'inventarios');
    assert.deepEqual(f.eventos[0], [1, 'usuario_crear', 'usuarios', 2, 'rol=inventarios', '1.1.1.1']);
  });

  test('rechaza crear un usuario con rol cliente (se autoregistra por CU-11)', async () => {
    await assert.rejects(
      () => f.servicio.crear({ ...DATOS, rol: 'cliente' }, ADMIN),
      (e) => e instanceof ValidacionError && Boolean(e.campos.rol),
    );
  });

  test('rechaza datos inválidos sin tocar el repositorio', async () => {
    await assert.rejects(() => f.servicio.crear({ ...DATOS, correo: 'mal' }, ADMIN), ValidacionError);
    assert.equal(f.usuarios.filas.size, 1);
  });

  test('rechaza un correo ya registrado', async () => {
    await assert.rejects(
      () => f.servicio.crear({ ...DATOS, correo: 'admin@correo.com' }, ADMIN),
      (e) => e instanceof ValidacionError && Boolean(e.campos.correo),
    );
  });

  test('un correo duplicado detectado hasta la base de datos también se traduce', async () => {
    f.usuarios.crearUsuario = async () => { const err = new Error('dup'); err.code = 'ER_DUP_ENTRY'; throw err; };
    await assert.rejects(() => f.servicio.crear(DATOS, ADMIN), (e) => e instanceof ValidacionError && Boolean(e.campos.correo));
  });
});

describe('UsuarioService.actualizar', () => {
  let f;
  beforeEach(() => { f = crearFakes(); });

  test('actualiza nombre y apellidos, sin tocar correo ni rol', async () => {
    const actualizado = await f.servicio.actualizar(1, { nombres: 'Marta Elena', apellidoPaterno: 'Solís', apellidoMaterno: '' }, ADMIN, '1.1.1.1');
    assert.equal(actualizado.nombres, 'Marta Elena');
    assert.equal(actualizado.apellidoMaterno, null);
    assert.equal(actualizado.correo, 'admin@correo.com');
    assert.equal(actualizado.rol, 'administrador');
    assert.equal(f.eventos[0][1], 'usuario_actualizar');
  });

  test('falla si el usuario no existe o los datos no son válidos', async () => {
    await assert.rejects(() => f.servicio.actualizar(99, { nombres: 'X', apellidoPaterno: 'Y' }, ADMIN), NoEncontradoError);
    await assert.rejects(() => f.servicio.actualizar(1, { nombres: '' }, ADMIN), ValidacionError);
  });
});

describe('UsuarioService.cambiarEstado', () => {
  let f;
  beforeEach(() => { f = crearFakes(); f.usuarios.filas.set(2, crearUsuario({ idUsuario: 2, correo: 'x@x.com', nombres: 'X', apellidoPaterno: 'Y', rol: 'inventarios', activo: true })); });

  test('da de baja a otro usuario y lo registra', async () => {
    const actualizado = await f.servicio.cambiarEstado(2, false, ADMIN, '1.1.1.1');
    assert.equal(actualizado.activo, false);
    assert.equal(f.eventos[0][1], 'usuario_baja');
  });

  test('reactiva a un usuario dado de baja', async () => {
    await f.servicio.cambiarEstado(2, false, ADMIN);
    const reactivado = await f.servicio.cambiarEstado(2, true, ADMIN, '2.2.2.2');
    assert.equal(reactivado.activo, true);
    assert.equal(f.eventos.at(-1)[1], 'usuario_alta');
  });

  test('un administrador no puede deshabilitar su propia cuenta', async () => {
    await assert.rejects(
      () => f.servicio.cambiarEstado(1, false, ADMIN),
      (e) => e instanceof ReglaNegocioError && e.codigo === 'AUTOBAJA',
    );
  });

  test('sí puede reactivarse a sí mismo (por si otro admin lo deshabilitó)', async () => {
    f.usuarios.filas.set(1, crearUsuario({ ...usuarioDe(), activo: false }));
    const actualizado = await f.servicio.cambiarEstado(1, true, ADMIN);
    assert.equal(actualizado.activo, true);
  });

  test('no repite el evento si el estado ya era el solicitado', async () => {
    await f.servicio.cambiarEstado(2, true, ADMIN); // ya estaba activo
    assert.equal(f.eventos.length, 0);
  });

  test('falla si el usuario no existe', async () => {
    await assert.rejects(() => f.servicio.cambiarEstado(99, false, ADMIN), NoEncontradoError);
  });
});
