/* CRUD de categorías y países (M-14, CU-08). */
(function () {
  const CONFIG = {
    categorias: { ruta: '/api/categorias', etiquetaSingular: 'la categoría', etiquetaNuevo: 'Nueva categoría', placeholder: 'Nombre de la categoría',
      notaEnUso: 'No se puede eliminar una categoría con productos asociados; puedes desactivarla.' },
    paises: { ruta: '/api/paises', etiquetaSingular: 'el país', etiquetaNuevo: 'Nuevo país', placeholder: 'Nombre del país',
      notaEnUso: 'No se puede eliminar un país con direcciones registradas; puedes desactivarlo.' },
  };
  let catalogo = 'categorias';

  const mensaje = document.getElementById('mensaje');
  const cuerpoTabla = document.getElementById('cuerpo-tabla');
  const sinResultados = document.getElementById('sin-resultados');
  const tabCategorias = document.getElementById('tab-categorias');
  const tabPaises = document.getElementById('tab-paises');
  const formAlta = document.getElementById('form-alta');
  const nombreNuevo = document.getElementById('nombre-nuevo');
  const etiquetaNuevo = document.getElementById('etiqueta-nuevo');
  const errorNuevo = document.getElementById('error-nuevo');
  const notaCatalogo = document.getElementById('nota-catalogo');

  function fila(elemento) {
    const tr = document.createElement('tr');
    tr.appendChild(Dom.el('td', { texto: elemento.nombre }));
    tr.appendChild(Dom.el('td', {}, [TablaProductos.insignia(elemento.activo)]));

    const cambiarEstado = Dom.el('button', {
      clase: 'boton-enlace',
      texto: elemento.activo ? 'Desactivar' : 'Activar',
      atributos: { type: 'button' },
      alClic: () => cambiarActivo(elemento),
    });
    const eliminar = Dom.el('button', {
      clase: 'boton-enlace peligro',
      texto: 'Eliminar',
      atributos: { type: 'button' },
      alClic: () => eliminar_(elemento),
    });
    tr.appendChild(Dom.el('td', { clase: 'acciones-celda' }, [cambiarEstado, eliminar]));
    return tr;
  }

  async function cargar() {
    Dom.aviso(mensaje, '');
    const c = CONFIG[catalogo];
    const respuesta = await Api.solicitar('GET', c.ruta + '?incluirInactivos=true');
    if (!respuesta.ok) {
      Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo cargar el catálogo.'));
      return;
    }
    Dom.vaciar(cuerpoTabla);
    respuesta.datos.elementos.forEach((e) => cuerpoTabla.appendChild(fila(e)));
    sinResultados.classList.toggle('oculto', respuesta.datos.elementos.length > 0);
  }

  async function cambiarActivo(elemento) {
    const c = CONFIG[catalogo];
    const idProp = catalogo === 'categorias' ? 'idCategoria' : 'idPais';
    const respuesta = await Api.solicitar('PUT', c.ruta + '/' + elemento[idProp], { activo: !elemento.activo });
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo actualizar.')); return; }
    await cargar();
  }

  async function eliminar_(elemento) {
    const c = CONFIG[catalogo];
    const idProp = catalogo === 'categorias' ? 'idCategoria' : 'idPais';
    const acepta = await Modal.confirmar({
      titulo: '¿Eliminar ' + c.etiquetaSingular + '?',
      mensaje: 'Se eliminará «' + elemento.nombre + '». Esta operación no se puede deshacer.',
      textoConfirmar: 'Eliminar',
      peligro: true,
    });
    if (!acepta) return;
    const respuesta = await Api.solicitar('DELETE', c.ruta + '/' + elemento[idProp] + '?confirmado=true');
    if (!respuesta.ok) { Dom.aviso(mensaje, Dom.mensajeDeError(respuesta, 'No se pudo eliminar.')); return; }
    Dom.aviso(mensaje, 'Elemento eliminado.', 'ok');
    await cargar();
  }

  function mostrarCatalogo(nuevo) {
    catalogo = nuevo;
    const c = CONFIG[catalogo];
    tabCategorias.classList.toggle('activa', catalogo === 'categorias');
    tabCategorias.setAttribute('aria-selected', String(catalogo === 'categorias'));
    tabPaises.classList.toggle('activa', catalogo === 'paises');
    tabPaises.setAttribute('aria-selected', String(catalogo === 'paises'));
    etiquetaNuevo.textContent = c.etiquetaNuevo;
    nombreNuevo.placeholder = c.placeholder;
    nombreNuevo.value = '';
    errorNuevo.textContent = '';
    notaCatalogo.textContent = c.notaEnUso;
    cargar();
  }

  tabCategorias.addEventListener('click', () => mostrarCatalogo('categorias'));
  tabPaises.addEventListener('click', () => mostrarCatalogo('paises'));

  formAlta.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const c = CONFIG[catalogo];
    const mensajeValidacion = Validaciones.validarNombreCatalogo(nombreNuevo.value, {
      etiqueta: catalogo === 'categorias' ? 'El nombre de la categoría' : 'El nombre del país',
      max: catalogo === 'categorias' ? 60 : 80,
    });
    errorNuevo.textContent = mensajeValidacion;
    if (mensajeValidacion) return;

    const respuesta = await Api.solicitar('POST', c.ruta, { nombre: nombreNuevo.value });
    if (!respuesta.ok) {
      const error = (respuesta.datos && respuesta.datos.error) || {};
      errorNuevo.textContent = (error.campos && error.campos.nombre) || error.mensaje || 'No se pudo agregar.';
      return;
    }
    nombreNuevo.value = '';
    await cargar();
  });

  (async function iniciar() {
    const usuario = await Sesion.requerir(['administrador']);
    if (!usuario) return;
    mostrarCatalogo('categorias');
  })();
})();
