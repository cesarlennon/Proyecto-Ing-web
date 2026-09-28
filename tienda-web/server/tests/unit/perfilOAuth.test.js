'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { perfilDesdeGoogle } = require('../../src/utils/perfilOAuth');
const { NoAutorizadoError } = require('../../src/errors/errores');

const perfil = (extra = {}) => ({
  id: 1234567890,
  emails: [{ value: 'Ana.Perez@Correo.com', verified: true }],
  name: { givenName: 'Ana', familyName: 'Pérez' },
  _json: { email_verified: true },
  ...extra,
});

describe('perfilDesdeGoogle', () => {
  test('normaliza el perfil que entrega Google', () => {
    assert.deepEqual(perfilDesdeGoogle(perfil()), {
      proveedor: 'google',
      id: '1234567890',
      correo: 'ana.perez@correo.com',
      nombres: 'Ana',
      apellidos: 'Pérez',
    });
  });

  test('exige un correo', () => {
    assert.throws(
      () => perfilDesdeGoogle(perfil({ emails: [] })),
      (e) => e instanceof NoAutorizadoError && e.codigo === 'OAUTH_SIN_CORREO',
    );
    assert.throws(() => perfilDesdeGoogle(null), NoAutorizadoError);
  });

  test('rechaza un correo que Google marca como no verificado', () => {
    assert.throws(
      () => perfilDesdeGoogle(perfil({ _json: { email_verified: false } })),
      (e) => e.codigo === 'OAUTH_CORREO_NO_VERIFICADO',
    );
  });

  test('acepta el perfil aunque Google no incluya el dato de verificación', () => {
    const sinDato = perfil({ _json: {}, emails: [{ value: 'a@b.com' }] });
    assert.equal(perfilDesdeGoogle(sinDato).correo, 'a@b.com');
  });
});
