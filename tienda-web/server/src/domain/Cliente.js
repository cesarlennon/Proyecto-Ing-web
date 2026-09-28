'use strict';

const Usuario = require('./Usuario');

class Cliente extends Usuario {
  constructor(datos) {
    super(datos);
    this.rfc = datos.rfc ?? null;
    this.curp = datos.curp ?? null;
  }

  permisos() {
    return [
      'productos:consultar',
      'carrito:gestionar',
      'cuenta:gestionar',
      'pedidos:comprar',
      'pedidos:propios',
      'productos:calificar',
    ];
  }
}

module.exports = Cliente;
