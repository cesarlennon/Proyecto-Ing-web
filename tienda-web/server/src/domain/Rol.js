'use strict';

/** Enumeración de perfiles. Los identificadores coinciden con los datos iniciales de la tabla roles. */
const ROLES = Object.freeze({
  ADMINISTRADOR: 'administrador',
  CLIENTE: 'cliente',
  INVENTARIOS: 'inventarios',
});

const IDS_ROL = Object.freeze({
  administrador: 1,
  cliente: 2,
  inventarios: 3,
});

function rolPorId(id) {
  const rol = Object.keys(IDS_ROL).find((nombre) => IDS_ROL[nombre] === Number(id));
  if (!rol) throw new Error(`Rol desconocido: ${id}`);
  return rol;
}

module.exports = { ROLES, IDS_ROL, rolPorId };
