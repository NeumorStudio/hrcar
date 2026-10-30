// robots.txt con el mapa del sitio en la dirección buena (el dominio de src/negocio.js). Sin dominio propio
// todavía, todo lleva noindex (lo pone el middleware) y aquí no se anuncia ningún mapa.
import { NEGOCIO, SITIO } from '../negocio.js';
export const prerender = true;
export function GET() {
  const texto = `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\n${NEGOCIO.dominio ? `\nSitemap: ${SITIO}/sitemap.xml\n` : ''}`;
  return new Response(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
