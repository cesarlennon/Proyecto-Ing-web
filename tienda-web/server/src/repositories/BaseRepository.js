'use strict';

const IDENTIFICADOR = /^[a-z_][a-z0-9_]*$/;

/**
 * Clase base de los repositorios. Ofrece las operaciones básicas y acepta una conexión
 * opcional (`cx`) para participar en una transacción.
 * Los nombres de columna se validan contra una lista permitida y los valores siempre
 * viajan como parámetros, de modo que no hay inyección SQL (RNF-03).
 */
class BaseRepository {
  constructor(bd, tabla, llave, columnas) {
    if (new.target === BaseRepository) {
      throw new TypeError('BaseRepository es una clase abstracta.');
    }
    for (const nombre of [tabla, llave, ...columnas]) {
      if (!IDENTIFICADOR.test(nombre)) throw new Error(`Identificador no válido: ${nombre}`);
    }
    this.bd = bd;
    this.tabla = tabla;
    this.llave = llave;
    this.columnas = columnas;
  }

  /** Devuelve el objeto contra el que se ejecuta la consulta: la transacción o el pool. */
  ejecutor(cx) {
    return cx ?? this.bd;
  }

  /** Convierte una fila de la base de datos en el objeto que usa el sistema. */
  mapear(fila) {
    return fila;
  }

  validarColumnas(datos, permitidas = this.columnas) {
    const columnas = Object.keys(datos);
    for (const columna of columnas) {
      if (!permitidas.includes(columna)) throw new Error(`Columna no permitida: ${columna}`);
    }
    return columnas;
  }

  async buscarPorId(id, cx) {
    const filas = await this.ejecutor(cx).consultar(
      `SELECT * FROM \`${this.tabla}\` WHERE \`${this.llave}\` = ?`,
      [id],
    );
    return filas.length > 0 ? this.mapear(filas[0]) : null;
  }

  async listar(filtros = {}, cx) {
    const columnas = this.validarColumnas(filtros);
    const donde = columnas.length > 0 ? ` WHERE ${columnas.map((c) => `\`${c}\` = ?`).join(' AND ')}` : '';
    const filas = await this.ejecutor(cx).consultar(
      `SELECT * FROM \`${this.tabla}\`${donde}`,
      columnas.map((c) => filtros[c]),
    );
    return filas.map((fila) => this.mapear(fila));
  }

  /** Inserta un registro y devuelve el identificador generado. */
  async crear(datos, cx) {
    const columnas = this.validarColumnas(datos, [...this.columnas, this.llave]);
    if (columnas.length === 0) throw new Error('No hay datos que guardar.');
    const resultado = await this.ejecutor(cx).consultar(
      `INSERT INTO \`${this.tabla}\` (${columnas.map((c) => `\`${c}\``).join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`,
      columnas.map((c) => datos[c]),
    );
    return resultado.insertId;
  }

  /** Actualiza un registro. Devuelve true si se modificó alguna fila. */
  async actualizar(id, datos, cx) {
    const columnas = this.validarColumnas(datos);
    if (columnas.length === 0) throw new Error('No hay datos que actualizar.');
    const resultado = await this.ejecutor(cx).consultar(
      `UPDATE \`${this.tabla}\` SET ${columnas.map((c) => `\`${c}\` = ?`).join(', ')} WHERE \`${this.llave}\` = ?`,
      [...columnas.map((c) => datos[c]), id],
    );
    return resultado.affectedRows > 0;
  }

  async eliminar(id, cx) {
    const resultado = await this.ejecutor(cx).consultar(
      `DELETE FROM \`${this.tabla}\` WHERE \`${this.llave}\` = ?`,
      [id],
    );
    return resultado.affectedRows > 0;
  }
}

module.exports = BaseRepository;
