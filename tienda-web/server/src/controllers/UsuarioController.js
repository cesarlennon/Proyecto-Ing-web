'use strict';

const { idDeRuta } = require('../utils/parametros');

/** Controlador de usuarios (CU-05). */
class UsuarioController {
  constructor({ usuarioService }) {
    this.usuarioService = usuarioService;
    for (const metodo of ['listar', 'crear', 'actualizar', 'cambiarEstado']) this[metodo] = this[metodo].bind(this);
  }

  async listar(req, res) {
    const usuarios = await this.usuarioService.listar({ rol: req.query.rol });
    res.json({ usuarios: usuarios.map((u) => u.paraAdmin()) });
  }

  async crear(req, res) {
    const usuario = await this.usuarioService.crear(req.body ?? {}, req.user, req.ip);
    res.status(201).json({ usuario: usuario.paraAdmin() });
  }

  async actualizar(req, res) {
    const usuario = await this.usuarioService.actualizar(idDeRuta(req.params.id), req.body ?? {}, req.user, req.ip);
    res.json({ usuario: usuario.paraAdmin() });
  }

  async cambiarEstado(req, res) {
    const usuario = await this.usuarioService.cambiarEstado(idDeRuta(req.params.id), req.body?.activo === true, req.user, req.ip);
    res.json({ usuario: usuario.paraAdmin() });
  }
}

module.exports = UsuarioController;
