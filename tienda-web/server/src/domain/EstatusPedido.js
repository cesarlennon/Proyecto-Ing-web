'use strict';

/** Enumeración de los estatus de un pedido, en el orden en que deben avanzar (RNF-19). */
const ESTATUS = Object.freeze({
  EN_PROCESO: 'En proceso',
  PAGADA: 'Pagada',
  ENVIADO: 'Enviado',
  RECIBIDO: 'Recibido',
});

const ORDEN = [ESTATUS.EN_PROCESO, ESTATUS.PAGADA, ESTATUS.ENVIADO, ESTATUS.RECIBIDO];

const IDS_ESTATUS = Object.freeze({
  [ESTATUS.EN_PROCESO]: 1,
  [ESTATUS.PAGADA]: 2,
  [ESTATUS.ENVIADO]: 3,
  [ESTATUS.RECIBIDO]: 4,
});

function estatusPorId(id) {
  const nombre = Object.keys(IDS_ESTATUS).find((n) => IDS_ESTATUS[n] === Number(id));
  if (!nombre) throw new Error(`Estatus desconocido: ${id}`);
  return nombre;
}

/** Estatus al que se puede avanzar desde `actual`, o null si ya es el último. */
function siguienteEstatus(actual) {
  const indice = ORDEN.indexOf(actual);
  if (indice === -1) throw new Error(`Estatus desconocido: ${actual}`);
  return ORDEN[indice + 1] ?? null;
}

module.exports = { ESTATUS, ORDEN, IDS_ESTATUS, estatusPorId, siguienteEstatus };
