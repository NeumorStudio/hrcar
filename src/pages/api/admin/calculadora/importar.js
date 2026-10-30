import { leerAnuncio, portal } from '../../../../lib/anuncio.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
export async function POST({ request, locals }) {
  const { url } = await request.json().catch(() => ({}));
  let u;
  try { u = new URL(String(url)); if (!/^https?:$/.test(u.protocol)) throw new Error(); } catch { return json({ ok: false, error: 'Pega un enlace completo (empieza por https://).' }, 400); }
  try {
    const datos = await leerAnuncio(u.toString());
    if (!datos.precio && !datos.titulo) return json({ ok: false, error: 'No he podido leer ese anuncio. Rellena los datos a mano.', portal: portal(u.toString()) }, 422);
    return json({ ok: true, datos });
  } catch (e) {
    return json({ ok: false, error: `Ese portal no deja leer el anuncio (${e.message}). Rellena los datos a mano.`, portal: portal(u.toString()) }, 422);
  }
}
