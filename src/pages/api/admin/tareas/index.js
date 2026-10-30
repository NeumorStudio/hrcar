import { crearTarea } from '../../../../lib/crm.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
export async function POST({ request, locals }) {
  const d = await request.json().catch(() => ({}));
  const titulo = String(d.titulo || '').trim().slice(0, 200);
  if (!titulo) return json({ ok: false, error: 'Escribe la tarea.' }, 400);
  const id = await crearTarea(locals.runtime.env.DB, { titulo, fecha: /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : null, hora: /^\d{2}:\d{2}$/.test(d.hora || '') ? d.hora : null, cliente_id: Number(d.cliente_id) || null, coche: String(d.coche || '').slice(0, 120) || null, notas: String(d.notas || '').slice(0, 2000) || null });
  return json({ ok: true, id });
}
