'use strict';

const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

/**
 * Sesiones con cookie HttpOnly, Secure (en producción) y SameSite=Lax (RF-03, RNF-06).
 * Lax es necesario para que la cookie viaje cuando Google regresa al usuario al sitio.
 * La tabla `sessions` se crea con database/schema.sql, de modo que la aplicación no
 * necesita permisos para crear tablas (RNF-13).
 */
function crearSesion(configuracion, pool) {
  const duracion = configuracion.sesion.minutosInactividad * 60 * 1000;
  const almacen = new MySQLStore(
    {
      createDatabaseTable: false,
      expiration: duracion,
      checkExpirationInterval: 15 * 60 * 1000,
    },
    pool,
  );

  return session({
    name: configuracion.sesion.nombreCookie,
    secret: configuracion.sesion.secreto,
    store: almacen,
    resave: false,
    saveUninitialized: false,
    rolling: true, // la sesión expira por inactividad, no por tiempo total
    cookie: {
      httpOnly: true,
      secure: configuracion.produccion,
      sameSite: 'lax',
      maxAge: duracion,
    },
  });
}

module.exports = { crearSesion };
