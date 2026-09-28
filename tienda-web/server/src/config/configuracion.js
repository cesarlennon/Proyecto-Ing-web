'use strict';

const path = require('path');

const REQUERIDAS = [
  'URL_BASE',
  'DB_HOST',
  'DB_USUARIO',
  'DB_NOMBRE',
  'SESION_SECRETO',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'CIFRADO_CLAVE',
];

/** Lee y valida las variables de entorno. Los secretos nunca se escriben en el código. */
class Configuracion {
  static cargar(env = process.env) {
    const faltantes = REQUERIDAS.filter((n) => !env[n] || !String(env[n]).trim());
    if (faltantes.length > 0) {
      throw new Error(`Faltan variables de entorno: ${faltantes.join(', ')}. Revisa tu archivo .env.`);
    }
    if (env.SESION_SECRETO.length < 32) {
      throw new Error('SESION_SECRETO debe tener al menos 32 caracteres.');
    }
    if (!/^[0-9a-f]{64}$/i.test(env.CIFRADO_CLAVE)) {
      throw new Error('CIFRADO_CLAVE debe ser una cadena hexadecimal de 64 caracteres (32 bytes).');
    }

    return Object.freeze({
      produccion: env.NODE_ENV === 'production',
      puerto: Number(env.PORT) || 3000,
      urlBase: env.URL_BASE.trim().replace(/\/+$/, ''),
      bd: Object.freeze({
        host: env.DB_HOST,
        puerto: Number(env.DB_PUERTO) || 3306,
        usuario: env.DB_USUARIO,
        contrasena: env.DB_CONTRASENA ?? '',
        nombre: env.DB_NOMBRE,
      }),
      sesion: Object.freeze({
        secreto: env.SESION_SECRETO,
        minutosInactividad: Number(env.SESION_MINUTOS) || 30,
        nombreCookie: 'sid',
      }),
      oauth: Object.freeze({
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      }),
      cifradoClave: env.CIFRADO_CLAVE,
      rutaCliente: path.resolve(__dirname, '../../../client'),
      rutaImagenes: path.resolve(__dirname, '../../uploads/productos'),
    });
  }
}

module.exports = Configuracion;
