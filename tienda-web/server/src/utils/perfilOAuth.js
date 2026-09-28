'use strict';

const { NoAutorizadoError } = require('../errors/errores');

/** Convierte el perfil que entrega Google en los datos mínimos que usa el sistema. */
function perfilDesdeGoogle(profile) {
  const correo = profile?.emails?.[0]?.value;
  const verificado = profile?._json?.email_verified ?? profile?.emails?.[0]?.verified;

  if (!correo) {
    throw new NoAutorizadoError('Google no entregó un correo para tu cuenta.', 'OAUTH_SIN_CORREO');
  }
  if (verificado === false || verificado === 'false') {
    throw new NoAutorizadoError('El correo de tu cuenta de Google no está verificado.', 'OAUTH_CORREO_NO_VERIFICADO');
  }

  return {
    proveedor: 'google',
    id: String(profile.id),
    correo: correo.trim().toLowerCase(),
    nombres: profile.name?.givenName ?? '',
    apellidos: profile.name?.familyName ?? '',
  };
}

module.exports = { perfilDesdeGoogle };
