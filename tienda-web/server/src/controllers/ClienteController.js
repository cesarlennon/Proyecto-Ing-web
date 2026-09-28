'use strict';

const { idDeRuta } = require('../utils/parametros');

/** Controlador de las direcciones y métodos de pago propios del cliente (CU-12, CU-13). */
class ClienteController {
  constructor({ direccionService, metodoPagoService }) {
    this.direccionService = direccionService;
    this.metodoPagoService = metodoPagoService;
    for (const metodo of [
      'listarDirecciones', 'crearDireccion', 'actualizarDireccion', 'eliminarDireccion', 'principalDireccion',
      'listarMetodosPago', 'crearMetodoPago', 'actualizarMetodoPago', 'eliminarMetodoPago', 'principalMetodoPago',
    ]) {
      this[metodo] = this[metodo].bind(this);
    }
  }

  async listarDirecciones(req, res) {
    const direcciones = await this.direccionService.listar(req.user.idUsuario);
    res.json({ direcciones: direcciones.map((d) => d.paraJSON()) });
  }

  async crearDireccion(req, res) {
    const direccion = await this.direccionService.crear(req.user.idUsuario, req.body ?? {}, req.user, req.ip);
    res.status(201).json({ direccion: direccion.paraJSON() });
  }

  async actualizarDireccion(req, res) {
    const direccion = await this.direccionService.actualizar(idDeRuta(req.params.id), req.user.idUsuario, req.body ?? {}, req.user, req.ip);
    res.json({ direccion: direccion.paraJSON() });
  }

  async eliminarDireccion(req, res) {
    await this.direccionService.eliminar(idDeRuta(req.params.id), req.user.idUsuario, req.user, req.ip);
    res.status(204).end();
  }

  async principalDireccion(req, res) {
    const direccion = await this.direccionService.establecerPrincipal(idDeRuta(req.params.id), req.user.idUsuario, req.user, req.ip);
    res.json({ direccion: direccion.paraJSON() });
  }

  async listarMetodosPago(req, res) {
    const metodos = await this.metodoPagoService.listar(req.user.idUsuario);
    res.json({ metodosPago: metodos.map((m) => m.paraJSON()) });
  }

  async crearMetodoPago(req, res) {
    const metodo = await this.metodoPagoService.crear(req.user.idUsuario, req.body ?? {}, req.user, req.ip);
    res.status(201).json({ metodoPago: metodo.paraJSON() });
  }

  async actualizarMetodoPago(req, res) {
    const metodo = await this.metodoPagoService.actualizar(idDeRuta(req.params.id), req.user.idUsuario, req.body ?? {}, req.user, req.ip);
    res.json({ metodoPago: metodo.paraJSON() });
  }

  async eliminarMetodoPago(req, res) {
    await this.metodoPagoService.eliminar(idDeRuta(req.params.id), req.user.idUsuario, req.user, req.ip);
    res.status(204).end();
  }

  async principalMetodoPago(req, res) {
    const metodo = await this.metodoPagoService.establecerPrincipal(idDeRuta(req.params.id), req.user.idUsuario, req.user, req.ip);
    res.json({ metodoPago: metodo.paraJSON() });
  }
}

module.exports = ClienteController;
