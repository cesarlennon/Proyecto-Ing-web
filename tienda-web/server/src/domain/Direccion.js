'use strict';

/** Dirección de entrega del cliente. Puede ser la principal (CU-12). */
class Direccion {
  constructor({
    idDireccion,
    idUsuario,
    calle,
    numeroExterior,
    numeroInterior = null,
    colonia,
    codigoPostal,
    municipio,
    ciudad,
    idPais,
    pais = null,
    esPrincipal = false,
    activo = true,
  }) {
    this.idDireccion = idDireccion;
    this.idUsuario = idUsuario;
    this.calle = calle;
    this.numeroExterior = numeroExterior;
    this.numeroInterior = numeroInterior;
    this.colonia = colonia;
    this.codigoPostal = codigoPostal;
    this.municipio = municipio;
    this.ciudad = ciudad;
    this.idPais = idPais;
    this.pais = pais;
    this.esPrincipal = esPrincipal;
    this.activo = activo;
  }

  /** Texto completo, tal como se guarda en el pedido para conservar un historial fiel (RNF-19). */
  textoCompleto() {
    const numero = this.numeroInterior ? `${this.numeroExterior} Int. ${this.numeroInterior}` : this.numeroExterior;
    const pais = this.pais ? this.pais.nombre : '';
    return [
      `${this.calle} ${numero}`,
      `Col. ${this.colonia}`,
      `${this.municipio}, ${this.ciudad}, ${pais}`,
      `C.P. ${this.codigoPostal}`,
    ].join(', ');
  }

  paraJSON() {
    return {
      idDireccion: this.idDireccion,
      calle: this.calle,
      numeroExterior: this.numeroExterior,
      numeroInterior: this.numeroInterior,
      colonia: this.colonia,
      codigoPostal: this.codigoPostal,
      municipio: this.municipio,
      ciudad: this.ciudad,
      idPais: this.idPais,
      pais: this.pais ? { idPais: this.pais.idPais, nombre: this.pais.nombre } : null,
      esPrincipal: this.esPrincipal,
      textoCompleto: this.textoCompleto(),
    };
  }
}

module.exports = Direccion;
