'use strict';

const BaseRepository = require('./BaseRepository');

class BitacoraRepository extends BaseRepository {
  constructor(bd) {
    super(bd, 'bitacora', 'id_bitacora', ['id_usuario', 'accion', 'entidad', 'id_entidad', 'detalle', 'ip']);
  }

  async registrarEvento({ idUsuario = null, accion, entidad = null, idEntidad = null, detalle = null, ip = null }) {
    return this.crear({
      id_usuario: idUsuario,
      accion,
      entidad,
      id_entidad: idEntidad,
      detalle: detalle === null ? null : String(detalle).slice(0, 500),
      ip,
    });
  }
}

module.exports = BitacoraRepository;
