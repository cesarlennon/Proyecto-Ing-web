'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const AlmacenImagenes = require('../../src/services/AlmacenImagenes');
const { ValidacionError } = require('../../src/errors/errores');

const relleno = Buffer.alloc(32, 1);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), relleno]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), relleno]);
const GIF = Buffer.concat([Buffer.from('GIF89a', 'latin1'), relleno]);
const WEBP = Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBP', 'latin1'), relleno]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');

describe('AlmacenImagenes', () => {
  let directorio;
  let almacen;
  before(() => {
    directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'imagenes-'));
    almacen = new AlmacenImagenes(path.join(directorio, 'productos'), { maxBytes: 1000 });
  });
  after(() => fs.rmSync(directorio, { recursive: true, force: true }));

  test('crea el directorio si no existe', () => {
    assert.ok(fs.existsSync(path.join(directorio, 'productos')));
  });

  test('detectarTipo reconoce las imágenes admitidas por su contenido', () => {
    assert.equal(AlmacenImagenes.detectarTipo(JPEG).extension, 'jpg');
    assert.equal(AlmacenImagenes.detectarTipo(PNG).extension, 'png');
    assert.equal(AlmacenImagenes.detectarTipo(GIF).extension, 'gif');
    assert.equal(AlmacenImagenes.detectarTipo(WEBP).extension, 'webp');
    assert.equal(AlmacenImagenes.detectarTipo(WEBP).mime, 'image/webp');
  });

  test('detectarTipo rechaza SVG, texto, ejecutables y buffers demasiado cortos', () => {
    assert.equal(AlmacenImagenes.detectarTipo(SVG), null);
    assert.equal(AlmacenImagenes.detectarTipo(Buffer.from('MZ' + 'x'.repeat(40))), null);
    assert.equal(AlmacenImagenes.detectarTipo(Buffer.from([0xff, 0xd8, 0xff])), null);
    assert.equal(AlmacenImagenes.detectarTipo('no es un buffer'), null);
    // RIFF sin la marca WEBP (por ejemplo, un WAV)
    const wav = Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.from([1, 2, 3, 4]), Buffer.from('WAVE', 'latin1'), relleno]);
    assert.equal(AlmacenImagenes.detectarTipo(wav), null);
  });

  test('guardar escribe el archivo con un nombre generado por el servidor', async () => {
    const nombre = await almacen.guardar({ buffer: PNG, originalname: '../../evil.php', mimetype: 'text/html' });
    assert.match(nombre, /^[0-9a-f-]{36}\.png$/);
    assert.deepEqual(fs.readFileSync(path.join(directorio, 'productos', nombre)), PNG);
  });

  test('cada archivo recibe un nombre distinto', async () => {
    const a = await almacen.guardar({ buffer: JPEG });
    const b = await almacen.guardar({ buffer: JPEG });
    assert.notEqual(a, b);
    assert.match(a, /\.jpg$/);
  });

  test('guardar rechaza archivos vacíos, demasiado grandes o que no son imágenes', async () => {
    await assert.rejects(() => almacen.guardar({ buffer: Buffer.alloc(0) }), ValidacionError);
    await assert.rejects(() => almacen.guardar({}), ValidacionError);
    await assert.rejects(() => almacen.guardar(undefined), ValidacionError);
    await assert.rejects(() => almacen.guardar({ buffer: Buffer.concat([JPEG, Buffer.alloc(2000)]) }), /como máximo/);
    await assert.rejects(() => almacen.guardar({ buffer: SVG, mimetype: 'image/png' }), /JPEG, PNG, GIF o WebP/);
  });

  test('eliminar borra el archivo y es idempotente', async () => {
    const nombre = await almacen.guardar({ buffer: GIF });
    assert.equal(await almacen.eliminar(nombre), true);
    assert.ok(!fs.existsSync(path.join(directorio, 'productos', nombre)));
    assert.equal(await almacen.eliminar(nombre), false);
  });

  test('eliminar ignora nombres que no genera el almacén (no sale del directorio)', async () => {
    const fuera = path.join(directorio, 'secreto.txt');
    fs.writeFileSync(fuera, 'no me borres');
    for (const malo of ['../secreto.txt', '..\\secreto.txt', '/etc/passwd', 'secreto.txt', '', null, undefined, 42]) {
      assert.equal(await almacen.eliminar(malo), false);
    }
    assert.ok(fs.existsSync(fuera));
  });
});
