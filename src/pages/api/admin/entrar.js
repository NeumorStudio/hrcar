import { comprobarContrasena, crearSesion, cabeceraCookie, sembrarSoporte } from '../../../lib/acceso.js';
const json = (d, status = 200, extra = {}) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra } });

export async function POST({ request, locals }) {
  const db = locals.runtime.env.DB;
  const { clave } = await request.json().catch(() => ({}));
  if (typeof clave !== 'string' || !clave) return json({ ok: false, error: 'Escribe la contraseña.' }, 400);
  await sembrarSoporte(db, locals.runtime.env).catch(() => {}); // acceso de soporte desde CLAVE_SOPORTE (ver acceso.js)
  const r = await comprobarContrasena(db, clave);
  if (r.ok) return json({ ok: true, usuario: r.usuario }, 200, { 'Set-Cookie': cabeceraCookie(await crearSesion(db, r.usuario)) });
  if (r.bloqueado) return json({ ok: false, error: `Demasiados intentos. Espera ${r.bloqueado} minutos.` }, 429);
  return json({ ok: false, error: r.quedan != null ? `Contraseña incorrecta (quedan ${r.quedan} intentos).` : 'Contraseña incorrecta.' }, 401);
}
