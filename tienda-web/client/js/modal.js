/*
 * Ventana de confirmación para las operaciones delicadas (RF-05, CU-04).
 * Devuelve una promesa que se resuelve con true si el usuario confirma y con false si cancela.
 */
const Modal = (() => {
  function confirmar(opciones) {
    const o = opciones || {};
    return new Promise((resolver) => {
      const anterior = document.activeElement;
      const fondo = Dom.el('div', { clase: 'modal-fondo' });
      const dialogo = Dom.el('div', {
        clase: 'modal',
        atributos: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-titulo' },
      });
      const cancelar = Dom.el('button', { clase: 'boton boton-secundario', texto: 'Cancelar', atributos: { type: 'button' } });
      const aceptar = Dom.el('button', {
        clase: 'boton ' + (o.peligro ? 'boton-peligro' : 'boton-primario'),
        texto: o.textoConfirmar || 'Aceptar',
        atributos: { type: 'button' },
      });

      function cerrar(resultado) {
        document.removeEventListener('keydown', alTeclear);
        document.body.removeChild(fondo);
        if (anterior && typeof anterior.focus === 'function') anterior.focus();
        resolver(resultado);
      }
      function alTeclear(evento) {
        if (evento.key === 'Escape') cerrar(false);
      }

      cancelar.addEventListener('click', () => cerrar(false));
      aceptar.addEventListener('click', () => cerrar(true));
      fondo.addEventListener('click', (evento) => {
        if (evento.target === fondo) cerrar(false);
      });
      document.addEventListener('keydown', alTeclear);

      dialogo.appendChild(Dom.el('h2', { texto: o.titulo || '¿Confirmar la operación?', atributos: { id: 'modal-titulo' } }));
      dialogo.appendChild(Dom.el('p', { texto: o.mensaje || '' }));
      dialogo.appendChild(Dom.el('div', { clase: 'acciones-modal' }, [cancelar, aceptar]));
      fondo.appendChild(dialogo);
      document.body.appendChild(fondo);
      cancelar.focus();
    });
  }

  return { confirmar };
})();
