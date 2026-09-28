'use strict';

const BaseRepository = require('./BaseRepository');
const Producto = require('../domain/Producto');
const Categoria = require('../domain/Categoria');

const SELECT_DETALLE = `
  SELECT p.*, c.nombre AS categoria_nombre, c.activo AS categoria_activa,
         (SELECT ROUND(AVG(k.estrellas), 1) FROM calificaciones k WHERE k.id_producto = p.id_producto) AS calificacion_promedio,
         (SELECT COUNT(*) FROM calificaciones k WHERE k.id_producto = p.id_producto) AS total_calificaciones
  FROM productos p
  JOIN categorias c ON c.id_categoria = p.id_categoria`;

/** Convierte un valor a entero acotado. Se inserta en el SQL solo después de validarlo como entero. */
function entero(valor, minimo, maximo) {
  const n = Math.trunc(Number(valor));
  if (!Number.isFinite(n)) return minimo;
  return Math.min(Math.max(n, minimo), maximo);
}

/** Escapa los comodines de LIKE para que la búsqueda sea literal. */
function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, '\\$&');
}

class ProductoRepository extends BaseRepository {
  constructor(bd) {
    super(bd, 'productos', 'id_producto', ['nombre', 'descripcion', 'precio', 'stock', 'id_categoria', 'dias_entrega', 'activo']);
  }

  mapear(fila) {
    const tieneCategoria = fila.categoria_nombre !== undefined;
    return new Producto({
      idProducto: fila.id_producto,
      nombre: fila.nombre,
      descripcion: fila.descripcion,
      precio: Number(fila.precio),
      stock: fila.stock,
      diasEntrega: fila.dias_entrega,
      activo: Boolean(fila.activo),
      fechaAlta: fila.fecha_alta,
      idCategoria: fila.id_categoria,
      categoria: tieneCategoria
        ? new Categoria({ idCategoria: fila.id_categoria, nombre: fila.categoria_nombre, activo: Boolean(fila.categoria_activa) })
        : null,
      calificacionPromedio: fila.calificacion_promedio === null || fila.calificacion_promedio === undefined ? null : Number(fila.calificacion_promedio),
      totalCalificaciones: Number(fila.total_calificaciones ?? 0),
    });
  }

  /**
   * Busca productos con filtros y paginación. Con `soloVisibles` (vista del cliente) excluye los
   * productos inactivos y los de categorías inactivas.
   */
  async buscar({ categoria = null, q = '', soloVisibles = true, incluirInactivos = false, pagina = 1, porPagina = 12 } = {}, cx) {
    const condiciones = [];
    const parametros = [];

    if (soloVisibles) {
      condiciones.push('p.activo = 1', 'c.activo = 1');
    } else if (!incluirInactivos) {
      condiciones.push('p.activo = 1');
    }
    if (categoria) {
      condiciones.push('p.id_categoria = ?');
      parametros.push(categoria);
    }
    const texto = String(q ?? '').trim();
    if (texto) {
      if (/^\d{1,9}$/.test(texto)) {
        condiciones.push('(p.nombre LIKE ? OR p.id_producto = ?)');
        parametros.push(`%${escaparLike(texto)}%`, Number(texto));
      } else {
        condiciones.push('p.nombre LIKE ?');
        parametros.push(`%${escaparLike(texto)}%`);
      }
    }

    const donde = condiciones.length > 0 ? ` WHERE ${condiciones.join(' AND ')}` : '';
    const limite = entero(porPagina, 1, 50);
    const desplazamiento = (entero(pagina, 1, 1000000) - 1) * limite;
    const ejecutor = this.ejecutor(cx);

    // LIMIT y OFFSET se escriben en el SQL porque ya son enteros acotados; con sentencias preparadas
    // algunas versiones de MySQL 8 rechazan estos parámetros.
    const filas = await ejecutor.consultar(
      `${SELECT_DETALLE}${donde} ORDER BY p.nombre ASC, p.id_producto ASC LIMIT ${limite} OFFSET ${desplazamiento}`,
      parametros,
    );
    const conteo = await ejecutor.consultar(
      `SELECT COUNT(*) AS total FROM productos p JOIN categorias c ON c.id_categoria = p.id_categoria${donde}`,
      parametros,
    );
    return { productos: filas.map((f) => this.mapear(f)), total: Number(conteo[0].total) };
  }

  async buscarConDetalle(id, cx) {
    const filas = await this.ejecutor(cx).consultar(`${SELECT_DETALLE} WHERE p.id_producto = ?`, [id]);
    return filas.length > 0 ? this.mapear(filas[0]) : null;
  }

  /** Indica si el producto aparece en algún pedido (en ese caso no se puede borrar, solo inactivar). */
  async tienePedidos(id, cx) {
    const filas = await this.ejecutor(cx).consultar('SELECT 1 FROM pedido_detalle WHERE id_producto = ? LIMIT 1', [id]);
    return filas.length > 0;
  }

  async crearProducto(datos, cx) {
    return this.crear(
      {
        nombre: datos.nombre,
        descripcion: datos.descripcion ?? null,
        precio: datos.precio,
        stock: datos.stock,
        id_categoria: datos.idCategoria,
        dias_entrega: datos.diasEntrega,
        activo: datos.activo === false ? 0 : 1,
      },
      cx,
    );
  }

  async actualizarProducto(id, datos, cx) {
    const cambios = {
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      precio: datos.precio,
      stock: datos.stock,
      id_categoria: datos.idCategoria,
      dias_entrega: datos.diasEntrega,
    };
    if (typeof datos.activo === 'boolean') cambios.activo = datos.activo ? 1 : 0;
    return this.actualizar(id, cambios, cx);
  }

  /**
   * Bloquea (FOR UPDATE) las filas de los productos indicados dentro de una transacción, para
   * que dos compras simultáneas no descuenten el mismo stock dos veces (CU-26).
   */
  async bloquearParaCompra(ids, cx) {
    if (ids.length === 0) return [];
    const filas = await this.ejecutor(cx).consultar(
      `${SELECT_DETALLE} WHERE p.id_producto IN (${ids.map(() => '?').join(', ')}) FOR UPDATE`,
      ids,
    );
    return filas.map((f) => this.mapear(f));
  }

  /** Descuenta `cantidad` unidades directamente en la base de datos, dentro de la transacción de compra. */
  async descontarStockEnBD(idProducto, cantidad, cx) {
    await this.ejecutor(cx).consultar('UPDATE productos SET stock = stock - ? WHERE id_producto = ?', [cantidad, idProducto]);
  }
}

module.exports = ProductoRepository;
