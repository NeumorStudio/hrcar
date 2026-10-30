// Avisos push: GET clave pública (para suscribirse), POST guardar suscripción, DELETE quitarla.
import { clavesVapid, guardarSuscripcion, borrarSuscripcion } from '../../../../lib/push.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function GET({ locals }) {
  const { publica } = await clavesVapid(locals.runtime.env.DB);
  return json({ ok: true, clave: publica });
}

export async function POST({ request, locals }) {
  const d = await request.json().catch(() => ({}));
  try {
    await guardarSuscripcion(locals.runtime.env.DB, d.suscripcion, locals.usuario?.usuario, d.dispositivo);
  } catch {
    return json({ ok: false, error: 'La suscripción no es válida.' }, 400);
  }
  return json({ ok: true });
}

export async function DELETE({ request, locals }) {
  const d = await request.json().catch(() => ({}));
  if (d.endpoint) await borrarSuscripcion(locals.runtime.env.DB, String(d.endpoint));
  return json({ ok: true });
}
