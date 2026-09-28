'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Usuario = require('../../src/domain/Usuario');
const Cliente = require('../../src/domain/Cliente');
const Administrador = require('../../src/domain/Administrador');
const PersonalInventarios = require('../../src/domain/PersonalInventarios');
const { crearUsuario } = require('../../src/domain/crearUsuario');
const { ROLES, IDS_ROL, rolPorId } = require('../../src/domain/Rol');

const base = { idUsuario: 1, correo: 'ana@correo.com', nombres: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: 'Gómez' };

describe('Jerarquía de usuarios', () => {
  test('Usuario es una clase abstracta', () => {
    assert.throws(() => new Usuario({ ...base, rol: 'cliente' }), TypeError);
  });

  test('crearUsuario devuelve la subclase que corresponde al rol', () => {
    assert.ok(crearUsuario({ ...base, rol: ROLES.ADMINISTRADOR }) instanceof Administrador);
    assert.ok(crearUsuario({ ...base, rol: ROLES.CLIENTE }) instanceof Cliente);
    assert.ok(crearUsuario({ ...base, rol: ROLES.INVENTARIOS }) instanceof PersonalInventarios);
    assert.throws(() => crearUsuario({ ...base, rol: 'invitado' }), /Rol desconocido/);
  });

  test('nombreCompleto omite el apellido materno vacío', () => {
    assert.equal(crearUsuario({ ...base, rol: 'cliente' }).nombreCompleto(), 'Ana Pérez Gómez');
    assert.equal(crearUsuario({ ...base, apellidoMaterno: null, rol: 'cliente' }).nombreCompleto(), 'Ana Pérez');
  });

  test('cada perfil tiene solo los permisos que le corresponden', () => {
    const admin = crearUsuario({ ...base, rol: 'administrador' });
    const cliente = crearUsuario({ ...base, rol: 'cliente' });
    const inventarios = crearUsuario({ ...base, rol: 'inventarios' });

    assert.ok(admin.puede('usuarios:gestionar'));
    assert.ok(admin.puede('reportes:ver'));
    assert.ok(cliente.puede('carrito:gestionar'));
    assert.ok(!cliente.puede('usuarios:gestionar'));
    assert.ok(!cliente.puede('productos:precio'));
    assert.ok(inventarios.puede('productos:stock'));
    assert.ok(inventarios.puede('pedidos:estatus'));
    assert.ok(!inventarios.puede('usuarios:gestionar'));
    assert.ok(!inventarios.puede('reportes:ver'));
  });

  test('tieneRol compara el perfil', () => {
    const cliente = crearUsuario({ ...base, rol: 'cliente' });
    assert.ok(cliente.tieneRol('cliente'));
    assert.ok(!cliente.tieneRol('administrador'));
  });

  test('paraSesion no expone datos de OAuth', () => {
    const u = crearUsuario({ ...base, rol: 'cliente', oauthProveedor: 'google', oauthId: '123' });
    const datos = u.paraSesion();
    assert.equal(datos.rol, 'cliente');
    assert.equal(datos.nombre, 'Ana Pérez Gómez');
    assert.ok(!('oauthId' in datos));
    assert.ok(!('oauthProveedor' in datos));
  });

  test('los identificadores de rol coinciden con los datos iniciales', () => {
    assert.equal(IDS_ROL.administrador, 1);
    assert.equal(IDS_ROL.cliente, 2);
    assert.equal(IDS_ROL.inventarios, 3);
    assert.equal(rolPorId(2), 'cliente');
    assert.equal(rolPorId('3'), 'inventarios');
    assert.throws(() => rolPorId(9), /Rol desconocido/);
  });
});
