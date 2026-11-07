import { MARCA } from './marca.js';

/**
 * Dirección para los enlaces que se mandan (WhatsApp, correo): la de la web, fija. El host de la petición lo puede
 * poner cualquiera (x-forwarded-host), así que solo se usa en local para probar.
 */
export function origenPublico(request) {
  const url = new URL(request.url);
  return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname) ? url.origin : MARCA.sitio;
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
