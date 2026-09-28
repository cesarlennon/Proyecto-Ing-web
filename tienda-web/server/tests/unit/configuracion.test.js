'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Configuracion = require('../../src/config/configuracion');

const ENV_VALIDO = {
  URL_BASE: 'http://localhost:3000/',
  DB_HOST: 'localhost',
  DB_USUARIO: 'tienda_app',
  DB_CONTRASENA: 'clave',
  DB_NOMBRE: 'tienda_web',
  SESION_SECRETO: 'x'.repeat(40),
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secreto',
  CIFRADO_CLAVE: 'a'.repeat(64),
};

describe('Configuracion', () => {
  test('carga y normaliza las variables de entorno', () => {
    const c = Configuracion.cargar(ENV_VALIDO);
    assert.equal(c.urlBase, 'http://localhost:3000');
    assert.equal(c.puerto, 3000);
    assert.equal(c.bd.puerto, 3306);
    assert.equal(c.bd.usuario, 'tienda_app');
    assert.equal(c.sesion.minutosInactividad, 30);
    assert.equal(c.produccion, false);
    assert.equal(c.oauth.clientID, 'id');
    assert.equal(c.cifradoClave, 'a'.repeat(64));
  });

  test('respeta PORT, DB_PUERTO, SESION_MINUTOS y NODE_ENV', () => {
    const c = Configuracion.cargar({ ...ENV_VALIDO, PORT: '8080', DB_PUERTO: '3307', SESION_MINUTOS: '10', NODE_ENV: 'production' });
    assert.equal(c.puerto, 8080);
    assert.equal(c.bd.puerto, 3307);
    assert.equal(c.sesion.minutosInactividad, 10);
    assert.equal(c.produccion, true);
  });

  test('la contraseña de la base de datos puede estar vacía', () => {
    const { DB_CONTRASENA, ...sinClave } = ENV_VALIDO;
    assert.equal(Configuracion.cargar(sinClave).bd.contrasena, '');
  });

  test('indica exactamente qué variables faltan', () => {
    assert.throws(
      () => Configuracion.cargar({ ...ENV_VALIDO, DB_HOST: '', GOOGLE_CLIENT_SECRET: '   ' }),
      /DB_HOST, GOOGLE_CLIENT_SECRET/,
    );
  });

  test('exige un secreto de sesión largo', () => {
    assert.throws(() => Configuracion.cargar({ ...ENV_VALIDO, SESION_SECRETO: 'corto' }), /al menos 32/);
  });

  test('exige una clave de cifrado hexadecimal de 64 caracteres', () => {
    assert.throws(() => Configuracion.cargar({ ...ENV_VALIDO, CIFRADO_CLAVE: 'corta' }), /CIFRADO_CLAVE/);
    assert.throws(() => Configuracion.cargar({ ...ENV_VALIDO, CIFRADO_CLAVE: 'z'.repeat(64) }), /CIFRADO_CLAVE/);
  });

  test('la configuración no se puede modificar', () => {
    const c = Configuracion.cargar(ENV_VALIDO);
    assert.throws(() => { c.produccion = true; }, TypeError);
  });
});
