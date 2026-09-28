/* Confirmar compra (M-07, CU-17): elige dirección y método de pago, y confirma el pago simulado. */
(function () {
  const mensaje = document.getElementById('mensaje');
  const listaDirecciones = document.getElementById('lista-direcciones');
  const listaMetodos = document.getElementById('lista-metodos');
  const resumenItems = document.getElementById('resumen-items');
  const resumenTotal = document.getElementById('resumen-total');
  const btnConfirmar = document.getElementById('btn-confirmar');

  let idDireccion = null;
  let idMetodoPago = null;

  function opcionRadio(nombre, id, principal, etiqueta, seleccionActual, alElegir) {
    const radio = Dom.el('input', { atributos: { type: 'radio', name: nombre, id: nombre + '-' + id, value: String(id) } });
    radio.checked = id === seleccionActual;
    radio.addEventListener('change', () => alElegir(id));
    const chip = principal ? Dom.el('span', { clase: 'insignia insignia-ok', texto: 'Principal', atributos: { style: 'margin-left:0.5rem;' } }) : null;
    return Dom.el('label', { clase: 'campo', atributos: { for: nombre + '-' + id, style: 'display:flex;align-items:center;gap:0.5rem;border:1px solid var(--borde);border-radius:4px;padding:0.6rem;margin-bottom:0.5rem;' } }, [radio, etiqueta, chip]);
  }

  async function cargarDirecciones() {
    const respuesta = await Api.solicitar('GET', '/api/mis-direcciones');
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudieron cargar tus direcciones.')); return; }
    const direcciones = respuesta.datos.direcciones;
    if (direcciones.length === 0) { listaDirecciones.textContent = 'No tienes direcciones registradas.'; return; }
    const principal = direcciones.find((d) => d.esPrincipal) || direcciones[0];
    idDireccion = principal.idDireccion;
    Dom.vaciar(listaDirecciones);
    direcciones.forEach((d) => listaDirecciones.appendChild(opcionRadio('direccion', d.idDireccion, d.esPrincipal, d.textoCompleto, idDireccion, (id) => { idDireccion = id; })));
  }

  async function cargarMetodos() {
    const respuesta = await Api.solicitar('GET', '/api/mis-metodos-pago');
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudieron cargar tus métodos de pago.')); return; }
    const metodos = respuesta.datos.metodosPago;
    if (metodos.length === 0) { listaMetodos.textContent = 'No tienes métodos de pago registrados.'; return; }
    const principal = metodos.find((m) => m.esPrincipal) || metodos[0];
    idMetodoPago = principal.idMetodoPago;
    Dom.vaciar(listaMetodos);
    metodos.forEach((m) => {
      const texto = m.numeroEnmascarado + '      Vence ' + m.vencimiento;
      listaMetodos.appendChild(opcionRadio('metodo', m.idMetodoPago, m.esPrincipal, texto, idMetodoPago, (id) => { idMetodoPago = id; }));
    });
  }

  async function cargarResumen() {
    const respuesta = await Api.solicitar('GET', '/api/carrito');
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo cargar tu carrito.')); return false; }
    if (respuesta.datos.items.length === 0) {
      Dom.aviso(mensaje, 'Tu carrito está vacío.');
      btnConfirmar.disabled = true;
      return false;
    }
    Dom.vaciar(resumenItems);
    respuesta.datos.items.forEach((item) => {
      resumenItems.appendChild(Dom.el('p', { texto: item.nombre + '  ×' + item.cantidad + '   ' + Dom.moneda(item.subtotal) }));
    });
    resumenTotal.textContent = Dom.moneda(respuesta.datos.total);
    return true;
  }

  btnConfirmar.addEventListener('click', async () => {
    Dom.aviso(mensaje, '');
    if (!idDireccion || !idMetodoPago) { Dom.aviso(mensaje, 'Selecciona una dirección y un método de pago.'); return; }
    const acepta = await Modal.confirmar({
      titulo: '¿Confirmar la compra?',
      mensaje: 'Se generará tu pedido y se procesará el pago (simulado). Esta operación no se puede deshacer.',
      textoConfirmar: 'Confirmar y pagar',
    });
    if (!acepta) return;

    btnConfirmar.disabled = true;
    try {
      const respuesta = await Api.solicitar('POST', '/api/mis-pedidos', { idDireccion, idMetodoPago, confirmado: true });
      if (!respuesta.ok) {
        const error = (respuesta.datos && respuesta.datos.error) || {};
        Dom.aviso(mensaje, error.mensaje || 'No se pudo completar la compra. Ajusta tu carrito e inténtalo de nuevo.');
        return;
      }
      document.dispatchEvent(new CustomEvent('carrito:actualizado'));
      window.location.assign('/pages/cliente/pedidos.html?nuevo=' + respuesta.datos.pedido.idPedido);
    } finally {
      btnConfirmar.disabled = false;
    }
  });

  (async function iniciar() {
    const usuario = await Sesion.requerir(['cliente']);
    if (!usuario) return;
    const hayCarrito = await cargarResumen();
    if (!hayCarrito) return;
    await cargarDirecciones();
    await cargarMetodos();
  })();
})();
