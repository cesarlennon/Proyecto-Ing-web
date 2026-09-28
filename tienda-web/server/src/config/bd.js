'use strict';

/** Ejecuta consultas dentro de una transacción. Tiene la misma interfaz que ConexionBD. */
class Contexto {
  constructor(conexion) {
    this.conexion = conexion;
  }

  async consultar(sql, parametros = []) {
    const [filas] = await this.conexion.execute(sql, normalizar(parametros));
    return filas;
  }
}

// mysql2 no acepta `undefined` como parámetro; se convierte en NULL.
function normalizar(parametros) {
  return parametros.map((p) => (p === undefined ? null : p));
}

/**
 * Administra el pool de conexiones de MySQL y las transacciones.
 * Todas las consultas usan parámetros (RNF-03): nunca se concatenan datos del usuario.
 */
class ConexionBD {
  constructor(pool) {
    this.pool = pool;
  }

  static crear(configuracion) {
    const mysql = require('mysql2/promise');
    return new ConexionBD(
      mysql.createPool({
        host: configuracion.host,
        port: configuracion.puerto,
        user: configuracion.usuario,
        password: configuracion.contrasena,
        database: configuracion.nombre,
        waitForConnections: true,
        connectionLimit: 10,
        charset: 'utf8mb4',
      }),
    );
  }

  async consultar(sql, parametros = []) {
    const [filas] = await this.pool.execute(sql, normalizar(parametros));
    return filas;
  }

  /**
   * Ejecuta `trabajo(cx)` dentro de una transacción: si termina sin error se confirma
   * y, si lanza un error, se revierte por completo (RNF-19).
   */
  async transaccion(trabajo) {
    const conexion = await this.pool.getConnection();
    try {
      await conexion.beginTransaction();
      const resultado = await trabajo(new Contexto(conexion));
      await conexion.commit();
      return resultado;
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  }

  async cerrar() {
    await this.pool.end();
  }
}

module.exports = { ConexionBD, Contexto };
