// 1) Protege el panel (/admin y /api/admin) con la cookie de sesión.
// 2) Cachea en el borde de Cloudflare las páginas públicas que salen de la base de datos,
//    por versión del contenido: en cuanto el dueño cambia algo, se sirven de nuevo.
// 3) Cabeceras de seguridad.
// 4) La web pública (el dominio de src/negocio.js) la sirve Vercel, que reenvía cada petición a este proyecto de Cloudflare
//    (ver vercel/vercel.json). Los visitantes solo conectan con Vercel, así que no les afectan los bloqueos
//    de IPs de Cloudflare que LaLiga ordena los días de partido. Por eso aquí:
//    - el host que ve el visitante llega en x-forwarded-host (el Host que vemos es el de *.pages.dev);
//    - las redirecciones son relativas;
//    - el origen de formularios y panel se compara con ese host;
//    - hacia fuera, las páginas se revalidan siempre (el CDN de Vercel no las guarda);
//    - lo que no se sirva con el dominio propio lleva noindex (sin dominio todavía: todo).
import { sesionValida, leerCookie, hayContrasena, renovarSesion, crearSesion, cabeceraCookie } from './lib/acceso.js';
import { estadoWeb } from './lib/datos.js';
import { deTexto, rutaQuitada, aplicar } from './lib/secciones.js';
import { NEGOCIO, HOSTS_PROPIOS, WHATSAPP_URL } from './negocio.js';

// Todas las páginas públicas pasan por aquí: se guardan en la caché del borde por versión del contenido y antes se
// les quita lo que el dueño haya ocultado en «Tu web» (ver src/lib/secciones.js). Solo la 404 sigue siendo un archivo fijo.
const PAGINAS_FIJAS = new Set(['/custom-order', '/sell-your-car', '/services', '/blog', '/contact']);
const PUBLICAS_DINAMICAS = (ruta) => ruta === '/' || ruta === '/stock' || ruta.startsWith('/stock/') || ruta === '/finance' || ruta === '/history' || ruta === '/sitemap.xml' || PAGINAS_FIJAS.has(ruta);
const LIBRES_ADMIN = new Set(['/admin/entrar', '/admin/configurar', '/admin/activar', '/api/admin/entrar', '/api/admin/configurar', '/api/admin/activar']);
const DOMINIO = { test: (host) => HOSTS_PROPIOS.includes(host) };
// eslint-disable-next-line no-undef
const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';
const PROPIOS = new Set(HOSTS_PROPIOS.map((h) => `https://${h}`));

/** Dirección de la web tal y como la ve el visitante (el dominio propio, https://<proyecto>.vercel.app…). */
function origenVisible(request, url) {
  const host = (request.headers.get('x-forwarded-host') || '').split(',')[0].trim().toLowerCase();
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/.test(host)) return { origen: url.origin, host: url.hostname };
  const proto = (request.headers.get('x-forwarded-proto') || '').split(',')[0].trim() === 'http' ? 'http' : 'https';
  return { origen: `${proto}://${host}`, host: host.replace(/:\d+$/, '') };
}

const redirigir = (destino) => new Response(null, { status: 302, headers: { Location: destino } });
const json = (datos, status) => new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function onRequest(context, next) {
  const { request, url, locals } = context;
  if (context.isPrerendered) return next(); // páginas fijas generadas en el build: sin petición real
  const ruta = url.pathname.replace(/\/$/, '') || '/';
  const env = locals.runtime?.env;
  const esAdmin = ruta === '/admin' || ruta.startsWith('/admin/') || ruta.startsWith('/api/admin');
  const visible = origenVisible(request, url);
  const tecnica = !DOMINIO.test(visible.host); // *.pages.dev, *.vercel.app o local: fuera de Google

  // peticiones que cambian cosas (formularios y panel): solo desde la propia web
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origen = request.headers.get('origin');
    if (origen && origen !== visible.origen && origen !== url.origin && !PROPIOS.has(origen)) return json({ ok: false, error: 'origen' }, 403);
  }

  if (esAdmin && env) {
    let renovar = null;
    if (!LIBRES_ADMIN.has(ruta)) {
      const valida = await sesionValida(env.DB, leerCookie(request));
      if (valida) locals.usuario = valida;
      if (!valida) {
        if (ruta.startsWith('/api/')) return json({ ok: false, error: 'sesion' }, 401);
        if (!(await hayContrasena(env.DB))) return redirigir('/admin/configurar');
        // después de entrar, de vuelta a donde iba (p. ej. el mensaje del aviso)
        const volver = ruta !== '/admin' && request.method === 'GET' ? `?volver=${encodeURIComponent(ruta + url.search)}` : '';
        return redirigir(`/admin/entrar${volver}`);
      }
      if (renovarSesion(valida)) renovar = await crearSesion(env.DB, valida.usuario).catch(() => null);
    }
    const respuesta = await next();
    const r = new Response(respuesta.body, respuesta);
    r.headers.set('Cache-Control', 'no-store');
    r.headers.set('X-Robots-Tag', 'noindex, nofollow');
    if (renovar && !r.headers.has('Set-Cookie')) r.headers.append('Set-Cookie', cabeceraCookie(renovar));
    seguridad(r.headers, true);
    return r;
  }

  // caché de las páginas públicas (y lo que el dueño oculta de su web)
  if (env && (request.method === 'GET' || request.method === 'HEAD') && PUBLICAS_DINAMICAS(ruta)) {
    const escribir = request.method === 'GET'; // lo que se genera para un HEAD no se guarda en la caché
    let cache = null;
    let clave = null;
    // copia de reserva de cada página: si la base de datos falla (o se agota su cuota diaria), se sirve la última buena
    const reserva = new Request(`${url.origin}${ruta}?reserva&b=${BUILD}`, { method: 'GET' });
    try {
      cache = caches.default;
    } catch {
      cache = null;
    }
    // versión del contenido + lo oculto; si la base de datos falla, la última lectura buena
    const { estado, deReserva } = await leerEstado(env, cache, url, locals.runtime.ctx);
    const ocultos = deTexto(estado?.oculto);
    locals.ocultosWeb = ocultos; // el mapa del sitio usa esta misma lectura
    // la copia de reserva puede ser de antes de que el dueño ocultara algo: se le vuelve a quitar lo oculto
    const servirCopia = async (copia) => {
      const tipo = copia.headers.get('content-type') || '';
      let r = null;
      if (tipo.includes('text/html')) {
        const html = await copia.clone().text().then((t) => aplicar(t, ruta, ocultos)).catch(() => null);
        if (html !== null) r = new Response(html, copia);
      }
      if (!r) r = new Response(copia.body, copia);
      r.headers.delete('content-length');
      return haciaFuera(r, tecnica);
    };
    // una página que el dueño ha quitado de su web: la 404 de siempre (sin los enlaces a lo quitado), también sin base de datos
    if (rutaQuitada(ruta, ocultos)) {
      const r = await pagina404(env, url, ruta, ocultos);
      seguridad(r.headers, false, tecnica);
      return haciaFuera(r, tecnica);
    }
    if (cache && estado) {
      try {
        clave = new Request(`${url.origin}${ruta}?v=${estado.version}&b=${BUILD}`, { method: 'GET' }); // cambia con cada publicación
        const guardada = await cache.match(clave);
        if (guardada) return haciaFuera(new Response(guardada.body, guardada), tecnica); // copia con cabeceras modificables
      } catch {
        clave = null;
      }
    }
    if (deReserva) {
      // sin base de datos: la última copia buena de esta página (sin lo oculto)
      const copia = cache ? await cache.match(reserva).catch(() => null) : null;
      if (copia) return servirCopia(copia);
    }
    let r = null;
    try {
      const respuesta = await next();
      if (respuesta && respuesta.status < 500) {
        if ((respuesta.headers.get('content-type') || '').includes('text/html')) {
          const html = await aplicar(await respuesta.text(), ruta, ocultos); // sin lo que el dueño ha ocultado
          r = new Response(html, respuesta);
          r.headers.delete('content-length');
        } else {
          r = new Response(respuesta.body, respuesta);
        }
      }
    } catch (e) {
      console.error('Página sin poder generarse', ruta, e);
      r = null;
    }
    if (!r) {
      const copia = cache ? await cache.match(reserva).catch(() => null) : null;
      if (copia) return servirCopia(copia);
      return paginaCaida(tecnica);
    }
    seguridad(r.headers, false); // lo que se guarda en caché es igual para todos
    if (escribir && cache && clave && r.status === 200) {
      r.headers.set('Cache-Control', 'public, max-age=0, s-maxage=86400'); // solo para la caché de Cloudflare
      const copia = new Response(r.clone().body, r);
      copia.headers.set('Cache-Control', 'public, max-age=0, s-maxage=2592000'); // la de reserva aguanta 30 días
      locals.runtime.ctx.waitUntil(Promise.all([cache.put(clave, r.clone()), cache.put(reserva, copia)]).catch(() => {}));
    }
    return haciaFuera(r, tecnica);
  }

  const respuesta = await next();
  const r = new Response(respuesta.body, respuesta);
  if (ruta.startsWith('/api/') && !r.headers.has('Cache-Control')) r.headers.set('Cache-Control', 'no-store');
  seguridad(r.headers, false, tecnica);
  return r;
}

// La última lectura buena de la versión y de lo oculto: en memoria (este isolate) y en la caché del borde.
// Si D1 falla, las páginas quitadas siguen quitadas y la caché por versión sigue sirviendo.
let ultimoEstado = null;
async function leerEstado(env, cache, url, ctx) {
  const claveEstado = new Request(`${url.origin}/__estado-web?b=${BUILD}`, { method: 'GET' });
  try {
    const e = await estadoWeb(env.DB);
    if (cache && (!ultimoEstado || ultimoEstado.version !== e.version || ultimoEstado.oculto !== e.oculto)) {
      const guardar = new Response(JSON.stringify(e), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=0, s-maxage=2592000' } });
      ctx.waitUntil(cache.put(claveEstado, guardar).catch(() => {}));
    }
    ultimoEstado = e;
    return { estado: e, deReserva: false };
  } catch {
    if (ultimoEstado) return { estado: ultimoEstado, deReserva: true };
    const guardado = cache ? await cache.match(claveEstado).then((r) => (r ? r.json() : null)).catch(() => null) : null;
    return { estado: guardado, deReserva: true };
  }
}

/** La página «no existe» de la web (archivo fijo del build), con lo oculto quitado y estado 404. */
async function pagina404(env, url, ruta, ocultos) {
  const fija = env.ASSETS ? await env.ASSETS.fetch(new URL('/404', url)).catch(() => null) : null;
  const html = fija && fija.ok ? await fija.text() : `<!doctype html><meta charset="utf-8"><title>Página no encontrada · ${NEGOCIO.nombre}</title><p>Esta página ya no está en la web. <a href="/">Ir al inicio</a> · <a href="/stock">Ver el stock</a></p>`;
  return new Response(await aplicar(html, ruta, ocultos), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

/** Si la web no puede generarse y no hay copia guardada: aviso corto con el teléfono y WhatsApp. */
function paginaCaida(tecnica) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${NEGOCIO.nombre} · Volvemos enseguida</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0a0c;color:#f4f4f5;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:24px;box-sizing:border-box}main{max-width:460px;text-align:center}h1{font-size:1.5rem;margin:0 0 12px}p{color:#b4b4bd;margin:0 0 20px}a{display:block;margin:10px 0;padding:14px 18px;border-radius:10px;text-decoration:none;font-weight:600}.t{background:#f4f4f5;color:#0a0a0c}.w{background:#1fa855;color:#fff}</style></head>
<body><main><h1>${NEGOCIO.nombre}</h1><p>Estamos actualizando la web. Vuelve a intentarlo en unos minutos o contacta con nosotros directamente:</p>
<a class="t" href="tel:${NEGOCIO.telefono}">Llamar al ${NEGOCIO.telefonoBonito}</a><a class="w" href="${WHATSAPP_URL}">Escribir por WhatsApp</a></main></body></html>`;
  const r = new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '120' } });
  seguridad(r.headers, false, tecnica);
  r.headers.set('Cache-Control', 'no-store');
  r.headers.set('Vercel-CDN-Cache-Control', 'no-store');
  return r;
}

/** Cabeceras de una página pública hacia el navegador y el CDN de Vercel: siempre fresca. */
function haciaFuera(r, tecnica) {
  r.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  r.headers.set('Vercel-CDN-Cache-Control', 'no-store');
  if (tecnica) r.headers.set('X-Robots-Tag', 'noindex');
  return r;
}

function seguridad(h, admin, tecnica = false) {
  if (tecnica) h.set('X-Robots-Tag', 'noindex'); // la web buena es la del dominio propio; las direcciones técnicas no deben salir en Google
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('X-Frame-Options', 'SAMEORIGIN');
  h.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  if (admin) h.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
}
