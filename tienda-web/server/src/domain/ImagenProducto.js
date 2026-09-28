'use strict';

/** Imagen de un producto. `ruta` es el nombre del archivo en el almacén de imágenes. */
class ImagenProducto {
  constructor({ idImagen, idProducto = null, ruta, orden = 0, fechaAlta = null }) {
    this.idImagen = idImagen;
    this.idProducto = idProducto;
    this.ruta = ruta;
    this.orden = orden;
    this.fechaAlta = fechaAlta;
  }

  url() {
    return `/imagenes/${this.ruta}`;
  }

  paraJSON() {
    return { idImagen: this.idImagen, url: this.url(), orden: this.orden };
  }
}

module.exports = ImagenProducto;
