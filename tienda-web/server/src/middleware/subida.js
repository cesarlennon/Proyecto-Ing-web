'use strict';

const multer = require('multer');

/**
 * Recibe hasta 10 imágenes de hasta 5 MB en el campo «imagenes». Los archivos se mantienen en
 * memoria y AlmacenImagenes decide si son válidos y dónde se guardan.
 */
function crearSubidaImagenes() {
  const cargador = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  });
  return cargador.array('imagenes', 10);
}

module.exports = { crearSubidaImagenes };
