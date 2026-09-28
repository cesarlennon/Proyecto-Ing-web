'use strict';

const { NoEncontradoError, ValidacionError } = require('../errors/errores');
const { enteroOpcional } = require('../utils/parametros');
const V = require('../utils/validaciones');

/** Reglas de negocio de los productos: consulta (CU-14, CU-15, CU-21), CRUD (CU-06), precio, stock y entrega. */
class ProductoService {
  constructor({ productos, categorias, imagenes, almacen, bitacora, logger = console }) {
    this.productos = productos;
    this.categorias = categorias;
    this.imagenes = imagenes;
    this.almacen = almacen;
    this.bitacora = bitacora;
    this.logger = logger;
  }

  /**
   * Lista productos con filtros y paginación. La vista «cliente» solo incluye productos activos de
   * categorías activas; la vista «gestion» (administración e inventarios) puede incluir los inactivos.
   */
  async listar(filtros = {}, vista = 'cliente') {
    const pagina = enteroOpcional(filtros.pagina, 1);
    const porPagina = Math.min(enteroOpcional(filtros.porPagina, 12), 50);
    const q = String(filtros.q ?? '').trim().slice(0, 100);
    const categoria = enteroOpcional(filtros.categoria, null);
    const gestion = vista === 'gestion';

    const { productos, total } = await this.productos.buscar({
      categoria,
      q,
      soloVisibles: !gestion,
      incluirInactivos: gestion && filtros.incluirInactivos === true,
      pagina,
      porPagina,
    });
    await this.adjuntarImagenes(productos);
    return { productos, total, pagina, porPagina, paginas: Math.max(1, Math.ceil(total / porPagina)) };
  }

  async obtener(id, vista = 'cliente') {
    const producto = await this.productos.buscarConDetalle(id);
    const oculto = vista !== 'gestion' && producto && (!producto.activo || !producto.categoria?.activo);
    if (!producto || oculto) throw new NoEncontradoError('El producto no existe.');
    producto.imagenes = await this.imagenes.listarPorProducto(id);
    return producto;
  }

  async crear(datos, usuario, ip = null) {
    const valores = this.validar(datos);
    await this.exigirCategoria(valores.idCategoria);
    const id = await this.productos.crearProducto({ ...valores, activo: datos?.activo !== false });
    await this.bitacora.registrar(usuario.idUsuario, 'producto_crear', 'productos', id, valores.nombre, ip);
    return this.obtener(id, 'gestion');
  }

  async actualizar(id, datos, usuario, ip = null) {
    await this.exigirProducto(id);
    const valores = this.validar(datos);
    await this.exigirCategoria(valores.idCategoria);
    await this.productos.actualizarProducto(id, { ...valores, activo: typeof datos?.activo === 'boolean' ? datos.activo : undefined });
    await this.bitacora.registrar(usuario.idUsuario, 'producto_actualizar', 'productos', id, valores.nombre, ip);
    return this.obtener(id, 'gestion');
  }

  /**
   * Elimina el producto. Si ya aparece en algún pedido no se borra (se perdería el historial de ventas):
   * se marca como inactivo. Devuelve { inactivado } para que la interfaz informe qué ocurrió.
   */
  async eliminar(id, usuario, ip = null) {
    await this.exigirProducto(id);

    if (await this.productos.tienePedidos(id)) return this.inactivar(id, usuario, ip);

    const imagenes = await this.imagenes.listarPorProducto(id);
    try {
      await this.productos.eliminar(id);
    } catch (error) {
      if (error && error.code === 'ER_ROW_IS_REFERENCED_2') return this.inactivar(id, usuario, ip);
      throw error;
    }
    for (const imagen of imagenes) {
      try {
        await this.almacen.eliminar(imagen.ruta);
      } catch (error) {
        this.logger.error('No se pudo eliminar un archivo de imagen.', { ruta: imagen.ruta, mensaje: error.message });
      }
    }
    await this.bitacora.registrar(usuario.idUsuario, 'producto_eliminar', 'productos', id, null, ip);
    return { inactivado: false };
  }

  async inactivar(id, usuario, ip) {
    await this.productos.actualizar(id, { activo: 0 });
    await this.bitacora.registrar(usuario.idUsuario, 'producto_inactivar', 'productos', id, 'Tiene pedidos asociados', ip);
    return { inactivado: true };
  }

  async cambiarPrecio(id, precio, usuario, ip = null) {
    const mensaje = V.validarPrecio(precio);
    if (mensaje) throw new ValidacionError({ precio: mensaje }, mensaje);
    const existente = await this.exigirProducto(id);
    const nuevo = Number(V.limpiar(precio));
    await this.productos.actualizar(id, { precio: nuevo });
    await this.bitacora.registrar(usuario.idUsuario, 'producto_precio', 'productos', id, `anterior=${existente.precio}; nuevo=${nuevo}`, ip);
    return this.obtener(id, 'gestion');
  }

  async cambiarStock(id, stock, usuario, ip = null) {
    const mensaje = V.validarStock(stock);
    if (mensaje) throw new ValidacionError({ stock: mensaje }, mensaje);
    const existente = await this.exigirProducto(id);
    const nuevo = Number(V.limpiar(stock));
    await this.productos.actualizar(id, { stock: nuevo });
    await this.bitacora.registrar(usuario.idUsuario, 'producto_stock', 'productos', id, `anterior=${existente.stock}; nuevo=${nuevo}`, ip);
    return this.obtener(id, 'gestion');
  }

  async definirEntrega(id, dias, usuario, ip = null) {
    const mensaje = V.validarDiasEntrega(dias);
    if (mensaje) throw new ValidacionError({ diasEntrega: mensaje }, mensaje);
    const existente = await this.exigirProducto(id);
    const nuevo = Number(V.limpiar(dias));
    await this.productos.actualizar(id, { dias_entrega: nuevo });
    await this.bitacora.registrar(usuario.idUsuario, 'producto_entrega', 'productos', id, `anterior=${existente.diasEntrega}; nuevo=${nuevo}`, ip);
    return this.obtener(id, 'gestion');
  }

  // ---- apoyo ----

  validar(datos) {
    const { errores, valores } = V.validarProducto(datos);
    if (Object.keys(errores).length > 0) throw new ValidacionError(errores);
    return valores;
  }

  async exigirProducto(id) {
    const producto = await this.productos.buscarPorId(id);
    if (!producto) throw new NoEncontradoError('El producto no existe.');
    return producto;
  }

  async exigirCategoria(idCategoria) {
    const categoria = await this.categorias.buscarPorId(idCategoria);
    if (!categoria || !categoria.activo) {
      const mensaje = 'La categoría seleccionada no existe o está inactiva.';
      throw new ValidacionError({ idCategoria: mensaje }, mensaje);
    }
    return categoria;
  }

  async adjuntarImagenes(productos) {
    const porProducto = await this.imagenes.listarPorProductos(productos.map((p) => p.idProducto));
    for (const producto of productos) producto.imagenes = porProducto.get(producto.idProducto) ?? [];
  }
}

module.exports = ProductoService;
