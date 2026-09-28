-- ===============================================================
-- Sistema de comercio electrónico - Ingeniería WEB
-- Esquema de base de datos para MySQL 8.0.16 o superior
-- (las restricciones CHECK se aplican a partir de esa versión)
-- La tabla sessions es la que usa express-mysql-session; se crea aquí para que la
-- aplicación no necesite permisos para crear tablas (RNF-13).
-- ===============================================================

CREATE DATABASE IF NOT EXISTS tienda_web CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE tienda_web;

-- Catálogo fijo de perfiles del sistema. No es editable porque el código depende de sus valores.
CREATE TABLE roles (
  id_rol TINYINT UNSIGNED NOT NULL,
  nombre VARCHAR(30) NOT NULL,
  PRIMARY KEY (id_rol),
  UNIQUE KEY uk_roles_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Datos de identidad y perfil de todos los usuarios del sistema.
CREATE TABLE usuarios (
  id_usuario INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_rol TINYINT UNSIGNED NOT NULL,
  correo VARCHAR(150) NOT NULL,
  nombres VARCHAR(80) NOT NULL,
  apellido_paterno VARCHAR(50) NOT NULL,
  apellido_materno VARCHAR(50) NULL,
  oauth_proveedor VARCHAR(20) NULL,
  oauth_id VARCHAR(100) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_alta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso DATETIME NULL,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uk_usuarios_correo (correo),
  CONSTRAINT fk_usuarios_id_rol FOREIGN KEY (id_rol) REFERENCES roles (id_rol) ON DELETE RESTRICT,
  UNIQUE KEY uk_usuarios_oauth (oauth_proveedor, oauth_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Datos fiscales del cliente. Extiende a usuarios (relación 1 a 1).
CREATE TABLE clientes (
  id_usuario INT UNSIGNED NOT NULL,
  rfc VARCHAR(13) NOT NULL,
  curp CHAR(18) NOT NULL,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uk_clientes_rfc (rfc),
  UNIQUE KEY uk_clientes_curp (curp),
  CONSTRAINT fk_clientes_id_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Catálogo de países para las direcciones. Administrable (CRUD).
CREATE TABLE paises (
  id_pais SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(80) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_pais),
  UNIQUE KEY uk_paises_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Direcciones de entrega del cliente. Una de ellas puede ser la principal.
CREATE TABLE direcciones (
  id_direccion INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario INT UNSIGNED NOT NULL,
  calle VARCHAR(100) NOT NULL,
  numero_exterior VARCHAR(10) NOT NULL,
  numero_interior VARCHAR(10) NULL,
  colonia VARCHAR(80) NOT NULL,
  codigo_postal VARCHAR(10) NOT NULL,
  municipio VARCHAR(80) NOT NULL,
  ciudad VARCHAR(80) NOT NULL,
  id_pais SMALLINT UNSIGNED NOT NULL,
  es_principal TINYINT(1) NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  clave_principal INT UNSIGNED GENERATED ALWAYS AS (IF(es_principal = 1 AND activo = 1, id_usuario, NULL)) STORED,
  PRIMARY KEY (id_direccion),
  CONSTRAINT fk_direcciones_id_usuario FOREIGN KEY (id_usuario) REFERENCES clientes (id_usuario) ON DELETE RESTRICT,
  CONSTRAINT fk_direcciones_id_pais FOREIGN KEY (id_pais) REFERENCES paises (id_pais) ON DELETE RESTRICT,
  UNIQUE KEY uk_direcciones_principal (clave_principal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Métodos de pago del cliente. Uno de ellos puede ser el principal. No se almacena el CVV.
CREATE TABLE metodos_pago (
  id_metodo_pago INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario INT UNSIGNED NOT NULL,
  titular VARCHAR(100) NOT NULL,
  numero_cifrado VARBINARY(255) NOT NULL,
  ultimos4 CHAR(4) NOT NULL,
  mes_vencimiento TINYINT UNSIGNED NOT NULL,
  anio_vencimiento SMALLINT UNSIGNED NOT NULL,
  es_principal TINYINT(1) NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  clave_principal INT UNSIGNED GENERATED ALWAYS AS (IF(es_principal = 1 AND activo = 1, id_usuario, NULL)) STORED,
  PRIMARY KEY (id_metodo_pago),
  CONSTRAINT fk_metodos_pago_id_usuario FOREIGN KEY (id_usuario) REFERENCES clientes (id_usuario) ON DELETE RESTRICT,
  UNIQUE KEY uk_metodos_pago_principal (clave_principal),
  CONSTRAINT ck_metodos_pago_mes CHECK (mes_vencimiento BETWEEN 1 AND 12)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Catálogo de categorías de producto. Administrable (CRUD).
CREATE TABLE categorias (
  id_categoria SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(60) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_categoria),
  UNIQUE KEY uk_categorias_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Productos a la venta. El identificador es de uso interno del sistema.
CREATE TABLE productos (
  id_producto INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT NULL,
  precio DECIMAL(10,2) NOT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  id_categoria SMALLINT UNSIGNED NOT NULL,
  dias_entrega SMALLINT UNSIGNED NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_alta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_producto),
  CONSTRAINT fk_productos_id_categoria FOREIGN KEY (id_categoria) REFERENCES categorias (id_categoria) ON DELETE RESTRICT,
  CONSTRAINT ck_productos_precio CHECK (precio >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Imágenes de cada producto, sin límite de cantidad.
CREATE TABLE imagenes_producto (
  id_imagen INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_producto INT UNSIGNED NOT NULL,
  ruta VARCHAR(255) NOT NULL,
  orden SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  fecha_alta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_imagen),
  CONSTRAINT fk_imagenes_producto_id_producto FOREIGN KEY (id_producto) REFERENCES productos (id_producto) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Calificación de 0 a 5 estrellas. Una por cliente y producto.
CREATE TABLE calificaciones (
  id_calificacion INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_producto INT UNSIGNED NOT NULL,
  id_usuario INT UNSIGNED NOT NULL,
  estrellas TINYINT UNSIGNED NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_calificacion),
  CONSTRAINT fk_calificaciones_id_producto FOREIGN KEY (id_producto) REFERENCES productos (id_producto) ON DELETE RESTRICT,
  CONSTRAINT fk_calificaciones_id_usuario FOREIGN KEY (id_usuario) REFERENCES clientes (id_usuario) ON DELETE RESTRICT,
  UNIQUE KEY uk_calificaciones (id_producto, id_usuario),
  CONSTRAINT ck_calificaciones_estrellas CHECK (estrellas BETWEEN 0 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Recomendaciones (comentarios) que los clientes escriben sobre un producto comprado.
CREATE TABLE recomendaciones (
  id_recomendacion INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_producto INT UNSIGNED NOT NULL,
  id_usuario INT UNSIGNED NOT NULL,
  texto VARCHAR(500) NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_recomendacion),
  CONSTRAINT fk_recomendaciones_id_producto FOREIGN KEY (id_producto) REFERENCES productos (id_producto) ON DELETE RESTRICT,
  CONSTRAINT fk_recomendaciones_id_usuario FOREIGN KEY (id_usuario) REFERENCES clientes (id_usuario) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Contenido del carrito de cada cliente. Un renglón por producto.
CREATE TABLE carrito_items (
  id_usuario INT UNSIGNED NOT NULL,
  id_producto INT UNSIGNED NOT NULL,
  cantidad INT UNSIGNED NOT NULL,
  fecha_agregado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario, id_producto),
  CONSTRAINT fk_carrito_items_id_usuario FOREIGN KEY (id_usuario) REFERENCES clientes (id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_carrito_items_id_producto FOREIGN KEY (id_producto) REFERENCES productos (id_producto) ON DELETE CASCADE,
  CONSTRAINT ck_carrito_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Catálogo fijo de estatus de pedido. No es editable porque el flujo del sistema depende de él.
CREATE TABLE estatus_pedido (
  id_estatus TINYINT UNSIGNED NOT NULL,
  nombre VARCHAR(20) NOT NULL,
  PRIMARY KEY (id_estatus),
  UNIQUE KEY uk_estatus_pedido_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Pedidos generados por los clientes. Guarda una copia de la dirección y de la tarjeta usadas.
CREATE TABLE pedidos (
  id_pedido INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario INT UNSIGNED NOT NULL,
  id_direccion INT UNSIGNED NULL,
  id_metodo_pago INT UNSIGNED NULL,
  direccion_envio VARCHAR(500) NOT NULL,
  tarjeta_ultimos4 CHAR(4) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  id_estatus TINYINT UNSIGNED NOT NULL DEFAULT 1,
  fecha_pedido DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_pago DATETIME NULL,
  fecha_envio DATETIME NULL,
  fecha_recepcion DATETIME NULL,
  PRIMARY KEY (id_pedido),
  CONSTRAINT fk_pedidos_id_usuario FOREIGN KEY (id_usuario) REFERENCES clientes (id_usuario) ON DELETE RESTRICT,
  CONSTRAINT fk_pedidos_id_direccion FOREIGN KEY (id_direccion) REFERENCES direcciones (id_direccion) ON DELETE SET NULL,
  CONSTRAINT fk_pedidos_id_metodo_pago FOREIGN KEY (id_metodo_pago) REFERENCES metodos_pago (id_metodo_pago) ON DELETE SET NULL,
  CONSTRAINT fk_pedidos_id_estatus FOREIGN KEY (id_estatus) REFERENCES estatus_pedido (id_estatus) ON DELETE RESTRICT,
  CONSTRAINT ck_pedidos_total CHECK (total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Productos de cada pedido, con el precio vigente al momento de la compra.
CREATE TABLE pedido_detalle (
  id_detalle INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_pedido INT UNSIGNED NOT NULL,
  id_producto INT UNSIGNED NOT NULL,
  cantidad INT UNSIGNED NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id_detalle),
  CONSTRAINT fk_pedido_detalle_id_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos (id_pedido) ON DELETE CASCADE,
  CONSTRAINT fk_pedido_detalle_id_producto FOREIGN KEY (id_producto) REFERENCES productos (id_producto) ON DELETE RESTRICT,
  CONSTRAINT ck_detalle_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Avisos al usuario, como la notificación de envío de un pedido.
CREATE TABLE notificaciones (
  id_notificacion INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario INT UNSIGNED NOT NULL,
  id_pedido INT UNSIGNED NULL,
  mensaje VARCHAR(255) NOT NULL,
  leida TINYINT(1) NOT NULL DEFAULT 0,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_notificacion),
  CONSTRAINT fk_notificaciones_id_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_notificaciones_id_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos (id_pedido) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Registro de eventos relevantes: inicios de sesión, cambios de estatus y operaciones administrativas.
CREATE TABLE bitacora (
  id_bitacora BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario INT UNSIGNED NULL,
  accion VARCHAR(50) NOT NULL,
  entidad VARCHAR(50) NULL,
  id_entidad INT UNSIGNED NULL,
  detalle VARCHAR(500) NULL,
  ip VARCHAR(45) NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_bitacora),
  CONSTRAINT fk_bitacora_id_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Sesiones de usuario (esquema que espera express-mysql-session)
CREATE TABLE sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ---------------------------------------------------------------
-- Datos iniciales (catálogos fijos y país por defecto)
-- ---------------------------------------------------------------
INSERT INTO roles (id_rol, nombre) VALUES
  (1, 'administrador'), (2, 'cliente'), (3, 'inventarios');

INSERT INTO estatus_pedido (id_estatus, nombre) VALUES
  (1, 'En proceso'), (2, 'Pagada'), (3, 'Enviado'), (4, 'Recibido');

INSERT INTO paises (nombre) VALUES ('México');

-- ---------------------------------------------------------------
-- Vista para el reporte de ventas por categoría y mes.
-- Se consideran los pedidos pagados o posteriores (estatus >= 2).
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW vw_ventas_categoria_mes AS
SELECT DATE_FORMAT(p.fecha_pedido, '%Y-%m') AS mes,
       c.id_categoria,
       c.nombre                             AS categoria,
       SUM(d.cantidad)                      AS unidades,
       SUM(d.cantidad * d.precio_unitario)  AS importe
FROM pedidos p
JOIN pedido_detalle d ON d.id_pedido = p.id_pedido
JOIN productos pr     ON pr.id_producto = d.id_producto
JOIN categorias c     ON c.id_categoria = pr.id_categoria
WHERE p.id_estatus >= 2
GROUP BY DATE_FORMAT(p.fecha_pedido, '%Y-%m'), c.id_categoria, c.nombre;
