/* Formulario de registro de cliente (CU-11). Valida con JavaScript antes de enviar (RF-06). */
(function () {
  const CAMPOS = ['nombres', 'apellidoPaterno', 'apellidoMaterno', 'rfc', 'curp', 'aceptaAviso'];
  const formulario = document.getElementById('form-registro');
  const mensajeGeneral = document.getElementById('mensaje-general');
  const botonRegistrar = document.getElementById('btn-registrar');

  function leerDatos() {
    return {
      nombres: formulario.elements.nombres.value,
      apellidoPaterno: formulario.elements.apellidoPaterno.value,
      apellidoMaterno: formulario.elements.apellidoMaterno.value,
      rfc: formulario.elements.rfc.value,
      curp: formulario.elements.curp.value,
      aceptaAviso: formulario.elements.aceptaAviso.checked,
    };
  }

  function mostrarError(campo, mensaje) {
    document.getElementById('error-' + campo).textContent = mensaje || '';
    const entrada = document.getElementById(campo);
    if (entrada.type !== 'checkbox') entrada.classList.toggle('invalido', Boolean(mensaje));
  }

  function mostrarMensajeGeneral(texto) {
    mensajeGeneral.textContent = texto || '';
    mensajeGeneral.classList.toggle('oculto', !texto);
  }

  function validar(soloCampo) {
    const { errores } = Validaciones.validarRegistroCliente(leerDatos());
    CAMPOS.forEach((campo) => {
      if (!soloCampo || soloCampo === campo) mostrarError(campo, errores[campo]);
    });
    return Object.keys(errores).length === 0;
  }

  CAMPOS.forEach((campo) => {
    const entrada = document.getElementById(campo);
    const evento = entrada.type === 'checkbox' ? 'change' : 'blur';
    entrada.addEventListener(evento, () => validar(campo));
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mostrarMensajeGeneral('');
    if (!validar()) return;

    botonRegistrar.disabled = true;
    try {
      const respuesta = await Api.solicitar('POST', '/api/auth/registro', leerDatos());
      if (respuesta.ok) {
        window.location.assign(respuesta.datos.rutaInicio);
        return;
      }
      const error = (respuesta.datos && respuesta.datos.error) || {};
      if (error.campos) {
        Object.keys(error.campos).forEach((campo) => mostrarError(campo, error.campos[campo]));
      }
      if (error.codigo === 'SIN_IDENTIDAD') {
        window.location.assign('/login.html?error=oauth');
        return;
      }
      mostrarMensajeGeneral(error.mensaje || 'No se pudo completar el registro. Inténtalo de nuevo.');
    } catch (e) {
      mostrarMensajeGeneral('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      botonRegistrar.disabled = false;
    }
  });

  // Prellena los datos de la identidad verificada; sin ella no se puede registrar.
  (async function iniciar() {
    const identidad = document.getElementById('identidad');
    const respuesta = await Api.solicitar('GET', '/api/auth/registro/pendiente');
    if (!respuesta.ok) {
      window.location.replace('/login.html?error=oauth');
      return;
    }
    identidad.textContent = '✓ Identidad verificada con Google: ' + respuesta.datos.correo;
    if (respuesta.datos.nombres) formulario.elements.nombres.value = respuesta.datos.nombres;
  })();
})();
