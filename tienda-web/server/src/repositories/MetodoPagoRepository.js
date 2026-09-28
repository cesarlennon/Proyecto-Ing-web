'use strict';

const BaseRepository = require('./BaseRepository');
const MetodoPago = require('../domain/MetodoPago');

class MetodoPagoRepository extends BaseRepository {
  constructor(bd) {
    super(bd, 'metodos_pago', 'id_metodo_pago', [
      'id_usuario', 'titular', 'numero_cifrado', 'ultimos4', 'mes_vencimiento',
      'anio_vencimiento', 'es_principal', 'activo',
    ]);
  }

  mapear(fila) {
    return new MetodoPago({
      idMetodoPago: fila.id_metodo_pago,
      idUsuario: fila.id_usuario,
      titular: fila.titular,
      ultimos4: fila.ultimos4,
      mesVencimiento: fila.mes_vencimiento,
      anioVencimiento: fila.anio_vencimiento,
      esPrincipal: Boolean(fila.es_principal),
      activo: Boolean(fila.activo),
      numeroCifrado: fila.numero_cifrado,
    });
  }

  async listarPorCliente(idUsuario, cx) {
    const filas = await this.ejecutor(cx).consultar(
      'SELECT * FROM metodos_pago WHERE id_usuario = ? AND activo = 1 ORDER BY es_principal DESC, id_metodo_pago',
      [idUsuario],
    );
    return filas.map((f) => this.mapear(f));
  }

  async buscarDeCliente(id, idUsuario, cx) {
    const filas = await this.ejecutor(cx).consultar(
      'SELECT * FROM metodos_pago WHERE id_metodo_pago = ? AND id_usuario = ? AND activo = 1',
      [id, idUsuario],
    );
    return filas.length > 0 ? this.mapear(filas[0]) : null;
  }

  async crearMetodo(idUsuario, valores, cx) {
    return this.crear(
      {
        id_usuario: idUsuario,
        titular: valores.titular,
        numero_cifrado: valores.numeroCifrado,
        ultimos4: valores.ultimos4,
        mes_vencimiento: valores.mesVencimiento,
        anio_vencimiento: valores.anioVencimiento,
        es_principal: valores.esPrincipal ? 1 : 0,
      },
      cx,
    );
  }

  async actualizarMetodo(id, valores, cx) {
    return this.actualizar(
      id,
      {
        titular: valores.titular,
        numero_cifrado: valores.numeroCifrado,
        ultimos4: valores.ultimos4,
        mes_vencimiento: valores.mesVencimiento,
        anio_vencimiento: valores.anioVencimiento,
      },
      cx,
    );
  }

  async limpiarPrincipal(idUsuario, cx) {
    await this.ejecutor(cx).consultar('UPDATE metodos_pago SET es_principal = 0 WHERE id_usuario = ?', [idUsuario]);
  }

  async marcarPrincipal(id, cx) {
    await this.ejecutor(cx).consultar('UPDATE metodos_pago SET es_principal = 1 WHERE id_metodo_pago = ?', [id]);
  }

  async desactivar(id, cx) {
    await this.ejecutor(cx).consultar('UPDATE metodos_pago SET activo = 0, es_principal = 0 WHERE id_metodo_pago = ?', [id]);
  }
}

module.exports = MetodoPagoRepository;
