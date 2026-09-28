'use strict';

/** Clase abstracta de la que derivan todos los errores controlados de la aplicación. */
class ErrorAplicacion extends Error {
  constructor(mensaje, { estado = 500, codigo = 'ERROR_APLICACION' } = {}) {
    if (new.target === ErrorAplicacion) {
      throw new TypeError('ErrorAplicacion es una clase abstracta.');
    }
    super(mensaje);
    this.name = new.target.name;
    this.estado = estado;
    this.codigo = codigo;
  }
}

/** Se incumple una regla de negocio (400). */
class ReglaNegocioError extends ErrorAplicacion {
  constructor(mensaje, codigo = 'REGLA_NEGOCIO') {
    super(mensaje, { estado: 400, codigo });
  }
}

/** Los datos enviados no son válidos; `campos` indica el mensaje de cada campo. */
class ValidacionError extends ReglaNegocioError {
  constructor(campos, mensaje = 'Hay datos que no son válidos. Revisa el formulario.') {
    super(mensaje, 'VALIDACION');
    this.campos = campos;
  }
}

/** No hay existencias suficientes para surtir el pedido. */
class ExistenciasInsuficientesError extends ReglaNegocioError {
  constructor(mensaje = 'No se cuenta con las unidades necesarias para cumplir el pedido.') {
    super(mensaje, 'SIN_EXISTENCIAS');
  }
}

/** El usuario no ha iniciado sesión (401). */
class NoAutenticadoError extends ErrorAplicacion {
  constructor(mensaje = 'Inicia sesión para continuar.') {
    super(mensaje, { estado: 401, codigo: 'NO_AUTENTICADO' });
  }
}

/** El usuario no tiene permiso para la operación (403). */
class NoAutorizadoError extends ErrorAplicacion {
  constructor(mensaje = 'No tienes permiso para realizar esta operación.', codigo = 'NO_AUTORIZADO') {
    super(mensaje, { estado: 403, codigo });
  }
}

/** El recurso solicitado no existe (404). */
class NoEncontradoError extends ErrorAplicacion {
  constructor(mensaje = 'No se encontró lo que buscas.') {
    super(mensaje, { estado: 404, codigo: 'NO_ENCONTRADO' });
  }
}

/** Se superó el límite de peticiones (429). */
class LimiteExcedidoError extends ErrorAplicacion {
  constructor(mensaje = 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.') {
    super(mensaje, { estado: 429, codigo: 'LIMITE_EXCEDIDO' });
  }
}

module.exports = {
  ErrorAplicacion,
  ReglaNegocioError,
  ValidacionError,
  ExistenciasInsuficientesError,
  NoAutenticadoError,
  NoAutorizadoError,
  NoEncontradoError,
  LimiteExcedidoError,
};
