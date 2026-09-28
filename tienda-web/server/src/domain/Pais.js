'use strict';

class Pais {
  constructor({ idPais, nombre, activo = true }) {
    this.idPais = idPais;
    this.nombre = nombre;
    this.activo = activo;
  }

  paraJSON() {
    return { idPais: this.idPais, nombre: this.nombre, activo: this.activo };
  }
}

module.exports = Pais;
