/*
 * Utilidades compartidas por las pantallas de administración e inventarios que listan
 * productos en una tabla con búsqueda y paginación.
 */
const TablaProductos = (() => {
  async function cargarCategorias(select) {
    const respuesta = await Api.solicitar('GET', '/api/categorias');
    Dom.vaciar(select);
    select.appendChild(Dom.el('option', { texto: 'Todas las categorías', atributos: { value: '' } }));
    if (!respuesta.ok) return;
    respuesta.datos.elementos.forEach((c) => {
      select.appendChild(Dom.el('option', { texto: c.nombre, atributos: { value: String(c.idCategoria) } }));
    });
  }

  function insignia(activo) {
    return Dom.el('span', { clase: 'insignia ' + (activo ? 'insignia-ok' : 'insignia-inactivo'), texto: activo ? 'Activo' : 'Inactivo' });
  }

  return { cargarCategorias, insignia };
})();
