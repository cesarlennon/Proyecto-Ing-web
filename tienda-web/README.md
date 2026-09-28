# TiendaWeb: sistema de comercio electrónico

Proyecto final de **Ingeniería WEB**. Sitio de e-commerce de venta genérica de productos con tres perfiles
(Administrador, Cliente y Personal de inventarios), desarrollado con **Node.js + Express**, **MySQL** y
**JavaScript** en el navegador.

## Estado actual

| Módulo | Estado |
|---|---|
| Estructura del repositorio, configuración y conexión a MySQL | Listo |
| Inicio de sesión con OAuth 2.0 (Google) y cierre de sesión (CU-02, CU-03) | Listo |
| Registro de clientes con validación en el navegador y en el servidor (CU-11) | Listo |
| Sesiones, control de acceso por perfil, protección CSRF, cabeceras de seguridad, bitácora | Listo |
| Catálogos de categorías y países, con CRUD para el administrador (CU-08) | Listo |
| Productos: consulta, filtro por categoría, alta, edición, precio, stock, entrega estimada (CU-06, CU-09, CU-14, CU-15, CU-21 a CU-23) | Listo |
| Imágenes de producto, sin límite por producto (CU-07) | Listo |
| Direcciones y métodos de pago del cliente, con cifrado de la tarjeta (CU-12, CU-13) | Listo |
| Carrito de compras (CU-16) y compra con pago simulado, en una transacción (CU-17, CU-26, CU-28) | Listo |
| Seguimiento de pedidos del cliente (CU-18) | Listo |
| Usuarios: alta de administrador y personal de inventarios, edición, baja y alta (CU-05) | Listo |
| Calificaciones y recomendaciones de producto, solo tras recibir el pedido (CU-19, CU-20, CU-27) | Listo |
| Pantallas: catálogo, detalle (con calificar/recomendar), carrito, confirmar compra, mis pedidos y mi cuenta (cliente); productos, catálogos y usuarios (administrador); inventario (personal de inventarios) | Listo |
| Reporte de ventas y cambio de estatus de pedido (administrador / personal de inventarios) | Pendiente |

## Requisitos

- Node.js 20 o superior
- MySQL 8.0.16 o superior (las restricciones CHECK se aplican desde esa versión)
- Una cuenta de Google para crear las credenciales de OAuth

## Estructura

```
tienda-web/
├── docs/                    documentación del proyecto (SRS, casos de uso, arquitectura, maquetado, clases)
├── database/
│   └── schema.sql           esquema, datos iniciales y tabla de sesiones
├── server/
│   ├── src/
│   │   ├── server.js        arranque del servidor
│   │   ├── app.js           configuración de Express
│   │   ├── contenedor.js    crea las clases e inyecta sus dependencias
│   │   ├── config/          variables de entorno, MySQL y OAuth
│   │   ├── middleware/      sesión, control de acceso, CSRF, errores, seguridad
│   │   ├── routes/          rutas de la API
│   │   ├── controllers/     reciben las peticiones HTTP
│   │   ├── services/        reglas de negocio
│   │   ├── repositories/    consultas SQL
│   │   ├── domain/          clases del dominio (Usuario y sus perfiles)
│   │   ├── errors/          jerarquía de errores
│   │   └── utils/
│   ├── scripts/crearAdmin.js
│   ├── tests/unit/          pruebas unitarias
│   ├── uploads/             imágenes en desarrollo (no se versiona)
│   ├── .env.example
│   └── package.json
├── client/
│   ├── index.html           página inicial (landing page)
│   ├── login.html, registro.html, aviso-privacidad.html
│   ├── css/, js/
│   └── pages/               pantallas por perfil: admin/, cliente/ e inventarios/
└── README.md
```

Las reglas de validación están en `client/js/validaciones.js`. El navegador las usa para validar los
formularios con JavaScript y el servidor las vuelve a aplicar antes de guardar, de modo que ambos usan
exactamente las mismas.

## Puesta en marcha

### 1. Crear la base de datos

```bash
mysql -u root -p < database/schema.sql
```

Después crea un usuario para la aplicación con los permisos mínimos (RNF-13):

```sql
CREATE USER 'tienda_app'@'localhost' IDENTIFIED BY 'cambia_esta_clave';
GRANT SELECT, INSERT, UPDATE, DELETE ON tienda_web.* TO 'tienda_app'@'localhost';
```

### 2. Crear las credenciales de Google

Los nombres de los menús de Google Cloud pueden variar un poco, pero los pasos son estos:

1. Entra a <https://console.cloud.google.com/> y crea un proyecto.
2. En **APIs y servicios > Pantalla de consentimiento de OAuth**, elige el tipo **Externo** y captura el nombre
   de la aplicación y un correo de soporte. En **Usuarios de prueba** agrega los correos con los que vas a probar:
   mientras la aplicación esté en modo de prueba, solo esas cuentas podrán iniciar sesión.
3. En **Credenciales > Crear credenciales > ID de cliente de OAuth**, elige **Aplicación web**.
4. En **URI de redireccionamiento autorizados** agrega estas dos direcciones (cambia el dominio en el servidor en la nube):
   - `http://localhost:3000/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/registro/callback`
5. Copia el ID de cliente y el secreto.

### 3. Configurar el servidor

```bash
cd server
cp .env.example .env
```

Edita `.env` con los datos de MySQL, las credenciales de Google y un secreto de sesión. Para generar el secreto:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 4. Instalar, crear el administrador y arrancar

```bash
npm install
npm run crear-admin -- tu.correo@gmail.com "Nombres" "Apellido paterno" "Apellido materno"
npm start
```

Abre <http://localhost:3000>. Inicia sesión con la cuenta de Google cuyo correo usaste al crear el administrador.
Los clientes se registran por su cuenta desde el botón **Registrarse**.

### 5. Pruebas

```bash
npm test
```

Usa el ejecutor de pruebas integrado de Node (`node:test`), sin dependencias adicionales.

## Rutas de la API implementadas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/auth/google` | Inicia el flujo de OAuth para iniciar sesión |
| GET | `/api/auth/google/callback` | Regreso de Google al iniciar sesión |
| GET | `/api/auth/google/registro` | Inicia el flujo de OAuth para registrarse |
| GET | `/api/auth/google/registro/callback` | Regreso de Google al registrarse |
| GET | `/api/auth/registro/pendiente` | Datos de la identidad verificada para prellenar el registro |
| POST | `/api/auth/registro` | Crea la cuenta de un cliente |
| GET | `/api/auth/sesion` | Datos del usuario con sesión activa |
| GET | `/api/auth/csrf` | Token CSRF para las peticiones que modifican datos |
| POST | `/api/auth/logout` | Cierra la sesión |
| GET | `/api/categorias`, `/api/paises` | Lista un catálogo (todos los perfiles) |
| POST/PUT/DELETE | `/api/categorias[/:id]`, `/api/paises[/:id]` | CRUD del catálogo (administrador) |
| GET | `/api/productos` | Lista productos con filtro por categoría, búsqueda y paginación |
| GET | `/api/productos/:id` | Detalle de un producto |
| POST/PUT/DELETE | `/api/productos[/:id]` | Alta, edición y baja de un producto (administrador) |
| PATCH | `/api/productos/:id/precio`, `/stock`, `/entrega` | Cambia precio, stock o entrega estimada |
| POST | `/api/productos/:id/imagenes` | Sube imágenes (multipart, campo `imagenes`, hasta 10 por solicitud) |
| DELETE | `/api/productos/:id/imagenes/:idImagen` | Elimina una imagen |
| GET/POST | `/api/mis-direcciones` | Lista o agrega una dirección del cliente en sesión |
| PUT/DELETE | `/api/mis-direcciones/:id` | Edita o da de baja una dirección propia |
| PATCH | `/api/mis-direcciones/:id/principal` | La marca como dirección principal |
| GET/POST | `/api/mis-metodos-pago` | Lista o agrega un método de pago del cliente en sesión |
| PUT/DELETE | `/api/mis-metodos-pago/:id` | Edita o da de baja un método de pago propio |
| PATCH | `/api/mis-metodos-pago/:id/principal` | Lo marca como método principal |
| GET/POST | `/api/carrito` | Consulta el carrito o agrega un producto |
| PUT/DELETE | `/api/carrito/:idProducto` | Cambia la cantidad o quita un producto del carrito |
| POST | `/api/mis-pedidos` | Genera un pedido a partir del carrito (compra con pago simulado) |
| GET | `/api/mis-pedidos`, `/api/mis-pedidos/:id` | Lista los pedidos propios o el detalle de uno |
| GET | `/api/pedidos?fecha=AAAA-MM-DD` | Ventas de un día (administrador o personal de inventarios) |
| GET | `/api/usuarios?rol=` | Lista usuarios, opcionalmente filtrados por perfil (administrador) |
| POST | `/api/usuarios` | Da de alta un administrador o personal de inventarios (el cliente se autoregistra) |
| PUT | `/api/usuarios/:id` | Edita nombre y apellidos de un usuario |
| PATCH | `/api/usuarios/:id/estado` | Da de baja o reactiva la cuenta |
| PUT | `/api/productos/:id/calificacion` | Guarda o actualiza la calificación propia (0 a 5 estrellas) |
| GET | `/api/productos/:id/calificacion` | Devuelve la calificación propia y si el cliente puede calificar (ya recibió el producto) |
| GET | `/api/productos/:id/recomendaciones` | Lista las recomendaciones del producto |
| POST | `/api/productos/:id/recomendaciones` | Publica una recomendación (solo si ya recibió el producto) |

Toda petición que no sea de lectura debe enviar el token en el encabezado `X-CSRF-Token`
(`client/js/api.js` lo hace automáticamente).

## Seguridad

- Sin contraseñas: la identidad se verifica con OAuth y solo se guarda el identificador del proveedor.
- Cookies de sesión `HttpOnly`, `Secure` (en producción) y `SameSite=Lax`, con expiración por inactividad.
- Consultas SQL siempre parametrizadas; los nombres de columna se validan contra una lista permitida.
- Política de contenido (CSP) que no permite scripts ni estilos en línea.
- Límite de peticiones en las rutas de acceso y token CSRF en las que modifican datos.
- Los errores devuelven mensajes genéricos; el detalle solo queda en el registro del servidor.
- Los secretos viven en `server/.env`, que está en `.gitignore`.

## Control de versiones y entrega

```bash
git init
git add .
git commit -m "Estructura inicial: acceso con OAuth"
git branch -M main
git remote add origin <URL-del-repositorio>
git push -u origin main
```

Comparte el enlace del repositorio o agrega la cuenta `upiita45@gmail.com` como colaborador (Settings > Collaborators
en GitHub). La documentación está en la carpeta `docs/`.
