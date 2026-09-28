'use strict';

const { idDeRuta } = require('../utils/parametros');

/** Controlador de productos e imágenes. Los perfiles con permiso sobre el stock reciben la vista de gestión. */
class ProductoController {
  constructor({ productoService, imagenService }) {
    this.productoService = productoService;
    this.imagenService = imagenService;
    for (const metodo of [
      'listar', 'obtener', 'crear', 'actualizar', 'eliminar', 'cambiarPrecio', 'cambiarStock',
      'definirEntrega', 'agregarImagenes', 'eliminarImagen',
    ]) {
      this[metodo] = this[metodo].bind(this);
    }
  }

  static vistaDe(usuario) {
    return usuario.puede('productos:stock') ? 'gestion' : 'cliente';
  }

  static serializar(producto, vista) {
    return vista === 'gestion' ? producto.paraGestion() : producto.paraCliente();
  }

  async listar(req, res) {
    const vista = ProductoController.vistaDe(req.user);
    const resultado = await this.productoService.listar(
      {
        categoria: req.query.categoria,
        q: req.query.q,
        pagina: req.query.pagina,
        porPagina: req.query.porPagina,
        incluirInactivos: req.query.incluirInactivos === 'true',
      },
      vista,
    );
    res.json({
      productos: resultado.productos.map((p) => ProductoController.serializar(p, vista)),
      total: resultado.total,
      pagina: resultado.pagina,
      porPagina: resultado.porPagina,
      paginas: resultado.paginas,
    });
  }

  async obtener(req, res) {
    const vista = ProductoController.vistaDe(req.user);
    const producto = await this.productoService.obtener(idDeRuta(req.params.id), vista);
    res.json({ producto: ProductoController.serializar(producto, vista) });
  }

  async crear(req, res) {
    const producto = await this.productoService.crear(req.body ?? {}, req.user, req.ip);
    res.status(201).json({ producto: producto.paraGestion() });
  }

  async actualizar(req, res) {
    const producto = await this.productoService.actualizar(idDeRuta(req.params.id), req.body ?? {}, req.user, req.ip);
    res.json({ producto: producto.paraGestion() });
  }

  async eliminar(req, res) {
    const { inactivado } = await this.productoService.eliminar(idDeRuta(req.params.id), req.user, req.ip);
    res.json({ inactivado });
  }

  async cambiarPrecio(req, res) {
    const producto = await this.productoService.cambiarPrecio(idDeRuta(req.params.id), req.body?.precio, req.user, req.ip);
    res.json({ producto: producto.paraGestion() });
  }

  async cambiarStock(req, res) {
    const producto = await this.productoService.cambiarStock(idDeRuta(req.params.id), req.body?.stock, req.user, req.ip);
    res.json({ producto: producto.paraGestion() });
  }

  async definirEntrega(req, res) {
    const producto = await this.productoService.definirEntrega(idDeRuta(req.params.id), req.body?.diasEntrega, req.user, req.ip);
    res.json({ producto: producto.paraGestion() });
  }

  async agregarImagenes(req, res) {
    const imagenes = await this.imagenService.agregar(idDeRuta(req.params.id), req.files ?? [], req.user, req.ip);
    res.status(201).json({ imagenes: imagenes.map((i) => i.paraJSON()) });
  }

  async eliminarImagen(req, res) {
    await this.imagenService.eliminar(idDeRuta(req.params.id), idDeRuta(req.params.idImagen), req.user, req.ip);
    res.status(204).end();
  }
}

module.exports = ProductoController;
