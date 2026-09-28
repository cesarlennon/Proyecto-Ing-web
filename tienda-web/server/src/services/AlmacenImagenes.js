'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { ValidacionError } = require('../errors/errores');

const NOMBRE_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp)$/;

/**
 * Guarda y elimina las imágenes de los productos en el disco del servidor.
 * - El tipo se determina por el contenido del archivo (no por el nombre ni por lo que declara el
 *   navegador) y solo se aceptan JPEG, PNG, GIF y WebP. SVG no se acepta porque puede llevar código.
 * - El nombre del archivo lo genera el servidor; el nombre original nunca se usa.
 */
class AlmacenImagenes {
  constructor(directorio, { maxBytes = 5 * 1024 * 1024 } = {}) {
    this.directorio = directorio;
    this.maxBytes = maxBytes;
    fs.mkdirSync(directorio, { recursive: true });
  }

  /** Devuelve { extension, mime } según la firma del archivo, o null si no es una imagen admitida. */
  static detectarTipo(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { extension: 'jpg', mime: 'image/jpeg' };
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return { extension: 'png', mime: 'image/png' };
    }
    const cabecera = buffer.subarray(0, 6).toString('latin1');
    if (cabecera === 'GIF87a' || cabecera === 'GIF89a') return { extension: 'gif', mime: 'image/gif' };
    if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
      return { extension: 'webp', mime: 'image/webp' };
    }
    return null;
  }

  /** Guarda el archivo y devuelve el nombre con el que quedó almacenado. */
  async guardar(archivo) {
    const buffer = archivo?.buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new ValidacionError({ imagenes: 'El archivo está vacío.' }, 'El archivo está vacío.');
    }
    if (buffer.length > this.maxBytes) {
      const mensaje = `Cada imagen puede pesar como máximo ${Math.round(this.maxBytes / (1024 * 1024))} MB.`;
      throw new ValidacionError({ imagenes: mensaje }, mensaje);
    }
    const tipo = AlmacenImagenes.detectarTipo(buffer);
    if (!tipo) {
      const mensaje = 'Solo se aceptan imágenes JPEG, PNG, GIF o WebP.';
      throw new ValidacionError({ imagenes: mensaje }, mensaje);
    }

    const nombre = `${crypto.randomUUID()}.${tipo.extension}`;
    await fs.promises.writeFile(path.join(this.directorio, nombre), buffer, { flag: 'wx' });
    return nombre;
  }

  /** Elimina un archivo. Ignora nombres que no genera este almacén (evita salir del directorio). */
  async eliminar(nombre) {
    if (typeof nombre !== 'string' || !NOMBRE_VALIDO.test(nombre)) return false;
    try {
      await fs.promises.unlink(path.join(this.directorio, nombre));
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }
}

module.exports = AlmacenImagenes;
