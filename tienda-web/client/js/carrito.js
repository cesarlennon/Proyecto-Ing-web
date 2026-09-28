/* Carrito de compras (M-06, CU-16): actualizar cantidades y eliminar productos en la misma vista. */
(function () {
  const mensaje = document.getElementById('mensaje');
  const cuerpoTabla = document.getElementById('cuerpo-tabla');
  const carritoVacio = document.getElementById('carrito-vacio');
  const resumen = document.getElementById('resumen');
  const total = document.getElementById('total');
  const btnComprar = document.getElementById('btn-comprar');

  function fila(item) {
    const tr = document.createElement('tr');
    const nombre = Dom.el('a', { texto: item.nombre, atributos: { href: '/pages/cliente/producto.html?id=' + item.idProducto } });
    tr.appendChild(Dom.el('td', {}, [nombre]));
    tr.appendChild(Dom.el('td', { texto: Dom.moneda(item.precio) }));

    const menos = Dom.el('button', { clase: 'boton-enlace', texto: '−', atributos: { type: 'button', 'aria-label': 'Disminuir cantidad' } });
    const mas = Dom.el('button', { clase: 'boton-enlace', texto: '+', atributos: { type: 'button', 'aria-label': 'Aumentar cantidad' } });
    const cantidad = Dom.el('span', { texto: String(item.cantidad), atributos: { style: 'padding:0 0.6rem;' } });
    menos.addEventListener('click', () => cambiarCantidad(item, item.cantidad - 1));
    mas.addEventListener('click', () => cambiarCantidad(item, item.cantidad + 1));
    tr.appendChild(Dom.el('td', {}, [menos, cantidad, mas]));

    tr.appendChild(Dom.el('td', { texto: Dom.moneda(item.subtotal) }));

    const eliminar = Dom.el('button', { clase: 'boton-enlace peligro', texto: 'Eliminar', atributos: { type: 'button' }, alClic: () => eliminarItem(item) });
    tr.appendChild(Dom.el('td', {}, [eliminar]));
    return tr;
  }

  async function cambiarCantidad(item, nueva) {
    if (nueva < 1) { await eliminarItem(item); return; }
    const respuesta = await Api.solicitar('PUT', '/api/carrito/' + item.idProducto, { cantidad: nueva });
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo actualizar la cantidad.')); return; }
    mostrar(respuesta.datos);
  }

  async function eliminarItem(item) {
    const acepta = await Modal.confirmar({
      titulo: '¿Eliminar producto?', mensaje: 'Se eliminará «' + item.nombre + '» del carrito.', textoConfirmar: 'Eliminar', peligro: true,
    });
    if (!acepta) return;
    const respuesta = await Api.solicitar('DELETE', '/api/carrito/' + item.idProducto + '?confirmado=true');
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo eliminar el producto.')); return; }
    mostrar(respuesta.datos);
  }

  function mostrar(carrito) {
    Dom.vaciar(cuerpoTabla);
    carrito.items.forEach((item) => cuerpoTabla.appendChild(fila(item)));
    const vacio = carrito.items.length === 0;
    carritoVacio.classList.toggle('oculto', !vacio);
    resumen.classList.toggle('oculto', vacio);
    document.querySelector('.tabla-contenedor').classList.toggle('oculto', vacio);
    total.textContent = Dom.moneda(carrito.total);
    document.dispatchEvent(new CustomEvent('carrito:actualizado'));
  }

  async function cargar() {
    Dom.aviso(mensaje, '');
    const respuesta = await Api.solicitar('GET', '/api/carrito');
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo cargar el carrito.')); return; }
    mostrar(respuesta.datos);
  }

  btnComprar.addEventListener('click', () => { window.location.assign('/pages/cliente/confirmar-compra.html'); });

  (async function iniciar() {
    const usuario = await Sesion.requerir(['cliente']);
    if (!usuario) return;
    await cargar();
  })();
})();
