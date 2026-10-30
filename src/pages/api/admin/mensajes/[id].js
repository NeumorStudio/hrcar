import { marcarLeido, borrarMensaje } from '../../../../lib/datos.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function PATCH({ request, params, locals }) {
  const { leido } = await request.json().catch(() => ({}));
  await marcarLeido(locals.runtime.env.DB, Number(params.id), !!leido);
  return json({ ok: true });
}
export async function DELETE({ params, locals }) {
  await borrarMensaje(locals.runtime.env.DB, Number(params.id));
  return json({ ok: true });
}
