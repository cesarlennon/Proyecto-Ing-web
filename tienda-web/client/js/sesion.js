/*
 * Protege las pantallas de cada perfil: pide la sesión al servidor y redirige si no hay sesión
 * o si el perfil no corresponde. El control de acceso real se aplica en el servidor (RF-04);
 * esto solo evita mostrar pantallas que no corresponden.
 */
const Sesion = (() => {
  const INICIO = {
    administrador: '/pages/admin/inicio.html',
    cliente: '/pages/cliente/inicio.html',
    inventarios: '/pages/inventarios/inicio.html',
  };

  async function requerir(rolesPermitidos) {
    const respuesta = await Api.solicitar('GET', '/api/auth/sesion');
    if (!respuesta.ok) {
      window.location.replace('/login.html');
      return null;
    }
    const usuario = respuesta.datos.usuario;
    if (!rolesPermitidos.includes(usuario.rol)) {
      window.location.replace(INICIO[usuario.rol] || '/');
      return null;
    }

    const nombre = document.getElementById('nombre-usuario');
    if (nombre) nombre.textContent = usuario.nombre;

    const salir = document.getElementById('btn-salir');
    if (salir) {
      salir.addEventListener('click', async () => {
        await Api.solicitar('POST', '/api/auth/logout');
        window.location.assign('/');
      });
    }
    return usuario;
  }

  return { requerir };
})();
