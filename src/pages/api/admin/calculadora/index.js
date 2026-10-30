import { guardarCalculo, borrarCalculo } from '../../../../lib/crm.js';
import { calcular, COSTES_POR_DEFECTO } from '../../../../lib/importacion.js';
import { ajuste } from '../../../../lib/datos.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
export async function POST({ request, locals }) {
  const db = locals.runtime.env.DB;
  const d = await request.json().catch(() => ({}));
  const costes = { ...COSTES_POR_DEFECTO, ...JSON.parse((await ajuste(db, 'costes')) || '{}') };
  const r = calcular(d, costes);
  const id = await guardarCalculo(db, { titulo: String(d.titulo || '').slice(0, 160), url: String(d.url || '').slice(0, 500), datos: { ...d, coste: r.coste, beneficio: r.beneficio, margen: r.margen, lineas: r.lineas } });
  return json({ ok: true, id });
}
