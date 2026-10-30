import { marcarTarea, borrarTarea } from '../../../../lib/crm.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
export async function PATCH({ request, params, locals }) {
  const { hecha } = await request.json().catch(() => ({}));
  await marcarTarea(locals.runtime.env.DB, Number(params.id), !!hecha);
  return json({ ok: true });
}
export async function DELETE({ params, locals }) {
  await borrarTarea(locals.runtime.env.DB, Number(params.id));
  return json({ ok: true });
}
