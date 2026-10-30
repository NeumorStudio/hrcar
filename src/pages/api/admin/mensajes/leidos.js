import { marcarTodosLeidos } from '../../../../lib/datos.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
/** «Marcar todos como leídos»: el globo rojo del menú vuelve a cero. */
export async function POST({ locals }) {
  await marcarTodosLeidos(locals.runtime.env.DB);
  return json({ ok: true });
}
