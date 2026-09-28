/* Listado de productos del administrador (M-11): búsqueda, filtro por categoría y acciones. */
(function () {
  let usuario = null;
  let pagina = 1;
  const porPagina = 10;

  const mensaje = document.getElementById('mensaje');
  const cuerpoTabla = document.getElementById('cuerpo-tabla');
  const sinResultados = document.getElementById('sin-resultados');
  const paginacion = document.getElementById('paginacion');
  const busqueda = document.getElementById('busqueda');
  const filtroCategoria = document.getElementById('filtro-categoria');
  const verInactivos = document.getElementById('ver-inactivos');

  function celdaAcciones(producto) {
    const editar = Dom.el('a', { texto: 'Editar', atributos: { href: '/pages/admin/producto-form.html?id=' + producto.idProducto } });
    const eliminar = Dom.el('button', {
      clase: 'boton-enlace peligro',
      texto: 'Eliminar',
      atributos: { type: 'button' },
      alClic: () => eliminarProducto(producto),
    });
    return Dom.el('td', { clase: 'acciones-celda' }, [editar, eliminar]);
  }

  function fila(producto) {
    const tr = document.createElement('tr');
    tr.appendChild(Dom.el('td', { texto: String(producto.idProducto) }));
    tr.appendChild(Dom.el('td', { texto: producto.nombre }));
    tr.appendChild(Dom.el('td', { texto: producto.categoria ? producto.categoria.nombre : '—' }));
    tr.appendChild(Dom.el('td', { texto: Dom.moneda(producto.precio) }));
    tr.appendChild(Dom.el('td', { texto: String(producto.stock) }));
    tr.appendChild(Dom.el('td', { texto: producto.diasEntrega ? producto.diasEntrega + ' día(s)' : '—' }));
    tr.appendChild(Dom.el('td', {}, [TablaProductos.insignia(producto.activo)]));
    tr.appendChild(celdaAcciones(producto));
    return tr;
  }

  async function eliminarProducto(producto) {
    const acepta = await Modal.confirmar({
      titulo: '¿Eliminar producto?',
      mensaje: 'Se eliminará «' + producto.nombre + '». Si el producto tiene ventas, se marcará como inactivo en lugar de borrarse.',
      textoConfirmar: 'Eliminar',
      peligro: true,
    });
    if (!acepta) return;
    const respuesta = await Api.solicitar('DELETE', '/api/productos/' + producto.idProducto + '?confirmado=true');
    if (!respuesta.ok) {
      Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo eliminar el producto.'));
      return;
    }
    Dom.aviso(mensaje, respuesta.datos.inactivado ? 'El producto tenía ventas: se marcó como inactivo.' : 'Producto eliminado.', 'ok');
    await cargar();
  }

  async function cargar() {
    Dom.aviso(mensaje, '');
    const parametros = new URLSearchParams({ pagina: String(pagina), porPagina: String(porPagina) });
    if (busqueda.value.trim()) parametros.set('q', busqueda.value.trim());
    if (filtroCategoria.value) parametros.set('categoria', filtroCategoria.value);
    if (verInactivos.checked) parametros.set('incluirInactivos', 'true');

    const respuesta = await Api.solicitar('GET', '/api/productos?' + parametros.toString());
    if (!respuesta.ok) {
      Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudieron cargar los productos.'));
      return;
    }
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
  verInactivos.addEventListener('change', () => { pagina = 1; cargar(); });
  filtroCategoria.addEventListener('change', () => { pagina = 1; cargar(); });

  (async function iniciar() {
    usuario = await Sesion.requerir(['administrador']);
    if (!usuario) return;
    await TablaProductos.cargarCategorias(filtroCategoria);
    await cargar();
  })();
})();
