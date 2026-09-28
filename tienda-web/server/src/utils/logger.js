'use strict';

const winston = require('winston');

/** Registro técnico del servidor. El detalle de los errores queda aquí y nunca se envía al navegador. */
function crearLogger(configuracion) {
  return winston.createLogger({
    level: configuracion.produccion ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    transports: [new winston.transports.Console()],
  });
}

module.exports = { crearLogger };
