// Recibe cualquier formulario de la web, lo guarda en el panel (Mensajes), avisa al móvil del dueño y, si Resend
// está configurado, se lo manda también por correo.
//
// Variables de entorno (Cloudflare → proyecto → Settings → Variables):
//   RESEND_API_KEY   clave de Resend (de las de "solo envío")          — sin ella, el mensaje queda en el panel y en el móvil
//   CORREO_DESTINO   a quién le llegan los avisos                       — por defecto NEGOCIO.email (src/negocio.js)
//   CORREO_REMITENTE remitente verificado en Resend                     — por defecto NEGOCIO.remitente
//
// Tope diario de correos (NEGOCIO.topeCorreosDia): la cuenta de Resend es compartida con otros proyectos del estudio,
// así que un robot que rellene formularios sin parar no puede gastar la cuota de los demás. Pasado el tope, los
// mensajes siguen entrando en el panel y avisando al móvil; solo deja de salir el correo hasta el día siguiente.
import { guardarMensaje, marcarEnviado, ajuste } from '../../lib/datos.js';
import { clienteDesdeContacto } from '../../lib/crm.js';
import { avisarTodos } from '../../lib/push.js';
import { guardarPendiente } from '../../lib/pendientes.js';
import { NEGOCIO, SITIO } from '../../negocio.js';

const DESTINO_POR_DEFECTO = NEGOCIO.email;
const REMITENTE_POR_DEFECTO = NEGOCIO.remitente;
const MAX_ADJUNTOS_BYTES = 20 * 1024 * 1024;

// Etiquetas legibles para el correo (el resto de campos sale con su nombre)
export const ETIQUETAS = {
  coche: 'Coche',
  nombre: 'Nombre', name: 'Nombre', contactName: 'Nombre',
  email: 'Email', contactEmail: 'Email',
  telefono: 'Teléfono', phone: 'Teléfono', contactPhone: 'Teléfono',
  mensaje: 'Mensaje', message: 'Mensaje', comments: 'Comentarios',
  make: 'Marca', model: 'Modelo', year: 'Año', mileage: 'Kilómetros', fuel: 'Combustible', transmission: 'Cambio',
  minYear: 'Año mínimo', maxBudget: 'Presupuesto máximo (€)',
  tipo: 'Tipo de vehículo',
  importe: 'Importe a financiar (€)', plazo: 'Plazo (meses)', cuota_estimada: 'Cuota estimada',
  acepto: 'Acepta condiciones de pre-reserva',
  tema: 'Asunto',
  consentimiento_financiera: 'Autoriza compartir sus datos con la financiera',
};
const OCULTOS = new Set(['website', 'formulario', 'asunto', 'pagina', 'fotos']);

const json = (datos, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

const escapar = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** ¿Queda cupo de correos hoy? Cuenta cada envío en la base de datos (una fila por día). */
async function quedaCupo(db, tope) {
  if (!tope) return true;
  const hoy = new Date().toISOString().slice(0, 10);
  const n = Number(await db.prepare("INSERT INTO ajustes (clave, valor) VALUES (?, '1') ON CONFLICT(clave) DO UPDATE SET valor = CAST(CAST(valor AS INTEGER) + 1 AS TEXT) RETURNING valor").bind(`correos:${hoy}`).first('valor'));
  if (n === 1) await db.prepare("DELETE FROM ajustes WHERE clave LIKE 'correos:%' AND clave < ?").bind(`correos:${hoy}`).run().catch(() => {});
  return n <= tope;
}

function base64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

export async function POST({ request, locals }) {
  const env = locals.runtime.env;
  let datos;
  try {
    datos = await request.formData();
  } catch {
    return json({ ok: false, error: 'formato' }, 400);
  }

  // Campo trampa para robots: si viene relleno, fingimos que todo ha ido bien.
  if (String(datos.get('website') || '').trim()) return json({ ok: true });

  let email = String(datos.get('email') || datos.get('contactEmail') || '').trim();
  let telefono = String(datos.get('telefono') || datos.get('phone') || datos.get('contactPhone') || '').trim();
  // campo «Teléfono o email»: si escribieron un email ahí, es un email
  if (!email && telefono.includes('@')) { email = telefono; telefono = ''; }
  if (!email && !telefono) return json({ ok: false, error: 'contacto' }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: 'email' }, 400);

  const formulario = String(datos.get('formulario') || 'contacto').slice(0, 30);
  const asunto = String(datos.get('asunto') || 'Formulario web').slice(0, 80);
  const coche = String(datos.get('coche') || '').trim().slice(0, 200);
  const pagina = String(datos.get('pagina') || '').slice(0, 300);
  const nombre = String(datos.get('nombre') || datos.get('name') || datos.get('contactName') || '').trim().slice(0, 120);

  const filas = [];
  const campos = {};
  for (const [clave, valor] of datos.entries()) {
    if (OCULTOS.has(clave) || typeof valor !== 'string' || !valor.trim()) continue;
    const v = clave === 'acepto' ? 'Sí' : valor.trim().slice(0, 4000);
    filas.push([ETIQUETAS[clave] || clave, v]);
    campos[clave] = v;
  }

  const adjuntos = [];
  let total = 0;
  for (const f of datos.getAll('fotos')) {
    if (typeof f === 'string' || !f.size) continue;
    if (total + f.size > MAX_ADJUNTOS_BYTES || adjuntos.length >= 10) break;
    total += f.size;
    adjuntos.push({ filename: f.name || `foto-${adjuntos.length + 1}.jpg`, content: base64(await f.arrayBuffer()) });
  }

  // 1) Siempre queda guardado en el panel, pase lo que pase con el correo.
  let idMensaje = null;
  let enEspera = false;
  try {
    const cliente_id = await clienteDesdeContacto(env.DB, { nombre, telefono, email, origen: 'web' }).catch(() => null);
    idMensaje = await guardarMensaje(env.DB, { formulario, asunto, coche, nombre, email, telefono, datos: campos, pagina, fotos: adjuntos.length, cliente_id });
  } catch (e) {
    console.error('No se pudo guardar el mensaje', e);
    // la base de datos no responde: el mensaje espera en KV y entra en el panel en cuanto el dueño lo abra
    try {
      await guardarPendiente(env, { formulario, asunto, coche, nombre, email, telefono, datos: campos, pagina, fotos: adjuntos.length });
      enEspera = true;
    } catch (e2) {
      console.error('Tampoco se pudo dejar en espera', e2);
    }
  }

  // 1b) Aviso al móvil del dueño (si tiene el panel instalado con avisos), sin retrasar la respuesta.
  if (idMensaje) {
    const quien = nombre || telefono || email;
    const aviso = avisarTodos(env.DB, { titulo: `${asunto}${coche ? `: ${coche}` : ''}`.slice(0, 80), cuerpo: `${quien}${campos.mensaje || campos.message || campos.comments ? ' — ' + String(campos.mensaje || campos.message || campos.comments).slice(0, 120) : ''}`, url: '/admin/mensajes?nuevos=1', tag: `mensaje-${idMensaje}` }).catch(() => {});
    if (locals.runtime.ctx?.waitUntil) locals.runtime.ctx.waitUntil(aviso); else await aviso;
  }

  // 2) Correo al dueño (si Resend está configurado y queda cupo hoy).
  const guardado = !!idMensaje || enEspera;
  if (!env.RESEND_API_KEY) return guardado ? json({ ok: true, correo: false }) : json({ ok: false, error: 'sin-configurar' }, 500);
  let cupo = true;
  try {
    cupo = await quedaCupo(env.DB, NEGOCIO.topeCorreosDia);
  } catch { /* sin base de datos no se puede contar: se manda */ }
  if (!cupo) return guardado ? json({ ok: true, correo: false }) : json({ ok: false, error: 'envio' }, 502);

  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111">
<h2 style="margin:0 0 12px">${escapar(asunto)}${coche ? ` — ${escapar(coche)}` : ''}</h2>
<table cellpadding="8" style="border-collapse:collapse;font-size:15px">
${filas.map(([k, v]) => `<tr><td style="border-bottom:1px solid #eee;color:#666;vertical-align:top">${escapar(k)}</td><td style="border-bottom:1px solid #eee;white-space:pre-wrap">${escapar(v)}</td></tr>`).join('\n')}
</table>
${adjuntos.length ? `<p style="color:#666">${adjuntos.length} foto(s) adjunta(s).</p>` : ''}
<p style="color:#999;font-size:12px;margin-top:24px">Enviado desde ${escapar(pagina || SITIO)}. Puedes responder directamente a este correo. También lo tienes en ${escapar(SITIO)}/admin/mensajes.</p>
</body></html>`;
  const texto = `${asunto}${coche ? ` — ${coche}` : ''}\n\n${filas.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nEnviado desde ${pagina || SITIO}`;

  let destino = env.CORREO_DESTINO;
  try {
    destino = (await ajuste(env.DB, 'correo_avisos')) || destino;
  } catch { /* sin base de datos seguimos con el correo por defecto */ }

  let respuesta;
  try {
    respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.CORREO_REMITENTE || REMITENTE_POR_DEFECTO,
        to: [destino || DESTINO_POR_DEFECTO],
        ...(email ? { reply_to: email } : {}),
        subject: `${asunto}${coche ? `: ${coche}` : ''}`.slice(0, 150),
        html,
        text: texto,
        ...(adjuntos.length ? { attachments: adjuntos } : {}),
      }),
    });
  } catch (e) {
    console.error('Resend sin respuesta', e);
    return guardado ? json({ ok: true, correo: false }) : json({ ok: false, error: 'envio' }, 502);
  }

  if (!respuesta.ok) {
    console.error('Resend', respuesta.status, await respuesta.text());
    return guardado ? json({ ok: true, correo: false }) : json({ ok: false, error: 'envio' }, 502);
  }
  if (idMensaje) await marcarEnviado(env.DB, idMensaje).catch(() => {});
  return json({ ok: true, correo: true });
}

export const ALL = () => json({ ok: false, error: 'metodo' }, 405);
