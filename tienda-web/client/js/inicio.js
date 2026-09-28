/* Pantalla de inicio de cada perfil: exige sesión y el rol indicado en <body data-rol="..."> */
(function () {
  Sesion.requerir([document.body.dataset.rol]);
})();
