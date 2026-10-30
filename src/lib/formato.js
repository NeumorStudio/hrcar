// Formatos de precios y kilómetros (es-ES).
// Los miles se agrupan siempre ("9.995 €", "9.000 km"), como en los portales de coches. La web de Arbicars ponía
// "9995 €" (es-ES no agrupa los números de 4 cifras) y quedaba desigual al lado de "26.000 €".
import { motor } from './nombres.js';

const miles = (n) => String(Math.round(Math.abs(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const eurosMiles = (n) => `${Number(n) < 0 ? '-' : ''}${miles(n)}\u00a0€`; // espacio irrompible antes del €
export const kmsMiles = (n) => `${miles(n)} km`;
export const euros = (n) => eurosMiles(n ?? 0);
export const kms = (n) => kmsMiles(n ?? 0);

export const escapar = (texto) =>
  String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Precio que cuenta para filtrar y ordenar: el de oferta si lo hay. */
export const precioFinal = (c) => c.precio_oferta ?? c.precio ?? 0;

/** Lo que pone la etiqueta de la tarjeta: el estado si no está disponible; si no, el tipo. */
export const distintivo = (c) => (c.estado === 'Disponible' ? c.tipo : c.estado);

export const subtitulo = (c) =>
  [c.ubicacion, c.anio, c.km != null ? kms(c.km) : null, motor(c.combustible), c.cambio]
    .filter((x) => x !== null && x !== undefined && x !== '')
    .join(' · ');

export const SIN_FOTO = 'covered-car.webp';
export const tieneFotos = (c) => c.fotos.length > 0 && c.fotos[0] !== SIN_FOTO;

/** Los vendidos van al final del listado; el resto mantiene el orden de coches.json. */
export const ordenListado = (coches) => [
  ...coches.filter((c) => c.estado !== 'Vendido'),
  ...coches.filter((c) => c.estado === 'Vendido'),
];
