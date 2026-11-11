// Página pública de firma: el vendedor firma (POST) y, ya firmado, descarga los datos de su copia en PDF (GET).
import { contratoPorToken } from '../../../lib/captaciones.js';
import { firmar, avisarFirma, datosPdf } from '../../../lib/firma.js';
import { TOKEN_VALIDO } from '../../../lib/contrato.js';
import { origenPublico } from '../../../lib/origen.js';
import { marcarVisto } from '../../../lib/captaciones.js';
import { sesionValida, leerCookie } from '../../../lib/acceso.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });

/** El cuerpo como texto, o null si pasa de `max` bytes (también sin Content-Length, con el cuerpo troceado). */
async function leerHasta(request, max) {
  if (Number(request.headers.get('content-length') || 0) > max) return null;
  if (!request.body) return '';
  const lector = request.body.getReader();
  const trozos = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { lector.cancel().catch(() => {}); return null; }
    trozos.push(value);
  }
  const todo = new Uint8Array(total);
  let i = 0;
  for (const t of trozos) { todo.set(t, i); i += t.byteLength; }
  return new TextDecoder().decode(todo);
}

async function contrato(params, db) {
  if (!TOKEN_VALIDO.test(params.token || '')) return null;
  return contratoPorToken(db, params.token);
}

export async function POST({ request, params, locals }) {
  const env = locals.runtime.env;
  const k = await contrato(params, env.DB);
  if (!k) return json({ ok: false, error: 'Este enlace no existe. Pide uno nuevo.' }, 404);
  const cuerpo = await leerHasta(request, 700000);
  if (cuerpo === null) return json({ ok: false, error: 'La firma ocupa demasiado. Bórrala y vuelve a firmar.' }, 413);
  let d = null;
  try { d = JSON.parse(cuerpo); } catch { d = null; }
  if (!d || typeof d !== 'object') return json({ ok: false, error: 'Datos no válidos.' }, 400);
  const r = await firmar(env, k, d, request);
  if (r.error) return json({ ok: false, error: r.error, campo: r.campo || null }, 400);
  const avisos = avisarFirma(env, k, r.valores, origenPublico(request, env)).catch(() => {});
  if (locals.runtime.ctx?.waitUntil) locals.runtime.ctx.waitUntil(avisos); else await avisos;
  return json({ ok: true });
}

/** La página de firma avisa de que se ha abierto (si no la está mirando el dueño desde su panel). */
export async function PATCH({ request, params, locals }) {
  const env = locals.runtime.env;
  const k = await contrato(params, env.DB);
  if (!k) return json({ ok: false }, 404);
  const esDueno = !!(await sesionValida(env.DB, leerCookie(request)).catch(() => null));
  if (k.estado === 'Pendiente' && !esDueno) await marcarVisto(env.DB, k.id).catch(() => {});
  return json({ ok: true });
}

export async function GET({ params, locals }) {
  const env = locals.runtime.env;
  const k = await contrato(params, env.DB);
  if (!k || k.estado !== 'Firmado') return json({ ok: false, error: 'Este contrato no está firmado.' }, 404);
  return json({ ok: true, pdf: await datosPdf(env, k) });
}
