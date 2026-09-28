/*
 * Cliente de la API. Se encarga de enviar el token CSRF en las peticiones que modifican datos.
 * Devuelve siempre { ok, estado, datos } y nunca lanza por errores HTTP.
 */
const Api = (() => {
  let tokenCsrf = null;

  async function obtenerToken() {
    if (!tokenCsrf) {
      const respuesta = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
      const cuerpo = await respuesta.json();
      tokenCsrf = cuerpo.token;
    }
    return tokenCsrf;
  }

  async function solicitar(metodo, url, cuerpo, reintento = true) {
    const opciones = { method: metodo, credentials: 'same-origin', headers: { Accept: 'application/json' } };
    const esFormulario = typeof FormData !== 'undefined' && cuerpo instanceof FormData;
    if (metodo !== 'GET') {
      // Con FormData el navegador agrega solo el Content-Type (multipart) con su delimitador.
      if (!esFormulario) opciones.headers['Content-Type'] = 'application/json';
      opciones.headers['X-CSRF-Token'] = await obtenerToken();
      if (cuerpo !== undefined) opciones.body = esFormulario ? cuerpo : JSON.stringify(cuerpo);
    }

    const respuesta = await fetch(url, opciones);
    let datos = null;
    if (respuesta.status !== 204) {
      try {
        datos = await respuesta.json();
      } catch (e) {
        datos = null;
      }
    }

    // Si el token caducó junto con la sesión, se pide uno nuevo y se reintenta una vez.
    if (reintento && respuesta.status === 403 && datos && datos.error && datos.error.codigo === 'CSRF_INVALIDO') {
      tokenCsrf = null;
      return solicitar(metodo, url, cuerpo, false);
    }
    return { ok: respuesta.ok, estado: respuesta.status, datos };
  }

  return { solicitar };
})();
