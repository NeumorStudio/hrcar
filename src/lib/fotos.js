// Fotos que sube el dueño desde el panel: viven en Cloudflare KV (foto:<nombre>) con una miniatura
// para los listados (foto:<nombre>-m.<ext>) y un índice en la tabla `fotos` de D1.
import { borrarRegistroFotos, fotosHuerfanas, espacioFotos } from './datos.js';

// El plan gratuito de KV da 1 GB en total. Se deja margen para las imágenes de la web y los mensajes en espera.
export const LIMITE_BYTES = 950 * 1000 * 1000;
export const NOMBRE_VALIDO = /^[A-Za-z0-9_-]{8,40}\.(webp|jpg|jpeg|png)$/;

/** 'abc.webp' → 'abc-m.webp' */
export const nombreMini = (nombre) => nombre.replace(/(\.[a-z]+)$/i, '-m$1');
export const nombreDeRuta = (ruta) => String(ruta).split('/').pop();

/**
 * Borra de KV, de la caché y del índice las fotos indicadas (rutas /fotos/… o nombres).
 * Nunca borra una foto que siga usando algún coche (llamar después de guardar el coche sin ellas).
 */
export async function borrarFotos(env, rutas, base) {
  let nombres = [...new Set(rutas.map(nombreDeRuta).filter((n) => NOMBRE_VALIDO.test(n)))];
  if (!nombres.length) return 0;
  const { results } = await env.DB.prepare('SELECT fotos FROM coches').all();
  const usadas = new Set(results.flatMap((c) => JSON.parse(c.fotos || '[]')).map((f) => nombreDeRuta(String(f))));
  nombres = nombres.filter((n) => !usadas.has(n));
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const borradas = [];
  for (const n of nombres) {
    try {
      await env.FOTOS.delete(`foto:${n}`);
      await env.FOTOS.delete(`foto:${nombreMini(n)}`);
    } catch (e) {
      // p. ej. cuota diaria de KV agotada: queda en el índice y la limpieza lo reintentará
      console.error('No se pudo borrar la foto', n, e);
      continue;
    }
    borradas.push(n);
    if (cache && base) for (const clave of [n, nombreMini(n)]) await cache.delete(new Request(new URL(`/fotos/${clave}`, base).toString())).catch(() => {});
  }
  if (borradas.length) await borrarRegistroFotos(env.DB, borradas).catch(() => {});
  return borradas.length;
}

/** Limpieza en segundo plano: fotos subidas que nunca llegaron a guardarse en un coche. */
export async function limpiarHuerfanas(env, base, limite = 10) {
  try {
    const huerfanas = await fotosHuerfanas(env.DB, limite);
    if (huerfanas.length) await borrarFotos(env, huerfanas, base);
    return huerfanas.length;
  } catch (e) {
    console.error('Limpieza de fotos', e);
    return 0;
  }
}

/** Cuánto ocupan las fotos y cuánto queda, para Ajustes y para avisar antes de que se llene. */
export async function usoFotos(db) {
  const { bytes, n } = await espacioFotos(db);
  return { bytes, n, limite: LIMITE_BYTES, porcentaje: Math.min(100, Math.round((bytes / LIMITE_BYTES) * 100)) };
}
