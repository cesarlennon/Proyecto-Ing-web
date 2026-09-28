/*
 * Utilidades para construir la interfaz sin innerHTML: todo texto se inserta con textContent,
 * de modo que los datos capturados por los usuarios nunca se interpretan como HTML (RNF-04).
 */
const Dom = (() => {
  function el(etiqueta, opciones, hijos) {
    const o = opciones || {};
    const nodo = document.createElement(etiqueta);
    if (o.clase) nodo.className = o.clase;
    if (o.texto !== undefined && o.texto !== null) nodo.textContent = o.texto;
    if (o.atributos) {
      Object.keys(o.atributos).forEach((nombre) => nodo.setAttribute(nombre, o.atributos[nombre]));
    }
    if (o.alClic) nodo.addEventListener('click', o.alClic);
    [].concat(hijos || []).forEach((hijo) => {
      if (hijo === null || hijo === undefined || hijo === false) return;
      nodo.appendChild(typeof hijo === 'string' ? document.createTextNode(hijo) : hijo);
    });
    return nodo;
  }

  function vaciar(nodo) {
    while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
  }

  const formatoMoneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
  function moneda(numero) {
    return formatoMoneda.format(numero);
  }

  function estrellas(promedio) {
    const n = Math.max(0, Math.min(5, Math.round(Number(promedio) || 0)));
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function textoEntrega(dias) {
    if (!dias) return 'Entrega estimada: por confirmar';
    return dias === 1 ? 'Entrega estimada: 1 día' : 'Entrega estimada: ' + dias + ' días';
  }

  /** Muestra u oculta un mensaje en un elemento con role="alert". tipo: 'error' u 'ok'. */
  function aviso(contenedor, texto, tipo) {
    contenedor.textContent = texto || '';
    contenedor.className = 'mensaje mensaje-' + (tipo || 'error') + (texto ? '' : ' oculto');
  }

  /** Extrae el mensaje de error de una respuesta de Api.solicitar. */
  function mensajeDeError(respuesta, porDefecto) {
    const error = respuesta && respuesta.datos && respuesta.datos.error;
    return (error && error.mensaje) || porDefecto || 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  }

  /** Dibuja los botones de paginación y llama a alCambiar(pagina) al elegir uno. */
  function paginacion(contenedor, pagina, paginas, alCambiar) {
    vaciar(contenedor);
    if (paginas <= 1) return;
    const boton = (texto, destino, opciones) => {
      const o = opciones || {};
      const b = el('button', {
        texto,
        clase: o.actual ? 'actual' : '',
        atributos: Object.assign({ type: 'button' }, o.actual ? { 'aria-current': 'page' } : {}),
        alClic: () => alCambiar(destino),
      });
      b.disabled = Boolean(o.deshabilitado);
      return b;
    };
    contenedor.appendChild(boton('‹', pagina - 1, { deshabilitado: pagina <= 1 }));
    const desde = Math.max(1, pagina - 3);
    const hasta = Math.min(paginas, desde + 6);
    for (let i = desde; i <= hasta; i += 1) contenedor.appendChild(boton(String(i), i, { actual: i === pagina }));
    contenedor.appendChild(boton('›', pagina + 1, { deshabilitado: pagina >= paginas }));
  }

  return { el, vaciar, moneda, estrellas, textoEntrega, aviso, mensajeDeError, paginacion };
})();
