'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const UsuarioController = require('../../src/controllers/UsuarioController');
const { crearUsuario } = require('../../src/domain/crearUsuario');
const { NoEncontradoError } = require('../../src/errors/errores');

const respuesta = () => ({
  estado: 200, cuerpo: undefined,
  status(c) { this.estado = c; return this; },
  json(c) { this.cuerpo = c; return this; },
});
const usuario = (extra = {}) => crearUsuario({ idUsuario: 2, correo: 'x@x.com', nombres: 'Luis', apellidoPaterno: 'Ramos', rol: 'inventarios', activo: true, ...extra });

function crear() {
  const llamadas = [];
  const usuarioService = {
    listar: async (...a) => { llamadas.push(['listar', ...a]); return [usuario()]; },
    crear: async (...a) => { llamadas.push(['crear', ...a]); return usuario(); },
    actualizar: async (...a) => { llamadas.push(['actualizar', ...a]); return usuario(); },
    cambiarEstado: async (...a) => { llamadas.push(['cambiarEstado', ...a]); return usuario({ activo: false }); },
  };
  return { controlador: new UsuarioController({ usuarioService }), llamadas };
}
const req = (extra) => ({ user: { idUsuario: 1 }, ip: '1.1.1.1', ...extra });

describe('UsuarioController', () => {
  test('listar pasa el filtro de rol y serializa con paraAdmin', async () => {
    const { controlador, llamadas } = crear();
    const r = respuesta();
    await controlador.listar(req({ query: { rol: 'inventarios' } }), r);
    assert.deepEqual(llamadas[0], ['listar', { rol: 'inventarios' }]);
    assert.equal(r.cuerpo.usuarios[0].rol, 'inventarios');
    assert.ok(!('permisos' in r.cuerpo.usuarios[0])); // paraAdmin, no paraSesion
  });

  test('crear responde 201 con el usuario creado', async () => {
    const { controlador, llamadas } = crear();
    const r = respuesta();
    await controlador.crear(req({ body: { correo: 'x@x.com' } }), r);
    assert.equal(r.estado, 201);
    assert.deepEqual(llamadas[0], ['crear', { correo: 'x@x.com' }, req().user, '1.1.1.1']);
  });

  test('actualizar toma el id de la ruta', async () => {
    const { controlador, llamadas } = crear();
    await controlador.actualizar(req({ params: { id: '2' }, body: { nombres: 'Luis' } }), respuesta());
    assert.deepEqual(llamadas[0], ['actualizar', 2, { nombres: 'Luis' }, req().user, '1.1.1.1']);
    await assert.rejects(() => controlador.actualizar(req({ params: { id: 'x' }, body: {} }), respuesta()), NoEncontradoError);
  });

  test('cambiarEstado solo activa con el valor exacto true', async () => {
    const { controlador, llamadas } = crear();
    await controlador.cambiarEstado(req({ params: { id: '2' }, body: { activo: true, confirmado: true } }), respuesta());
    assert.deepEqual(llamadas[0], ['cambiarEstado', 2, true, req().user, '1.1.1.1']);

    for (const valor of ['true', 1, undefined]) {
      const { controlador: c2, llamadas: l2 } = crear();
      await c2.cambiarEstado(req({ params: { id: '2' }, body: { activo: valor } }), respuesta());
      assert.equal(l2[0][2], false);
    }
  });
});
