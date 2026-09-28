/* Detalle de producto para el cliente (M-05): galería y datos de compra (CU-14). */
(function () {
  const idProducto = new URLSearchParams(window.location.search).get('id');
  const mensaje = document.getElementById('mensaje');
  const detalle = document.getElementById('detalle');
  const migas = document.getElementById('migas');
  const imagenPrincipal = document.getElementById('imagen-principal');
  const miniaturas = document.getElementById('miniaturas');

  function mostrarImagen(imagenes, indice) {
    Dom.vaciar(imagenPrincipal);
    if (imagenes.length === 0) {
      imagenPrincipal.textContent = 'Sin imagen';
      return;
    }
    imagenPrincipal.appendChild(Dom.el('img', { atributos: { src: imagenes[indice].url, alt: 'Imagen del producto' } }));
    Array.prototype.forEach.call(miniaturas.children, (boton, i) => boton.classList.toggle('activa', i === indice));
  }

  (async function iniciar() {
    const usuario = await Sesion.requerir(['cliente']);
    if (!usuario) return;
    if (!idProducto) { Dom.aviso(mensaje, 'Falta indicar el producto.'); return; }

    const respuesta = await Api.solicitar('GET', '/api/productos/' + idProducto);
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se encontró el producto.')); return; }

    const producto = respuesta.datos.producto;
    document.title = producto.nombre + ' | TiendaWeb';
    document.getElementById('nombre').textContent = producto.nombre;
    document.getElementById('categoria').textContent = producto.categoria ? producto.categoria.nombre : '';
    document.getElementById('estrellas').textContent = Dom.estrellas(producto.calificacion.promedio);
    document.getElementById('calificaciones').textContent =
      producto.calificacion.total > 0 ? producto.calificacion.promedio + ' (' + producto.calificacion.total + ' calificaciones)' : 'Sin calificaciones aún';
    document.getElementById('precio').textContent = Dom.moneda(producto.precio);
    document.getElementById('entrega').textContent = Dom.textoEntrega(producto.diasEntrega);
    document.getElementById('descripcion').textContent = producto.descripcion || '';
    migas.appendChild(document.createTextNode(' › ' + producto.nombre));

    Dom.vaciar(miniaturas);
    producto.imagenes.forEach((imagen, indice) => {
      const boton = Dom.el('button', { atributos: { type: 'button', 'aria-label': 'Ver imagen ' + (indice + 1) }, alClic: () => mostrarImagen(producto.imagenes, indice) }, [
        Dom.el('img', { atributos: { src: imagen.url, alt: '' } }),
      ]);
      miniaturas.appendChild(boton);
    });
    mostrarImagen(producto.imagenes, 0);
    detalle.classList.remove('oculto');

    const btnAgregar = document.getElementById('btn-agregar-carrito');
    const campoCantidad = document.getElementById('cantidad');
    const errorCantidad = document.getElementById('error-cantidad');
    btnAgregar.addEventListener('click', async () => {
      const cantidad = Number(campoCantidad.value.trim());
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        errorCantidad.textContent = 'La cantidad debe ser un número entero mayor que cero.';
        return;
      }
      errorCantidad.textContent = '';
      btnAgregar.disabled = true;
      try {
        const r = await Api.solicitar('POST', '/api/carrito', { idProducto: producto.idProducto, cantidad });
        if (!r.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(r, 'No se pudo agregar el producto al carrito.')); return; }
        document.dispatchEvent(new CustomEvent('carrito:actualizado'));
        Dom.aviso(mensaje, 'Se agregó al carrito.', 'ok');
      } finally {
        btnAgregar.disabled = false;
      }
    });

    await iniciarResenas(producto.idProducto);
  })();

  // ---------- Recomendaciones y calificación propia (CU-19, CU-20, CU-27) ----------
  async function iniciarResenas(idProducto) {
    const seccion = document.getElementById('seccion-resenas');
    const listaRecomendaciones = document.getElementById('lista-recomendaciones');
    const sinRecomendaciones = document.getElementById('sin-recomendaciones');
    const panelResena = document.getElementById('panel-resena');
    const noDisponible = document.getElementById('resena-no-disponible');
    const contenedorEstrellas = document.getElementById('estrellas-seleccion');
    const errorEstrellas = document.getElementById('error-estrellas');
    const campoTexto = document.getElementById('texto-recomendacion');
    const errorTexto = document.getElementById('error-texto');
    const btnPublicar = document.getElementById('btn-publicar');
    seccion.classList.remove('oculto');

    let estrellasElegidas = 0;

    function dibujarEstrellas() {
      Dom.vaciar(contenedorEstrellas);
      for (let i = 1; i <= 5; i += 1) {
        contenedorEstrellas.appendChild(Dom.el('span', {
          texto: i <= estrellasElegidas ? '★' : '☆',
          atributos: { role: 'radio', 'aria-checked': String(i === estrellasElegidas), tabindex: '0', 'aria-label': i + ' estrellas' },
          alClic: () => { estrellasElegidas = i; dibujarEstrellas(); guardarCalificacion(); },
        }));
      }
    }

    async function guardarCalificacion() {
      errorEstrellas.textContent = '';
      const respuesta = await Api.solicitar('PUT', '/api/productos/' + idProducto + '/calificacion', { estrellas: estrellasElegidas });
      if (!respuesta.ok) {
        errorEstrellas.textContent = Dom.mensajeDeError(respuesta, 'No se pudo guardar tu calificación.');
        return;
      }
      await cargarRecomendaciones();
    }

    async function publicarRecomendacion() {
      const mensajeValidacion = Validaciones.validarTextoRecomendacion(campoTexto.value);
      errorTexto.textContent = mensajeValidacion;
      if (mensajeValidacion) return;

      btnPublicar.disabled = true;
      try {
        const respuesta = await Api.solicitar('POST', '/api/productos/' + idProducto + '/recomendaciones', { texto: campoTexto.value });
        if (!respuesta.ok) {
          errorTexto.textContent = Dom.mensajeDeError(respuesta, 'No se pudo publicar tu recomendación.');
          return;
        }
        campoTexto.value = '';
        await cargarRecomendaciones();
      } finally {
        btnPublicar.disabled = false;
      }
    }
    btnPublicar.addEventListener('click', publicarRecomendacion);

    function filaRecomendacion(r) {
      return Dom.el('div', { atributos: { style: 'margin-bottom:0.9rem;' } }, [
        Dom.el('p', { atributos: { style: 'margin:0;' } }, [
          Dom.el('strong', { texto: r.autor }),
          document.createTextNode('  '),
        ]),
        Dom.el('p', { texto: r.texto, atributos: { style: 'margin:0.15rem 0 0;' } }),
      ]);
    }

    async function cargarRecomendaciones() {
      const respuesta = await Api.solicitar('GET', '/api/productos/' + idProducto + '/recomendaciones');
      if (!respuesta.ok) return;
      Dom.vaciar(listaRecomendaciones);
      respuesta.datos.recomendaciones.forEach((r) => listaRecomendaciones.appendChild(filaRecomendacion(r)));
      sinRecomendaciones.classList.toggle('oculto', respuesta.datos.recomendaciones.length > 0);
    }

    const miCalificacion = await Api.solicitar('GET', '/api/productos/' + idProducto + '/calificacion');
    if (miCalificacion.ok && miCalificacion.datos.puedeCalificar) {
      estrellasElegidas = miCalificacion.datos.calificacion ? miCalificacion.datos.calificacion.estrellas : 0;
      dibujarEstrellas();
      panelResena.classList.remove('oculto');
    } else {
      noDisponible.classList.remove('oculto');
    }
    await cargarRecomendaciones();
  }
})();
