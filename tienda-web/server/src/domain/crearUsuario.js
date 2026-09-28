'use strict';

const { ROLES } = require('./Rol');
const Administrador = require('./Administrador');
const Cliente = require('./Cliente');
const PersonalInventarios = require('./PersonalInventarios');

const CLASES = {
  [ROLES.ADMINISTRADOR]: Administrador,
  [ROLES.CLIENTE]: Cliente,
  [ROLES.INVENTARIOS]: PersonalInventarios,
};

/** Fábrica: devuelve la subclase de Usuario que corresponde al rol. */
function crearUsuario(datos) {
  const Clase = CLASES[datos.rol];
  if (!Clase) throw new Error(`Rol desconocido: ${datos.rol}`);
  return new Clase(datos);
}

module.exports = { crearUsuario };
