'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const V = require('../../src/utils/validaciones');

const DATOS_VALIDOS = { correo: 'luis.r@correo.com', rol: 'inventarios', nombres: 'Luis', apellidoPaterno: 'Ramos', apellidoMaterno: 'Solís' };

describe('Validaciones de usuario', () => {
  test('validarRolUsuario solo acepta administrador o inventarios', () => {
    assert.equal(V.validarRolUsuario('administrador'), '');
    assert.equal(V.validarRolUsuario('inventarios'), '');
    assert.match(V.validarRolUsuario('cliente'), /no es válido/);
    assert.match(V.validarRolUsuario(''), /Selecciona/);
    assert.match(V.validarRolUsuario('root'), /no es válido/);
  });

  test('validarUsuarioNuevo normaliza correo y rol, y hace opcional el apellido materno', () => {
    const { errores, valores } = V.validarUsuarioNuevo({ ...DATOS_VALIDOS, correo: '  Luis.R@Correo.com ', apellidoMaterno: '' });
    assert.deepEqual(errores, {});
    assert.equal(valores.correo, 'luis.r@correo.com');
    assert.equal(valores.apellidoMaterno, null);
    assert.equal(valores.rol, 'inventarios');
  });

  test('validarUsuarioNuevo reporta un error por cada campo inválido', () => {
    const { errores } = V.validarUsuarioNuevo({ correo: 'mal', rol: 'cliente', nombres: '', apellidoPaterno: '' });
    assert.deepEqual(Object.keys(errores).sort(), ['apellidoPaterno', 'correo', 'nombres', 'rol']);
  });

  test('validarUsuarioEdicion no toca correo ni rol', () => {
    const { errores, valores } = V.validarUsuarioEdicion({ nombres: 'Luis', apellidoPaterno: 'Ramos' });
    assert.deepEqual(errores, {});
    assert.ok(!('correo' in valores));
    assert.ok(!('rol' in valores));
  });

  test('validarUsuarioEdicion exige nombre y apellido paterno', () => {
    const { errores } = V.validarUsuarioEdicion({});
    assert.deepEqual(Object.keys(errores).sort(), ['apellidoPaterno', 'nombres']);
  });
});
