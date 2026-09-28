/*
 * Reglas de validación compartidas.
 * El navegador las usa para validar los formularios con JavaScript (RF-06) y el servidor
 * vuelve a aplicarlas antes de guardar, porque nunca se debe confiar solo en el cliente.
 * Cada función devuelve un mensaje de error o una cadena vacía si el valor es válido.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrica();
  } else {
    raiz.Validaciones = fabrica();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const RE_NOMBRE = /^\p{L}[\p{L} .'-]*$/u;
  const RE_RFC = /^[A-ZÑ&]{3,4}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{3}$/;
  const RE_CURP =
    /^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HMX](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$/;

  /** Quita espacios de los extremos y colapsa los espacios repetidos. */
  function limpiar(valor) {
    return String(valor === undefined || valor === null ? '' : valor).trim().replace(/\s+/g, ' ');
  }

  function validarCorreo(valor) {
    const v = limpiar(valor);
    if (!v) return 'El correo es obligatorio.';
    if (v.length > 150 || !RE_CORREO.test(v)) return 'El correo no tiene un formato válido.';
    return '';
  }

  function validarNombre(valor, { etiqueta = 'El nombre', obligatorio = true, max = 80 } = {}) {
    const v = limpiar(valor);
    if (!v) return obligatorio ? `${etiqueta} es obligatorio.` : '';
    if (v.length > max) return `${etiqueta} no puede tener más de ${max} caracteres.`;
    if (!RE_NOMBRE.test(v)) return `${etiqueta} solo puede contener letras, espacios, punto, apóstrofo y guion.`;
    return '';
  }

  function validarRFC(valor) {
    const v = limpiar(valor).toUpperCase();
    if (!v) return 'El RFC es obligatorio.';
    if (!RE_RFC.test(v)) return 'El RFC no tiene un formato válido.';
    return '';
  }

  function validarCURP(valor) {
    const v = limpiar(valor).toUpperCase();
    if (!v) return 'La CURP es obligatoria.';
    if (!RE_CURP.test(v)) return 'La CURP no tiene un formato válido.';
    return '';
  }

  /**
   * Valida el formulario de registro de cliente (CU-11).
   * Devuelve { errores, valores }: los mensajes por campo y los datos ya normalizados.
   */
  function validarRegistroCliente(datos) {
    const d = datos || {};
    const errores = {};
    const asignar = (campo, mensaje) => {
      if (mensaje) errores[campo] = mensaje;
    };

    asignar('nombres', validarNombre(d.nombres, { etiqueta: 'El nombre' }));
    asignar('apellidoPaterno', validarNombre(d.apellidoPaterno, { etiqueta: 'El apellido paterno', max: 50 }));
    asignar(
      'apellidoMaterno',
      validarNombre(d.apellidoMaterno, { etiqueta: 'El apellido materno', obligatorio: false, max: 50 }),
    );
    asignar('rfc', validarRFC(d.rfc));
    asignar('curp', validarCURP(d.curp));
    if (d.aceptaAviso !== true) errores.aceptaAviso = 'Debes aceptar el aviso de privacidad.';

    const valores = {
      nombres: limpiar(d.nombres),
      apellidoPaterno: limpiar(d.apellidoPaterno),
      apellidoMaterno: limpiar(d.apellidoMaterno) || null,
      rfc: limpiar(d.rfc).toUpperCase(),
      curp: limpiar(d.curp).toUpperCase(),
    };
    return { errores, valores };
  }


  // ---------------------------------------------------------------
  // Catálogos y productos
  // ---------------------------------------------------------------
  const RE_NOMBRE_CATALOGO = /^[\p{L}\p{N}][\p{L}\p{N} .,&'()\/-]*$/u;
  const RE_CONTROL = /[\u0000-\u001f\u007f]/;
  const RE_CONTROL_TEXTO_LARGO = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

  /** Nombre de un elemento de catálogo (categoría, país). */
  function validarNombreCatalogo(valor, { etiqueta = 'El nombre', max = 60 } = {}) {
    const v = limpiar(valor);
    if (!v) return `${etiqueta} es obligatorio.`;
    if (v.length > max) return `${etiqueta} no puede tener más de ${max} caracteres.`;
    if (!RE_NOMBRE_CATALOGO.test(v)) return `${etiqueta} contiene caracteres no permitidos.`;
    return '';
  }

  /**
   * Valida los datos de un elemento de catálogo. Con `parcial` solo se revisan los campos presentes
   * (para actualizar). Devuelve { errores, valores }.
   */
  function validarCatalogo(datos, { etiqueta = 'El nombre', max = 60, parcial = false } = {}) {
    const d = datos || {};
    const errores = {};
    const valores = {};

    if (!parcial || d.nombre !== undefined) {
      const mensaje = validarNombreCatalogo(d.nombre, { etiqueta, max });
      if (mensaje) errores.nombre = mensaje;
      valores.nombre = limpiar(d.nombre);
    }
    if (d.activo !== undefined) {
      if (typeof d.activo !== 'boolean') errores.activo = 'El estado no es válido.';
      else valores.activo = d.activo;
    }
    return { errores, valores };
  }

  function validarNombreProducto(valor) {
    const v = limpiar(valor);
    if (!v) return 'El nombre es obligatorio.';
    if (v.length > 120) return 'El nombre no puede tener más de 120 caracteres.';
    if (RE_CONTROL.test(v)) return 'El nombre contiene caracteres no permitidos.';
    return '';
  }

  function validarDescripcion(valor) {
    const v = String(valor === undefined || valor === null ? '' : valor).trim();
    if (v.length > 2000) return 'La descripción no puede tener más de 2000 caracteres.';
    if (RE_CONTROL_TEXTO_LARGO.test(v)) return 'La descripción contiene caracteres no permitidos.';
    return '';
  }

  function validarPrecio(valor) {
    const v = limpiar(valor);
    if (!v) return 'El precio es obligatorio.';
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(v) || Number(v) <= 0) {
      return 'El precio debe ser mayor que cero y tener máximo dos decimales.';
    }
    return '';
  }

  function validarStock(valor) {
    const v = limpiar(valor);
    if (!v) return 'El stock es obligatorio.';
    if (!/^\d{1,7}$/.test(v)) return 'El stock debe ser un número entero mayor o igual a cero.';
    return '';
  }

  function validarDiasEntrega(valor) {
    const v = limpiar(valor);
    if (!v) return 'Los días de entrega son obligatorios.';
    if (!/^\d{1,3}$/.test(v) || Number(v) < 1 || Number(v) > 365) {
      return 'Los días de entrega deben ser un número entero entre 1 y 365.';
    }
    return '';
  }

  function validarIdCategoria(valor) {
    const v = limpiar(valor);
    if (!/^\d{1,9}$/.test(v) || Number(v) < 1) return 'Selecciona una categoría.';
    return '';
  }

  /** Valida el formulario de producto (CU-06, CU-09). Devuelve { errores, valores } ya normalizados. */
  function validarProducto(datos) {
    const d = datos || {};
    const errores = {};
    const asignar = (campo, mensaje) => {
      if (mensaje) errores[campo] = mensaje;
    };

    asignar('nombre', validarNombreProducto(d.nombre));
    asignar('descripcion', validarDescripcion(d.descripcion));
    asignar('precio', validarPrecio(d.precio));
    asignar('stock', validarStock(d.stock));
    asignar('idCategoria', validarIdCategoria(d.idCategoria));
    asignar('diasEntrega', validarDiasEntrega(d.diasEntrega));

    const descripcion = String(d.descripcion === undefined || d.descripcion === null ? '' : d.descripcion).trim();
    const valores = {
      nombre: limpiar(d.nombre),
      descripcion: descripcion || null,
      precio: Number(limpiar(d.precio)),
      stock: Number(limpiar(d.stock)),
      idCategoria: Number(limpiar(d.idCategoria)),
      diasEntrega: Number(limpiar(d.diasEntrega)),
    };
    return { errores, valores };
  }


  // ---------------------------------------------------------------
  // Direcciones y métodos de pago del cliente
  // ---------------------------------------------------------------
  const RE_TEXTO_DIRECCION = /^[\p{L}\p{N}][\p{L}\p{N} .,#'-]*$/u;
  const RE_CP = /^\d{5}$/;

  function validarTexto(valor, { etiqueta, max, obligatorio = true } = {}) {
    const v = limpiar(valor);
    if (!v) return obligatorio ? `${etiqueta} es obligatorio.` : '';
    if (v.length > max) return `${etiqueta} no puede tener más de ${max} caracteres.`;
    if (!RE_TEXTO_DIRECCION.test(v)) return `${etiqueta} contiene caracteres no permitidos.`;
    return '';
  }

  function validarCodigoPostal(valor) {
    const v = limpiar(valor);
    if (!v) return 'El código postal es obligatorio.';
    if (!RE_CP.test(v)) return 'El código postal debe tener 5 dígitos.';
    return '';
  }

  function validarIdPais(valor) {
    const v = limpiar(valor);
    if (!/^\d{1,9}$/.test(v) || Number(v) < 1) return 'Selecciona un país.';
    return '';
  }

  /** Valida el formulario de dirección (CU-12). Devuelve { errores, valores } normalizados. */
  function validarDireccion(datos) {
    const d = datos || {};
    const errores = {};
    const asignar = (campo, mensaje) => { if (mensaje) errores[campo] = mensaje; };

    asignar('calle', validarTexto(d.calle, { etiqueta: 'La calle', max: 100 }));
    asignar('numeroExterior', validarTexto(d.numeroExterior, { etiqueta: 'El número exterior', max: 10 }));
    asignar('numeroInterior', validarTexto(d.numeroInterior, { etiqueta: 'El número interior', max: 10, obligatorio: false }));
    asignar('colonia', validarTexto(d.colonia, { etiqueta: 'La colonia', max: 80 }));
    asignar('codigoPostal', validarCodigoPostal(d.codigoPostal));
    asignar('municipio', validarTexto(d.municipio, { etiqueta: 'El municipio', max: 80 }));
    asignar('ciudad', validarTexto(d.ciudad, { etiqueta: 'La ciudad', max: 80 }));
    asignar('idPais', validarIdPais(d.idPais));

    const valores = {
      calle: limpiar(d.calle),
      numeroExterior: limpiar(d.numeroExterior),
      numeroInterior: limpiar(d.numeroInterior) || null,
      colonia: limpiar(d.colonia),
      codigoPostal: limpiar(d.codigoPostal),
      municipio: limpiar(d.municipio),
      ciudad: limpiar(d.ciudad),
      idPais: Number(limpiar(d.idPais)) || null,
      esPrincipal: d.esPrincipal === true,
    };
    return { errores, valores };
  }

  /** Suma de verificación de Luhn, usada para detectar errores de captura en el número de tarjeta. */
  function pasaLuhn(numero) {
    let suma = 0;
    let doblar = false;
    for (let i = numero.length - 1; i >= 0; i -= 1) {
      let digito = Number(numero[i]);
      if (doblar) {
        digito *= 2;
        if (digito > 9) digito -= 9;
      }
      suma += digito;
      doblar = !doblar;
    }
    return suma % 10 === 0;
  }

  function validarNumeroTarjeta(valor) {
    const v = limpiar(valor).replace(/[ -]/g, '');
    if (!v) return 'El número de tarjeta es obligatorio.';
    if (!/^\d{13,19}$/.test(v)) return 'El número de tarjeta no es válido.';
    if (!pasaLuhn(v)) return 'El número de tarjeta no es válido.';
    return '';
  }

  function validarVencimiento(mes, anio, { hoy = new Date() } = {}) {
    const m = Number(limpiar(mes));
    const a = Number(limpiar(anio));
    if (!m || !a || m < 1 || m > 12 || String(limpiar(anio)).length !== 4) {
      return 'Indica el mes y el año de vencimiento (MM/AAAA).';
    }
    const finDeMes = new Date(a, m, 0, 23, 59, 59);
    if (finDeMes.getTime() < hoy.getTime()) return 'La tarjeta está vencida.';
    return '';
  }

  function validarCVV(valor) {
    const v = limpiar(valor);
    if (!v) return 'El CVV es obligatorio.';
    if (!/^\d{3,4}$/.test(v)) return 'El CVV debe tener 3 o 4 dígitos.';
    return '';
  }

  /**
   * Valida el formulario de método de pago (CU-13). El CVV se valida pero nunca se incluye
   * en `valores`: solo se usa para confirmar la captura y no se envía al servidor.
   */
  function validarMetodoPago(datos) {
    const d = datos || {};
    const errores = {};
    const asignar = (campo, mensaje) => { if (mensaje) errores[campo] = mensaje; };

    asignar('titular', validarNombre(d.titular, { etiqueta: 'El nombre del titular', max: 100 }));
    asignar('numero', validarNumeroTarjeta(d.numero));
    asignar('vencimiento', validarVencimiento(d.mesVencimiento, d.anioVencimiento));
    asignar('cvv', validarCVV(d.cvv));

    const valores = {
      titular: limpiar(d.titular),
      numero: limpiar(d.numero).replace(/[ -]/g, ''),
      mesVencimiento: Number(limpiar(d.mesVencimiento)) || null,
      anioVencimiento: Number(limpiar(d.anioVencimiento)) || null,
      esPrincipal: d.esPrincipal === true,
    };
    return { errores, valores };
  }


  // ---------------------------------------------------------------
  // Usuarios (administración)
  // ---------------------------------------------------------------
  const ROLES_ADMINISTRABLES = ['administrador', 'inventarios'];

  function validarRolUsuario(valor) {
    const v = limpiar(valor);
    if (!v) return 'Selecciona un perfil.';
    if (ROLES_ADMINISTRABLES.indexOf(v) === -1) return 'El perfil seleccionado no es válido.';
    return '';
  }

  /** Valida el alta de un usuario administrador o de inventarios (CU-05). El cliente se autoregistra. */
  function validarUsuarioNuevo(datos) {
    const d = datos || {};
    const errores = {};
    const asignar = (campo, mensaje) => { if (mensaje) errores[campo] = mensaje; };

    asignar('correo', validarCorreo(d.correo));
    asignar('rol', validarRolUsuario(d.rol));
    asignar('nombres', validarNombre(d.nombres, { etiqueta: 'El nombre' }));
    asignar('apellidoPaterno', validarNombre(d.apellidoPaterno, { etiqueta: 'El apellido paterno', max: 50 }));
    asignar('apellidoMaterno', validarNombre(d.apellidoMaterno, { etiqueta: 'El apellido materno', obligatorio: false, max: 50 }));

    const valores = {
      correo: limpiar(d.correo).toLowerCase(),
      rol: limpiar(d.rol),
      nombres: limpiar(d.nombres),
      apellidoPaterno: limpiar(d.apellidoPaterno),
      apellidoMaterno: limpiar(d.apellidoMaterno) || null,
    };
    return { errores, valores };
  }

  /** Valida la edición de nombre y apellidos de un usuario ya existente. El correo y el perfil no cambian. */
  function validarUsuarioEdicion(datos) {
    const d = datos || {};
    const errores = {};
    const asignar = (campo, mensaje) => { if (mensaje) errores[campo] = mensaje; };

    asignar('nombres', validarNombre(d.nombres, { etiqueta: 'El nombre' }));
    asignar('apellidoPaterno', validarNombre(d.apellidoPaterno, { etiqueta: 'El apellido paterno', max: 50 }));
    asignar('apellidoMaterno', validarNombre(d.apellidoMaterno, { etiqueta: 'El apellido materno', obligatorio: false, max: 50 }));

    const valores = {
      nombres: limpiar(d.nombres),
      apellidoPaterno: limpiar(d.apellidoPaterno),
      apellidoMaterno: limpiar(d.apellidoMaterno) || null,
    };
    return { errores, valores };
  }


  // ---------------------------------------------------------------
  // Calificaciones y recomendaciones de producto
  // ---------------------------------------------------------------
  function validarEstrellas(valor) {
    const v = limpiar(valor);
    if (!v && v !== '0') return 'Selecciona una calificación de 0 a 5 estrellas.';
    if (!/^[0-5]$/.test(v)) return 'La calificación debe ser un número entero de 0 a 5.';
    return '';
  }

  function validarTextoRecomendacion(valor) {
    const v = limpiar(valor);
    if (!v) return 'Escribe tu recomendación.';
    if (v.length > 500) return 'La recomendación no puede tener más de 500 caracteres.';
    if (RE_CONTROL_TEXTO_LARGO.test(v)) return 'La recomendación contiene caracteres no permitidos.';
    return '';
  }

  return {
    limpiar,
    validarCorreo,
    validarNombre,
    validarRFC,
    validarCURP,
    validarRegistroCliente,
    validarNombreCatalogo,
    validarCatalogo,
    validarNombreProducto,
    validarDescripcion,
    validarPrecio,
    validarStock,
    validarDiasEntrega,
    validarIdCategoria,
    validarProducto,
    validarCodigoPostal,
    validarDireccion,
    validarNumeroTarjeta,
    validarVencimiento,
    validarCVV,
    validarMetodoPago,
    validarRolUsuario,
    validarUsuarioNuevo,
    validarUsuarioEdicion,
    validarEstrellas,
    validarTextoRecomendacion,
  };
});
