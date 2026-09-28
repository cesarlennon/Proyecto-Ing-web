/* Alta y edición de producto (M-12): valida con JavaScript y sube imágenes sin límite (CU-06, CU-07, CU-09). */
(function () {
  const idProducto = new URLSearchParams(window.location.search).get('id');
  const CAMPOS = ['nombre', 'descripcion', 'precio', 'stock', 'idCategoria', 'diasEntrega'];

  const formulario = document.getElementById('form-producto');
  const mensaje = document.getElementById('mensaje');
  const tituloPagina = document.getElementById('titulo-pagina');
  const btnGuardar = document.getElementById('btn-guardar');
  const campoActivo = document.getElementById('campo-activo');
  const galeriaContenedor = document.getElementById('galeria');
  const errorImagenes = document.getElementById('error-imagenes');
  const btnSubir = document.getElementById('btn-subir');
  const archivos = document.getElementById('archivos');

  let galeria = null;

  function leerDatos() {
    return {
      nombre: formulario.elements.nombre.value,
      descripcion: formulario.elements.descripcion.value,
      precio: formulario.elements.precio.value,
      stock: formulario.elements.stock.value,
      idCategoria: formulario.elements.idCategoria.value,
      diasEntrega: formulario.elements.diasEntrega.value,
    };
  }

  function mostrarError(campo, texto) {
    document.getElementById('error-' + campo).textContent = texto || '';
    const entrada = document.getElementById(campo);
    if (entrada) entrada.classList.toggle('invalido', Boolean(texto));
  }

  function validar(soloCampo) {
    const { errores } = Validaciones.validarProducto(leerDatos());
    CAMPOS.forEach((campo) => { if (!soloCampo || soloCampo === campo) mostrarError(campo, errores[campo]); });
    return Object.keys(errores).length === 0;
  }

  CAMPOS.forEach((campo) => {
    const entrada = document.getElementById(campo);
    const evento = entrada.tagName === 'SELECT' ? 'change' : 'blur';
    entrada.addEventListener(evento, () => validar(campo));
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    Dom.aviso(mensaje, '');
    if (!validar()) return;

    const cuerpo = leerDatos();
    if (idProducto) cuerpo.activo = document.getElementById('activo').checked;

    btnGuardar.disabled = true;
    try {
      const respuesta = idProducto
        ? await Api.solicitar('PUT', '/api/productos/' + idProducto, cuerpo)
        : await Api.solicitar('POST', '/api/productos', cuerpo);
      if (!respuesta.ok) {
        const error = (respuesta.datos && respuesta.datos.error) || {};
        if (error.campos) Object.keys(error.campos).forEach((campo) => mostrarError(campo, error.campos[campo]));
        Dom.aviso(mensaje, error.mensaje || 'No se pudo guardar el producto.');
        return;
      }
      if (!idProducto) {
        window.location.replace('/pages/admin/producto-form.html?id=' + respuesta.datos.producto.idProducto);
        return;
      }
      Dom.aviso(mensaje, 'Los cambios se guardaron.', 'ok');
    } finally {
      btnGuardar.disabled = false;
    }
  });

  btnSubir.addEventListener('click', async () => {
    if (!idProducto) {
      Dom.aviso(mensaje, 'Guarda el producto antes de agregar imágenes.');
      return;
    }
    errorImagenes.textContent = '';
    const error = Galeria.validarArchivos(archivos.files);
    if (error) { errorImagenes.textContent = error; return; }

    btnSubir.disabled = true;
    try {
      const respuesta = await Galeria.subir(idProducto, archivos.files);
      if (!respuesta.ok) {
        errorImagenes.textContent = Dom.mensajeDeError(respuesta, 'No se pudieron subir las imágenes.');
        return;
      }
      archivos.value = '';
      await galeria.recargar();
    } finally {
      btnSubir.disabled = false;
    }
  });

  function llenarFormulario(producto) {
    formulario.elements.nombre.value = producto.nombre;
    formulario.elements.descripcion.value = producto.descripcion || '';
    formulario.elements.precio.value = producto.precio;
    formulario.elements.stock.value = producto.stock;
    formulario.elements.idCategoria.value = String(producto.idCategoria);
    formulario.elements.diasEntrega.value = producto.diasEntrega || '';
    document.getElementById('activo').checked = producto.activo;
  }

  (async function iniciar() {
    const usuario = await Sesion.requerir(['administrador']);
    if (!usuario) return;
    await TablaProductos.cargarCategorias(document.getElementById('idCategoria'));

    galeria = Galeria.crear({ idProducto, contenedor: galeriaContenedor, aviso: errorImagenes });

    if (idProducto) {
      tituloPagina.textContent = 'Editar producto';
      campoActivo.classList.remove('oculto');
      const producto = await galeria.recargar();
      if (producto) llenarFormulario(producto);
      else if (!producto) Dom.aviso(mensaje, 'No se encontró el producto.');
    } else {
      galeria.mostrar([]);
    }
  })();
})();
