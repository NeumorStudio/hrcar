// El dueño pone su contraseña con el enlace de un solo uso (ver src/pages/admin/activar.astro).
import { usarEnlaceJuan, crearSesion, cabeceraCookie, MIN_LONGITUD } from '../../../lib/acceso.js';
const json = (d, status = 200, extra = {}) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });

export async function POST({ request, locals }) {
  const db = locals.runtime.env.DB;
  const { t, clave, clave2 } = await request.json().catch(() => ({}));
  if (typeof clave !== 'string' || clave.length < MIN_LONGITUD) return json({ ok: false, error: `La contraseña debe tener al menos ${MIN_LONGITUD} caracteres.` }, 400);
  if (clave !== clave2) return json({ ok: false, error: 'Las dos contraseñas no coinciden.' }, 400);
  if (!(await usarEnlaceJuan(db, String(t || ''), clave))) return json({ ok: false, error: 'Este enlace ya no vale: ya se usó o ha caducado. Pide uno nuevo a NeumorStudio.' }, 410);
  return json({ ok: true }, 200, { 'Set-Cookie': cabeceraCookie(await crearSesion(db, 'juan')) });
}
