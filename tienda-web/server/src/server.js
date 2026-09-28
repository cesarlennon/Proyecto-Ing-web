'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Configuracion = require('./config/configuracion');
const { crearLogger } = require('./utils/logger');
const { construirContenedor } = require('./contenedor');
const { crearApp } = require('./app');

async function iniciar() {
  const config = Configuracion.cargar();
  const logger = crearLogger(config);
  const contenedor = construirContenedor(config, logger);

  try {
    await contenedor.bd.consultar('SELECT 1');
  } catch (error) {
    logger.error('No se pudo conectar con MySQL. Revisa las variables DB_* del archivo .env.', { mensaje: error.message });
    process.exit(1);
  }

  const app = crearApp({ config, ...contenedor });
  const servidor = app.listen(config.puerto, () => {
    logger.info(`Servidor listo en ${config.urlBase} (puerto ${config.puerto}).`);
  });

  const cerrar = (senal) => {
    logger.info(`Se recibió ${senal}; cerrando el servidor.`);
    servidor.close(async () => {
      await contenedor.bd.cerrar();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => cerrar('SIGTERM'));
  process.on('SIGINT', () => cerrar('SIGINT'));
}

iniciar().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
