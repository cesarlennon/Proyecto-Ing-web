'use strict';

const { NoEncontradoError, ReglaNegocioError, ValidacionError } = require('../errors/errores');
const { validarCatalogo } = require('../utils/validaciones');

/** Datos propios de cada catálogo administrable (RF-12). */
const CATALOGOS = {
  categorias: {
    evento: 'categoria',
    etiqueta: 'El nombre de la categoría',
    max: 60,
    enUso: 'tieneProductos',
    mensajeEnUso: 'No se puede eliminar una categoría con productos asociados. Cambia esos productos de categoría primero.',
    duplicado: 'Ya existe una categoría con ese nombre.',
  },
  paises: {
    evento: 'pais',
    etiqueta: 'El nombre del país',
    max: 80,
    enUso: 'tieneDirecciones',
    mensajeEnUso: 'No se puede eliminar un país que tiene direcciones registradas. Desactívalo en su lugar.',
    duplicado: 'Ya existe un país con ese nombre.',
  },
};

/** CRUD de los catálogos del sistema: categorías y países (CU-08). */
class CatalogoService {
  constructor({ categorias, paises, bitacora }) {
    this.repositorios = { categorias, paises };
    this.bitacora = bitacora;
  }

  configuracion(catalogo) {
    const datos = Object.hasOwn(CATALOGOS, catalogo) ? CATALOGOS[catalogo] : null;
    if (!datos) throw new NoEncontradoError('Catálogo no encontrado.');
    return { ...datos, repo: this.repositorios[catalogo] };
  }

  async exigirElemento(c, id) {
    const elemento = await c.repo.buscarPorId(id);
    if (!elemento) throw new NoEncontradoError('El elemento no existe.');
    return elemento;
  }

  async listar(catalogo, { incluirInactivos = false } = {}) {
    const { repo } = this.configuracion(catalogo);
    return repo.listarTodas({ incluirInactivas: incluirInactivos });
  }

  async crear(catalogo, datos, usuario, ip = null) {
    const c = this.configuracion(catalogo);
    const { errores, valores } = validarCatalogo(datos, { etiqueta: c.etiqueta, max: c.max });
    if (Object.keys(errores).length > 0) throw new ValidacionError(errores);

    let id;
    try {
      id = await c.repo.crear({ nombre: valores.nombre, activo: valores.activo === false ? 0 : 1 });
    } catch (error) {
      throw this.traducir(error, c);
    }
    await this.bitacora.registrar(usuario.idUsuario, `${c.evento}_crear`, catalogo, id, valores.nombre, ip);
    return c.repo.buscarPorId(id);
  }

  async actualizar(catalogo, id, datos, usuario, ip = null) {
    const c = this.configuracion(catalogo);
    const { errores, valores } = validarCatalogo(datos, { etiqueta: c.etiqueta, max: c.max, parcial: true });
    if (Object.keys(errores).length > 0) throw new ValidacionError(errores);
    if (Object.keys(valores).length === 0) throw new ValidacionError({}, 'No hay cambios que guardar.');
    await this.exigirElemento(c, id);

    const cambios = {};
    if (valores.nombre !== undefined) cambios.nombre = valores.nombre;
    if (valores.activo !== undefined) cambios.activo = valores.activo ? 1 : 0;

    try {
      await c.repo.actualizar(id, cambios);
    } catch (error) {
      throw this.traducir(error, c);
    }
    await this.bitacora.registrar(usuario.idUsuario, `${c.evento}_actualizar`, catalogo, id, JSON.stringify(cambios), ip);
    return c.repo.buscarPorId(id);
  }

  async eliminar(catalogo, id, usuario, ip = null) {
    const c = this.configuracion(catalogo);
    const elemento = await this.exigirElemento(c, id);
    if (await c.repo[c.enUso](id)) throw new ReglaNegocioError(c.mensajeEnUso, 'CATALOGO_EN_USO');

    try {
      await c.repo.eliminar(id);
    } catch (error) {
      throw this.traducir(error, c);
    }
    await this.bitacora.registrar(usuario.idUsuario, `${c.evento}_eliminar`, catalogo, id, elemento.nombre, ip);
  }

  /** Convierte los errores de llave de MySQL en mensajes comprensibles. */
  traducir(error, c) {
    if (error && error.code === 'ER_DUP_ENTRY') return new ValidacionError({ nombre: c.duplicado }, c.duplicado);
    if (error && error.code === 'ER_ROW_IS_REFERENCED_2') return new ReglaNegocioError(c.mensajeEnUso, 'CATALOGO_EN_USO');
    return error;
  }
}

module.exports = CatalogoService;
