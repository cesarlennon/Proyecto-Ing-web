'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const DireccionService = require('../../src/services/DireccionService');
const Direccion = require('../../src/domain/Direccion');
const Pais = require('../../src/domain/Pais');
const { NoEncontradoError, ValidacionError } = require('../../src/errors/errores');

const USUARIO = { idUsuario: 7 };
const DATOS = { calle: 'Av. Universidad', numeroExterior: '1200', colonia: 'Xoco', codigoPostal: '04310', municipio: 'Benito Juárez', ciudad: 'CDMX', idPais: '1' };

function crearFakes() {
  const f = { eventos: [] };
  f.direcciones = {
    filas: new Map(),
    siguiente: 1,
    async listarPorCliente(idUsuario) { return [...this.filas.values()].filter((d) => d.idUsuario === idUsuario && d.activo); },
    async buscarDeCliente(id, idUsuario) {
      const d = this.filas.get(id);
      return d && d.idUsuario === idUsuario && d.activo ? d : null;
    },
    async crearDireccion(idUsuario, valores) {
      const id = this.siguiente++;
      this.filas.set(id, new Direccion({ idDireccion: id, idUsuario, ...valores, pais: new Pais({ idPais: valores.idPais, nombre: 'México' }) }));
      return id;
    },
    async actualizarDireccion(id, valores) { Object.assign(this.filas.get(id), valores); },
    async limpiarPrincipal(idUsuario) { for (const d of this.filas.values()) if (d.idUsuario === idUsuario) d.esPrincipal = false; },
    async marcarPrincipal(id) { this.filas.get(id).esPrincipal = true; },
    async desactivar(id) { const d = this.filas.get(id); d.activo = false; d.esPrincipal = false; },
  };
  f.paises = { async buscarPorId(id) { return id === 1 ? new Pais({ idPais: 1, nombre: 'México', activo: true }) : (id === 2 ? new Pais({ idPais: 2, nombre: 'Viejo', activo: false }) : null); } };
  f.bd = { async transaccion(trabajo) { return trabajo({}); } };
  f.bitacora = { async registrar(...a) { f.eventos.push(a); } };
  f.servicio = new DireccionService({ bd: f.bd, direcciones: f.direcciones, paises: f.paises, bitacora: f.bitacora });
  return f;
}

describe('DireccionService.crear', () => {
  let f;
  beforeEach(() => { f = crearFakes(); });

  test('la primera dirección del cliente se marca como principal aunque no se pida', async () => {
    const d = await f.servicio.crear(7, { ...DATOS, esPrincipal: false }, USUARIO, '1.1.1.1');
    assert.equal(d.esPrincipal, true);
    assert.deepEqual(f.eventos[0], [7, 'direccion_crear', 'direcciones', 1, null, '1.1.1.1']);
  });

  test('una segunda dirección no principal no desplaza a la primera', async () => {
    await f.servicio.crear(7, DATOS, USUARIO);
    await f.servicio.crear(7, { ...DATOS, esPrincipal: false }, USUARIO);
    const lista = await f.direcciones.listarPorCliente(7);
    assert.equal(lista.filter((d) => d.esPrincipal).length, 1);
    assert.ok(lista[0].esPrincipal);
  });

  test('marcar una nueva dirección como principal quita la marca a las demás', async () => {
    await f.servicio.crear(7, DATOS, USUARIO);
    await f.servicio.crear(7, { ...DATOS, esPrincipal: true }, USUARIO);
    const lista = await f.direcciones.listarPorCliente(7);
    assert.deepEqual(lista.map((d) => d.esPrincipal), [false, true]);
  });

  test('rechaza datos inválidos y un país inexistente o inactivo', async () => {
    await assert.rejects(() => f.servicio.crear(7, { ...DATOS, calle: '' }, USUARIO), ValidacionError);
    await assert.rejects(() => f.servicio.crear(7, { ...DATOS, idPais: '2' }, USUARIO), (e) => Boolean(e.campos.idPais));
    await assert.rejects(() => f.servicio.crear(7, { ...DATOS, idPais: '999' }, USUARIO), (e) => Boolean(e.campos.idPais));
  });
});

describe('DireccionService: actualizar, eliminar y principal', () => {
  let f;
  beforeEach(async () => { f = crearFakes(); await f.servicio.crear(7, DATOS, USUARIO); });

  test('actualizar exige que la dirección sea del cliente', async () => {
    await f.servicio.actualizar(1, 7, { ...DATOS, calle: 'Nueva calle' }, USUARIO);
    assert.equal((await f.direcciones.buscarDeCliente(1, 7)).calle, 'Nueva calle');
    await assert.rejects(() => f.servicio.actualizar(1, 99, DATOS, USUARIO), NoEncontradoError);
    await assert.rejects(() => f.servicio.actualizar(99, 7, DATOS, USUARIO), NoEncontradoError);
  });

  test('eliminar es una baja lógica', async () => {
    await f.servicio.eliminar(1, 7, USUARIO, '2.2.2.2');
    assert.equal(await f.direcciones.buscarDeCliente(1, 7), null);
    assert.equal(f.eventos.at(-1)[1], 'direccion_eliminar');
  });

  test('establecerPrincipal solo puede usarse con una dirección propia', async () => {
    await f.servicio.crear(7, { ...DATOS, esPrincipal: false }, USUARIO);
    const actualizada = await f.servicio.establecerPrincipal(2, 7, USUARIO);
    assert.equal(actualizada.esPrincipal, true);
    assert.equal((await f.direcciones.buscarDeCliente(1, 7)).esPrincipal, false);
    await assert.rejects(() => f.servicio.establecerPrincipal(1, 99, USUARIO), NoEncontradoError);
  });
});
