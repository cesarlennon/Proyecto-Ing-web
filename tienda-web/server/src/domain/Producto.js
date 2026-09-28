'use strict';

const { ExistenciasInsuficientesError } = require('../errors/errores');

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Artículo a la venta. Controla sus existencias y decide qué datos se muestran a cada perfil. */
class Producto {
  constructor({
    idProducto,
    nombre,
    descripcion = null,
    precio,
    stock,
    diasEntrega = null,
    activo = true,
    fechaAlta = null,
    idCategoria,
    categoria = null,
    imagenes = [],
    calificacionPromedio = null,
    totalCalificaciones = 0,
  }) {
    this.idProducto = idProducto;
    this.nombre = nombre;
    this.descripcion = descripcion;
    this.precio = precio;
    this.stock = stock;
    this.diasEntrega = diasEntrega;
    this.activo = activo;
    this.fechaAlta = fechaAlta;
    this.idCategoria = idCategoria;
    this.categoria = categoria;
    this.imagenes = imagenes;
    this.calificacionPromedio = calificacionPromedio;
    this.totalCalificaciones = totalCalificaciones;
  }

  hayExistencias(cantidad) {
    return Number.isInteger(cantidad) && cantidad > 0 && this.stock >= cantidad;
  }

  descontarStock(cantidad) {
    if (!this.hayExistencias(cantidad)) throw new ExistenciasInsuficientesError();
    this.stock -= cantidad;
  }

  /** Fecha aproximada de entrega a partir de `desde` (por omisión, hoy). Null si no se definió. */
  fechaEntregaEstimada(desde = new Date()) {
    if (this.diasEntrega === null || this.diasEntrega === undefined) return null;
    return new Date(desde.getTime() + this.diasEntrega * MS_POR_DIA);
  }

  /** Vista para el cliente: nunca incluye el stock (RF-10). */
  paraCliente(desde = new Date()) {
    const entrega = this.fechaEntregaEstimada(desde);
    return {
      idProducto: this.idProducto,
      nombre: this.nombre,
      descripcion: this.descripcion,
      precio: this.precio,
      categoria: this.categoria ? { idCategoria: this.categoria.idCategoria, nombre: this.categoria.nombre } : null,
      diasEntrega: this.diasEntrega,
      entregaEstimada: entrega ? entrega.toISOString().slice(0, 10) : null,
      imagenes: this.imagenes.map((i) => i.paraJSON()),
      calificacion: { promedio: this.calificacionPromedio, total: this.totalCalificaciones },
    };
  }

  /** Vista para el personal autorizado: agrega stock, estado y datos de administración. */
  paraGestion(desde = new Date()) {
    return {
      ...this.paraCliente(desde),
      stock: this.stock,
      activo: this.activo,
      idCategoria: this.idCategoria,
      fechaAlta: this.fechaAlta,
    };
  }
}

module.exports = Producto;
