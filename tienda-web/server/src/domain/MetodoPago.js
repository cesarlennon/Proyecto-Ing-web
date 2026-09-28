'use strict';

/** Método de pago del cliente. El número se guarda cifrado; el CVV nunca se almacena (RNF-08). */
class MetodoPago {
  constructor({
    idMetodoPago,
    idUsuario,
    titular,
    ultimos4,
    mesVencimiento,
    anioVencimiento,
    esPrincipal = false,
    activo = true,
    numeroCifrado = null,
  }) {
    this.idMetodoPago = idMetodoPago;
    this.idUsuario = idUsuario;
    this.titular = titular;
    this.ultimos4 = ultimos4;
    this.mesVencimiento = mesVencimiento;
    this.anioVencimiento = anioVencimiento;
    this.esPrincipal = esPrincipal;
    this.activo = activo;
    this.numeroCifrado = numeroCifrado;
  }

  numeroEnmascarado() {
    return `•••• ${this.ultimos4}`;
  }

  /** Vigente si su fecha de vencimiento (fin del mes) no ha pasado. */
  estaVigente(hoy = new Date()) {
    const finDeMes = new Date(this.anioVencimiento, this.mesVencimiento, 0, 23, 59, 59);
    return finDeMes.getTime() >= hoy.getTime();
  }

  vencimientoTexto() {
    return `${String(this.mesVencimiento).padStart(2, '0')}/${String(this.anioVencimiento).slice(-2)}`;
  }

  paraJSON() {
    return {
      idMetodoPago: this.idMetodoPago,
      titular: this.titular,
      ultimos4: this.ultimos4,
      numeroEnmascarado: this.numeroEnmascarado(),
      mesVencimiento: this.mesVencimiento,
      anioVencimiento: this.anioVencimiento,
      vencimiento: this.vencimientoTexto(),
      esPrincipal: this.esPrincipal,
    };
  }
}

module.exports = MetodoPago;
