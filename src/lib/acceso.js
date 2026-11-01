// Acceso al panel: la contraseña del dueño (la pone él la primera vez), una contraseña de soporte
// opcional (para quien le lleva la web, por si hay que entrar a arreglar algo) y una cookie firmada.
// Todo con WebCrypto; ningún secreto sale de la base de datos.
import { ajuste, guardarAjuste } from './datos.js';
import { NEGOCIO } from '../negocio.js';

export const COOKIE = 'lidi_admin';
const DIAS_SESION = 30;
const ITERACIONES = 12000; // PBKDF2-SHA256: suficiente con el bloqueo por intentos y dentro del límite de CPU del plan gratuito
const MAX_INTENTOS = 8;
const MINUTOS_BLOQUEO = 15;
export const MIN_LONGITUD = 10;
// enlace de un solo uso para que el dueño ponga su contraseña (ver más abajo)
const CLAVE_ENLACE = 'enlace_juan';
export const DIAS_ENLACE = 7;

// Dos accesos con contraseña propia. 'juan' es el identificador interno del dueño (viene de LIDIAUTO, la primera
// web de la plantilla; no se renombra para no invalidar sesiones ni contraseñas); 'soporte' es opcional.
export const USUARIOS = {
  juan: { sal: 'admin_sal', hash: 'admin_hash', nombre: NEGOCIO.duenoNombre },
  soporte: { sal: 'soporte_sal', hash: 'soporte_hash', nombre: 'Soporte' },
};

const enc = new TextEncoder();
const aHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const deHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));
const base64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deBase64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const iguales = (a, b) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
};

async function derivar(clave, sal) {
  const k = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: ITERACIONES }, k, 256));
}

async function firmar(secreto, texto) {
  const k = await crypto.subtle.importKey('raw', deHex(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(texto)));
}

/** ¿Hay contraseña del dueño configurada ya? */
export const hayContrasena = async (db) => !!(await ajuste(db, USUARIOS.juan.hash));
/** ¿Está activado el acceso de soporte? */
export const haySoporte = async (db) => !!(await ajuste(db, USUARIOS.soporte.hash));

/** Guarda (o cambia) la contraseña de un usuario. Cambiar la del dueño cierra todas las sesiones. */
export async function guardarContrasena(db, clave, usuario = 'juan') {
  const u = USUARIOS[usuario];
  if (!u) throw new Error('usuario');
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(clave, sal);
  await guardarAjuste(db, u.sal, aHex(sal));
  await guardarAjuste(db, u.hash, aHex(hash));
  if (usuario === 'juan' || !(await ajuste(db, 'secreto_sesion'))) {
    // secreto nuevo para las cookies: todas las sesiones anteriores dejan de valer
    await guardarAjuste(db, 'secreto_sesion', aHex(crypto.getRandomValues(new Uint8Array(32))));
  }
  // si el dueño cambia su contraseña (por el enlace o en Ajustes), un enlace pendiente ya no debe poder cambiarla otra vez
  if (usuario === 'juan') await guardarAjuste(db, CLAVE_ENLACE, null);
  await guardarAjuste(db, 'intentos', null);
}

// ------------------------------------------------------------------ enlace para que el dueño ponga su contraseña
// Quien le lleva la web crea un enlace de un solo uso y se lo manda por WhatsApp: el dueño lo abre en el móvil, escribe
// su contraseña y entra. Así nadie tiene que pasarle una contraseña. Solo se guarda la huella SHA-256 del código.
const huella = async (texto) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(texto)));

/** Crea (o sustituye) el enlace. Devuelve el código que va en la dirección y cuándo caduca. */
export async function crearEnlaceJuan(db) {
  const codigo = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const caduca = Date.now() + DIAS_ENLACE * 86400000;
  await guardarAjuste(db, CLAVE_ENLACE, JSON.stringify({ h: aHex(await huella(codigo)), e: caduca }));
  return { codigo, caduca };
}

/** Fecha de caducidad del enlace pendiente, o null si no hay ninguno sin usar. */
export async function enlaceJuanPendiente(db) {
  try {
    const g = JSON.parse((await ajuste(db, CLAVE_ENLACE)) || 'null');
    return g && typeof g.e === 'number' && g.e > Date.now() ? g.e : null;
  } catch {
    return null;
  }
}

/** ¿Vale este código? (no lo gasta) */
export async function enlaceJuanValido(db, codigo) {
  if (typeof codigo !== 'string' || !/^[A-Za-z0-9_-]{30,60}$/.test(codigo)) return false;
  try {
    const g = JSON.parse((await ajuste(db, CLAVE_ENLACE)) || 'null');
    if (!g || typeof g.e !== 'number' || g.e <= Date.now() || typeof g.h !== 'string') return false;
    return iguales(await huella(codigo), deHex(g.h));
  } catch {
    return false;
  }
}

/** Gasta el enlace: pone la contraseña del dueño (se cierran todas las sesiones) y lo borra. */
export async function usarEnlaceJuan(db, codigo, clave) {
  const guardado = await ajuste(db, CLAVE_ENLACE);
  if (!guardado || !(await enlaceJuanValido(db, codigo))) return false;
  // de un solo uso de verdad: solo sigue quien consigue borrarlo (dos envíos a la vez no pueden usarlo los dos)
  const r = await db.prepare('DELETE FROM ajustes WHERE clave = ? AND valor = ?').bind(CLAVE_ENLACE, guardado).run();
  if (!r || !r.meta || r.meta.changes !== 1) return false;
  await guardarContrasena(db, clave, 'juan');
  return true;
}

// ------------------------------------------------------------------ acceso de soporte (NeumorStudio)
// La contraseña de soporte la pone el estudio como secreto CLAVE_SOPORTE en el proyecto de Cloudflare Pages: al entrar
// en el panel (con la clave que sea), si es nueva o ha cambiado, se guarda como contraseña de soporte. Así el estudio no necesita nunca la
// contraseña del dueño. El dueño ve en Ajustes que NeumorStudio tiene acceso y puede quitarlo (y volver a permitirlo).
const CLAVE_QUITADO = 'soporte_quitado';
/** ¿Ha quitado el dueño el acceso de soporte? (mientras sí, CLAVE_SOPORTE no vuelve a activarlo) */
export const soporteQuitado = async (db) => !!(await ajuste(db, CLAVE_QUITADO));

// Huella (PBKDF2, con su propia sal) de la CLAVE_SOPORTE con la que se activó: si en Cloudflare se pone otra, al
// entrar se sustituye. Si el soporte cambia su contraseña desde el panel, la huella sigue igual y no se pisa.
const CLAVE_ORIGEN = 'soporte_origen';

/** Si hay CLAVE_SOPORTE en Cloudflare y el dueño no ha quitado el acceso, activa el soporte con ella (la primera vez
 *  o cuando en Cloudflare se ha puesto una clave distinta). */
export async function sembrarSoporte(db, env) {
  const clave = typeof env?.CLAVE_SOPORTE === 'string' ? env.CLAVE_SOPORTE.trim() : '';
  if (clave.length < MIN_LONGITUD) return false;
  if (await soporteQuitado(db)) return false;
  try {
    const o = JSON.parse((await ajuste(db, CLAVE_ORIGEN)) || 'null');
    if (o && (await haySoporte(db)) && iguales(await derivar(clave, deHex(o.s)), deHex(o.h))) return false; // ya está
  } catch {}
  await guardarContrasena(db, clave, 'soporte'); // con secreto_sesion ya creado, las sesiones del dueño siguen
  const sal = crypto.getRandomValues(new Uint8Array(16));
  await guardarAjuste(db, CLAVE_ORIGEN, JSON.stringify({ s: aHex(sal), h: aHex(await derivar(clave, sal)) }));
  return true;
}

/** El dueño quita el acceso de soporte: se borra, se cierran sus sesiones y CLAVE_SOPORTE deja de activarlo. */
export async function quitarSoporte(db) {
  await guardarAjuste(db, CLAVE_ENLACE, null); // sin soporte, tampoco vale un enlace que creara el soporte
  await guardarAjuste(db, USUARIOS.soporte.sal, null);
  await guardarAjuste(db, USUARIOS.soporte.hash, null);
  await guardarAjuste(db, CLAVE_ORIGEN, null);
  await guardarAjuste(db, CLAVE_QUITADO, '1');
}

/** El dueño vuelve a permitir el acceso: la próxima vez que el estudio entre con CLAVE_SOPORTE, queda activado. */
export const permitirSoporte = (db) => guardarAjuste(db, CLAVE_QUITADO, null);

/** Devuelve { ok, usuario } o { ok: false, bloqueado: minutos, quedan } */
export async function comprobarContrasena(db, clave, soloUsuario = null) {
  const intentos = JSON.parse((await ajuste(db, 'intentos')) || '{"n":0,"hasta":0}');
  const ahora = Date.now();
  if (intentos.hasta > ahora) return { ok: false, bloqueado: Math.ceil((intentos.hasta - ahora) / 60000) };
  for (const [id, u] of Object.entries(USUARIOS)) {
    if (soloUsuario && id !== soloUsuario) continue;
    const sal = await ajuste(db, u.sal);
    const hash = await ajuste(db, u.hash);
    if (!sal || !hash) continue;
    if (iguales(await derivar(clave, deHex(sal)), deHex(hash))) {
      if (intentos.n) await guardarAjuste(db, 'intentos', null);
      return { ok: true, usuario: id };
    }
  }
  const n = (intentos.hasta ? 0 : intentos.n) + 1;
  await guardarAjuste(db, 'intentos', JSON.stringify({ n, hasta: n >= MAX_INTENTOS ? ahora + MINUTOS_BLOQUEO * 60000 : 0 }));
  return { ok: false, bloqueado: n >= MAX_INTENTOS ? MINUTOS_BLOQUEO : 0, quedan: Math.max(0, MAX_INTENTOS - n) };
}

export async function crearSesion(db, usuario = 'juan') {
  const secreto = await ajuste(db, 'secreto_sesion');
  const carga = base64url(enc.encode(JSON.stringify({ u: usuario, e: Date.now() + DIAS_SESION * 86400000, n: aHex(crypto.getRandomValues(new Uint8Array(8))) })));
  const firma = base64url(await firmar(secreto, carga));
  return `${carga}.${firma}`;
}

/** Devuelve { usuario, nombre } si la cookie es válida, o false. */
export async function sesionValida(db, valor) {
  if (!valor || !valor.includes('.')) return false;
  const secreto = await ajuste(db, 'secreto_sesion');
  if (!secreto) return false;
  const [carga, firma] = valor.split('.');
  try {
    if (!iguales(await firmar(secreto, carga), deBase64url(firma))) return false;
    const datos = JSON.parse(new TextDecoder().decode(deBase64url(carga)));
    if (typeof datos.e !== 'number' || datos.e <= Date.now()) return false;
    const usuario = USUARIOS[datos.u] ? datos.u : 'juan';
    if (usuario === 'soporte' && !(await haySoporte(db))) return false; // acceso de soporte retirado
    return { usuario, nombre: USUARIOS[usuario].nombre, caduca: datos.e };
  } catch {
    return false;
  }
}

// Lax (no Strict): al abrir el panel desde un aviso, un correo o WhatsApp, el dueño sigue dentro.
// Los cambios (POST, PUT…) solo se aceptan desde la propia web (lo comprueba el middleware por el origen).
export const cabeceraCookie = (valor, borrar = false) =>
  `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${borrar ? 0 : DIAS_SESION * 86400}`;

/** ¿Toca renovar la sesión? Si la cookie tiene más de un día, se da otra de 30: quien usa el panel no tiene que volver a entrar. */
export const renovarSesion = (valida) => !!valida?.caduca && valida.caduca - Date.now() < (DIAS_SESION - 1) * 86400000;

export function leerCookie(request) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}
