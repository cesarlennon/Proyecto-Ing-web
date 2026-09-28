/* Usuarios (M-13, CU-05): administrador y personal de inventarios. El cliente se autoregistra. */
(function () {
  const CAMPOS_NUEVO = ['correo', 'rol', 'nombres', 'apellidoPaterno', 'apellidoMaterno'];
  const CAMPOS_EDICION = ['nombres', 'apellidoPaterno', 'apellidoMaterno'];
  const ETIQUETAS_ROL = { administrador: 'Administrador', cliente: 'Cliente', inventarios: 'Personal de inventarios' };

  const mensaje = document.getElementById('mensaje');
  const filtroRol = document.getElementById('filtro-rol');
  const cuerpoTabla = document.getElementById('cuerpo-tabla');
  const sinResultados = document.getElementById('sin-resultados');
  const btnNuevo = document.getElementById('btn-nuevo-usuario');
  const formulario = document.getElementById('form-usuario');
  const tituloForm = document.getElementById('form-titulo');
  const campoCorreo = document.getElementById('correo');
  const campoRol = document.getElementById('rol');
  const notaOauth = document.getElementById('nota-oauth');

  let idEditando = null;

  function limpiarErrores(campos) {
    campos.forEach((c) => { const el = document.getElementById('error-' + c); if (el) el.textContent = ''; });
  }

  function leerFormulario() {
    return {
      correo: campoCorreo.value,
      rol: campoRol.value,
      nombres: formulario.elements.nombres.value,
      apellidoPaterno: formulario.elements.apellidoPaterno.value,
      apellidoMaterno: formulario.elements.apellidoMaterno.value,
    };
  }

  function abrirFormularioNuevo() {
    idEditando = null;
    tituloForm.textContent = 'Nuevo usuario';
    formulario.reset();
    limpiarErrores(CAMPOS_NUEVO);
    campoCorreo.disabled = false;
    campoRol.disabled = false;
    notaOauth.classList.remove('oculto');
    formulario.classList.remove('oculto');
    formulario.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function abrirFormularioEdicion(usuario) {
    idEditando = usuario.idUsuario;
    tituloForm.textContent = 'Editar usuario';
    limpiarErrores(CAMPOS_NUEVO);
    campoCorreo.value = usuario.correo;
    campoCorreo.disabled = true;
    campoRol.value = usuario.rol === 'cliente' ? 'inventarios' : usuario.rol;
    campoRol.disabled = true;
    formulario.elements.nombres.value = usuario.nombres;
    formulario.elements.apellidoPaterno.value = usuario.apellidoPaterno;
    formulario.elements.apellidoMaterno.value = usuario.apellidoMaterno || '';
    notaOauth.classList.add('oculto');
    formulario.classList.remove('oculto');
    formulario.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  document.getElementById('btn-cancelar').addEventListener('click', () => formulario.classList.add('oculto'));
  btnNuevo.addEventListener('click', abrirFormularioNuevo);

  CAMPOS_NUEVO.forEach((campo) => {
    const entrada = document.getElementById(campo);
    const evento = entrada.tagName === 'SELECT' ? 'change' : 'blur';
    entrada.addEventListener(evento, () => {
      const validador = idEditando ? Validaciones.validarUsuarioEdicion : Validaciones.validarUsuarioNuevo;
      const { errores } = validador(leerFormulario());
      const el = document.getElementById('error-' + campo);
      if (el) el.textContent = errores[campo] || '';
    });
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const datos = leerFormulario();
    const validador = idEditando ? Validaciones.validarUsuarioEdicion : Validaciones.validarUsuarioNuevo;
    const { errores } = validador(datos);
    limpiarErrores(CAMPOS_NUEVO);
    if (Object.keys(errores).length > 0) {
      Object.keys(errores).forEach((c) => { const el = document.getElementById('error-' + c); if (el) el.textContent = errores[c]; });
      return;
    }

    const respuesta = idEditando
      ? await Api.solicitar('PUT', '/api/usuarios/' + idEditando, datos)
      : await Api.solicitar('POST', '/api/usuarios', datos);
    if (!respuesta.ok) {
      const error = (respuesta.datos && respuesta.datos.error) || {};
      if (error.campos) Object.keys(error.campos).forEach((c) => { const el = document.getElementById('error-' + c); if (el) el.textContent = error.campos[c]; });
      Dom.aviso(mensaje, error.mensaje || 'No se pudo guardar el usuario.');
      return;
    }
    formulario.classList.add('oculto');
    Dom.aviso(mensaje, idEditando ? 'Usuario actualizado.' : 'Usuario creado.', 'ok');
    await cargar();
  });

  async function cambiarEstado(usuario) {
    const activar = !usuario.activo;
    const acepta = await Modal.confirmar({
      titulo: activar ? '¿Reactivar usuario?' : '¿Dar de baja al usuario?',
      mensaje: (activar ? 'Se reactivará' : 'Se dará de baja') + ' a «' + usuario.nombre + '». ' + (activar ? 'Podrá volver a iniciar sesión.' : 'No podrá iniciar sesión mientras esté deshabilitado.'),
      textoConfirmar: activar ? 'Reactivar' : 'Dar de baja',
      peligro: !activar,
    });
    if (!acepta) return;
    const respuesta = await Api.solicitar('PATCH', '/api/usuarios/' + usuario.idUsuario + '/estado', { activo: activar, confirmado: true });
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo actualizar el estado.')); return; }
    await cargar();
  }

  function fila(usuario) {
    const tr = document.createElement('tr');
    tr.appendChild(Dom.el('td', { texto: usuario.nombre }));
    tr.appendChild(Dom.el('td', { texto: usuario.correo }));
    tr.appendChild(Dom.el('td', { texto: ETIQUETAS_ROL[usuario.rol] || usuario.rol }));
    tr.appendChild(Dom.el('td', {}, [TablaProductos.insignia(usuario.activo)]));

    const acciones = [];
    if (usuario.rol !== 'cliente') {
      acciones.push(Dom.el('button', { clase: 'boton-enlace', texto: 'Editar', atributos: { type: 'button' }, alClic: () => abrirFormularioEdicion(usuario) }));
      acciones.push(document.createTextNode(' '));
    }
    acciones.push(Dom.el('button', {
      clase: 'boton-enlace' + (usuario.activo ? ' peligro' : ''),
      texto: usuario.activo ? 'Baja' : 'Alta',
      atributos: { type: 'button' },
      alClic: () => cambiarEstado(usuario),
    }));
    tr.appendChild(Dom.el('td', { clase: 'acciones-celda' }, acciones));
    return tr;
  }

  async function cargar() {
    Dom.aviso(mensaje, '');
    const parametros = filtroRol.value ? '?rol=' + filtroRol.value : '';
    const respuesta = await Api.solicitar('GET', '/api/usuarios' + parametros);
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudieron cargar los usuarios.')); return; }
    const usuarios = respuesta.datos.usuarios;
    Dom.vaciar(cuerpoTabla);
    usuarios.forEach((u) => cuerpoTabla.appendChild(fila(u)));
    sinResultados.classList.toggle('oculto', usuarios.length > 0);
  }

  filtroRol.addEventListener('change', cargar);

  (async function iniciar() {
    const usuario = await Sesion.requerir(['administrador']);
    if (!usuario) return;
    await cargar();
  })();
})();
