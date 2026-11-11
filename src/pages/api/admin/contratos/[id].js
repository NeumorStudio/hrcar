// Datos del contrato firmado para montar su PDF en el panel.
import { contratoPorId } from '../../../../lib/captaciones.js';
import { datosPdf } from '../../../../lib/firma.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function GET({ params, locals }) {
  const env = locals.runtime.env;
  const k = /^\d{1,12}$/.test(params.id || '') ? await contratoPorId(env.DB, Number(params.id)) : null;
  if (!k) return json({ ok: false, error: 'No encuentro ese contrato.' }, 404);
  if (k.estado !== 'Firmado') return json({ ok: false, error: 'Ese contrato todavía no está firmado.' }, 400);
  return json({ ok: true, pdf: await datosPdf(env, k) });
}
