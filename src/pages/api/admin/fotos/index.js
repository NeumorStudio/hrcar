// Subida de fotos desde el panel: se guardan en KV con un nombre único y se sirven en /fotos/<nombre>.
// Con cada foto llega su miniatura (para los listados), que se guarda como /fotos/<nombre>-m.<ext>.
import { registrarFoto } from '../../../../lib/datos.js';
import { LIMITE_BYTES, nombreMini, limpiarHuerfanas, usoFotos } from '../../../../lib/fotos.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const MAX_BYTES = 6 * 1024 * 1024;
const MAX_MINI = 600 * 1024;
const TIPOS = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const nombreUnico = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => ALFABETO[b % 64]).join('');

function esImagen(bytes, tipo) {
  const b = new Uint8Array(bytes.slice(0, 12));
  if (tipo === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8;
  if (tipo === 'image/png') return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (tipo === 'image/webp') return String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';
  return false;
}

export async function POST({ request, locals }) {
  const env = locals.runtime.env;
  const datos = await request.formData().catch(() => null);
  const f = datos?.get('foto');
  if (!f || typeof f === 'string' || !f.size) return json({ ok: false, error: 'No llegó ninguna foto.' }, 400);
  const ext = TIPOS[f.type];
  if (!ext) return json({ ok: false, error: 'Formato no admitido (usa JPG, PNG o WebP).' }, 415);
  if (f.size > MAX_BYTES) return json({ ok: false, error: 'La foto es demasiado grande.' }, 413);
  const bytes = await f.arrayBuffer();
  if (!esImagen(bytes, f.type)) return json({ ok: false, error: 'El archivo no es una imagen.' }, 415);
  // miniatura opcional (si no llega, los listados usan la foto grande)
  const m = datos.get('mini');
  let mini = null;
  if (m && typeof m !== 'string' && m.size && m.size <= MAX_MINI && TIPOS[m.type]) {
    const b = await m.arrayBuffer();
    if (esImagen(b, m.type)) mini = { bytes: b, tipo: m.type };
  }
  const total = f.size + (mini ? mini.bytes.byteLength : 0);
  const uso = await usoFotos(env.DB).catch(() => null);
  if (uso && uso.bytes + total > LIMITE_BYTES) {
    return json({ ok: false, error: 'El espacio para fotos está lleno. En Ajustes, «Espacio para fotos», puedes liberar el de los coches vendidos hace tiempo.' }, 507);
  }
  const nombre = `${nombreUnico()}.${ext}`;
  try {
    await env.FOTOS.put(`foto:${nombre}`, bytes, { metadata: { tipo: f.type } });
    if (mini) await env.FOTOS.put(`foto:${nombreMini(nombre)}`, mini.bytes, { metadata: { tipo: mini.tipo } });
    await registrarFoto(env.DB, nombre, f.type, total);
  } catch (e) {
    console.error('No se pudo guardar la foto', e);
    await env.FOTOS.delete(`foto:${nombre}`).catch(() => {});
    await env.FOTOS.delete(`foto:${nombreMini(nombre)}`).catch(() => {});
    return json({ ok: false, error: 'No se ha podido guardar la foto: el almacén de fotos no responde o ha llegado a su límite de hoy. Prueba otra vez en unos minutos.' }, 503);
  }
  // de paso, se borran algunas fotos que se subieron y nunca llegaron a guardarse en un coche
  locals.runtime.ctx.waitUntil(limpiarHuerfanas(env, request.url));
  return json({ ok: true, nombre, url: `/fotos/${nombre}` });
}
