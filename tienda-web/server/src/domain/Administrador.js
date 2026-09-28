'use strict';

const Usuario = require('./Usuario');

class Administrador extends Usuario {
  permisos() {
    return [
      'usuarios:gestionar',
      'catalogos:gestionar',
      'productos:consultar',
      'productos:gestionar',
      'productos:precio',
      'productos:stock',
      'productos:imagenes',
      'pedidos:estatus',
      'pedidos:ventas_dia',
      'reportes:ver',
    ];
  }
}

module.exports = Administrador;
