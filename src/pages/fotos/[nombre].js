// Sirve las fotos que sube el dueño desde el panel (guardadas en Cloudflare KV).
// Cada foto tiene un nombre único, así que se puede cachear para siempre.
const NOMBRE_VALIDO = /^[A-Za-z0-9_-]{8,40}\.(webp|jpg|jpeg|png)$/;
const TIPOS = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

export async function GET({ params, request, locals }) {
  const nombre = params.nombre || '';
  if (!NOMBRE_VALIDO.test(nombre)) return new Response('No encontrada', { status: 404 });

  const cache = caches.default;
  const clave = new Request(new URL(request.url).toString().split('?')[0], { method: 'GET' });
  const guardada = await cache.match(clave).catch(() => null);
  if (guardada) return new Response(guardada.body, guardada);

  const fotos = locals.runtime.env.FOTOS;
  let { value, metadata } = await fotos.getWithMetadata(`foto:${nombre}`, { type: 'arrayBuffer' });
  // miniatura que no existe (fotos subidas antes de que hubiera miniaturas): se sirve la grande
  if (!value && /-m\.[a-z]+$/i.test(nombre)) ({ value, metadata } = await fotos.getWithMetadata(`foto:${nombre.replace(/-m(\.[a-z]+)$/i, '$1')}`, { type: 'arrayBuffer' }));
  if (!value) return new Response('No encontrada', { status: 404 });
  const respuesta = new Response(value, {
    headers: {
      'Content-Type': metadata?.tipo || TIPOS[nombre.split('.').pop()] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
  locals.runtime.ctx.waitUntil(cache.put(clave, respuesta.clone()).catch(() => {}));
  return respuesta;
}
