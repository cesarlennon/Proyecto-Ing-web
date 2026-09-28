'use strict';

const { idDeRuta } = require('../utils/parametros');

/** Controlador de los catálogos. El nombre del catálogo lo fija la ruta (req.catalogo). */
class CatalogoController {
  constructor({ catalogoService }) {
    this.catalogoService = catalogoService;
    for (const metodo of ['listar', 'crear', 'actualizar', 'eliminar']) this[metodo] = this[metodo].bind(this);
  }

  async listar(req, res) {
    const incluirInactivos = req.query.incluirInactivos === 'true' && req.user.puede('catalogos:gestionar');
    const elementos = await this.catalogoService.listar(req.catalogo, { incluirInactivos });
    res.json({ elementos: elementos.map((e) => e.paraJSON()) });
  }

  async crear(req, res) {
    const elemento = await this.catalogoService.crear(req.catalogo, req.body ?? {}, req.user, req.ip);
    res.status(201).json({ elemento: elemento.paraJSON() });
  }

  async actualizar(req, res) {
    const elemento = await this.catalogoService.actualizar(req.catalogo, idDeRuta(req.params.id), req.body ?? {}, req.user, req.ip);
    res.json({ elemento: elemento.paraJSON() });
  }

  async eliminar(req, res) {
    await this.catalogoService.eliminar(req.catalogo, idDeRuta(req.params.id), req.user, req.ip);
    res.status(204).end();
  }
}

module.exports = CatalogoController;
