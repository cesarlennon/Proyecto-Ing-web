'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const CatalogoService = require('../../src/services/CatalogoService');
const Categoria = require('../../src/domain/Categoria');
const Pais = require('../../src/domain/Pais');
const { NoEncontradoError, ReglaNegocioError, ValidacionError } = require('../../src/errors/errores');

const ADMIN = { idUsuario: 1 };

function repoFalso(Clase, campoId, metodoEnUso) {
  const repo = {
    filas: new Map(),
    siguiente: 1,
    llamadas: [],
    enUso: false,
    fallo: null,
    async listarTodas(opciones) { this.llamadas.push(['listarTodas', opciones]); return [...this.filas.values()]; },
    async buscarPorId(id) { return this.filas.get(id) ?? null; },
    async crear(datos) {
      if (this.fallo) throw this.fallo;
      const id = this.siguiente++;
      this.filas.set(id, new Clase({ [campoId]: id, nombre: datos.nombre, activo: Boolean(datos.activo) }));
      this.llamadas.push(['crear', datos]);
      return id;
    },
    async actualizar(id, cambios) {
      if (this.fallo) throw this.fallo;
      this.llamadas.push(['actualizar', id, cambios]);
      const actual = this.filas.get(id);
      this.filas.set(id, new Clase({ [campoId]: id, nombre: cambios.nombre ?? actual.nombre, activo: cambios.activo === undefined ? actual.activo : Boolean(cambios.activo) }));
      return true;
    },
    async eliminar(id) { if (this.fallo) throw this.fallo; this.llamadas.push(['eliminar', id]); this.filas.delete(id); return true; },
  };
  repo[metodoEnUso] = async function () { return this.enUso; };
  return repo;
}

describe('CatalogoService', () => {
  let categorias;
  let paises;
  let eventos;
  let servicio;
  beforeEach(() => {
    categorias = repoFalso(Categoria, 'idCategoria', 'tieneProductos');
    paises = repoFalso(Pais, 'idPais', 'tieneDirecciones');
    eventos = [];
    servicio = new CatalogoService({ categorias, paises, bitacora: { async registrar(...a) { eventos.push(a); } } });
  });

  test('un catálogo desconocido no existe', async () => {
    await assert.rejects(() => servicio.listar('usuarios'), NoEncontradoError);
    await assert.rejects(() => servicio.listar('__proto__'), NoEncontradoError);
    await assert.rejects(() => servicio.listar('constructor'), NoEncontradoError);
  });

  test('listar pide solo los activos, salvo que se pidan todos', async () => {
    await servicio.listar('categorias');
    await servicio.listar('paises', { incluirInactivos: true });
    assert.deepEqual(categorias.llamadas[0], ['listarTodas', { incluirInactivas: false }]);
    assert.deepEqual(paises.llamadas[0], ['listarTodas', { incluirInactivas: true }]);
  });

  test('crear normaliza el nombre, guarda como activo y registra en la bitácora', async () => {
    const categoria = await servicio.crear('categorias', { nombre: '  Ropa   deportiva ' }, ADMIN, '1.1.1.1');
    assert.equal(categoria.nombre, 'Ropa deportiva');
    assert.deepEqual(categorias.llamadas[0], ['crear', { nombre: 'Ropa deportiva', activo: 1 }]);
    assert.deepEqual(eventos[0], [1, 'categoria_crear', 'categorias', 1, 'Ropa deportiva', '1.1.1.1']);
  });

  test('crear rechaza nombres inválidos con el detalle del campo', async () => {
    await assert.rejects(
      () => servicio.crear('categorias', { nombre: '' }, ADMIN),
      (e) => e instanceof ValidacionError && Boolean(e.campos.nombre),
    );
    await assert.rejects(() => servicio.crear('paises', { nombre: 'x'.repeat(81) }, ADMIN), ValidacionError);
    assert.equal(categorias.llamadas.length, 0);
  });

  test('un nombre duplicado se informa como error del campo', async () => {
    categorias.fallo = Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
    await assert.rejects(
      () => servicio.crear('categorias', { nombre: 'Hogar' }, ADMIN),
      (e) => e instanceof ValidacionError && /categoría/.test(e.campos.nombre),
    );
    paises.fallo = Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
    await assert.rejects(() => servicio.crear('paises', { nombre: 'México' }, ADMIN), (e) => /país/.test(e.campos.nombre));
  });

  test('los errores inesperados no se ocultan', async () => {
    categorias.fallo = new Error('se cayó');
    await assert.rejects(() => servicio.crear('categorias', { nombre: 'Hogar' }, ADMIN), /se cayó/);
  });

  test('actualizar cambia solo lo enviado', async () => {
    await servicio.crear('categorias', { nombre: 'Hogar' }, ADMIN);
    const renombrada = await servicio.actualizar('categorias', 1, { nombre: 'Hogar y cocina' }, ADMIN);
    assert.equal(renombrada.nombre, 'Hogar y cocina');
    assert.deepEqual(categorias.llamadas.at(-1), ['actualizar', 1, { nombre: 'Hogar y cocina' }]);

    const desactivada = await servicio.actualizar('categorias', 1, { activo: false }, ADMIN);
    assert.equal(desactivada.activo, false);
    assert.deepEqual(categorias.llamadas.at(-1), ['actualizar', 1, { activo: 0 }]);
    assert.equal(eventos.at(-1)[1], 'categoria_actualizar');
  });

  test('actualizar rechaza cambios vacíos o inválidos y elementos inexistentes', async () => {
    await servicio.crear('categorias', { nombre: 'Hogar' }, ADMIN);
    await assert.rejects(() => servicio.actualizar('categorias', 1, {}, ADMIN), /No hay cambios/);
    await assert.rejects(() => servicio.actualizar('categorias', 1, { nombre: '' }, ADMIN), ValidacionError);
    await assert.rejects(() => servicio.actualizar('categorias', 99, { nombre: 'X' }, ADMIN), NoEncontradoError);
  });

  test('eliminar no permite borrar una categoría con productos (M-14)', async () => {
    await servicio.crear('categorias', { nombre: 'Hogar' }, ADMIN);
    categorias.enUso = true;
    await assert.rejects(
      () => servicio.eliminar('categorias', 1, ADMIN),
      (e) => e instanceof ReglaNegocioError && e.codigo === 'CATALOGO_EN_USO' && /productos asociados/.test(e.message),
    );
    assert.ok(categorias.filas.has(1));
  });

  test('eliminar no permite borrar un país con direcciones', async () => {
    await servicio.crear('paises', { nombre: 'México' }, ADMIN);
    paises.enUso = true;
    await assert.rejects(() => servicio.eliminar('paises', 1, ADMIN), (e) => e.codigo === 'CATALOGO_EN_USO' && /direcciones/.test(e.message));
  });

  test('eliminar borra el elemento sin uso y lo registra', async () => {
    await servicio.crear('categorias', { nombre: 'Hogar' }, ADMIN);
    await servicio.eliminar('categorias', 1, ADMIN, '2.2.2.2');
    assert.ok(!categorias.filas.has(1));
    assert.deepEqual(eventos.at(-1), [1, 'categoria_eliminar', 'categorias', 1, 'Hogar', '2.2.2.2']);
    await assert.rejects(() => servicio.eliminar('categorias', 1, ADMIN), NoEncontradoError);
  });

  test('si la base de datos bloquea el borrado por una referencia, se informa igual', async () => {
    await servicio.crear('categorias', { nombre: 'Hogar' }, ADMIN);
    categorias.fallo = Object.assign(new Error('fk'), { code: 'ER_ROW_IS_REFERENCED_2' });
    await assert.rejects(() => servicio.eliminar('categorias', 1, ADMIN), (e) => e.codigo === 'CATALOGO_EN_USO');
  });
});
