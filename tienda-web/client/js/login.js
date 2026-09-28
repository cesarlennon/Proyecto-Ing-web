/* Muestra el motivo por el que no se pudo iniciar sesión, según el parámetro ?error= */
(function () {
  const MENSAJES = {
    sin_cuenta: 'No existe una cuenta con ese correo. Regístrate para continuar.',
    deshabilitada: 'Tu cuenta está deshabilitada. Comunícate con el administrador.',
    ya_registrado: 'Ya tienes una cuenta con ese correo. Inicia sesión.',
    oauth: 'No se pudo verificar tu identidad. Inténtalo de nuevo.',
  };

  const codigo = new URLSearchParams(window.location.search).get('error');
  const mensaje = MENSAJES[codigo];
  if (mensaje) {
    const elemento = document.getElementById('mensaje');
    elemento.textContent = mensaje;
    elemento.classList.remove('oculto');
  }
})();
