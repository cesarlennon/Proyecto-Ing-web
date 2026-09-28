'use strict';

/** Registra en la bitácora los eventos relevantes (RNF-11). Un fallo aquí no interrumpe la operación. */
class BitacoraService {
  constructor({ bitacora, logger = console }) {
    this.bitacora = bitacora;
    this.logger = logger;
  }

  async registrar(idUsuario, accion, entidad = null, idEntidad = null, detalle = null, ip = null) {
    try {
      await this.bitacora.registrarEvento({ idUsuario, accion, entidad, idEntidad, detalle, ip });
    } catch (error) {
      this.logger.error('No se pudo escribir en la bitácora.', { accion, mensaje: error.message });
    }
  }
}

module.exports = BitacoraService;
