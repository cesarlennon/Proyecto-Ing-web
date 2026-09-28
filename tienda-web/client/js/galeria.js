/*
 * Galería de imágenes de un producto (CU-07): muestra las imágenes, permite agregar varias a la vez
 * y eliminarlas con confirmación. No hay límite de imágenes por producto.
 */
const Galeria = (() => {
  const TIPOS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const MAX_ARCHIVOS = 10;
  const MAX_BYTES = 5 * 1024 * 1024;

  /** Revisa los archivos elegidos antes de enviarlos; el servidor vuelve a validarlos por su contenido. */
  function validarArchivos(archivos) {
    if (!archivos || archivos.length === 0) return 'Selecciona al menos una imagen.';
    if (archivos.length > MAX_ARCHIVOS) return 'Puedes subir hasta ' + MAX_ARCHIVOS + ' imágenes a la vez.';
    for (let i = 0; i < archivos.length; i += 1) {
      if (TIPOS.indexOf(archivos[i].type) === -1) return 'Solo se aceptan imágenes JPEG, PNG, GIF o WebP.';
      if (archivos[i].size > MAX_BYTES) return 'Cada imagen puede pesar como máximo 5 MB.';
    }
    return '';
  }

  /** Envía los archivos al servidor. Devuelve la respuesta de Api.solicitar. */
  function subir(idProducto, archivos) {
    const datos = new FormData();
    Array.prototype.forEach.call(archivos, (archivo) => datos.append('imagenes', archivo));
    return Api.solicitar('POST', '/api/productos/' + idProducto + '/imagenes', datos);
  }

  /**
   * Crea una galería. opciones: { idProducto, contenedor, aviso, alCambiar }.
   * Devuelve { recargar, mostrar }.
   */
  function crear(opciones) {
    const { idProducto, contenedor, aviso, alCambiar } = opciones;

    function mostrar(imagenes) {
      Dom.vaciar(contenedor);
      if (imagenes.length === 0) {
        contenedor.appendChild(Dom.el('p', { clase: 'galeria-vacia', texto: 'Este producto aún no tiene imágenes.' }));
        return;
      }
      imagenes.forEach((imagen, indice) => {
        const boton = Dom.el('button', {
          texto: '×',
          atributos: { type: 'button', 'aria-label': 'Eliminar la imagen ' + (indice + 1) },
          alClic: () => eliminar(imagen),
        });
        contenedor.appendChild(
          Dom.el('div', { clase: 'miniatura' }, [
            Dom.el('img', { atributos: { src: imagen.url, alt: 'Imagen ' + (indice + 1) + ' del producto' } }),
            boton,
          ]),
        );
      });
    }

    async function recargar() {
      const respuesta = await Api.solicitar('GET', '/api/productos/' + idProducto);
      if (!respuesta.ok) {
        Dom.aviso(aviso, Dom.mensajeDeError(respuesta, 'No se pudieron cargar las imágenes.'));
        return null;
      }
      mostrar(respuesta.datos.producto.imagenes);
      if (alCambiar) alCambiar(respuesta.datos.producto);
      return respuesta.datos.producto;
    }

    async function eliminar(imagen) {
      const acepta = await Modal.confirmar({
        titulo: '¿Eliminar la imagen?',
        mensaje: 'La imagen se quitará del producto. Esta operación no se puede deshacer.',
        textoConfirmar: 'Eliminar',
        peligro: true,
      });
      if (!acepta) return;
      const respuesta = await Api.solicitar(
        'DELETE',
        '/api/productos/' + idProducto + '/imagenes/' + imagen.idImagen + '?confirmado=true',
      );
      if (!respuesta.ok) {
        Dom.aviso(aviso, Dom.mensajeDeError(respuesta, 'No se pudo eliminar la imagen.'));
        return;
      }
      Dom.aviso(aviso, 'Imagen eliminada.', 'ok');
      await recargar();
    }

    return { recargar, mostrar };
  }

  return { crear, subir, validarArchivos };
})();
