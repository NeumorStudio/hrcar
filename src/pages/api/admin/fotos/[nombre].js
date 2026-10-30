// Borra una foto subida que no use ningún coche (las que sí se usan se borran al guardar el coche sin ellas).
import { NOMBRE_VALIDO, borrarFotos } from '../../../../lib/fotos.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function DELETE({ params, locals, request }) {
  const env = locals.runtime.env;
  const nombre = params.nombre || '';
  if (!NOMBRE_VALIDO.test(nombre)) return json({ ok: false, error: 'Nombre no válido.' }, 400);
  const usada = await env.DB.prepare('SELECT 1 AS x FROM coches WHERE fotos LIKE ? LIMIT 1').bind(`%${nombre}%`).first();
  if (usada) return json({ ok: false, error: 'Esa foto la usa un coche: quítala desde su ficha y guarda.' }, 409);
  await borrarFotos(env, [nombre], request.url);
  return json({ ok: true });
}
