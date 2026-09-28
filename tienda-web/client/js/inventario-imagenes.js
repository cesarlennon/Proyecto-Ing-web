/* Administración de imágenes desde el inventario (M-16, CU-07). */
(function () {
  const idProducto = new URLSearchParams(window.location.search).get('id');
  const mensaje = document.getElementById('mensaje');
  const tituloPagina = document.getElementById('titulo-pagina');
  const galeriaContenedor = document.getElementById('galeria');
  const errorImagenes = document.getElementById('error-imagenes');
  const btnSubir = document.getElementById('btn-subir');
  const archivos = document.getElementById('archivos');
  let galeria = null;

  btnSubir.addEventListener('click', async () => {
    errorImagenes.textContent = '';
    const error = Galeria.validarArchivos(archivos.files);
    if (error) { errorImagenes.textContent = error; return; }

    btnSubir.disabled = true;
    try {
      const respuesta = await Galeria.subir(idProducto, archivos.files);
      if (!respuesta.ok) { errorImagenes.textContent = Dom.mensajeDeError(respuesta, 'No se pudieron subir las imágenes.'); return; }
      archivos.value = '';
      await galeria.recargar();
    } finally {
      btnSubir.disabled = false;
    }
  });

  (async function iniciar() {
    const usuario = await Sesion.requerir(['inventarios', 'administrador']);
    if (!usuario) return;
    if (!idProducto) { Dom.aviso(mensaje, 'Falta indicar el producto.'); return; }

    galeria = Galeria.crear({
      idProducto,
      contenedor: galeriaContenedor,
      aviso: errorImagenes,
      alCambiar: (producto) => { tituloPagina.textContent = 'Imágenes de ' + producto.nombre; },
    });
    const producto = await galeria.recargar();
    if (!producto) Dom.aviso(mensaje, 'No se encontró el producto.');
  })();
})();
