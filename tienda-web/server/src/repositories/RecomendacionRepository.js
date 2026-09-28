'use strict';

const BaseRepository = require('./BaseRepository');
const Recomendacion = require('../domain/Recomendacion');

class RecomendacionRepository extends BaseRepository {
  constructor(bd) {
    super(bd, 'recomendaciones', 'id_recomendacion', ['id_producto', 'id_usuario', 'texto']);
  }

  mapear(fila) {
    return new Recomendacion({
      idRecomendacion: fila.id_recomendacion,
      idProducto: fila.id_producto,
      idUsuario: fila.id_usuario,
      texto: fila.texto,
      autor: fila.autor ?? null,
      fecha: fila.fecha,
    });
  }

  /** Lista las recomendaciones de un producto con el nombre del cliente que las escribió, la más reciente primero. */
  async listarPorProducto(idProducto, cx) {
    const filas = await this.ejecutor(cx).consultar(
      `SELECT r.*, u.nombres AS autor_nombres, u.apellido_paterno AS autor_apellido
       FROM recomendaciones r JOIN usuarios u ON u.id_usuario = r.id_usuario
       WHERE r.id_producto = ? ORDER BY r.fecha DESC`,
      [idProducto],
    );
    return filas.map((f) => this.mapear({ ...f, autor: `${f.autor_nombres} ${f.autor_apellido}` }));
  }

  async crear(idProducto, idUsuario, texto, cx) {
    const id = await super.crear({ id_producto: idProducto, id_usuario: idUsuario, texto }, cx);
    const filas = await this.ejecutor(cx).consultar('SELECT * FROM recomendaciones WHERE id_recomendacion = ?', [id]);
    return this.mapear(filas[0]);
  }
}

module.exports = RecomendacionRepository;
