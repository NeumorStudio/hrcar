import { borrarVenta } from '../../../../lib/crm.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
export async function DELETE({ params, locals }) {
  await borrarVenta(locals.runtime.env.DB, Number(params.id));
  return json({ ok: true });
}
