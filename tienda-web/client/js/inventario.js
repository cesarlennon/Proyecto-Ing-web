/* Inventario (M-16): buscar, editar precio y stock en línea, y administrar imágenes (CU-21 a CU-23). */
(function () {
  let pagina = 1;
  const porPagina = 10;

  const mensaje = document.getElementById('mensaje');
  const cuerpoTabla = document.getElementById('cuerpo-tabla');
  const sinResultados = document.getElementById('sin-resultados');
  const paginacion = document.getElementById('paginacion');
  const busqueda = document.getElementById('busqueda');

  function celdaEditable(valor, tipo) {
    const entrada = Dom.el('input', { atributos: { type: 'text', value: String(valor), 'aria-label': tipo } });
    entrada.dataset.tipo = tipo;
    entrada.dataset.original = String(valor);
    return entrada;
  }

  function fila(producto) {
    const tr = document.createElement('tr');
    const entradaPrecio = celdaEditable(producto.precio, 'precio');
    const entradaStock = celdaEditable(producto.stock, 'stock');

    tr.appendChild(Dom.el('td', { texto: String(producto.idProducto) }));
    tr.appendChild(Dom.el('td', { texto: producto.nombre }));
    tr.appendChild(Dom.el('td', {}, [entradaPrecio]));
    tr.appendChild(Dom.el('td', {}, [entradaStock]));
    tr.appendChild(Dom.el('td', { texto: String(producto.imagenes.length) }));

    const guardarPrecio = Dom.el('button', { clase: 'boton-enlace', texto: 'Guardar precio', atributos: { type: 'button' } });
    const guardarStock = Dom.el('button', { clase: 'boton-enlace', texto: 'Guardar stock', atributos: { type: 'button' } });
    const imagenes = Dom.el('a', { texto: 'Imágenes', atributos: { href: '/pages/inventarios/imagenes.html?id=' + producto.idProducto } });

    guardarPrecio.addEventListener('click', () => guardarCampo(producto, 'precio', entradaPrecio, guardarPrecio));
    guardarStock.addEventListener('click', () => guardarCampo(producto, 'stock', entradaStock, guardarStock));

    tr.appendChild(Dom.el('td', { clase: 'acciones-celda' }, [guardarPrecio, guardarStock, imagenes]));
    return tr;
  }

  async function guardarCampo(producto, tipo, entrada, boton) {
    const valor = entrada.value.trim();
    if (valor === entrada.dataset.original) return;
    const mensajeValidacion = tipo === 'precio' ? Validaciones.validarPrecio(valor) : Validaciones.validarStock(valor);
    if (mensajeValidacion) { Dom.aviso(mensaje, mensajeValidacion); return; }

    const etiqueta = tipo === 'precio' ? 'el precio' : 'el stock';
    const acepta = await Modal.confirmar({
      titulo: '¿Actualizar ' + etiqueta + '?',
      mensaje: 'Se actualizará ' + etiqueta + ' de «' + producto.nombre + '» a ' + valor + '.',
      textoConfirmar: 'Guardar',
    });
    if (!acepta) return;

    boton.disabled = true;
    try {
      const respuesta = await Api.solicitar('PATCH', '/api/productos/' + producto.idProducto + '/' + tipo, {
        [tipo]: tipo === 'precio' ? valor : Number(valor),
        confirmado: true,
      });
      if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo guardar el cambio.')); return; }
      entrada.dataset.original = valor;
      Dom.aviso(mensaje, 'Cambio guardado.', 'ok');
    } finally {
      boton.disabled = false;
    }
  }

  async function cargar() {
    Dom.aviso(mensaje, '');
    const parametros = new URLSearchParams({ pagina: String(pagina), porPagina: String(porPagina) });
    if (busqueda.value.trim()) parametros.set('q', busqueda.value.trim());
    const respuesta = await Api.solicitar('GET', '/api/productos?' + parametros.toString());
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudieron cargar los productos.')); return; }

    const { productos, paginas } = respuesta.datos;
    Dom.vaciar(cuerpoTabla);
    productos.forEach((p) => cuerpoTabla.appendChild(fila(p)));
    sinResultados.classList.toggle('oculto', productos.length > 0);
    Dom.paginacion(paginacion, pagina, paginas, (destino) => { pagina = destino; cargar(); });
  }

  document.getElementById('form-filtros').addEventListener('submit', (evento) => {
    evento.preventDefault();
    pagina = 1;
    cargar();
  });

  (async function iniciar() {
    const usuario = await Sesion.requerir(['inventarios', 'administrador']);
    if (!usuario) return;
    await cargar();
  })();
})();
