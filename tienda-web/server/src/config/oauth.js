'use strict';

const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { perfilDesdeGoogle } = require('../utils/perfilOAuth');

/**
 * Configura Passport con dos estrategias de Google que solo se diferencian en la URL de retorno:
 * una para iniciar sesión y otra para registrarse. Ambas verifican el parámetro `state`
 * para evitar la falsificación de solicitudes en el inicio de sesión.
 */
function configurarOAuth({ passport, config, usuarios }) {
  const opciones = (ruta) => ({
    clientID: config.oauth.clientID,
    clientSecret: config.oauth.clientSecret,
    callbackURL: `${config.urlBase}${ruta}`,
    state: true,
  });

  const verificar = (accessToken, refreshToken, profile, done) => {
    try {
      done(null, perfilDesdeGoogle(profile));
    } catch (error) {
      done(error);
    }
  };

  passport.use('google-login', new GoogleStrategy(opciones('/api/auth/google/callback'), verificar));
  passport.use('google-registro', new GoogleStrategy(opciones('/api/auth/google/registro/callback'), verificar));

  // En la sesión solo se guarda el identificador del usuario.
  passport.serializeUser((usuario, done) => done(null, usuario.idUsuario));
  passport.deserializeUser(async (id, done) => {
    try {
      const usuario = await usuarios.buscarPorId(id);
      done(null, usuario && usuario.activo ? usuario : false);
    } catch (error) {
      done(error);
    }
  });
}

module.exports = { configurarOAuth };
