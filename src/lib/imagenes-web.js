// Imágenes "de la web" (portada, secciones) que se pueden cambiar desde el panel.
// Se guardan en KV como web:<clave>; si no hay ninguna, se sirve la de public/img/v2/<clave>.webp.
export const CLAVES = {
  hero: 'Portada (foto grande de arriba)',
  llaves: 'Vende tu coche (entrega de llaves)',
  importacion: 'Importación / encargo a medida',
  financiacion: 'Financiación',
  taller: 'Garantía (servicios)',
  acompanamiento: 'Gestión de venta (servicios)',
  nosotros: 'Sobre nosotros',
};
export const urlImagenWeb = (clave) => `/img-web/${clave}.webp`;
