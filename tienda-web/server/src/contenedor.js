'use strict';

const passport = require('passport');
const { ConexionBD } = require('./config/bd');
const { configurarOAuth } = require('./config/oauth');
const { crearSesion } = require('./middleware/sesion');
const { crearLimitadorAuth } = require('./middleware/seguridad');
const { crearSubidaImagenes } = require('./middleware/subida');
const UsuarioRepository = require('./repositories/UsuarioRepository');
const ClienteRepository = require('./repositories/ClienteRepository');
const BitacoraRepository = require('./repositories/BitacoraRepository');
const CategoriaRepository = require('./repositories/CategoriaRepository');
const PaisRepository = require('./repositories/PaisRepository');
const ProductoRepository = require('./repositories/ProductoRepository');
const ImagenRepository = require('./repositories/ImagenRepository');
const CalificacionRepository = require('./repositories/CalificacionRepository');
const RecomendacionRepository = require('./repositories/RecomendacionRepository');
const DireccionRepository = require('./repositories/DireccionRepository');
const MetodoPagoRepository = require('./repositories/MetodoPagoRepository');
const CarritoRepository = require('./repositories/CarritoRepository');
const PedidoRepository = require('./repositories/PedidoRepository');
const AlmacenImagenes = require('./services/AlmacenImagenes');
const CatalogoService = require('./services/CatalogoService');
const ProductoService = require('./services/ProductoService');
const ImagenService = require('./services/ImagenService');
const CifradoService = require('./services/CifradoService');
const DireccionService = require('./services/DireccionService');
const MetodoPagoService = require('./services/MetodoPagoService');
const CarritoService = require('./services/CarritoService');
const InventarioService = require('./services/InventarioService');
const PagoSimuladoService = require('./services/PagoSimuladoService');
const PedidoService = require('./services/PedidoService');
const UsuarioService = require('./services/UsuarioService');
const CalificacionService = require('./services/CalificacionService');
const RecomendacionService = require('./services/RecomendacionService');
const CatalogoController = require('./controllers/CatalogoController');
const ProductoController = require('./controllers/ProductoController');
const ClienteController = require('./controllers/ClienteController');
const CarritoController = require('./controllers/CarritoController');
const PedidoController = require('./controllers/PedidoController');
const UsuarioController = require('./controllers/UsuarioController');
const ResenaController = require('./controllers/ResenaController');
const BitacoraService = require('./services/BitacoraService');
const AuthService = require('./services/AuthService');
const AuthController = require('./controllers/AuthController');

/**
 * Crea las clases y les inyecta sus dependencias (inyección por constructor).
 * Es el único lugar donde se conocen todas las clases concretas.
 */
function construirContenedor(config, logger) {
  const bd = ConexionBD.crear(config.bd);

  const usuarios = new UsuarioRepository(bd);
  const clientes = new ClienteRepository(bd);
  const bitacoraRepo = new BitacoraRepository(bd);
  const categorias = new CategoriaRepository(bd);
  const paises = new PaisRepository(bd);
  const productos = new ProductoRepository(bd);
  const imagenes = new ImagenRepository(bd);
  const calificacionesRepo = new CalificacionRepository(bd);
  const recomendacionesRepo = new RecomendacionRepository(bd);
  const direcciones = new DireccionRepository(bd);
  const metodosPago = new MetodoPagoRepository(bd);
  const carritoRepo = new CarritoRepository(bd);
  const pedidosRepo = new PedidoRepository(bd);

  const bitacora = new BitacoraService({ bitacora: bitacoraRepo, logger });
  const almacen = new AlmacenImagenes(config.rutaImagenes);
  const cifrado = new CifradoService(config.cifradoClave);

  const authService = new AuthService({ bd, usuarios, clientes, bitacora });
  const catalogoService = new CatalogoService({ categorias, paises, bitacora });
  const productoService = new ProductoService({ productos, categorias, imagenes, almacen, bitacora, logger });
  const imagenService = new ImagenService({ imagenes, productos, almacen, bitacora, logger });
  const direccionService = new DireccionService({ bd, direcciones, paises, bitacora });
  const metodoPagoService = new MetodoPagoService({ bd, metodosPago, cifrado, bitacora });
  const carritoService = new CarritoService({ carrito: carritoRepo, productos });
  const inventarioService = new InventarioService({ productos });
  const pagoSimuladoService = new PagoSimuladoService();
  const pedidoService = new PedidoService({
    bd, pedidos: pedidosRepo, carritoRepo, direcciones, metodosPago,
    inventario: inventarioService, pagos: pagoSimuladoService, bitacora,
  });
  const usuarioService = new UsuarioService({ usuarios, bitacora });
  const calificacionService = new CalificacionService({ calificaciones: calificacionesRepo, productos, pedidos: pedidosRepo, bitacora });
  const recomendacionService = new RecomendacionService({ recomendaciones: recomendacionesRepo, productos, pedidos: pedidosRepo, bitacora });

  configurarOAuth({ passport, config, usuarios });
  const controladores = {
    auth: new AuthController({ authService, passport, nombreCookie: config.sesion.nombreCookie }),
    catalogo: new CatalogoController({ catalogoService }),
    producto: new ProductoController({ productoService, imagenService }),
    cliente: new ClienteController({ direccionService, metodoPagoService }),
    carrito: new CarritoController({ carritoService }),
    pedido: new PedidoController({ pedidoService }),
    usuario: new UsuarioController({ usuarioService }),
    resena: new ResenaController({ calificacionService, recomendacionService }),
  };

  return {
    bd,
    logger,
    passport,
    sesion: crearSesion(config, bd.pool),
    controladores,
    limitadorAuth: crearLimitadorAuth(),
    subidaImagenes: crearSubidaImagenes(),
  };
}

module.exports = { construirContenedor };
