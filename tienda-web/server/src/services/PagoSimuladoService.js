'use strict';

const { ReglaNegocioError } = require('../errors/errores');

/**
 * Simula la aprobación de un pago (CU-28): no se cobra nada real. El proyecto permite,
 * opcionalmente, integrar una pasarela real (PayPal, Mercado Pago, OpenPay, etc.) implementando
 * esta misma interfaz.
 */
class PagoSimuladoService {
  async procesarPago(metodoPago, monto) {
    if (!metodoPago) throw new ReglaNegocioError('Selecciona un método de pago.', 'METODO_PAGO_REQUERIDO');
    if (!(monto > 0)) throw new ReglaNegocioError('El monto a pagar no es válido.', 'MONTO_INVALIDO');
    // El pago simulado siempre se aprueba una vez que hay un método de pago y un monto válidos.
    return { aprobado: true, referencia: `SIM-${Date.now()}-${metodoPago.idMetodoPago}` };
  }
}

module.exports = PagoSimuladoService;
