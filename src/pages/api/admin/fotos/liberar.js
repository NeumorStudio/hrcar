// Libera espacio de fotos: a los coches vendidos hace más de 6 meses se les deja solo la portada
// (es la que sale en «Últimas entregas»). Va por tandas para no pasar los límites diarios de KV.
import { vendidosConFotos, dejarSoloPortada, tocar } from '../../../../lib/datos.js';
import { borrarFotos, usoFotos } from '../../../../lib/fotos.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const POR_TANDA = 60; // fotos (cada una son 2 borrados en KV: la grande y la miniatura)
const COCHES_POR_TANDA = 15; // cada coche son 2 consultas a D1 (el plan gratuito admite 50 por petición)

export async function POST({ locals, request }) {
  const env = locals.runtime.env;
  const coches = await vendidosConFotos(env.DB, 180);
  const quitar = [];
  let hechos = 0;
  for (const c of coches) {
    const estas = c.fotos.slice(1).filter((f) => String(f).startsWith('/fotos/'));
    if (hechos > 0 && (quitar.length + estas.length > POR_TANDA || hechos >= COCHES_POR_TANDA)) break;
    await dejarSoloPortada(env.DB, c.slug, c.fotos[0]);
    quitar.push(...estas);
    hechos++;
  }
  const fotos = await borrarFotos(env, quitar, request.url);
  if (hechos) await tocar(env.DB);
  return json({ ok: true, fotos, coches: hechos, quedan: coches.length - hechos, uso: await usoFotos(env.DB) });
}
