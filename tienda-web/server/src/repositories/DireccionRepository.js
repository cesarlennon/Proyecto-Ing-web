'use strict';

const BaseRepository = require('./BaseRepository');
const Direccion = require('../domain/Direccion');
const Pais = require('../domain/Pais');

const SELECT_DETALLE = `
  SELECT d.*, p.nombre AS pais_nombre
  FROM direcciones d
  JOIN paises p ON p.id_pais = d.id_pais`;

class DireccionRepository extends BaseRepository {
  constructor(bd) {
    super(bd, 'direcciones', 'id_direccion', [
      'id_usuario', 'calle', 'numero_exterior', 'numero_interior', 'colonia',
      'codigo_postal', 'municipio', 'ciudad', 'id_pais', 'es_principal', 'activo',
    ]);
  }

  mapear(fila) {
    return new Direccion({
      idDireccion: fila.id_direccion,
      idUsuario: fila.id_usuario,
      calle: fila.calle,
      numeroExterior: fila.numero_exterior,
      numeroInterior: fila.numero_interior,
      colonia: fila.colonia,
      codigoPostal: fila.codigo_postal,
      municipio: fila.municipio,
      ciudad: fila.ciudad,
      idPais: fila.id_pais,
      pais: fila.pais_nombre !== undefined ? new Pais({ idPais: fila.id_pais, nombre: fila.pais_nombre }) : null,
      esPrincipal: Boolean(fila.es_principal),
      activo: Boolean(fila.activo),
    });
  }

  async listarPorCliente(idUsuario, cx) {
    const filas = await this.ejecutor(cx).consultar(
      `${SELECT_DETALLE} WHERE d.id_usuario = ? AND d.activo = 1 ORDER BY d.es_principal DESC, d.id_direccion`,
      [idUsuario],
    );
    return filas.map((f) => this.mapear(f));
  }

  /** Busca una dirección activa que pertenezca al cliente indicado (evita usar la de otro cliente). */
  async buscarDeCliente(id, idUsuario, cx) {
    const filas = await this.ejecutor(cx).consultar(
      `${SELECT_DETALLE} WHERE d.id_direccion = ? AND d.id_usuario = ? AND d.activo = 1`,
      [id, idUsuario],
    );
    return filas.length > 0 ? this.mapear(filas[0]) : null;
  }

  async crearDireccion(idUsuario, valores, cx) {
    return this.crear(
      {
        id_usuario: idUsuario,
        calle: valores.calle,
        numero_exterior: valores.numeroExterior,
        numero_interior: valores.numeroInterior,
        colonia: valores.colonia,
        codigo_postal: valores.codigoPostal,
        municipio: valores.municipio,
        ciudad: valores.ciudad,
        id_pais: valores.idPais,
        es_principal: valores.esPrincipal ? 1 : 0,
      },
      cx,
    );
  }

  async actualizarDireccion(id, valores, cx) {
    return this.actualizar(
      id,
      {
        calle: valores.calle,
        numero_exterior: valores.numeroExterior,
        numero_interior: valores.numeroInterior,
        colonia: valores.colonia,
        codigo_postal: valores.codigoPostal,
        municipio: valores.municipio,
        ciudad: valores.ciudad,
        id_pais: valores.idPais,
      },
      cx,
    );
  }

  /** Quita la marca de principal a todas las direcciones del cliente (paso previo a fijar una nueva). */
  async limpiarPrincipal(idUsuario, cx) {
    await this.ejecutor(cx).consultar('UPDATE direcciones SET es_principal = 0 WHERE id_usuario = ?', [idUsuario]);
  }

  async marcarPrincipal(id, cx) {
    await this.ejecutor(cx).consultar('UPDATE direcciones SET es_principal = 1 WHERE id_direccion = ?', [id]);
  }

  /** Baja lógica: no se borra para conservar la referencia en pedidos anteriores. */
  async desactivar(id, cx) {
    await this.ejecutor(cx).consultar('UPDATE direcciones SET activo = 0, es_principal = 0 WHERE id_direccion = ?', [id]);
  }
}

module.exports = DireccionRepository;
