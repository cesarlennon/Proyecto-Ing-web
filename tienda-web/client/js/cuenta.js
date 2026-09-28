/* Mi cuenta (M-09, M-10, CU-12, CU-13): direcciones y métodos de pago del cliente. */
(function () {
  const mensaje = document.getElementById('mensaje');
  const tabDirecciones = document.getElementById('tab-direcciones');
  const tabPago = document.getElementById('tab-pago');
  const panelDirecciones = document.getElementById('panel-direcciones');
  const panelPago = document.getElementById('panel-pago');

  // ---------- Direcciones ----------
  const listaDirecciones = document.getElementById('lista-direcciones');
  const direccionesVacio = document.getElementById('direcciones-vacio');
  const btnNuevaDireccion = document.getElementById('btn-nueva-direccion');
  const formDireccion = document.getElementById('form-direccion');
  const tituloFormDireccion = document.getElementById('form-direccion-titulo');
  const CAMPOS_DIRECCION = ['calle', 'numeroExterior', 'numeroInterior', 'colonia', 'codigoPostal', 'municipio', 'ciudad', 'idPais'];
  let idDireccionEditando = null;

  function tarjetaDireccion(d) {
    const acciones = [
      Dom.el('button', { clase: 'boton-enlace', texto: 'Editar', atributos: { type: 'button' }, alClic: () => abrirFormDireccion(d) }),
      document.createTextNode(' '),
      Dom.el('button', { clase: 'boton-enlace peligro', texto: 'Eliminar', atributos: { type: 'button' }, alClic: () => eliminarDireccion(d) }),
    ];
    if (!d.esPrincipal) {
      acciones.push(document.createTextNode(' '));
      acciones.push(Dom.el('button', { clase: 'boton-enlace', texto: 'Hacer principal', atributos: { type: 'button' }, alClic: () => hacerPrincipalDireccion(d) }));
    }
    return Dom.el('article', { clase: 'tarjeta' }, [
      d.esPrincipal ? Dom.el('span', { clase: 'insignia insignia-ok', texto: 'Principal' }) : null,
      Dom.el('p', { texto: d.textoCompleto }),
      Dom.el('p', {}, acciones),
    ]);
  }

  async function cargarDirecciones() {
    const respuesta = await Api.solicitar('GET', '/api/mis-direcciones');
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudieron cargar tus direcciones.')); return; }
    const direcciones = respuesta.datos.direcciones;
    Dom.vaciar(listaDirecciones);
    direcciones.forEach((d) => listaDirecciones.appendChild(tarjetaDireccion(d)));
    direccionesVacio.classList.toggle('oculto', direcciones.length > 0);
  }

  async function cargarPaisesSelect() {
    const select = document.getElementById('idPais');
    const respuesta = await Api.solicitar('GET', '/api/paises');
    Dom.vaciar(select);
    if (respuesta.ok) respuesta.datos.elementos.forEach((p) => select.appendChild(Dom.el('option', { texto: p.nombre, atributos: { value: String(p.idPais) } })));
  }

  function limpiarErrores(campos) {
    campos.forEach((c) => { const el = document.getElementById('error-' + c); if (el) el.textContent = ''; });
  }

  function abrirFormDireccion(direccion) {
    idDireccionEditando = direccion ? direccion.idDireccion : null;
    tituloFormDireccion.textContent = direccion ? 'Editar dirección' : 'Nueva dirección';
    limpiarErrores(CAMPOS_DIRECCION);
    formDireccion.elements.calle.value = direccion ? direccion.calle : '';
    formDireccion.elements.numeroExterior.value = direccion ? direccion.numeroExterior : '';
    formDireccion.elements.numeroInterior.value = direccion && direccion.numeroInterior ? direccion.numeroInterior : '';
    formDireccion.elements.colonia.value = direccion ? direccion.colonia : '';
    formDireccion.elements.codigoPostal.value = direccion ? direccion.codigoPostal : '';
    formDireccion.elements.municipio.value = direccion ? direccion.municipio : '';
    formDireccion.elements.ciudad.value = direccion ? direccion.ciudad : '';
    if (direccion) formDireccion.elements.idPais.value = String(direccion.idPais);
    formDireccion.elements.esPrincipal.checked = direccion ? direccion.esPrincipal : false;
    formDireccion.classList.remove('oculto');
    formDireccion.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function leerDireccion() {
    return {
      calle: formDireccion.elements.calle.value,
      numeroExterior: formDireccion.elements.numeroExterior.value,
      numeroInterior: formDireccion.elements.numeroInterior.value,
      colonia: formDireccion.elements.colonia.value,
      codigoPostal: formDireccion.elements.codigoPostal.value,
      municipio: formDireccion.elements.municipio.value,
      ciudad: formDireccion.elements.ciudad.value,
      idPais: formDireccion.elements.idPais.value,
      esPrincipal: formDireccion.elements.esPrincipal.checked,
    };
  }

  CAMPOS_DIRECCION.forEach((campo) => {
    document.getElementById(campo).addEventListener('blur', () => {
      const { errores } = Validaciones.validarDireccion(leerDireccion());
      document.getElementById('error-' + campo).textContent = errores[campo] || '';
    });
  });

  formDireccion.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const { errores } = Validaciones.validarDireccion(leerDireccion());
    limpiarErrores(CAMPOS_DIRECCION);
    if (Object.keys(errores).length > 0) {
      Object.keys(errores).forEach((c) => { const el = document.getElementById('error-' + c); if (el) el.textContent = errores[c]; });
      return;
    }
    const datos = leerDireccion();
    const respuesta = idDireccionEditando
      ? await Api.solicitar('PUT', '/api/mis-direcciones/' + idDireccionEditando, datos)
      : await Api.solicitar('POST', '/api/mis-direcciones', datos);
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo guardar la dirección.')); return; }
    formDireccion.classList.add('oculto');
    Dom.aviso(mensaje, 'Dirección guardada.', 'ok');
    await cargarDirecciones();
  });

  document.getElementById('btn-cancelar-direccion').addEventListener('click', () => formDireccion.classList.add('oculto'));
  btnNuevaDireccion.addEventListener('click', () => abrirFormDireccion(null));

  async function eliminarDireccion(direccion) {
    const acepta = await Modal.confirmar({ titulo: '¿Eliminar dirección?', mensaje: 'Se eliminará esta dirección.', textoConfirmar: 'Eliminar', peligro: true });
    if (!acepta) return;
    const respuesta = await Api.solicitar('DELETE', '/api/mis-direcciones/' + direccion.idDireccion + '?confirmado=true');
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo eliminar la dirección.')); return; }
    await cargarDirecciones();
  }

  async function hacerPrincipalDireccion(direccion) {
    const respuesta = await Api.solicitar('PATCH', '/api/mis-direcciones/' + direccion.idDireccion + '/principal');
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo actualizar.')); return; }
    await cargarDirecciones();
  }

  // ---------- Métodos de pago ----------
  const listaMetodos = document.getElementById('lista-metodos');
  const metodosVacio = document.getElementById('metodos-vacio');
  const btnNuevoMetodo = document.getElementById('btn-nuevo-metodo');
  const formMetodo = document.getElementById('form-metodo');
  const tituloFormMetodo = document.getElementById('form-metodo-titulo');
  const CAMPOS_METODO = ['titular', 'numero', 'mesVencimiento', 'anioVencimiento', 'cvv'];
  let idMetodoEditando = null;

  function tarjetaMetodo(m) {
    const acciones = [
      Dom.el('button', { clase: 'boton-enlace', texto: 'Editar', atributos: { type: 'button' }, alClic: () => abrirFormMetodo(m) }),
      document.createTextNode(' '),
      Dom.el('button', { clase: 'boton-enlace peligro', texto: 'Eliminar', atributos: { type: 'button' }, alClic: () => eliminarMetodo(m) }),
    ];
    if (!m.esPrincipal) {
      acciones.push(document.createTextNode(' '));
      acciones.push(Dom.el('button', { clase: 'boton-enlace', texto: 'Hacer principal', atributos: { type: 'button' }, alClic: () => hacerPrincipalMetodo(m) }));
    }
    return Dom.el('article', { clase: 'tarjeta' }, [
      m.esPrincipal ? Dom.el('span', { clase: 'insignia insignia-ok', texto: 'Principal' }) : null,
      Dom.el('p', { texto: m.numeroEnmascarado + '   Vence ' + m.vencimiento }),
      Dom.el('p', { texto: m.titular, atributos: { style: 'color:var(--gris);font-size:0.85rem;' } }),
      Dom.el('p', {}, acciones),
    ]);
  }

  async function cargarMetodos() {
    const respuesta = await Api.solicitar('GET', '/api/mis-metodos-pago');
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudieron cargar tus métodos de pago.')); return; }
    const metodos = respuesta.datos.metodosPago;
    Dom.vaciar(listaMetodos);
    metodos.forEach((m) => listaMetodos.appendChild(tarjetaMetodo(m)));
    metodosVacio.classList.toggle('oculto', metodos.length > 0);
  }

  function abrirFormMetodo(metodo) {
    idMetodoEditando = metodo ? metodo.idMetodoPago : null;
    tituloFormMetodo.textContent = metodo ? 'Editar método de pago' : 'Nuevo método de pago';
    limpiarErrores(CAMPOS_METODO);
    formMetodo.reset();
    if (metodo) {
      formMetodo.elements.titular.value = metodo.titular;
      formMetodo.elements.mesVencimiento.value = String(metodo.mesVencimiento).padStart(2, '0');
      formMetodo.elements.anioVencimiento.value = String(metodo.anioVencimiento);
      formMetodo.elements.esPrincipalMetodo.checked = metodo.esPrincipal;
    }
    formMetodo.classList.remove('oculto');
    formMetodo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function leerMetodo() {
    return {
      titular: formMetodo.elements.titular.value,
      numero: formMetodo.elements.numero.value,
      mesVencimiento: formMetodo.elements.mesVencimiento.value,
      anioVencimiento: formMetodo.elements.anioVencimiento.value,
      cvv: formMetodo.elements.cvv.value,
      esPrincipal: formMetodo.elements.esPrincipalMetodo.checked,
    };
  }

  CAMPOS_METODO.forEach((campo) => {
    document.getElementById(campo).addEventListener('blur', () => {
      const { errores } = Validaciones.validarMetodoPago(leerMetodo());
      document.getElementById('error-' + campo).textContent = errores[campo] || '';
    });
  });

  formMetodo.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const { errores } = Validaciones.validarMetodoPago(leerMetodo());
    limpiarErrores(CAMPOS_METODO);
    if (Object.keys(errores).length > 0) {
      Object.keys(errores).forEach((c) => { const el = document.getElementById('error-' + c); if (el) el.textContent = errores[c]; });
      return;
    }
    const { cvv, ...datos } = leerMetodo();
    const respuesta = idMetodoEditando
      ? await Api.solicitar('PUT', '/api/mis-metodos-pago/' + idMetodoEditando, datos)
      : await Api.solicitar('POST', '/api/mis-metodos-pago', datos);
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo guardar el método de pago.')); return; }
    formMetodo.classList.add('oculto');
    Dom.aviso(mensaje, 'Método de pago guardado.', 'ok');
    await cargarMetodos();
  });

  document.getElementById('btn-cancelar-metodo').addEventListener('click', () => formMetodo.classList.add('oculto'));
  btnNuevoMetodo.addEventListener('click', () => abrirFormMetodo(null));

  async function eliminarMetodo(metodo) {
    const acepta = await Modal.confirmar({ titulo: '¿Eliminar método de pago?', mensaje: 'Se eliminará esta tarjeta.', textoConfirmar: 'Eliminar', peligro: true });
    if (!acepta) return;
    const respuesta = await Api.solicitar('DELETE', '/api/mis-metodos-pago/' + metodo.idMetodoPago + '?confirmado=true');
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo eliminar el método de pago.')); return; }
    await cargarMetodos();
  }

  async function hacerPrincipalMetodo(metodo) {
    const respuesta = await Api.solicitar('PATCH', '/api/mis-metodos-pago/' + metodo.idMetodoPago + '/principal');
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo actualizar.')); return; }
    await cargarMetodos();
  }

  // ---------- Pestañas ----------
  tabDirecciones.addEventListener('click', () => {
    tabDirecciones.classList.add('activa'); tabDirecciones.setAttribute('aria-selected', 'true');
    tabPago.classList.remove('activa'); tabPago.setAttribute('aria-selected', 'false');
    panelDirecciones.classList.remove('oculto'); panelPago.classList.add('oculto');
  });
  tabPago.addEventListener('click', () => {
    tabPago.classList.add('activa'); tabPago.setAttribute('aria-selected', 'true');
    tabDirecciones.classList.remove('activa'); tabDirecciones.setAttribute('aria-selected', 'false');
    panelPago.classList.remove('oculto'); panelDirecciones.classList.add('oculto');
  });

  (async function iniciar() {
    const usuario = await Sesion.requerir(['cliente']);
    if (!usuario) return;
    await cargarPaisesSelect();
    await cargarDirecciones();
    await cargarMetodos();
  })();
})();
