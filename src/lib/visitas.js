// Estadísticas de la web: cuántas páginas se ven cada día y de dónde llega la gente (Google, Instagram, WhatsApp…).
// Sin cookies, sin IP y sin nada que identifique a nadie: solo un contador por día, página y origen.
// Por eso no hace falta banner de cookies. Se apunta después de responder, así la página no espera.
import { COOKIE } from './acceso.js';
import { hoyMadrid, tareasDelDia } from './diario.js';
import { HOSTS_PROPIOS } from '../negocio.js';

const BOTS = /bot\b|bot\/|crawl|spider|slurp|preview|facebookexternalhit|meta-externalagent|whatsapp|telegram|discord|skype|curl|wget|python|node-fetch|axios|go-http|java\/|okhttp|headless|lighthouse|pagespeed|pingdom|uptime|monitor|scan|httpclient/i;

// de dónde llega: el nombre que se enseña en el panel
const SITIOS = [
  [/(^|\.)google\.[a-z.]+$/, 'Google'], [/(^|\.)bing\.com$/, 'Bing'], [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)instagram\.com$/, 'Instagram'], [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, 'Facebook'],
  [/(^|\.)tiktok\.com$/, 'TikTok'], [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'], [/(^|\.)(t\.co|x\.com|twitter\.com)$/, 'X'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'WhatsApp'], [/(^|\.)wallapop\.com$/, 'Wallapop'], [/(^|\.)coches\.net$/, 'coches.net'],
  [/(^|\.)milanuncios\.com$/, 'Milanuncios'], [/(^|\.)autoscout24\.[a-z.]+$/, 'AutoScout24'], [/(^|\.)coches\.com$/, 'coches.com'],
];
const UTM = { google: 'Google', ig: 'Instagram', instagram: 'Instagram', fb: 'Facebook', facebook: 'Facebook', tiktok: 'TikTok',
  youtube: 'YouTube', whatsapp: 'WhatsApp', wa: 'WhatsApp', wallapop: 'Wallapop', milanuncios: 'Milanuncios', 'coches.net': 'coches.net' };
export const DENTRO = 'Dentro de la web'; // pasó de una página a otra de la propia web
export const DIRECTO = 'Directo';         // escribió la dirección, un favorito, una app que no dice de dónde viene…

function origenDe(request, url, hostVisible) {
  const utm = (url.searchParams.get('utm_source') || '').trim().toLowerCase().slice(0, 30);
  if (utm) return UTM[utm] || utm.replace(/[^a-z0-9._-]/g, '') || 'Otras webs';
  let host = '';
  try { host = new URL(request.headers.get('referer') || '').hostname.toLowerCase(); } catch { return DIRECTO; }
  if (!host) return DIRECTO;
  if (host === hostVisible || host === url.hostname || HOSTS_PROPIOS.includes(host)) return DENTRO;
  for (const [re, nombre] of SITIOS) if (re.test(host)) return nombre;
  return 'Otras webs';
}

function esPersona(request, ruta) {
  if (request.method !== 'GET' || ruta.includes('.') || /^\/(firmar|fotos|img-web)(\/|$)/.test(ruta)) return false; // HEAD, sitemap.xml, contratos, fotos…
  const ua = request.headers.get('user-agent') || '';
  if (!ua || BOTS.test(ua)) return false;
  const proposito = `${request.headers.get('sec-purpose') || ''} ${request.headers.get('purpose') || ''} ${request.headers.get('x-moz') || ''}`;
  if (/prefetch|prerender/i.test(proposito)) return false; // el navegador la pide por si acaso, no la ha abierto nadie
  if ((request.headers.get('cookie') || '').includes(`${COOKIE}=`)) return false; // el dueño mirando su web
  return true;
}

/** Tras servir una página pública: suma la visita y, si hoy aún no se ha hecho, lanza la tarea del día. Nunca falla. */
export function trasVisita({ env, request, url, ruta, hostVisible, estado, ctx }) {
  try {
    const hoy = hoyMadrid();
    if (estado && estado.tareasDia !== hoy) ctx.waitUntil(tareasDelDia(env.DB));
    if (!esPersona(request, ruta)) return;
    const origen = origenDe(request, url, hostVisible);
    ctx.waitUntil(env.DB.prepare('INSERT INTO visitas (dia, ruta, origen, n) VALUES (?, ?, ?, 1) ON CONFLICT(dia, ruta, origen) DO UPDATE SET n = n + 1')
      .bind(hoy, ruta.slice(0, 120), origen).run().catch(() => {}));
  } catch {
    // las estadísticas nunca rompen la web
  }
}
