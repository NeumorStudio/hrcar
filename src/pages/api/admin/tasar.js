// Tasación por coches parecidos. El panel pide cada portal por separado ({ fuente, datos }) y luego el cálculo
// ({ calcular: true, datos, comparables, captacion_id? }), que se guarda en la captación si viene su número.
import { buscarComparables, calcularTasacion, objetivo, FUENTES } from '../../../lib/tasacion.js';
import { actualizarCaptacion } from '../../../lib/captaciones.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function POST({ request, locals }) {
  const env = locals.runtime.env;
  const d = await request.json().catch(() => ({}));
  const o = objetivo(d.datos || {});
  if (!o.marca || !o.modelo) return json({ ok: false, error: 'Faltan la marca y el modelo para tasar.' }, 400);
  if (d.calcular) {
    const lista = Array.isArray(d.comparables) ? d.comparables.slice(0, 200) : [];
    const t = calcularTasacion(o, lista);
    t.busquedas = Array.isArray(d.busquedas) ? d.busquedas.filter((b) => b && /^https:\/\/www\.(coches\.net|autoscout24\.es)\//.test(b.url)).slice(0, 4) : [];
    t.errores = Array.isArray(d.errores) ? d.errores.map((e) => String(e).slice(0, 160)).slice(0, 4) : [];
    const id = /^\d{1,12}$/.test(String(d.captacion_id || '')) ? Number(d.captacion_id) : null;
    if (id) await actualizarCaptacion(env.DB, id, { tasacion: t }).catch(() => {});
    return json({ ok: true, tasacion: t });
  }
  if (!FUENTES.includes(d.fuente)) return json({ ok: false, error: 'Fuente desconocida.' }, 400);
  try {
    const r = await buscarComparables(d.fuente, o, env);
    return json({ ok: true, ...r });
  } catch (e) {
    return json({ ok: false, error: e.message }, 502);
  }
}
