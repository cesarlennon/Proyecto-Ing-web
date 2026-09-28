'use strict';

const BaseRepository = require('./BaseRepository');
const Pais = require('../domain/Pais');

class PaisRepository extends BaseRepository {
  constructor(bd) {
    super(bd, 'paises', 'id_pais', ['nombre', 'activo']);
  }

  mapear(fila) {
    return new Pais({ idPais: fila.id_pais, nombre: fila.nombre, activo: Boolean(fila.activo) });
  }

  async listarTodas({ incluirInactivas = false } = {}, cx) {
    const donde = incluirInactivas ? '' : ' WHERE activo = 1';
    const filas = await this.ejecutor(cx).consultar(`SELECT * FROM paises${donde} ORDER BY nombre`, []);
    return filas.map((f) => this.mapear(f));
  }

  async tieneDirecciones(id, cx) {
    const filas = await this.ejecutor(cx).consultar('SELECT 1 FROM direcciones WHERE id_pais = ? LIMIT 1', [id]);
    return filas.length > 0;
  }
}

module.exports = PaisRepository;
