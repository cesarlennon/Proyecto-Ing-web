/* Catálogo de productos del cliente (M-04): filtro por categoría (CU-15) y paginación (CU-14). */
(function () {
  let pagina = 1;
  let categoriaActual = '';
  const porPagina = 12;

  const mensaje = document.getElementById('mensaje');
  const grid = document.getElementById('grid');
  const sinResultados = document.getElementById('sin-resultados');
  const paginacion = document.getElementById('paginacion');
  const listaCategorias = document.getElementById('lista-categorias');

  function tarjeta(producto) {
    const enlace = '/pages/cliente/producto.html?id=' + producto.idProducto;
    const imagen = producto.imagenes[0]
      ? Dom.el('img', { atributos: { src: producto.imagenes[0].url, alt: producto.nombre } })
      : 'Sin imagen';
    const btnAgregar = Dom.el('button', {
      clase: 'boton boton-primario boton-pequeno', texto: 'Agregar', atributos: { type: 'button', style: 'margin-top:0.25rem;' },
      alClic: () => agregarAlCarrito(producto, btnAgregar),
    });
    return Dom.el('article', { clase: 'tarjeta-producto' }, [
      Dom.el('a', { clase: 'imagen', atributos: { href: enlace, 'aria-hidden': 'true', tabindex: '-1' } }, [imagen]),
      Dom.el('h3', {}, [Dom.el('a', { texto: producto.nombre, atributos: { href: enlace } })]),
      Dom.el('span', { clase: 'estrellas', texto: Dom.estrellas(producto.calificacion.promedio) }),
      Dom.el('span', { clase: 'precio', texto: Dom.moneda(producto.precio) }),
      Dom.el('span', { clase: 'entrega', texto: Dom.textoEntrega(producto.diasEntrega) }),
      btnAgregar,
    ]);
  }

  async function agregarAlCarrito(producto, boton) {
    boton.disabled = true;
    try {
      const respuesta = await Api.solicitar('POST', '/api/carrito', { idProducto: producto.idProducto, cantidad: 1 });
      if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo agregar el producto al carrito.')); return; }
      document.dispatchEvent(new CustomEvent('carrito:actualizado'));
      Dom.aviso(mensaje, 'Se agregó «' + producto.nombre + '» al carrito.', 'ok');
    } finally {
      boton.disabled = false;
    }
  }

  async function cargarCategorias() {
    const respuesta = await Api.solicitar('GET', '/api/categorias');
    Dom.vaciar(listaCategorias);
    const opcion = (texto, valor) => {
      const id = 'cat-' + (valor || 'todas');
      const radio = Dom.el('input', { atributos: { type: 'radio', name: 'categoria', id, value: valor } });
      radio.checked = valor === categoriaActual;
      radio.addEventListener('change', () => { categoriaActual = valor; pagina = 1; cargarProductos(); });
      return Dom.el('label', { atributos: { for: id } }, [radio, ' ' + texto]);
    };
    listaCategorias.appendChild(opcion('Todas', ''));
    if (respuesta.ok) respuesta.datos.elementos.forEach((c) => listaCategorias.appendChild(opcion(c.nombre, String(c.idCategoria))));
  }

  async function cargarProductos() {
    Dom.aviso(mensaje, '');
    const parametros = new URLSearchParams({ pagina: String(pagina), porPagina: String(porPagina) });
    if (categoriaActual) parametros.set('categoria', categoriaActual);

    const respuesta = await Api.solicitar('GET', '/api/productos?' + parametros.toString());
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo cargar el catálogo.')); return; }

    const { productos, paginas } = respuesta.datos;
    Dom.vaciar(grid);
    productos.forEach((p) => grid.appendChild(tarjeta(p)));
    sinResultados.classList.toggle('oculto', productos.length > 0);
    Dom.paginacion(paginacion, pagina, paginas, (destino) => { pagina = destino; cargarProductos(); window.scrollTo(0, 0); });
  }

  (async function iniciar() {
    const usuario = await Sesion.requerir(['cliente']);
    if (!usuario) return;
    await cargarCategorias();
    await cargarProductos();
  })();
})();
