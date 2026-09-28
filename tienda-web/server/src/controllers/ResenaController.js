'use strict';

const { idDeRuta } = require('../utils/parametros');

/** Controlador de calificaciones y recomendaciones de producto (CU-19, CU-20). */
class ResenaController {
  constructor({ calificacionService, recomendacionService }) {
    this.calificacionService = calificacionService;
    this.recomendacionService = recomendacionService;
    for (const metodo of ['calificar', 'miCalificacion', 'listarRecomendaciones', 'recomendar']) {
      this[metodo] = this[metodo].bind(this);
    }
  }

  async calificar(req, res) {
    const calificacion = await this.calificacionService.calificar(
      idDeRuta(req.params.id),
      req.user.idUsuario,
      req.body?.estrellas,
      req.user,
      req.ip,
    );
    res.json({ calificacion: calificacion.paraJSON() });
  }

  async miCalificacion(req, res) {
    const { calificacion, puedeCalificar } = await this.calificacionService.miCalificacion(idDeRuta(req.params.id), req.user.idUsuario);
    res.json({ calificacion: calificacion ? calificacion.paraJSON() : null, puedeCalificar });
  }

  async listarRecomendaciones(req, res) {
    const recomendaciones = await this.recomendacionService.listar(idDeRuta(req.params.id));
    res.json({ recomendaciones: recomendaciones.map((r) => r.paraJSON()) });
  }

  async recomendar(req, res) {
    const recomendacion = await this.recomendacionService.recomendar(
      idDeRuta(req.params.id),
      req.user.idUsuario,
      req.body?.texto,
      req.user,
      req.ip,
    );
    res.status(201).json({ recomendacion: recomendacion.paraJSON() });
  }
}

module.exports = ResenaController;
