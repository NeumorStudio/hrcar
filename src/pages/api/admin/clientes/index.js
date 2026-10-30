import { crearCliente } from '../../../../lib/crm.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
export async function POST({ request, locals }) {
  const d = await request.json().catch(() => ({}));
  const nombre = String(d.nombre || '').trim().slice(0, 120);
  if (!nombre) return json({ ok: false, error: 'Falta el nombre.' }, 400);
  const id = await crearCliente(locals.runtime.env.DB, { nombre, telefono: String(d.telefono || '').trim().slice(0, 40), email: String(d.email || '').trim().slice(0, 120), notas: String(d.notas || '').slice(0, 5000), origen: 'manual' });
  return json({ ok: true, id });
}
