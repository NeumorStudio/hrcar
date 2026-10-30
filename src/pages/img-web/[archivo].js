// Sirve las imágenes de la web cambiables desde el panel: la de KV si el dueño subió una, si no la de serie.
// Caché corta (5 min): la URL no cambia cuando el dueño sube otra, y así el cambio se ve enseguida también a través de Vercel.
import { CLAVES } from '../../lib/imagenes-web.js';

// El navegador la guarda 5 min; el CDN de Vercel no (así un cambio desde el panel se ve enseguida).
const CACHE = { 'Cache-Control': 'public, max-age=300', 'Vercel-CDN-Cache-Control': 'no-store' };

// En el borde de Cloudflare se guarda 5 minutos: cada visita nueva no cuesta una lectura de KV.
export const claveCache = (origen, clave) => new Request(`${origen}/img-web/${clave}.webp?serie=1`, { method: 'GET' });

export async function GET({ params, request, locals }) {
  const clave = String(params.archivo || '').replace(/\.webp$/, '');
  if (!CLAVES[clave]) return new Response('No encontrada', { status: 404 });
  const env = locals.runtime.env;
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const ck = claveCache(new URL(request.url).origin, clave);
  const guardada = cache ? await cache.match(ck).catch(() => null) : null;
  if (guardada) return new Response(guardada.body, guardada);
  const guardar = (r) => {
    if (cache && r.ok) {
      const copia = new Response(r.clone().body, r);
      copia.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
      locals.runtime.ctx.waitUntil(cache.put(ck, copia).catch(() => {}));
    }
    return r;
  };
  const { value, metadata } = await env.FOTOS.getWithMetadata(`web:${clave}`, { type: 'arrayBuffer' }).catch(() => ({ value: null }));
  if (value) {
    return guardar(new Response(value, { headers: { 'Content-Type': metadata?.tipo || 'image/webp', ...CACHE, 'X-Content-Type-Options': 'nosniff' } }));
  }
  // la de serie, desde los archivos estáticos del propio sitio
  const servir = async (carpeta) => {
    const url = new URL(`/img/${carpeta}/${clave}.webp`, request.url);
    return env.ASSETS ? env.ASSETS.fetch(new Request(url.toString())) : fetch(url.toString());
  };
  const r = await servir('v2');
  if (!r.ok) return new Response('No encontrada', { status: 404 });
  return guardar(new Response(r.body, { headers: { 'Content-Type': 'image/webp', ...CACHE } }));
}
