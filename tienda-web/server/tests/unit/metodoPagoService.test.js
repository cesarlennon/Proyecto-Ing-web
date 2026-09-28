'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const MetodoPagoService = require('../../src/services/MetodoPagoService');
const CifradoService = require('../../src/services/CifradoService');
const MetodoPago = require('../../src/domain/MetodoPago');
const { NoEncontradoError, ValidacionError } = require('../../src/errors/errores');

const USUARIO = { idUsuario: 7 };
const ANIO = new Date().getFullYear() + 2;
const DATOS = { titular: 'Ana Pérez', numero: '4111 1111 1111 1111', mesVencimiento: '08', anioVencimiento: String(ANIO), cvv: '123' };

function crearFakes() {
  const f = { eventos: [] };
  f.metodosPago = {
    filas: new Map(),
    siguiente: 1,
    async listarPorCliente(idUsuario) { return [...this.filas.values()].filter((m) => m.idUsuario === idUsuario && m.activo); },
    async buscarDeCliente(id, idUsuario) {
      const m = this.filas.get(id);
      return m && m.idUsuario === idUsuario && m.activo ? m : null;
    },
    async crearMetodo(idUsuario, valores) {
      const id = this.siguiente++;
      this.filas.set(id, new MetodoPago({ idMetodoPago: id, idUsuario, ultimos4: valores.ultimos4, ...valores }));
      return id;
    },
    async actualizarMetodo(id, valores) { Object.assign(this.filas.get(id), valores); },
    async limpiarPrincipal(idUsuario) { for (const m of this.filas.values()) if (m.idUsuario === idUsuario) m.esPrincipal = false; },
    async marcarPrincipal(id) { this.filas.get(id).esPrincipal = true; },
    async desactivar(id) { const m = this.filas.get(id); m.activo = false; m.esPrincipal = false; },
  };
  f.bd = { async transaccion(trabajo) { return trabajo({}); } };
  f.bitacora = { async registrar(...a) { f.eventos.push(a); } };
  f.cifrado = new CifradoService('a'.repeat(64));
  f.servicio = new MetodoPagoService({ bd: f.bd, metodosPago: f.metodosPago, cifrado: f.cifrado, bitacora: f.bitacora });
  return f;
}

describe('MetodoPagoService.crear', () => {
  let f;
  beforeEach(() => { f = crearFakes(); });

  test('cifra el número, guarda los últimos 4 dígitos y nunca el CVV', async () => {
    const metodo = await f.servicio.crear(7, DATOS, USUARIO, '1.1.1.1');
    assert.equal(metodo.ultimos4, '1111');
    const fila = f.metodosPago.filas.get(1);
    assert.ok(Buffer.isBuffer(fila.numeroCifrado));
    assert.equal(f.cifrado.descifrar(fila.numeroCifrado), '4111111111111111');
    assert.ok(!('cvv' in fila));
    assert.equal(f.eventos[0][1], 'metodo_pago_crear');
  });

  test('el primer método se marca como principal aunque no se pida', async () => {
    const m = await f.servicio.crear(7, { ...DATOS, esPrincipal: false }, USUARIO);
    assert.equal(m.esPrincipal, true);
  });

  test('un nuevo método marcado como principal desplaza al anterior', async () => {
    await f.servicio.crear(7, DATOS, USUARIO);
    await f.servicio.crear(7, { ...DATOS, esPrincipal: true }, USUARIO);
    const lista = await f.metodosPago.listarPorCliente(7);
    assert.deepEqual(lista.map((m) => m.esPrincipal), [false, true]);
  });

  test('rechaza una tarjeta inválida o vencida', async () => {
    await assert.rejects(() => f.servicio.crear(7, { ...DATOS, numero: '4111111111111112' }, USUARIO), ValidacionError);
    await assert.rejects(() => f.servicio.crear(7, { ...DATOS, anioVencimiento: '2000' }, USUARIO), (e) => Boolean(e.campos.vencimiento));
  });
});

describe('MetodoPagoService: actualizar, eliminar y principal', () => {
  let f;
  beforeEach(async () => { f = crearFakes(); await f.servicio.crear(7, DATOS, USUARIO); });

  test('actualizar exige que el método sea del cliente y vuelve a cifrar el número', async () => {
    await f.servicio.actualizar(1, 7, { ...DATOS, numero: '5500 0000 0000 0004' }, USUARIO);
    const fila = f.metodosPago.filas.get(1);
    assert.equal(fila.ultimos4, '0004');
    await assert.rejects(() => f.servicio.actualizar(1, 99, DATOS, USUARIO), NoEncontradoError);
  });

  test('eliminar es una baja lógica', async () => {
    await f.servicio.eliminar(1, 7, USUARIO, '2.2.2.2');
    assert.equal(await f.metodosPago.buscarDeCliente(1, 7), null);
  });

  test('establecerPrincipal cambia cuál es el método principal', async () => {
    await f.servicio.crear(7, { ...DATOS, esPrincipal: false }, USUARIO);
    await f.servicio.establecerPrincipal(2, 7, USUARIO);
    assert.equal((await f.metodosPago.buscarDeCliente(1, 7)).esPrincipal, false);
    assert.equal((await f.metodosPago.buscarDeCliente(2, 7)).esPrincipal, true);
    await assert.rejects(() => f.servicio.establecerPrincipal(1, 99, USUARIO), NoEncontradoError);
  });
});
