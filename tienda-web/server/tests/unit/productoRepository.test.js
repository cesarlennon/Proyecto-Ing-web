'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const ProductoRepository = require('../../src/repositories/ProductoRepository');
const ImagenRepository = require('../../src/repositories/ImagenRepository');

function bdFalsa() {
  return {
    llamadas: [],
    filas: [],
    total: 0,
    async consultar(sql, parametros) {
      this.llamadas.push({ sql: sql.replace(/\s+/g, ' ').trim(), parametros });
      return /COUNT\(\*\) AS total/.test(sql) ? [{ total: this.total }] : this.filas;
    },
  };
}

const FILA = {
  id_producto: 10, nombre: 'Lámpara', descripcion: null, precio: '449.00', stock: 12, dias_entrega: 3, activo: 1,
  id_categoria: 2, categoria_nombre: 'Hogar', categoria_activa: 1, calificacion_promedio: null, total_calificaciones: 0,
};

describe('ProductoRepository.buscar', () => {
  let bd;
  let repo;
  beforeEach(() => { bd = bdFalsa(); repo = new ProductoRepository(bd); });

  test('por omisión muestra solo productos y categorías activos, con paginación', async () => {
    bd.filas = [FILA];
    bd.total = 1;
    const { productos, total } = await repo.buscar();
    const { sql, parametros } = bd.llamadas[0];
    assert.match(sql, /WHERE p\.activo = 1 AND c\.activo = 1 ORDER BY p\.nombre ASC, p\.id_producto ASC LIMIT 12 OFFSET 0$/);
    assert.deepEqual(parametros, []);
    assert.equal(total, 1);
    assert.equal(productos[0].precio, 449); // DECIMAL llega como texto y se convierte
    assert.equal(productos[0].categoria.nombre, 'Hogar');
    assert.equal(productos[0].calificacionPromedio, null);
    assert.equal(productos[0].activo, true);
  });

  test('el conteo usa las mismas condiciones que la consulta', async () => {
    await repo.buscar({ categoria: 3, q: 'lámpara' });
    const [consulta, conteo] = bd.llamadas;
    // La consulta principal tiene subconsultas con su propio WHERE; las condiciones de filtro son las del final.
    const cola = consulta.sql.slice(consulta.sql.indexOf(' FROM productos p JOIN categorias c'));
    const dondeConsulta = /WHERE (.*) ORDER BY/.exec(cola)[1];
    assert.ok(conteo.sql.endsWith(`WHERE ${dondeConsulta}`));
    assert.deepEqual(conteo.parametros, consulta.parametros);
  });

  test('filtra por categoría y por texto usando parámetros', async () => {
    await repo.buscar({ categoria: 3, q: 'lámpara' });
    const { sql, parametros } = bd.llamadas[0];
    assert.match(sql, /p\.id_categoria = \? AND p\.nombre LIKE \?/);
    assert.deepEqual(parametros, [3, '%lámpara%']);
  });

  test('una búsqueda numérica también busca por identificador', async () => {
    await repo.buscar({ q: '12' });
    const { sql, parametros } = bd.llamadas[0];
    assert.match(sql, /\(p\.nombre LIKE \? OR p\.id_producto = \?\)/);
    assert.deepEqual(parametros, ['%12%', 12]);
  });

  test('los comodines de LIKE se escapan y el texto nunca entra en el SQL', async () => {
    const hostil = "100%_'; DROP TABLE productos;--";
    await repo.buscar({ q: hostil });
    const { sql, parametros } = bd.llamadas[0];
    assert.ok(!sql.includes('DROP'));
    assert.deepEqual(parametros, ["%100\\%\\_'; DROP TABLE productos;--%"]);
  });

  test('la gestión ve inactivos solo si los pide', async () => {
    await repo.buscar({ soloVisibles: false });
    assert.match(bd.llamadas[0].sql, /WHERE p\.activo = 1 ORDER BY/);
    await repo.buscar({ soloVisibles: false, incluirInactivos: true });
    assert.doesNotMatch(bd.llamadas[2].sql, /p\.activo/);
  });

  test('la paginación se acota a enteros y no permite inyectar SQL', async () => {
    await repo.buscar({ pagina: 3, porPagina: 5 });
    assert.match(bd.llamadas[0].sql, /LIMIT 5 OFFSET 10$/);
    await repo.buscar({ pagina: 1, porPagina: 5000 });
    assert.match(bd.llamadas[2].sql, /LIMIT 50 OFFSET 0$/);
    await repo.buscar({ pagina: '1; DROP TABLE x', porPagina: '5 OR 1=1' });
    assert.match(bd.llamadas[4].sql, /LIMIT 1 OFFSET 0$/);
    assert.ok(!bd.llamadas[4].sql.includes('DROP'));
  });
});

describe('ProductoRepository: escritura y consultas auxiliares', () => {
  test('crearProducto traduce a columnas y guarda activo como 1 o 0', async () => {
    const bd = bdFalsa();
    bd.consultar = async (sql, parametros) => { bd.llamadas.push({ sql, parametros }); return { insertId: 5 }; };
    const id = await new ProductoRepository(bd).crearProducto({
      nombre: 'A', descripcion: undefined, precio: 10, stock: 2, idCategoria: 3, diasEntrega: 4, activo: false,
    });
    assert.equal(id, 5);
    assert.match(bd.llamadas[0].sql, /^INSERT INTO `productos` \(`nombre`, `descripcion`, `precio`, `stock`, `id_categoria`, `dias_entrega`, `activo`\)/);
    assert.deepEqual(bd.llamadas[0].parametros, ['A', null, 10, 2, 3, 4, 0]);
  });

  test('actualizarProducto omite el estado si no se envía', async () => {
    const bd = bdFalsa();
    bd.consultar = async (sql, parametros) => { bd.llamadas.push({ sql, parametros }); return { affectedRows: 1 }; };
    const repo = new ProductoRepository(bd);
    await repo.actualizarProducto(7, { nombre: 'A', precio: 1, stock: 1, idCategoria: 2, diasEntrega: 1 });
    assert.doesNotMatch(bd.llamadas[0].sql, /activo/);
    await repo.actualizarProducto(7, { nombre: 'A', precio: 1, stock: 1, idCategoria: 2, diasEntrega: 1, activo: true });
    assert.match(bd.llamadas[1].sql, /`activo` = \?/);
  });

  test('tienePedidos consulta pedido_detalle', async () => {
    const bd = bdFalsa();
    bd.filas = [{ 1: 1 }];
    assert.equal(await new ProductoRepository(bd).tienePedidos(3), true);
    assert.match(bd.llamadas[0].sql, /FROM pedido_detalle WHERE id_producto = \?/);
    bd.filas = [];
    assert.equal(await new ProductoRepository(bd).tienePedidos(3), false);
  });
});

describe('ImagenRepository', () => {
  test('listarPorProductos hace una sola consulta y agrupa por producto', async () => {
    const bd = bdFalsa();
    bd.filas = [
      { id_imagen: 1, id_producto: 10, ruta: 'a.jpg', orden: 1 },
      { id_imagen: 2, id_producto: 11, ruta: 'b.jpg', orden: 1 },
      { id_imagen: 3, id_producto: 10, ruta: 'c.jpg', orden: 2 },
    ];
    const mapa = await new ImagenRepository(bd).listarPorProductos([10, 11, 12]);
    assert.equal(bd.llamadas.length, 1);
    assert.match(bd.llamadas[0].sql, /IN \(\?, \?, \?\)/);
    assert.deepEqual(bd.llamadas[0].parametros, [10, 11, 12]);
    assert.deepEqual(mapa.get(10).map((i) => i.ruta), ['a.jpg', 'c.jpg']);
    assert.deepEqual(mapa.get(12), []);
    assert.equal(mapa.get(10)[0].idProducto, 10);
  });

  test('sin productos no consulta la base de datos', async () => {
    const bd = bdFalsa();
    const mapa = await new ImagenRepository(bd).listarPorProductos([]);
    assert.equal(mapa.size, 0);
    assert.equal(bd.llamadas.length, 0);
  });

  test('siguienteOrden devuelve un número y crearImagen traduce las columnas', async () => {
    const bd = bdFalsa();
    bd.filas = [{ siguiente: '4' }];
    const repo = new ImagenRepository(bd);
    assert.equal(await repo.siguienteOrden(10), 4);
    bd.consultar = async (sql, parametros) => { bd.llamadas.push({ sql, parametros }); return { insertId: 9 }; };
    assert.equal(await repo.crearImagen({ idProducto: 10, ruta: 'a.jpg', orden: 4 }), 9);
    assert.deepEqual(bd.llamadas.at(-1).parametros, [10, 'a.jpg', 4]);
  });
});
