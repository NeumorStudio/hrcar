// Trae una imagen de otra web (p. ej. la foto de un anuncio) para que el panel la pueda reducir y guardar
// como cualquier otra foto. Solo para el panel; devuelve los bytes tal cual con su tipo.
const MAX_BYTES = 20 * 1024 * 1024;
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function GET({ url }) {
  const destino = url.searchParams.get('url') || '';
  let u;
  try { u = new URL(destino); if (!/^https?:$/.test(u.protocol)) throw new Error(); } catch { return json({ ok: false, error: 'Pega un enlace completo (empieza por https://).' }, 400); }
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]|0\.)/.test(u.hostname)) return json({ ok: false, error: 'Enlace no permitido.' }, 400);
  let r;
  try {
    r = await fetch(u.toString(), { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', Accept: 'image/*,*/*;q=0.5', Referer: u.origin + '/' }, redirect: 'follow', cf: { cacheTtl: 0 } });
  } catch {
    return json({ ok: false, error: 'No se ha podido descargar la imagen.' }, 502);
  }
  if (!r.ok) return json({ ok: false, error: `La web ha respondido ${r.status}.` }, 502);
  const tipo = (r.headers.get('content-type') || '').split(';')[0].trim();
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(tipo)) return json({ ok: false, error: 'Ese enlace no es una foto (JPG, PNG, WebP, GIF o AVIF).' }, 415);
  const largo = Number(r.headers.get('content-length') || 0);
  if (largo > MAX_BYTES) return json({ ok: false, error: 'La imagen es demasiado grande.' }, 413);
  const bytes = await r.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return json({ ok: false, error: 'La imagen es demasiado grande.' }, 413);
  return new Response(bytes, { headers: { 'Content-Type': tipo, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Content-Disposition': 'attachment' } });
}
