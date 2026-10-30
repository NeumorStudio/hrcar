// Avisos push al móvil del dueño (Web Push: RFC 8291 aes128gcm + RFC 8292 VAPID), solo con WebCrypto.
// Las claves VAPID se generan la primera vez y se guardan en la base de datos; nada que configurar.
import { ajuste, guardarAjuste, preparar } from './datos.js';

import { NEGOCIO } from '../negocio.js';
const CONTACTO = `mailto:${NEGOCIO.email}`;
const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64url = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (String(s).length % 4)) % 4)), (c) => c.charCodeAt(0));
const concat = (...partes) => { const n = partes.reduce((a, p) => a + p.length, 0); const out = new Uint8Array(n); let o = 0; for (const p of partes) { out.set(p, o); o += p.length; } return out; };

export async function clavesVapid(db) {
  let publica = await ajuste(db, 'vapid_publica');
  let privada = await ajuste(db, 'vapid_privada');
  if (!publica || !privada) {
    const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    publica = b64url(await crypto.subtle.exportKey('raw', par.publicKey));
    privada = JSON.stringify(await crypto.subtle.exportKey('jwk', par.privateKey));
    await guardarAjuste(db, 'vapid_publica', publica);
    await guardarAjuste(db, 'vapid_privada', privada);
  }
  return { publica, privada: JSON.parse(privada) };
}

async function cabeceraVapid(endpoint, claves) {
  const aud = new URL(endpoint).origin;
  const cabecera = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const carga = b64url(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTACTO })));
  const clave = await crypto.subtle.importKey('jwk', claves.privada, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, clave, enc.encode(`${cabecera}.${carga}`));
  return `vapid t=${cabecera}.${carga}.${b64url(firma)}, k=${claves.publica}`;
}

async function hkdf(sal, ikm, info, bits) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sal, info }, k, bits));
}

// Cifra el mensaje para una suscripción (aes128gcm)
async function cifrar(suscripcion, texto) {
  const uaPublica = deB64url(suscripcion.keys.p256dh);
  const auth = deB64url(suscripcion.keys.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublica = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaClave = await crypto.subtle.importKey('raw', uaPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const compartido = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaClave }, local.privateKey, 256));
  const ikm = await hkdf(auth, compartido, concat(enc.encode('WebPush: info\0'), uaPublica, asPublica), 256);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 128);
  const nonce = await hkdf(sal, ikm, enc.encode('Content-Encoding: nonce\0'), 96);
  const claveAes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const relleno = concat(enc.encode(texto), new Uint8Array([2])); // 0x02: último registro
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, claveAes, relleno));
  const rs = new Uint8Array([0, 0, 16, 0]); // tamaño de registro 4096
  return concat(sal, rs, new Uint8Array([asPublica.length]), asPublica, cifrado);
}

/** Envía un aviso a una suscripción. Devuelve el status HTTP (201 = entregado al servicio push). */
export async function enviarPush(db, suscripcion, datos, claves) {
  claves = claves || (await clavesVapid(db));
  const cuerpo = await cifrar(suscripcion, JSON.stringify(datos));
  const r = await fetch(suscripcion.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await cabeceraVapid(suscripcion.endpoint, claves),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(cuerpo.length),
      TTL: '86400',
      Urgency: 'high',
      Topic: String(datos.tag || 'aviso').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'aviso',
    },
    body: cuerpo,
  });
  return r.status;
}

export async function listarSuscripciones(db) {
  await preparar(db);
  const { results } = await db.prepare('SELECT id, endpoint, datos, usuario, dispositivo, creado FROM suscripciones ORDER BY id').all();
  return results.map((s) => ({ ...s, datos: JSON.parse(s.datos) }));
}

export async function guardarSuscripcion(db, suscripcion, usuario, dispositivo) {
  await preparar(db);
  if (!suscripcion?.endpoint || !suscripcion?.keys?.p256dh || !suscripcion?.keys?.auth) throw new Error('suscripcion');
  await db.prepare('INSERT INTO suscripciones (endpoint, datos, usuario, dispositivo, creado) VALUES (?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET datos = excluded.datos, usuario = excluded.usuario, dispositivo = excluded.dispositivo')
    .bind(suscripcion.endpoint, JSON.stringify(suscripcion), usuario || 'juan', String(dispositivo || '').slice(0, 160), new Date().toISOString()).run();
}

export async function borrarSuscripcion(db, endpoint) {
  await db.prepare('DELETE FROM suscripciones WHERE endpoint = ?').bind(endpoint).run();
}

/** Avisa a todos los móviles apuntados. Las suscripciones caducadas (404/410) se borran. */
export async function avisarTodos(db, datos) {
  let subs = [];
  try { subs = await listarSuscripciones(db); } catch { return { enviados: 0, total: 0 }; }
  if (!subs.length) return { enviados: 0, total: 0 };
  const claves = await clavesVapid(db);
  let enviados = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      const status = await enviarPush(db, s.datos, datos, claves);
      if (status === 201 || status === 200) enviados++;
      else if (status === 404 || status === 410) await borrarSuscripcion(db, s.endpoint);
      else console.error('push', status, s.endpoint.slice(0, 60));
    } catch (e) {
      console.error('push error', e?.message);
    }
  }));
  return { enviados, total: subs.length };
}
