// Modelos de una marca para las sugerencias del alta: los de la lista y los que ya hay en el inventario.
import { modelosDe, marcaConocida } from '../../../data/modelos.js';
import { preparar } from '../../../lib/datos.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, max-age=300' } });

export async function GET({ url, locals }) {
  const marca = String(url.searchParams.get('marca') || '').slice(0, 60).trim();
  if (!marca) return json({ ok: true, modelos: [] });
  const db = locals.runtime.env.DB;
  await preparar(db);
  const { results } = await db.prepare('SELECT DISTINCT modelo FROM coches WHERE LOWER(marca) = LOWER(?) AND modelo IS NOT NULL').bind(marcaConocida(marca) || marca).all();
  const propios = results.map((r) => r.modelo);
  const modelos = [...new Set([...modelosDe(marca), ...propios])].sort((a, b) => a.localeCompare(b, 'es'));
  return json({ ok: true, marca: marcaConocida(marca) || marca, modelos });
}
