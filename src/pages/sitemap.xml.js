// Mapa del sitio para Google: páginas fijas y coches a la venta (los vendidos llevan noindex y los ocultos no existen).
import { listarParaMapa, listarVendidos } from '../lib/datos.js';
import { leerOcultos, rutasVisibles } from '../lib/secciones.js';
import { SITIO } from '../negocio.js';
// /blog no se incluye: de momento no tiene contenido (lleva noindex)
const RUTAS = ['/', '/stock', '/custom-order', '/sell-your-car', '/finance', '/services', '/contact'];
// /history solo cuando hay entregas (sin ellas lleva noindex)
const dia = (f) => (f ? String(f).slice(0, 10) : null);
export async function GET({ locals }) {
  const db = locals.runtime.env.DB;
  // lo oculto ya lo ha leído el middleware (la misma lectura que decide qué páginas dan 404)
  const [coches, ocultos, vendidos] = await Promise.all([listarParaMapa(db), locals.ocultosWeb ?? leerOcultos(db), listarVendidos(db, 1)]);
  const ultima = coches.map((c) => dia(c.actualizado)).filter(Boolean).sort().pop();
  const urls = [
    ...rutasVisibles(vendidos.length ? [...RUTAS, '/history'] : RUTAS, ocultos).map((r) => ({ loc: r, lastmod: r === '/' || r === '/stock' ? ultima : null })), // sin las páginas que el dueño ha quitado
    ...coches.map((c) => ({ loc: `/stock/${c.slug}`, lastmod: dia(c.actualizado) })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${SITIO}${u.loc === '/' ? '' : u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
