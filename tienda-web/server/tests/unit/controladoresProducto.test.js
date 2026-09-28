'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const ProductoController = require('../../src/controllers/ProductoController');
const CatalogoController = require('../../src/controllers/CatalogoController');
const Producto = require('../../src/domain/Producto');
const Categoria = require('../../src/domain/Categoria');
const ImagenProducto = require('../../src/domain/ImagenProducto');
const { crearUsuario } = require('../../src/domain/crearUsuario');
const { NoEncontradoError } = require('../../src/errors/errores');

const usuarioDe = (rol) => crearUsuario({ idUsuario: 1, correo: 'a@b.com', nombres: 'Ana', apellidoPaterno: 'Pérez', rol });
const respuesta = () => ({
  estado: 200, cuerpo: undefined, terminada: false,
  status(c) { this.estado = c; return this; },
  json(c) { this.cuerpo = c; return this; },
  end() { this.terminada = true; return this; },
});
const producto = () =>
  new Producto({
    idProducto: 10, nombre: 'Lámpara', precio: 449, stock: 12, diasEntrega: 3, idCategoria: 2,
    categoria: new Categoria({ idCategoria: 2, nombre: 'Hogar' }),
    imagenes: [new ImagenProducto({ idImagen: 1, ruta: 'a.jpg' })],
  });

function crearProductoController() {
  const llamadas = [];
  const servicio = {};
  for (const m of ['listar', 'obtener', 'crear', 'actualizar', 'eliminar', 'cambiarPrecio', 'cambiarStock', 'definirEntrega']) {
    servicio[m] = async (...args) => {
      llamadas.push([m, ...args]);
      if (m === 'listar') return { productos: [producto()], total: 1, pagina: 1, porPagina: 12, paginas: 1 };
      if (m === 'eliminar') return { inactivado: true };
      return producto();
    };
  }
  const imagenes = {
    agregar: async (...args) => { llamadas.push(['agregarImagenes', ...args]); return [new ImagenProducto({ idImagen: 1, ruta: 'a.jpg' })]; },
    eliminar: async (...args) => { llamadas.push(['eliminarImagen', ...args]); },
  };
  return { controlador: new ProductoController({ productoService: servicio, imagenService: imagenes }), llamadas };
}

describe('ProductoController', () => {
  test('el cliente recibe la vista sin stock; inventarios y administración, con stock', async () => {
    const { controlador } = crearProductoController();
    const paraCliente = respuesta();
    await controlador.listar({ user: usuarioDe('cliente'), query: {} }, paraCliente);
    assert.ok(!('stock' in paraCliente.cuerpo.productos[0]));
    assert.ok(!JSON.stringify(paraCliente.cuerpo).includes('"stock"'));

    for (const rol of ['administrador', 'inventarios']) {
      const r = respuesta();
      await controlador.listar({ user: usuarioDe(rol), query: {} }, r);
      assert.equal(r.cuerpo.productos[0].stock, 12);
    }
  });

  test('listar pasa los filtros al servicio; incluirInactivos solo si vale «true»', async () => {
    const { controlador, llamadas } = crearProductoController();
    await controlador.listar({ user: usuarioDe('administrador'), query: { categoria: '2', q: 'lám', pagina: '3', porPagina: '5', incluirInactivos: 'true' } }, respuesta());
    assert.deepEqual(llamadas[0].slice(0, 3), ['listar', { categoria: '2', q: 'lám', pagina: '3', porPagina: '5', incluirInactivos: true }, 'gestion']);
    await controlador.listar({ user: usuarioDe('cliente'), query: { incluirInactivos: 'true' } }, respuesta());
    assert.equal(llamadas[1][2], 'cliente');
  });

  test('obtener valida el identificador de la ruta', async () => {
    const { controlador, llamadas } = crearProductoController();
    const r = respuesta();
    await controlador.obtener({ user: usuarioDe('cliente'), params: { id: '10' } }, r);
    assert.equal(llamadas[0][1], 10);
    assert.equal(r.cuerpo.producto.idProducto, 10);
    for (const malo of ['abc', '0', '-1', '1.5', '99999999999']) {
      await assert.rejects(() => controlador.obtener({ user: usuarioDe('cliente'), params: { id: malo } }, respuesta()), NoEncontradoError);
    }
  });

  test('crear y actualizar responden con la vista de gestión', async () => {
    const { controlador } = crearProductoController();
    const creado = respuesta();
    await controlador.crear({ user: usuarioDe('administrador'), body: { nombre: 'x' }, ip: '1.1.1.1' }, creado);
    assert.equal(creado.estado, 201);
    assert.equal(creado.cuerpo.producto.stock, 12);
    const actualizado = respuesta();
    await controlador.actualizar({ user: usuarioDe('administrador'), params: { id: '10' }, body: {}, ip: '1.1.1.1' }, actualizado);
    assert.equal(actualizado.estado, 200);
  });

  test('eliminar informa si el producto se inactivó', async () => {
    const { controlador } = crearProductoController();
    const r = respuesta();
    await controlador.eliminar({ user: usuarioDe('administrador'), params: { id: '10' } }, r);
    assert.deepEqual(r.cuerpo, { inactivado: true });
  });

  test('precio, stock y entrega toman su valor del cuerpo', async () => {
    const { controlador, llamadas } = crearProductoController();
    const req = (cuerpo) => ({ user: usuarioDe('inventarios'), params: { id: '10' }, body: cuerpo, ip: '9.9.9.9' });
    await controlador.cambiarPrecio(req({ precio: '99.9', confirmado: true }), respuesta());
    await controlador.cambiarStock(req({ stock: 7, confirmado: true }), respuesta());
    await controlador.definirEntrega(req({ diasEntrega: 4 }), respuesta());
    assert.deepEqual(llamadas.map((l) => [l[0], l[2]]), [['cambiarPrecio', '99.9'], ['cambiarStock', 7], ['definirEntrega', 4]]);
    assert.equal(llamadas[0][4], '9.9.9.9');
  });

  test('las imágenes se toman de req.files y su eliminación responde 204', async () => {
    const { controlador, llamadas } = crearProductoController();
    const archivos = [{ buffer: Buffer.alloc(20) }];
    const creada = respuesta();
    await controlador.agregarImagenes({ user: usuarioDe('inventarios'), params: { id: '10' }, files: archivos, ip: '1.1.1.1' }, creada);
    assert.equal(creada.estado, 201);
    assert.deepEqual(creada.cuerpo.imagenes, [{ idImagen: 1, url: '/imagenes/a.jpg', orden: 0 }]);
    assert.equal(llamadas[0][2], archivos);

    await controlador.agregarImagenes({ user: usuarioDe('inventarios'), params: { id: '10' }, ip: '1.1.1.1' }, respuesta());
    assert.deepEqual(llamadas[1][2], []);

    const borrada = respuesta();
    await controlador.eliminarImagen({ user: usuarioDe('inventarios'), params: { id: '10', idImagen: '1' }, ip: '1.1.1.1' }, borrada);
    assert.equal(borrada.estado, 204);
    assert.ok(borrada.terminada);
    assert.deepEqual(llamadas[2].slice(1, 3), [10, 1]);
  });
});

describe('CatalogoController', () => {
  function crear() {
    const llamadas = [];
    const elemento = new Categoria({ idCategoria: 1, nombre: 'Hogar' });
    const servicio = {
      listar: async (...a) => { llamadas.push(['listar', ...a]); return [elemento]; },
      crear: async (...a) => { llamadas.push(['crear', ...a]); return elemento; },
      actualizar: async (...a) => { llamadas.push(['actualizar', ...a]); return elemento; },
      eliminar: async (...a) => { llamadas.push(['eliminar', ...a]); },
    };
    return { controlador: new CatalogoController({ catalogoService: servicio }), llamadas };
  }

  test('incluirInactivos solo lo puede pedir quien gestiona catálogos', async () => {
    const { controlador, llamadas } = crear();
    await controlador.listar({ catalogo: 'categorias', user: usuarioDe('cliente'), query: { incluirInactivos: 'true' } }, respuesta());
    await controlador.listar({ catalogo: 'categorias', user: usuarioDe('administrador'), query: { incluirInactivos: 'true' } }, respuesta());
    assert.deepEqual(llamadas[0][2], { incluirInactivos: false });
    assert.deepEqual(llamadas[1][2], { incluirInactivos: true });
  });

  test('crear responde 201, actualizar 200 y eliminar 204', async () => {
    const { controlador, llamadas } = crear();
    const base = { catalogo: 'paises', user: usuarioDe('administrador'), ip: '1.1.1.1' };
    const c = respuesta();
    await controlador.crear({ ...base, body: { nombre: 'México' } }, c);
    assert.equal(c.estado, 201);
    assert.deepEqual(c.cuerpo.elemento, { idCategoria: 1, nombre: 'Hogar', activo: true });
    const a = respuesta();
    await controlador.actualizar({ ...base, params: { id: '1' }, body: { activo: false } }, a);
    assert.equal(a.estado, 200);
    const e = respuesta();
    await controlador.eliminar({ ...base, params: { id: '1' } }, e);
    assert.equal(e.estado, 204);
    assert.deepEqual(llamadas.map((l) => l[0]), ['crear', 'actualizar', 'eliminar']);
    assert.equal(llamadas[0][1], 'paises');
  });

  test('un identificador inválido responde como recurso inexistente', async () => {
    const { controlador } = crear();
    await assert.rejects(
      () => controlador.eliminar({ catalogo: 'categorias', user: usuarioDe('administrador'), params: { id: 'x' } }, respuesta()),
      NoEncontradoError,
    );
  });
});
