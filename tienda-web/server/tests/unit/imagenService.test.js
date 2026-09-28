'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const ImagenService = require('../../src/services/ImagenService');
const ImagenProducto = require('../../src/domain/ImagenProducto');
const { NoEncontradoError, ValidacionError } = require('../../src/errors/errores');

const USUARIO = { idUsuario: 4 };

function crearFakes() {
  const f = { eventos: [] };
  f.almacen = {
    guardados: [],
    eliminados: [],
    invalidoEn: null,
    falloAlEliminar: false,
    contador: 0,
    async guardar() {
      this.contador += 1;
      if (this.invalidoEn === this.contador) throw new ValidacionError({ imagenes: 'Solo se aceptan imágenes JPEG, PNG, GIF o WebP.' });
      const nombre = `img${this.contador}.jpg`;
      this.guardados.push(nombre);
      return nombre;
    },
    async eliminar(ruta) { if (this.falloAlEliminar) throw new Error('disco'); this.eliminados.push(ruta); },
  };
  f.imagenes = {
    filas: new Map(),
    siguiente: 1,
    fallaCrear: false,
    async siguienteOrden(id) { return [...this.filas.values()].filter((i) => i.idProducto === id).length + 1; },
    async crearImagen({ idProducto, ruta, orden }) {
      if (this.fallaCrear) throw new Error('base de datos');
      const id = this.siguiente++;
      this.filas.set(id, new ImagenProducto({ idImagen: id, idProducto, ruta, orden }));
      return id;
    },
    async listarPorProducto(id) { return [...this.filas.values()].filter((i) => i.idProducto === id); },
    async buscarPorId(id) { return this.filas.get(id) ?? null; },
    async eliminar(id) { this.filas.delete(id); return true; },
  };
  f.productos = { async buscarPorId(id) { return id === 10 ? { idProducto: 10 } : null; } };
  f.logger = { errores: [], error(...a) { this.errores.push(a); } };
  f.bitacora = { async registrar(...a) { f.eventos.push(a); } };
  f.servicio = new ImagenService({ imagenes: f.imagenes, productos: f.productos, almacen: f.almacen, bitacora: f.bitacora, logger: f.logger });
  return f;
}

const archivos = (n) => Array.from({ length: n }, () => ({ buffer: Buffer.alloc(20, 1) }));

describe('ImagenService.agregar', () => {
  let f;
  beforeEach(() => { f = crearFakes(); });

  test('guarda cada archivo, asigna el orden y devuelve todas las imágenes del producto', async () => {
    const lista = await f.servicio.agregar(10, archivos(3), USUARIO, '1.1.1.1');
    assert.equal(lista.length, 3);
    assert.deepEqual(lista.map((i) => i.orden), [1, 2, 3]);
    assert.deepEqual(f.eventos[0], [4, 'imagen_agregar', 'productos', 10, '3 imagen(es)', '1.1.1.1']);
  });

  test('no hay límite de imágenes por producto: se pueden seguir agregando', async () => {
    await f.servicio.agregar(10, archivos(10), USUARIO);
    await f.servicio.agregar(10, archivos(10), USUARIO);
    assert.equal((await f.imagenes.listarPorProducto(10)).length, 20);
  });

  test('un producto inexistente se rechaza antes de guardar nada', async () => {
    await assert.rejects(() => f.servicio.agregar(99, archivos(1), USUARIO), NoEncontradoError);
    assert.equal(f.almacen.guardados.length, 0);
  });

  test('exige al menos un archivo y máximo 10 por solicitud', async () => {
    await assert.rejects(() => f.servicio.agregar(10, [], USUARIO), (e) => e instanceof ValidacionError && /al menos una/.test(e.campos.imagenes));
    await assert.rejects(() => f.servicio.agregar(10, undefined, USUARIO), ValidacionError);
    await assert.rejects(() => f.servicio.agregar(10, archivos(11), USUARIO), (e) => /hasta 10/.test(e.campos.imagenes));
  });

  test('es todo o nada: si un archivo no es válido se descartan los que ya se habían guardado', async () => {
    f.almacen.invalidoEn = 3;
    await assert.rejects(() => f.servicio.agregar(10, archivos(3), USUARIO), ValidacionError);
    assert.equal(f.imagenes.filas.size, 0);
    assert.deepEqual(f.almacen.eliminados.sort(), ['img1.jpg', 'img2.jpg']);
    assert.equal(f.eventos.length, 0);
  });

  test('si falla la base de datos se elimina el archivo recién guardado', async () => {
    f.imagenes.fallaCrear = true;
    await assert.rejects(() => f.servicio.agregar(10, archivos(1), USUARIO), /base de datos/);
    assert.deepEqual(f.almacen.eliminados, ['img1.jpg']);
  });
});

describe('ImagenService.eliminar y listar', () => {
  let f;
  beforeEach(async () => { f = crearFakes(); await f.servicio.agregar(10, archivos(2), USUARIO); f.eventos.length = 0; });

  test('elimina el registro y el archivo, y lo registra en la bitácora', async () => {
    await f.servicio.eliminar(10, 1, USUARIO, '2.2.2.2');
    assert.ok(!f.imagenes.filas.has(1));
    assert.deepEqual(f.almacen.eliminados, ['img1.jpg']);
    assert.deepEqual(f.eventos[0], [4, 'imagen_eliminar', 'productos', 10, 'imagen 1', '2.2.2.2']);
  });

  test('no permite eliminar una imagen usando el identificador de otro producto', async () => {
    await assert.rejects(() => f.servicio.eliminar(11, 1, USUARIO), NoEncontradoError);
    await assert.rejects(() => f.servicio.eliminar(10, 99, USUARIO), NoEncontradoError);
    assert.ok(f.imagenes.filas.has(1));
  });

  test('un fallo al borrar el archivo se registra pero no impide la operación', async () => {
    f.almacen.falloAlEliminar = true;
    await f.servicio.eliminar(10, 2, USUARIO);
    assert.ok(!f.imagenes.filas.has(2));
    assert.equal(f.logger.errores.length, 1);
  });

  test('listar exige que el producto exista', async () => {
    assert.equal((await f.servicio.listar(10)).length, 2);
    await assert.rejects(() => f.servicio.listar(99), NoEncontradoError);
  });
});
