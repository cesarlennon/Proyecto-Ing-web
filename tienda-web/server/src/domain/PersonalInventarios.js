'use strict';

const Usuario = require('./Usuario');

class PersonalInventarios extends Usuario {
  permisos() {
    return [
      'productos:consultar',
      'productos:precio',
      'productos:stock',
      'productos:imagenes',
      'pedidos:estatus',
      'pedidos:ventas_dia',
    ];
  }
}

module.exports = PersonalInventarios;
