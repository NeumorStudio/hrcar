import { NEGOCIO } from '../../../../negocio.js';
// Manda un aviso de prueba a todos los móviles apuntados.
import { avisarTodos } from '../../../../lib/push.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function POST({ locals }) {
  const r = await avisarTodos(locals.runtime.env.DB, { titulo: `${NEGOCIO.nombre}: aviso de prueba`, cuerpo: 'Así te llegarán los mensajes nuevos de la web.', url: '/admin/mensajes', tag: 'prueba' });
  if (!r.total) return json({ ok: false, error: 'No hay ningún móvil con los avisos activados.' }, 400);
  return json({ ok: true, ...r });
}
