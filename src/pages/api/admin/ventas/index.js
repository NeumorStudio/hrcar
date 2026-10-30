import { registrarVenta } from '../../../../lib/crm.js';
import { obtenerCoche, cambiarEstado, actualizarCoche } from '../../../../lib/datos.js';
import { tituloLimpio } from '../../../../lib/nombres.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
export async function POST({ request, locals }) {
  const db = locals.runtime.env.DB;
  const d = await request.json().catch(() => ({}));
  const precio = Math.round(Number(d.precio_venta));
  if (!Number.isFinite(precio) || precio < 0) return json({ ok: false, error: 'Falta el precio de venta.' }, 400);
  const coche = d.coche ? await obtenerCoche(db, String(d.coche)) : null;
  const titulo = String(d.titulo || (coche ? tituloLimpio(coche) : '') || '').trim().slice(0, 200);
  if (!titulo) return json({ ok: false, error: 'Indica el coche.' }, 400);
  const coste = d.coste === '' || d.coste == null ? (coche?.coste ?? null) : Math.round(Number(d.coste));
  const id = await registrarVenta(db, { coche: coche?.slug || null, titulo, cliente_id: Number(d.cliente_id) || null, comprador: String(d.comprador || '').trim().slice(0, 120) || null, precio_venta: precio, coste: Number.isFinite(coste) ? coste : null, fecha: /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : null, notas: String(d.notas || '').slice(0, 2000) || null });
  if (coche) {
    if (coste != null && coche.coste !== coste) await actualizarCoche(db, coche.slug, { ...coche, coste });
    if (d.marcar_vendido !== false && coche.estado !== 'Vendido') await cambiarEstado(db, coche.slug, 'Vendido');
  }
  return json({ ok: true, id });
}
