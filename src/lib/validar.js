// Valida y normaliza lo que llega del formulario del panel antes de guardarlo.
import { ESTADOS, TIPOS } from './datos.js';
import { tituloLimpio } from './nombres.js';

const texto = (v, max = 200) => (v == null ? null : String(v).trim().slice(0, max) || null);
const entero = (v, min, max) => {
  if (v === '' || v == null) return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
};

export const quitarAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
export const slugificar = (s) => quitarAcentos(String(s)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function generarSlug(c) {
  const base = slugificar([c.marca, c.modelo, c.version, c.combustible, c.puertas && `${c.puertas}p`, c.carroceria, c.anio, c.ubicacion && 'en', c.ubicacion].filter(Boolean).join(' ')).slice(0, 90).replace(/-+$/, '');
  const hex = [...crypto.getRandomValues(new Uint8Array(3))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${base || 'coche'}-${hex}`;
}

const FOTO_VALIDA = /^(\/fotos\/[A-Za-z0-9_-]{8,40}\.(webp|jpg|jpeg|png)|[A-Za-z0-9_-]{8,40}\.webp)$/;

/** Devuelve { coche } o { error } */
export function validarCoche(d) {
  const c = {
    tipo: TIPOS.includes(d.tipo) ? d.tipo : 'Ocasión',
    marca: texto(d.marca, 60),
    modelo: texto(d.modelo, 80),
    version: texto(d.version, 160),
    anio: entero(d.anio, 1950, new Date().getFullYear() + 1),
    combustible: texto(d.combustible, 40),
    potencia_cv: entero(d.potencia_cv, 1, 2000),
    carroceria: texto(d.carroceria, 40),
    puertas: entero(d.puertas, 2, 7),
    cambio: texto(d.cambio, 20),
    titulo: texto(d.titulo, 200),
    km: entero(d.km, 0, 2000000),
    color: texto(d.color, 40),
    etiqueta_dgt: ['0', 'ECO', 'C', 'B'].includes(d.etiqueta_dgt) ? d.etiqueta_dgt : null,
    garantia_meses: entero(d.garantia_meses, 0, 120),
    ubicacion: texto(d.ubicacion, 60),
    descripcion: texto(d.descripcion, 5000),
    matricula: texto(d.matricula, 20)?.toUpperCase() ?? null,
    coste: entero(d.coste, 0, 10000000),
    notas: texto(d.notas, 5000),
    precio: entero(d.precio, 0, 10000000),
    precio_financiado: entero(d.precio_financiado, 0, 10000000),
    precio_oferta: d.en_oferta ? entero(d.precio_oferta, 0, 10000000) : null,
    reservable: !!d.reservable,
    estado: ESTADOS.includes(d.estado) ? d.estado : 'Disponible',
    fotos: Array.isArray(d.fotos) ? d.fotos.filter((f) => typeof f === 'string' && FOTO_VALIDA.test(f)).slice(0, 20) : [],
  };
  if (!c.marca || !c.modelo) return { error: 'Faltan la marca o el modelo.' };
  if (!c.anio) return { error: 'Falta el año.' };
  if (!c.combustible) return { error: 'Falta el combustible.' };
  if (!c.cambio) return { error: 'Falta el cambio.' };
  if (c.km == null) return { error: 'Faltan los kilómetros.' };
  if (c.precio == null) return { error: 'Falta el precio.' };
  if (d.en_oferta && c.precio_oferta == null) return { error: 'Has marcado «En oferta»: escribe el precio de oferta (o desmárcalo).' };
  if (c.precio_oferta != null && c.precio_oferta >= c.precio) return { error: 'El precio de oferta tiene que ser menor que el precio normal.' };
  if (!c.titulo) c.titulo = [c.marca, c.modelo, c.version].filter(Boolean).join(' ');
  if (c.estado === 'Vendido') c.fecha_venta = new Date().toISOString().slice(0, 10);
  else c.fecha_venta = null;
  return { coche: c };
}

/** La venta que acompaña a un coche marcado como vendido desde su ficha del panel (o null si no viene precio). */
export function validarVenta(v, coche) {
  if (!v || typeof v !== 'object') return null;
  const precio = entero(v.precio_venta, 0, 10000000);
  if (precio == null) return null;
  return {
    coche: coche.slug,
    titulo: texto(tituloLimpio(coche), 200) || [coche.marca, coche.modelo].filter(Boolean).join(' ') || 'Coche',
    cliente_id: entero(v.cliente_id, 1, 1e12),
    comprador: texto(v.comprador, 120),
    precio_venta: precio,
    coste: coche.coste ?? null,
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(v.fecha || '') ? v.fecha : null,
    notas: null,
  };
}
