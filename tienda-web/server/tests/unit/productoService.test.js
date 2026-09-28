'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const ProductoService = require('../../src/services/ProductoService');
const Producto = require('../../src/domain/Producto');
const Categoria = require('../../src/domain/Categoria');
const ImagenProducto = require('../../src/domain/ImagenProducto');
const { NoEncontradoError, ValidacionError } = require('../../src/errors/errores');

const ADMIN = { idUsuario: 1 };
const DATOS = { nombre: '  Lámpara de escritorio ', descripcion: 'Con brazo', precio: '449.00', stock: '12', idCategoria: '2', diasEntrega: '3' };

const producto = (extra = {}) =>
  new Producto({
    idProducto: 10,
    nombre: 'Lámpara',
    precio: 449,
    stock: 12,
    diasEntrega: 3,
    idCategoria: 2,
    categoria: new Categoria({ idCategoria: 2, nombre: 'Hogar', activo: true }),
    ...extra,
  });

function crearFakes() {
  const f = { eventos: [] };
  f.almacen = { eliminados: [], falla: false, async eliminar(ruta) { if (this.falla) throw new Error('disco'); this.eliminados.push(ruta); } };
  f.logger = { errores: [], error(...a) { this.errores.push(a); } };
  f.productos = {
    guardados: new Map([[10, producto()]]),
    resultado: { productos: [], total: 0 },
    filtro: null,
    conPedidos: false,
    fallaFK: false,
    creado: null,
    actualizado: null,
    parcial: null,
    eliminado: null,
    async buscar(filtro) { this.filtro = filtro; return this.resultado; },
    async buscarConDetalle(id) { return this.guardados.get(id) ?? null; },
    async buscarPorId(id) { return this.guardados.get(id) ?? null; },
    async crearProducto(datos) { this.creado = datos; this.guardados.set(11, producto({ idProducto: 11, nombre: datos.nombre })); return 11; },
    async actualizarProducto(id, datos) { this.actualizado = [id, datos]; },
    async actualizar(id, datos) { this.parcial = [id, datos]; },
    async tienePedidos() { return this.conPedidos; },
    async eliminar(id) {
      if (this.fallaFK) throw Object.assign(new Error('fk'), { code: 'ER_ROW_IS_REFERENCED_2' });
      this.eliminado = id;
    },
  };
  f.categorias = {
    datos: new Map([[2, new Categoria({ idCategoria: 2, nombre: 'Hogar', activo: true })], [3, new Categoria({ idCategoria: 3, nombre: 'Vieja', activo: false })]]),
    async buscarPorId(id) { return this.datos.get(id) ?? null; },
  };
  f.imagenes = {
    lista: [],
    async listarPorProducto() { return this.lista; },
    async listarPorProductos(ids) { return new Map(ids.map((id) => [id, id === 10 ? this.lista : []])); },
  };
  f.bitacora = { async registrar(...a) { f.eventos.push(a); } };
  f.servicio = new ProductoService({ productos: f.productos, categorias: f.categorias, imagenes: f.imagenes, almacen: f.almacen, bitacora: f.bitacora, logger: f.logger });
  return f;
}

describe('ProductoService.listar', () => {
  let f;
  beforeEach(() => { f = crearFakes(); });

  test('la vista del cliente solo pide productos visibles y normaliza la paginación', async () => {
    f.productos.resultado = { productos: [producto()], total: 25 };
    f.imagenes.lista = [new ImagenProducto({ idImagen: 1, ruta: 'a.jpg' })];
    const r = await f.servicio.listar({ categoria: '2', q: `  ${'x'.repeat(150)} `, pagina: '2', porPagina: '500', incluirInactivos: true }, 'cliente');

    assert.equal(f.productos.filtro.soloVisibles, true);
    assert.equal(f.productos.filtro.incluirInactivos, false); // el cliente nunca ve inactivos
    assert.equal(f.productos.filtro.categoria, 2);
    assert.equal(f.productos.filtro.q.length, 100);
    assert.equal(f.productos.filtro.pagina, 2);
    assert.equal(f.productos.filtro.porPagina, 50);
    assert.equal(r.total, 25);
    assert.equal(r.paginas, 1);
    assert.equal(r.productos[0].imagenes.length, 1);
  });

  test('valores inválidos vuelven a los predeterminados', async () => {
    await f.servicio.listar({ categoria: 'abc', pagina: '-3', porPagina: 'x' });
    assert.equal(f.productos.filtro.categoria, null);
    assert.equal(f.productos.filtro.pagina, 1);
    assert.equal(f.productos.filtro.porPagina, 12);
  });

  test('calcula el número de páginas', async () => {
    f.productos.resultado = { productos: [], total: 25 };
    assert.equal((await f.servicio.listar({ porPagina: '12' })).paginas, 3);
    f.productos.resultado = { productos: [], total: 0 };
    assert.equal((await f.servicio.listar({})).paginas, 1);
  });

  test('la vista de gestión puede incluir los productos inactivos', async () => {
    await f.servicio.listar({ incluirInactivos: true }, 'gestion');
    assert.equal(f.productos.filtro.soloVisibles, false);
    assert.equal(f.productos.filtro.incluirInactivos, true);
    await f.servicio.listar({}, 'gestion');
    assert.equal(f.productos.filtro.incluirInactivos, false);
  });
});

describe('ProductoService.obtener', () => {
  let f;
  beforeEach(() => { f = crearFakes(); });

  test('el cliente no ve productos inactivos ni de categorías inactivas', async () => {
    f.productos.guardados.set(20, producto({ idProducto: 20, activo: false }));
    f.productos.guardados.set(21, producto({ idProducto: 21, categoria: new Categoria({ idCategoria: 3, nombre: 'Vieja', activo: false }) }));
    await assert.rejects(() => f.servicio.obtener(20, 'cliente'), NoEncontradoError);
    await assert.rejects(() => f.servicio.obtener(21, 'cliente'), NoEncontradoError);
    await assert.rejects(() => f.servicio.obtener(99, 'cliente'), NoEncontradoError);
  });

  test('la gestión sí los ve y se adjuntan las imágenes', async () => {
    f.productos.guardados.set(20, producto({ idProducto: 20, activo: false }));
    f.imagenes.lista = [new ImagenProducto({ idImagen: 1, ruta: 'a.jpg' })];
    const p = await f.servicio.obtener(20, 'gestion');
    assert.equal(p.idProducto, 20);
    assert.equal(p.imagenes.length, 1);
  });
});

describe('ProductoService.crear y actualizar', () => {
  let f;
  beforeEach(() => { f = crearFakes(); });

  test('crear valida, normaliza, guarda y registra en la bitácora', async () => {
    const creado = await f.servicio.crear(DATOS, ADMIN, '1.1.1.1');
    assert.deepEqual(f.productos.creado, {
      nombre: 'Lámpara de escritorio', descripcion: 'Con brazo', precio: 449, stock: 12, idCategoria: 2, diasEntrega: 3, activo: true,
    });
    assert.equal(creado.idProducto, 11);
    assert.deepEqual(f.eventos[0], [1, 'producto_crear', 'productos', 11, 'Lámpara de escritorio', '1.1.1.1']);
  });

  test('crear rechaza datos inválidos sin tocar la base', async () => {
    await assert.rejects(
      () => f.servicio.crear({ ...DATOS, precio: '0', stock: '-1', nombre: '' }, ADMIN),
      (e) => e instanceof ValidacionError && ['precio', 'stock', 'nombre'].every((c) => e.campos[c]),
    );
    assert.equal(f.productos.creado, null);
  });

  test('crear exige una categoría existente y activa', async () => {
    await assert.rejects(() => f.servicio.crear({ ...DATOS, idCategoria: '99' }, ADMIN), (e) => Boolean(e.campos.idCategoria));
    await assert.rejects(() => f.servicio.crear({ ...DATOS, idCategoria: '3' }, ADMIN), (e) => Boolean(e.campos.idCategoria));
    assert.equal(f.productos.creado, null);
  });

  test('crear puede dejar el producto inactivo', async () => {
    await f.servicio.crear({ ...DATOS, activo: false }, ADMIN);
    assert.equal(f.productos.creado.activo, false);
  });

  test('actualizar guarda todos los campos y solo cambia el estado si se envía', async () => {
    await f.servicio.actualizar(10, DATOS, ADMIN);
    assert.equal(f.productos.actualizado[0], 10);
    assert.equal(f.productos.actualizado[1].activo, undefined);
    await f.servicio.actualizar(10, { ...DATOS, activo: false }, ADMIN);
    assert.equal(f.productos.actualizado[1].activo, false);
    assert.equal(f.eventos.at(-1)[1], 'producto_actualizar');
  });

  test('actualizar un producto inexistente o con datos inválidos falla', async () => {
    await assert.rejects(() => f.servicio.actualizar(99, DATOS, ADMIN), NoEncontradoError);
    await assert.rejects(() => f.servicio.actualizar(10, { ...DATOS, diasEntrega: '0' }, ADMIN), ValidacionError);
  });
});

describe('ProductoService.eliminar', () => {
  let f;
  beforeEach(() => { f = crearFakes(); f.imagenes.lista = [new ImagenProducto({ idImagen: 1, ruta: 'a.jpg' }), new ImagenProducto({ idImagen: 2, ruta: 'b.png' })]; });

  test('un producto inexistente no se puede eliminar', async () => {
    await assert.rejects(() => f.servicio.eliminar(99, ADMIN), NoEncontradoError);
  });

  test('si tiene pedidos se inactiva en lugar de borrarse y conserva sus imágenes', async () => {
    f.productos.conPedidos = true;
    assert.deepEqual(await f.servicio.eliminar(10, ADMIN), { inactivado: true });
    assert.deepEqual(f.productos.parcial, [10, { activo: 0 }]);
    assert.equal(f.productos.eliminado, null);
    assert.deepEqual(f.almacen.eliminados, []);
    assert.equal(f.eventos[0][1], 'producto_inactivar');
  });

  test('sin pedidos se borra y se eliminan los archivos de sus imágenes', async () => {
    assert.deepEqual(await f.servicio.eliminar(10, ADMIN), { inactivado: false });
    assert.equal(f.productos.eliminado, 10);
    assert.deepEqual(f.almacen.eliminados, ['a.jpg', 'b.png']);
    assert.equal(f.eventos[0][1], 'producto_eliminar');
  });

  test('si la base bloquea el borrado por una referencia, se inactiva', async () => {
    f.productos.fallaFK = true;
    assert.deepEqual(await f.servicio.eliminar(10, ADMIN), { inactivado: true });
    assert.deepEqual(f.almacen.eliminados, []);
  });

  test('un fallo al borrar un archivo se registra pero no interrumpe', async () => {
    f.almacen.falla = true;
    assert.deepEqual(await f.servicio.eliminar(10, ADMIN), { inactivado: false });
    assert.equal(f.logger.errores.length, 2);
  });
});

describe('ProductoService: precio, stock y entrega', () => {
  let f;
  beforeEach(() => { f = crearFakes(); });

  test('cambiarPrecio valida, actualiza y registra el valor anterior y el nuevo', async () => {
    await f.servicio.cambiarPrecio(10, '399.50', ADMIN, '1.1.1.1');
    assert.deepEqual(f.productos.parcial, [10, { precio: 399.5 }]);
    assert.deepEqual(f.eventos[0], [1, 'producto_precio', 'productos', 10, 'anterior=449; nuevo=399.5', '1.1.1.1']);
    for (const malo of ['0', '-3', 'abc', '', undefined, null]) {
      await assert.rejects(() => f.servicio.cambiarPrecio(10, malo, ADMIN), (e) => e instanceof ValidacionError && Boolean(e.campos.precio));
    }
  });

  test('cambiarStock acepta cero y rechaza negativos o decimales', async () => {
    await f.servicio.cambiarStock(10, 0, ADMIN);
    assert.deepEqual(f.productos.parcial, [10, { stock: 0 }]);
    assert.equal(f.eventos[0][4], 'anterior=12; nuevo=0');
    await assert.rejects(() => f.servicio.cambiarStock(10, '-1', ADMIN), (e) => Boolean(e.campos.stock));
    await assert.rejects(() => f.servicio.cambiarStock(10, '2.5', ADMIN), ValidacionError);
  });

  test('definirEntrega guarda los días', async () => {
    await f.servicio.definirEntrega(10, '5', ADMIN);
    assert.deepEqual(f.productos.parcial, [10, { dias_entrega: 5 }]);
    await assert.rejects(() => f.servicio.definirEntrega(10, '0', ADMIN), (e) => Boolean(e.campos.diasEntrega));
  });

  test('las tres operaciones fallan si el producto no existe', async () => {
    await assert.rejects(() => f.servicio.cambiarPrecio(99, '10', ADMIN), NoEncontradoError);
    await assert.rejects(() => f.servicio.cambiarStock(99, '10', ADMIN), NoEncontradoError);
    await assert.rejects(() => f.servicio.definirEntrega(99, '3', ADMIN), NoEncontradoError);
  });
});
