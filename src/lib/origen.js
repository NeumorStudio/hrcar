import { MARCA } from './marca.js';

/**
 * Dirección para los enlaces que se mandan (WhatsApp, correo): la de la web, fija. El host de la petición lo puede
 * poner cualquiera (x-forwarded-host), así que solo se usa en local para probar (en Cloudflare el host nunca es una IP privada).
 */
export function origenPublico(request, env) {
  // una copia de prueba publicada en otro sitio lo dice con la variable SITIO_PUBLICO
  if (env?.SITIO_PUBLICO && /^https:\/\/[a-z0-9.-]+$/i.test(env.SITIO_PUBLICO)) return env.SITIO_PUBLICO;
  const url = new URL(request.url);
  // en local (también desde el móvil en la misma wifi: 192.168.x.x, 10.x.x.x…) los enlaces apuntan al propio ordenador
  const local = /^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname);
  return local ? url.origin : MARCA.sitio;
}

// Dirección de la web tal y como la ve el visitante (el dominio llega por Vercel; el Host que ve Cloudflare es *.pages.dev).
// La misma regla que src/middleware.js, para montar enlaces que se mandan por correo o WhatsApp.
export function origenVisible(request) {
  const url = new URL(request.url);
  const host = (request.headers.get('x-forwarded-host') || '').split(',')[0].trim().toLowerCase();
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/.test(host)) return url.origin;
  const proto = (request.headers.get('x-forwarded-proto') || '').split(',')[0].trim() === 'http' ? 'http' : 'https';
  return `${proto}://${host}`;
}
