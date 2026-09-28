'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const DireccionRepository = require('../../src/repositories/DireccionRepository');
const MetodoPagoRepository = require('../../src/repositories/MetodoPagoRepository');
const CarritoRepository = require('../../src/repositories/CarritoRepository');
const PedidoRepository = require('../../src/repositories/PedidoRepository');
const ProductoRepository = require('../../src/repositories/ProductoRepository');

function bdFalsa(filas = []) {
  return { llamadas: [], filas, async consultar(sql, parametros) { this.llamadas.push({ sql: sql.replace(/\s+/g, ' ').trim(), parametros }); return this.filas; } };
}

describe('DireccionRepository', () => {
  test('listarPorCliente solo trae las activas, con el país incluido', async () => {
    const bd = bdFalsa([{ id_direccion: 1, id_usuario: 7, calle: 'R', numero_exterior: '1', numero_interior: null, colonia: 'C', codigo_postal: '00000', municipio: 'M', ciudad: 'CD', id_pais: 1, pais_nombre: 'México', es_principal: 1, activo: 1 }]);
    const lista = await new DireccionRepository(bd).listarPorCliente(7);
    assert.match(bd.llamadas[0].sql, /WHERE d\.id_usuario = \? AND d\.activo = 1 ORDER BY d\.es_principal DESC/);
    assert.deepEqual(bd.llamadas[0].parametros, [7]);
    assert.equal(lista[0].pais.nombre, 'México');
    assert.equal(lista[0].esPrincipal, true);
  });

  test('buscarDeCliente exige que coincida el dueño y que esté activa', async () => {
    const bd = bdFalsa([]);
    const repo = new DireccionRepository(bd);
    assert.equal(await repo.buscarDeCliente(1, 7), null);
    assert.match(bd.llamadas[0].sql, /id_direccion = \? AND d\.id_usuario = \? AND d\.activo = 1/);
    assert.deepEqual(bd.llamadas[0].parametros, [1, 7]);
  });

  test('limpiarPrincipal, marcarPrincipal y desactivar afectan solo lo que deben', async () => {
    const bd = bdFalsa();
    const repo = new DireccionRepository(bd);
    await repo.limpiarPrincipal(7);
    assert.match(bd.llamadas[0].sql, /UPDATE direcciones SET es_principal = 0 WHERE id_usuario = \?/);
    await repo.marcarPrincipal(1);
    assert.match(bd.llamadas[1].sql, /UPDATE direcciones SET es_principal = 1 WHERE id_direccion = \?/);
    await repo.desactivar(1);
    assert.match(bd.llamadas[2].sql, /UPDATE direcciones SET activo = 0, es_principal = 0 WHERE id_direccion = \?/);
  });
});

describe('MetodoPagoRepository', () => {
  test('nunca selecciona ni expone el CVV (la tabla no tiene esa columna)', async () => {
    const bd = bdFalsa([{ id_metodo_pago: 1, id_usuario: 7, titular: 'Ana', numero_cifrado: Buffer.from('x'), ultimos4: '1111', mes_vencimiento: 8, anio_vencimiento: 2030, es_principal: 1, activo: 1 }]);
    const lista = await new MetodoPagoRepository(bd).listarPorCliente(7);
    assert.ok(!bd.llamadas[0].sql.toLowerCase().includes('cvv'));
    assert.equal(lista[0].ultimos4, '1111');
  });

  test('crearMetodo traduce los nombres de columna', async () => {
    const bd = bdFalsa();
    bd.consultar = async (sql, parametros) => { bd.llamadas.push({ sql, parametros }); return { insertId: 9 }; };
    const id = await new MetodoPagoRepository(bd).crearMetodo(7, {
      titular: 'Ana', numeroCifrado: Buffer.from('c'), ultimos4: '1111', mesVencimiento: 8, anioVencimiento: 2030, esPrincipal: true,
    });
    assert.equal(id, 9);
    assert.deepEqual(bd.llamadas[0].parametros, [7, 'Ana', Buffer.from('c'), '1111', 8, 2030, 1]);
  });
});

describe('CarritoRepository', () => {
  test('agregar usa ON DUPLICATE KEY para sumar la cantidad si ya existía', async () => {
    const bd = bdFalsa();
    await new CarritoRepository(bd).agregar(7, 1, 3);
    assert.match(bd.llamadas[0].sql, /ON DUPLICATE KEY UPDATE cantidad = cantidad \+ VALUES\(cantidad\)/);
    assert.deepEqual(bd.llamadas[0].parametros, [7, 1, 3]);
  });

  test('obtener arma los ItemCarrito con el precio y la categoría vigentes', async () => {
    const bd = bdFalsa([{ cantidad: 2, fecha_agregado: null, id_producto: 1, nombre: 'A', precio: '10.00', stock: 5, activo: 1, id_categoria: 3, categoria_nombre: 'Hogar', categoria_activa: 1 }]);
    const items = await new CarritoRepository(bd).obtener(7);
    assert.equal(items[0].producto.precio, 10);
    assert.equal(items[0].producto.categoria.nombre, 'Hogar');
    assert.equal(items[0].cantidad, 2);
  });

  test('actualizarCantidad y quitar informan si afectaron una fila', async () => {
    const bd = bdFalsa();
    bd.consultar = async (sql, parametros) => { bd.llamadas.push({ sql, parametros }); return { affectedRows: 0 }; };
    const repo = new CarritoRepository(bd);
    assert.equal(await repo.actualizarCantidad(7, 1, 2), false);
    assert.equal(await repo.quitar(7, 1), false);
  });

  test('vaciar borra todos los renglones del cliente', async () => {
    const bd = bdFalsa();
    await new CarritoRepository(bd).vaciar(7);
    assert.deepEqual(bd.llamadas[0], { sql: 'DELETE FROM carrito_items WHERE id_usuario = ?', parametros: [7] });
  });
});

describe('PedidoRepository', () => {
  test('existeCompraRecibida solo considera pedidos con estatus Recibido', async () => {
    const bd = bdFalsa([{ 1: 1 }]);
    const existe = await new PedidoRepository(bd).existeCompraRecibida(7, 1);
    assert.equal(existe, true);
    assert.match(bd.llamadas[0].sql, /p\.id_estatus = \?/);
    assert.deepEqual(bd.llamadas[0].parametros, [7, 1, 4]);
  });

  test('crearPedido inserta el pedido y cada renglón del detalle', async () => {
    const bd = bdFalsa();
    let llamada = 0;
    bd.consultar = async (sql, parametros) => {
      bd.llamadas.push({ sql: sql.replace(/\s+/g, ' ').trim(), parametros });
      llamada += 1;
      return llamada === 1 ? { insertId: 55 } : {};
    };
    const detalles = [{ producto: { idProducto: 1 }, cantidad: 2, precioUnitario: 10 }, { producto: { idProducto: 2 }, cantidad: 1, precioUnitario: 20 }];
    const id = await new PedidoRepository(bd).crearPedido({ idUsuario: 7, direccionEnvio: 'x', tarjetaUltimos4: '1111', total: 40, detalles });
    assert.equal(id, 55);
    assert.match(bd.llamadas[0].sql, /INSERT INTO pedidos/);
    assert.equal(bd.llamadas.length, 3);
    assert.deepEqual(bd.llamadas[1].parametros, [55, 1, 2, 10]);
  });

  test('actualizarEstatus registra la fecha correspondiente a cada estatus, y ninguna en «En proceso»', async () => {
    const bd = bdFalsa();
    const repo = new PedidoRepository(bd);
    await repo.actualizarEstatus(1, 'Pagada');
    assert.match(bd.llamadas[0].sql, /fecha_pago = CURRENT_TIMESTAMP/);
    await repo.actualizarEstatus(1, 'Enviado');
    assert.match(bd.llamadas[1].sql, /fecha_envio = CURRENT_TIMESTAMP/);
    await repo.actualizarEstatus(1, 'Recibido');
    assert.match(bd.llamadas[2].sql, /fecha_recepcion = CURRENT_TIMESTAMP/);
    await repo.actualizarEstatus(1, 'En proceso');
    assert.doesNotMatch(bd.llamadas[3].sql, /fecha_/);
  });

  test('buscarConDetalle devuelve null si no existe y, si existe, incluye sus renglones', async () => {
    const bd = bdFalsa([]);
    assert.equal(await new PedidoRepository(bd).buscarConDetalle(99), null);

    const bd2 = bdFalsa();
    let paso = 0;
    bd2.consultar = async (sql) => {
      paso += 1;
      if (paso === 1) return [{ id_pedido: 1, id_usuario: 7, direccion_envio: 'x', tarjeta_ultimos4: '1111', total: '40.00', id_estatus: 2, estatus_nombre: 'Pagada', fecha_pedido: null, fecha_pago: null, fecha_envio: null, fecha_recepcion: null }];
      return [{ id_detalle: 1, id_producto: 1, nombre_producto: 'A', cantidad: 2, precio_unitario: '10.00' }];
    };
    const pedido = await new PedidoRepository(bd2).buscarConDetalle(1);
    assert.equal(pedido.total, 40);
    assert.equal(pedido.detalles.length, 1);
  });
});

describe('ProductoRepository: bloqueo y descuento para la compra', () => {
  test('bloquearParaCompra usa FOR UPDATE y no consulta con una lista vacía', async () => {
    const bd = bdFalsa([]);
    const repo = new ProductoRepository(bd);
    assert.deepEqual(await repo.bloquearParaCompra([]), []);
    assert.equal(bd.llamadas.length, 0);
    await repo.bloquearParaCompra([1, 2]);
    assert.match(bd.llamadas[0].sql, /FOR UPDATE$/);
    assert.deepEqual(bd.llamadas[0].parametros, [1, 2]);
  });

  test('descontarStockEnBD resta directamente en SQL (evita condiciones de carrera)', async () => {
    const bd = bdFalsa();
    await new ProductoRepository(bd).descontarStockEnBD(1, 3);
    assert.match(bd.llamadas[0].sql, /SET stock = stock - \? WHERE id_producto = \?/);
    assert.deepEqual(bd.llamadas[0].parametros, [3, 1]);
  });
});
