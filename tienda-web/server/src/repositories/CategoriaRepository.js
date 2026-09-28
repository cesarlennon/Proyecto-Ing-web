'use strict';

const BaseRepository = require('./BaseRepository');
const Categoria = require('../domain/Categoria');

class CategoriaRepository extends BaseRepository {
  constructor(bd) {
    super(bd, 'categorias', 'id_categoria', ['nombre', 'activo']);
  }

  mapear(fila) {
    return new Categoria({ idCategoria: fila.id_categoria, nombre: fila.nombre, activo: Boolean(fila.activo) });
  }

  async listarTodas({ incluirInactivas = false } = {}, cx) {
    const donde = incluirInactivas ? '' : ' WHERE activo = 1';
    const filas = await this.ejecutor(cx).consultar(`SELECT * FROM categorias${donde} ORDER BY nombre`, []);
    return filas.map((f) => this.mapear(f));
  }

  async tieneProductos(id, cx) {
    const filas = await this.ejecutor(cx).consultar('SELECT 1 FROM productos WHERE id_categoria = ? LIMIT 1', [id]);
    return filas.length > 0;
  }
}

module.exports = CategoriaRepository;
