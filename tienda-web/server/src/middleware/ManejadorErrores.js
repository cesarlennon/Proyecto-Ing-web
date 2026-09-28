'use strict';

const { ErrorAplicacion } = require('../errors/errores');

/**
 * Manejador central de errores (RF-07, RNF-10): responde con mensajes genéricos, sin rutas ni
 * trazas internas. El detalle técnico se escribe solo en el registro del servidor.
 */
class ManejadorErrores {
  static manejar(logger = console) {
    // Express reconoce un manejador de errores por sus cuatro parámetros.
    // eslint-disable-next-line no-unused-vars
    return (error, req, res, next) => {
      if (res.headersSent) return next(error);

      if (error instanceof ErrorAplicacion) {
        if (error.estado >= 500) {
          logger.error('Error de la aplicación.', { codigo: error.codigo, mensaje: error.message });
        }
        const cuerpo = { error: { codigo: error.codigo, mensaje: error.message } };
        if (error.campos) cuerpo.error.campos = error.campos;
        return res.status(error.estado).json(cuerpo);
      }

      if (error && error.type === 'entity.parse.failed') {
        return res
          .status(400)
          .json({ error: { codigo: 'JSON_INVALIDO', mensaje: 'La información enviada no tiene un formato válido.' } });
      }
      if (error && error.name === 'MulterError') {
        const mensajes = {
          LIMIT_FILE_SIZE: 'Cada imagen puede pesar como máximo 5 MB.',
          LIMIT_FILE_COUNT: 'Puedes subir hasta 10 imágenes a la vez.',
          LIMIT_UNEXPECTED_FILE: 'Los archivos deben enviarse en el campo de imágenes.',
        };
        return res.status(400).json({
          error: { codigo: 'ARCHIVO_INVALIDO', mensaje: mensajes[error.code] ?? 'No se pudo procesar el archivo enviado.' },
        });
      }
      if (error && error.type === 'entity.too.large') {
        return res
          .status(413)
          .json({ error: { codigo: 'DEMASIADO_GRANDE', mensaje: 'La información enviada es demasiado grande.' } });
      }

      logger.error('Error no controlado.', {
        mensaje: error?.message,
        pila: error?.stack,
        ruta: `${req.method} ${req.originalUrl}`,
      });
      return res
        .status(500)
        .json({ error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.' } });
    };
  }
}

module.exports = ManejadorErrores;
