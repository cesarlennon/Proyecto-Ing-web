'use strict';

/*
 * Crea el primer usuario administrador. Después inicia sesión con la cuenta de Google que
 * tenga ese mismo correo.
 *
 * Uso: npm run crear-admin -- correo@ejemplo.com "Nombres" "Apellido paterno" ["Apellido materno"]
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Configuracion = require('../src/config/configuracion');
const { ConexionBD } = require('../src/config/bd');
const UsuarioRepository = require('../src/repositories/UsuarioRepository');
const { ROLES } = require('../src/domain/Rol');
const V = require('../src/utils/validaciones');

async function principal() {
  const [correo, nombres, apellidoPaterno, apellidoMaterno] = process.argv.slice(2);
  if (!correo || !nombres || !apellidoPaterno) {
    console.error('Uso: npm run crear-admin -- correo@ejemplo.com "Nombres" "Apellido paterno" ["Apellido materno"]');
    process.exit(1);
  }

  const errores = [
    V.validarCorreo(correo),
    V.validarNombre(nombres, { etiqueta: 'El nombre' }),
    V.validarNombre(apellidoPaterno, { etiqueta: 'El apellido paterno', max: 50 }),
    V.validarNombre(apellidoMaterno, { etiqueta: 'El apellido materno', obligatorio: false, max: 50 }),
  ].filter(Boolean);
  if (errores.length > 0) {
    console.error(errores.join('\n'));
    process.exit(1);
  }

  const config = Configuracion.cargar();
  const bd = ConexionBD.crear(config.bd);
  const usuarios = new UsuarioRepository(bd);

  try {
    const correoNormalizado = V.limpiar(correo).toLowerCase();
    if (await usuarios.buscarPorCorreo(correoNormalizado)) {
      console.error(`Ya existe un usuario con el correo ${correoNormalizado}.`);
      process.exit(1);
    }
    const id = await usuarios.crearUsuario({
      rol: ROLES.ADMINISTRADOR,
      correo: correoNormalizado,
      nombres: V.limpiar(nombres),
      apellidoPaterno: V.limpiar(apellidoPaterno),
      apellidoMaterno: V.limpiar(apellidoMaterno) || null,
    });
    console.log(`Administrador creado (id ${id}). Inicia sesión con la cuenta de Google ${correoNormalizado}.`);
  } finally {
    await bd.cerrar();
  }
}

principal().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
