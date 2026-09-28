'use strict';

const BaseRepository = require('./BaseRepository');

class ClienteRepository extends BaseRepository {
  constructor(bd) {
    super(bd, 'clientes', 'id_usuario', ['rfc', 'curp']);
  }

  async crearCliente({ idUsuario, rfc, curp }, cx) {
    return this.crear({ id_usuario: idUsuario, rfc, curp }, cx);
  }
}

module.exports = ClienteRepository;
