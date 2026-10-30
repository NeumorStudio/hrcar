import { hayContrasena, guardarContrasena, crearSesion, cabeceraCookie, MIN_LONGITUD } from '../../../lib/acceso.js';
const json = (d, status = 200, extra = {}) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra } });

export async function POST({ request, locals }) {
  const db = locals.runtime.env.DB;
  if (await hayContrasena(db)) return json({ ok: false, error: 'La contraseña ya está creada.' }, 409);
  const { clave, clave2 } = await request.json().catch(() => ({}));
  if (typeof clave !== 'string' || clave.length < MIN_LONGITUD) return json({ ok: false, error: `La contraseña debe tener al menos ${MIN_LONGITUD} caracteres.` }, 400);
  if (clave !== clave2) return json({ ok: false, error: 'Las dos contraseñas no coinciden.' }, 400);
  await guardarContrasena(db, clave);
  return json({ ok: true }, 200, { 'Set-Cookie': cabeceraCookie(await crearSesion(db)) });
}
