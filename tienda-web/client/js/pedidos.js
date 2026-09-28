/* Mis pedidos (M-08, CU-18): lista de pedidos y detalle con el avance del estatus. */
(function () {
  const PASOS = ['En proceso', 'Pagada', 'Enviado', 'Recibido'];
  const mensaje = document.getElementById('mensaje');
  const cuerpoTabla = document.getElementById('cuerpo-tabla');
  const sinResultados = document.getElementById('sin-resultados');
  const detalle = document.getElementById('detalle');
  const detalleTitulo = document.getElementById('detalle-titulo');
  const detallePasos = document.getElementById('detalle-pasos');
  const detalleProductos = document.getElementById('detalle-productos');
  const detalleDireccion = document.getElementById('detalle-direccion');
  const detallePago = document.getElementById('detalle-pago');

  function fila(pedido) {
    const tr = document.createElement('tr');
    tr.appendChild(Dom.el('td', { texto: '#' + pedido.idPedido }));
    tr.appendChild(Dom.el('td', { texto: pedido.fechaPedido ? new Date(pedido.fechaPedido).toLocaleDateString('es-MX') : '—' }));
    tr.appendChild(Dom.el('td', { texto: Dom.moneda(pedido.total) }));
    tr.appendChild(Dom.el('td', { texto: pedido.estatus }));
    const verDetalle = Dom.el('button', { clase: 'boton-enlace', texto: 'Ver detalle', atributos: { type: 'button' }, alClic: () => mostrarDetalle(pedido.idPedido) });
    tr.appendChild(Dom.el('td', {}, [verDetalle]));
    return tr;
  }

  async function mostrarDetalle(idPedido) {
    const respuesta = await Api.solicitar('GET', '/api/mis-pedidos/' + idPedido);
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo cargar el pedido.')); return; }
    const pedido = respuesta.datos.pedido;

    detalleTitulo.textContent = 'Pedido #' + pedido.idPedido + ' — Detalle';
    Dom.vaciar(detallePasos);
    const indiceActual = PASOS.indexOf(pedido.estatus);
    PASOS.forEach((paso, i) => {
      const cumplido = i <= indiceActual;
      detallePasos.appendChild(Dom.el('span', {
        clase: 'insignia ' + (cumplido ? 'insignia-ok' : 'insignia-inactivo'),
        texto: (cumplido ? '✓ ' : '') + paso,
      }));
    });

    Dom.vaciar(detalleProductos);
    pedido.detalles.forEach((d) => {
      const puedeCalificar = pedido.estatus === 'Recibido';
      const enlace = '/pages/cliente/producto.html?id=' + d.idProducto + '#seccion-resenas';
      const hijos = [Dom.el('a', { texto: d.nombre + '  ×' + d.cantidad, atributos: { href: enlace } })];
      if (puedeCalificar) {
        hijos.push(document.createTextNode('   '));
        hijos.push(Dom.el('a', { texto: '[Calificar]', atributos: { href: enlace } }));
        hijos.push(document.createTextNode(' '));
        hijos.push(Dom.el('a', { texto: '[Recomendar]', atributos: { href: enlace } }));
      }
      detalleProductos.appendChild(Dom.el('p', {}, hijos));
    });

    detalleDireccion.textContent = 'Enviado a: ' + pedido.direccionEnvio;
    detallePago.textContent = 'Pago: •••• ' + pedido.tarjetaUltimos4;
    detalle.classList.remove('oculto');
    detalle.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function cargar() {
    Dom.aviso(mensaje, '');
    const respuesta = await Api.solicitar('GET', '/api/mis-pedidos');
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudieron cargar tus pedidos.')); return; }
    const pedidos = respuesta.datos.pedidos;
    Dom.vaciar(cuerpoTabla);
    pedidos.forEach((p) => cuerpoTabla.appendChild(fila(p)));
    sinResultados.classList.toggle('oculto', pedidos.length > 0);

    const nuevo = new URLSearchParams(window.location.search).get('nuevo');
    if (nuevo) await mostrarDetalle(Number(nuevo));
  }

  (async function iniciar() {
    const usuario = await Sesion.requerir(['cliente']);
    if (!usuario) return;
    await cargar();
  })();
})();
