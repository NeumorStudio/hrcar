// Guarda un interruptor de «Tu web a tu medida» (src/pages/admin/web.astro).
import { leerOcultos, guardarOcultos, VALIDOS } from '../../../lib/secciones.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function POST({ request, locals }) {
  const db = locals.runtime.env.DB;
  const d = await request.json().catch(() => ({}));
  const id = String(d.id || '');
  if (!VALIDOS.has(id)) return json({ ok: false, error: 'Esa opción no existe.' }, 400);
  const ocultos = await leerOcultos(db);
  const lista = d.visible ? ocultos.filter((x) => x !== id) : [...ocultos, id];
  return json({ ok: true, ocultos: await guardarOcultos(db, lista) });
}
