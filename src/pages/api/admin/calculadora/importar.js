import { leerAnuncio, portal, sacarEnlace } from '../../../../lib/anuncio.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
export async function POST({ request, locals }) {
  const { url } = await request.json().catch(() => ({}));
  let u;
  // lo pegado puede traer texto de más (al compartir desde el móvil): se queda solo el enlace
  const limpio = sacarEnlace(url);
  if (!limpio) return json({ ok: false, error: 'En lo que has pegado no hay ningún enlace. Copia el enlace del anuncio (empieza por https://).' }, 400);
  u = new URL(limpio);
  try {
    const datos = await leerAnuncio(u.toString());
    if (!datos.precio && !datos.titulo) return json({ ok: false, error: 'No he podido leer ese anuncio. Rellena los datos a mano.', portal: portal(u.toString()) }, 422);
    return json({ ok: true, datos });
  } catch (e) {
    return json({ ok: false, error: `Ese portal no deja leer el anuncio (${e.message}). Rellena los datos a mano.`, portal: portal(u.toString()) }, 422);
  }
}
