'use strict';

const BaseRepository = require('./BaseRepository');
const ImagenProducto = require('../domain/ImagenProducto');

class ImagenRepository extends BaseRepository {
  constructor(bd) {
    super(bd, 'imagenes_producto', 'id_imagen', ['id_producto', 'ruta', 'orden']);
  }

  mapear(fila) {
    return new ImagenProducto({
      idImagen: fila.id_imagen,
      idProducto: fila.id_producto,
      ruta: fila.ruta,
      orden: fila.orden,
      fechaAlta: fila.fecha_alta,
    });
  }

  async listarPorProducto(idProducto, cx) {
    const filas = await this.ejecutor(cx).consultar(
      'SELECT * FROM imagenes_producto WHERE id_producto = ? ORDER BY orden, id_imagen',
      [idProducto],
    );
    return filas.map((f) => this.mapear(f));
  }

  /** Devuelve un Map idProducto -> ImagenProducto[] con una sola consulta (evita una consulta por producto). */
  async listarPorProductos(ids, cx) {
    const resultado = new Map(ids.map((id) => [id, []]));
    if (ids.length === 0) return resultado;
    const filas = await this.ejecutor(cx).consultar(
      `SELECT * FROM imagenes_producto WHERE id_producto IN (${ids.map(() => '?').join(', ')}) ORDER BY orden, id_imagen`,
      ids,
    );
    for (const fila of filas) resultado.get(fila.id_producto)?.push(this.mapear(fila));
    return resultado;
  }

  async siguienteOrden(idProducto, cx) {
    const filas = await this.ejecutor(cx).consultar(
      'SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM imagenes_producto WHERE id_producto = ?',
      [idProducto],
    );
    return Number(filas[0].siguiente);
  }

  async crearImagen({ idProducto, ruta, orden }, cx) {
    return this.crear({ id_producto: idProducto, ruta, orden }, cx);
  }
}

module.exports = ImagenRepository;
