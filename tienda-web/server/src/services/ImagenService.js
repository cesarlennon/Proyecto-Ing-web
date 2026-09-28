'use strict';

const { NoEncontradoError, ValidacionError } = require('../errors/errores');

const MAX_POR_SOLICITUD = 10;

/** Administra las imágenes de los productos (CU-07). Un producto puede tener cualquier cantidad. */
class ImagenService {
  constructor({ imagenes, productos, almacen, bitacora, logger = console }) {
    this.imagenes = imagenes;
    this.productos = productos;
    this.almacen = almacen;
    this.bitacora = bitacora;
    this.logger = logger;
  }

  async exigirProducto(idProducto) {
    const producto = await this.productos.buscarPorId(idProducto);
    if (!producto) throw new NoEncontradoError('El producto no existe.');
    return producto;
  }

  async listar(idProducto) {
    await this.exigirProducto(idProducto);
    return this.imagenes.listarPorProducto(idProducto);
  }

  /**
   * Agrega varias imágenes a la vez. Es todo o nada: si alguna no es válida se descartan
   * también las que ya se habían guardado en esta solicitud.
   */
  async agregar(idProducto, archivos, usuario, ip = null) {
    await this.exigirProducto(idProducto);
    if (!Array.isArray(archivos) || archivos.length === 0) {
      const mensaje = 'Selecciona al menos una imagen.';
      throw new ValidacionError({ imagenes: mensaje }, mensaje);
    }
    if (archivos.length > MAX_POR_SOLICITUD) {
      const mensaje = `Puedes subir hasta ${MAX_POR_SOLICITUD} imágenes a la vez.`;
      throw new ValidacionError({ imagenes: mensaje }, mensaje);
    }

    const creadas = [];
    try {
      for (const archivo of archivos) {
        const ruta = await this.almacen.guardar(archivo);
        try {
          const orden = await this.imagenes.siguienteOrden(idProducto);
          const idImagen = await this.imagenes.crearImagen({ idProducto, ruta, orden });
          creadas.push({ idImagen, ruta });
        } catch (error) {
          await this.almacen.eliminar(ruta);
          throw error;
        }
      }
    } catch (error) {
      await this.descartar(creadas);
      throw error;
    }

    await this.bitacora.registrar(usuario.idUsuario, 'imagen_agregar', 'productos', idProducto, `${creadas.length} imagen(es)`, ip);
    return this.imagenes.listarPorProducto(idProducto);
  }

  async eliminar(idProducto, idImagen, usuario, ip = null) {
    const imagen = await this.imagenes.buscarPorId(idImagen);
    if (!imagen || imagen.idProducto !== idProducto) throw new NoEncontradoError('La imagen no existe.');

    await this.imagenes.eliminar(idImagen);
    try {
      await this.almacen.eliminar(imagen.ruta);
    } catch (error) {
      this.logger.error('No se pudo eliminar un archivo de imagen.', { ruta: imagen.ruta, mensaje: error.message });
    }
    await this.bitacora.registrar(usuario.idUsuario, 'imagen_eliminar', 'productos', idProducto, `imagen ${idImagen}`, ip);
  }

  async descartar(creadas) {
    for (const { idImagen, ruta } of creadas) {
      try {
        await this.imagenes.eliminar(idImagen);
        await this.almacen.eliminar(ruta);
      } catch (error) {
        this.logger.error('No se pudo descartar una imagen.', { ruta, mensaje: error.message });
      }
    }
  }
}

module.exports = ImagenService;
