import { actualizarCaptacion, borrarCaptacion, obtenerCaptacion } from '../../../../lib/captaciones.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const idDe = (p) => (/^\d{1,12}$/.test(p.id || '') ? Number(p.id) : null);

export async function PATCH({ request, params, locals }) {
  const id = idDe(params);
  if (!id) return json({ ok: false, error: 'No encuentro esa captación.' }, 404);
  const d = await request.json().catch(() => null);
  if (!d || typeof d !== 'object') return json({ ok: false, error: 'Datos no válidos.' }, 400);
  try {
    const c = await actualizarCaptacion(locals.runtime.env.DB, id, d);
    if (!c) return json({ ok: false, error: 'Esa captación ya no existe.' }, 404);
    return json({ ok: true, estado: c.estado });
  } catch (e) {
    return json({ ok: false, error: e.message }, 400);
  }
}

export async function DELETE({ params, locals }) {
  const id = idDe(params);
  const db = locals.runtime.env.DB;
  if (!id || !(await obtenerCaptacion(db, id))) return json({ ok: false, error: 'Esa captación ya no existe.' }, 404);
  await borrarCaptacion(db, id);
  return json({ ok: true });
}
