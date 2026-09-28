'use strict';

const crypto = require('node:crypto');

const ALGORITMO = 'aes-256-gcm';

/**
 * Cifra y descifra datos sensibles (el número de tarjeta) con AES-256-GCM (RNF-08).
 * La clave nunca se escribe en el código: se recibe por configuración (variable de entorno).
 */
class CifradoService {
  constructor(claveHex) {
    if (!/^[0-9a-f]{64}$/i.test(claveHex || '')) {
      throw new Error('CIFRADO_CLAVE debe ser una cadena hexadecimal de 64 caracteres (32 bytes).');
    }
    this.clave = Buffer.from(claveHex, 'hex');
  }

  /** Devuelve un Buffer con iv + etiqueta de autenticación + texto cifrado, listo para guardarse. */
  cifrar(texto) {
    const iv = crypto.randomBytes(12);
    const cifrador = crypto.createCipheriv(ALGORITMO, this.clave, iv);
    const cifrado = Buffer.concat([cifrador.update(String(texto), 'utf8'), cifrador.final()]);
    return Buffer.concat([iv, cifrador.getAuthTag(), cifrado]);
  }

  descifrar(datos) {
    const iv = datos.subarray(0, 12);
    const etiqueta = datos.subarray(12, 28);
    const cifrado = datos.subarray(28);
    const descifrador = crypto.createDecipheriv(ALGORITMO, this.clave, iv);
    descifrador.setAuthTag(etiqueta);
    return Buffer.concat([descifrador.update(cifrado), descifrador.final()]).toString('utf8');
  }

  /** Últimos cuatro dígitos, para mostrar la tarjeta enmascarada. */
  static ultimos4(numero) {
    return String(numero).slice(-4);
  }
}

module.exports = CifradoService;
