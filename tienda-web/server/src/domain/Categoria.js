'use strict';

class Categoria {
  constructor({ idCategoria, nombre, activo = true }) {
    this.idCategoria = idCategoria;
    this.nombre = nombre;
    this.activo = activo;
  }

  paraJSON() {
    return { idCategoria: this.idCategoria, nombre: this.nombre, activo: this.activo };
  }
}

module.exports = Categoria;
