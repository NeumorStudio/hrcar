// Cambiar las imágenes de la web desde el panel: GET lista, POST (multipart clave+foto) guarda, DELETE vuelve a la de serie.
import { CLAVES } from '../../../lib/imagenes-web.js';
import { tocar } from '../../../lib/datos.js';
import { claveCache } from '../../img-web/[archivo].js';
// al cambiar una imagen, fuera la copia del borde (en este centro de datos; en los demás caduca en 5 minutos)
const olvidar = async (request, clave) => {
  const origen = new URL(request.url).origin;
  await caches.default.delete(claveCache(origen, clave)).catch(() => {});
};
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const MAX_BYTES = 4 * 1024 * 1024;

export async function GET({ locals }) {
  const env = locals.runtime.env;
  const lista = {};
  for (const clave of Object.keys(CLAVES)) {
    const { value, metadata } = await env.FOTOS.getWithMetadata(`web:${clave}`, { type: 'arrayBuffer' }).catch(() => ({ value: null }));
    lista[clave] = { nombre: CLAVES[clave], propia: !!value, bytes: value ? value.byteLength : 0, actualizado: metadata?.actualizado || null };
  }
  return json({ ok: true, imagenes: lista });
}

export async function POST({ request, locals }) {
  const env = locals.runtime.env;
  const datos = await request.formData().catch(() => null);
  const clave = String(datos?.get('clave') || '');
  const f = datos?.get('foto');
  if (!CLAVES[clave]) return json({ ok: false, error: 'Imagen desconocida.' }, 400);
  if (!f || typeof f === 'string' || !f.size) return json({ ok: false, error: 'No llegó ninguna imagen.' }, 400);
  if (!['image/webp', 'image/jpeg', 'image/png'].includes(f.type)) return json({ ok: false, error: 'Formato no admitido (JPG, PNG o WebP).' }, 415);
  if (f.size > MAX_BYTES) return json({ ok: false, error: 'La imagen es demasiado grande (máximo 4 MB).' }, 413);
  const bytes = await f.arrayBuffer();
  const b = new Uint8Array(bytes.slice(0, 12));
  const esImagen = (b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50) || (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP');
  if (!esImagen) return json({ ok: false, error: 'El archivo no es una imagen.' }, 415);
  await env.FOTOS.put(`web:${clave}`, bytes, { metadata: { tipo: f.type, actualizado: new Date().toISOString() } });
  await tocar(env.DB).catch(() => {});
  await olvidar(request, clave).catch(() => {});
  return json({ ok: true, url: `/img-web/${clave}.webp?v=${Date.now()}` });
}

export async function DELETE({ request, locals }) {
  const env = locals.runtime.env;
  const d = await request.json().catch(() => ({}));
  if (!CLAVES[d.clave]) return json({ ok: false, error: 'Imagen desconocida.' }, 400);
  await env.FOTOS.delete(`web:${d.clave}`);
  await tocar(env.DB).catch(() => {});
  await olvidar(request, d.clave).catch(() => {});
  return json({ ok: true });
}
