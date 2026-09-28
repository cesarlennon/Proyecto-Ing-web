'use strict';

const BaseRepository = require('./BaseRepository');
const Calificacion = require('../domain/Calificacion');

class CalificacionRepository extends BaseRepository {
  constructor(bd) {
    super(bd, 'calificaciones', 'id_calificacion', ['id_producto', 'id_usuario', 'estrellas']);
  }

  mapear(fila) {
    return new Calificacion({
      idCalificacion: fila.id_calificacion,
      idProducto: fila.id_producto,
      idUsuario: fila.id_usuario,
      estrellas: fila.estrellas,
      fecha: fila.fecha,
    });
  }

  async buscarDeCliente(idProducto, idUsuario, cx) {
    const filas = await this.ejecutor(cx).consultar(
      'SELECT * FROM calificaciones WHERE id_producto = ? AND id_usuario = ?',
      [idProducto, idUsuario],
    );
    return filas.length > 0 ? this.mapear(filas[0]) : null;
  }

  /** Crea la calificación o, si el cliente ya había calificado el producto, actualiza el valor (RF-14). */
  async guardar(idProducto, idUsuario, estrellas, cx) {
    await this.ejecutor(cx).consultar(
      `INSERT INTO calificaciones (id_producto, id_usuario, estrellas) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE estrellas = VALUES(estrellas), fecha = CURRENT_TIMESTAMP`,
      [idProducto, idUsuario, estrellas],
    );
    return this.buscarDeCliente(idProducto, idUsuario, cx);
  }

  async promedio(idProducto, cx) {
    const filas = await this.ejecutor(cx).consultar(
      'SELECT ROUND(AVG(estrellas), 1) AS promedio, COUNT(*) AS total FROM calificaciones WHERE id_producto = ?',
      [idProducto],
    );
    return { promedio: filas[0].promedio === null ? null : Number(filas[0].promedio), total: Number(filas[0].total) };
  }
}

module.exports = CalificacionRepository;
