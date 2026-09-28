/* Actualiza el número junto a «Carrito» en el menú, si la sesión es de un cliente. */
(function () {
  async function actualizar() {
    const insignia = document.getElementById('contador-carrito');
    if (!insignia) return;
    const respuesta = await Api.solicitar('GET', '/api/carrito');
    if (!respuesta.ok) return;
    const cantidad = respuesta.datos.items.reduce((suma, i) => suma + i.cantidad, 0);
    insignia.textContent = cantidad > 0 ? ' (' + cantidad + ')' : '';
  }
  document.addEventListener('carrito:actualizado', actualizar);
  actualizar();
})();
