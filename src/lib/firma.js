// Firma de un contrato por el vendedor desde su enlace (/firmar/<token>) y los datos para montar su PDF.
import { rellenar, usaCampo, DEL_VENDEDOR, documentoValido, matriculaValida, bytesFirma, sha256, fechaLarga, fechaHora } from './contrato.js';
import { obtenerCaptacion, ajustesContrato } from './captaciones.js';
import { avisarTodos } from './push.js';
import { ajuste } from './datos.js';
import { MARCA } from './marca.js';

const texto = (v, max = 200) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, max));

/** Lo que tiene que rellenar el vendedor en este contrato: [campo, etiqueta, obligatorio, valor actual]. */
export function camposVendedor(k) {
  return DEL_VENDEDOR.filter(([campo]) => usaCampo(k.plantilla, campo) || campo === 'vendedor_nombre' || campo === 'vendedor_dni')
    .map(([campo, etiqueta, obligatorio]) => [campo, etiqueta, obligatorio, k.datos?.[campo] || '']);
}

/**
 * IP del firmante. La web llega por Vercel, que pone la IP del visitante en x-forwarded-for; Cloudflare ve la conexión
 * (cf-connecting-ip, la de Vercel). Como x-forwarded-for lo puede escribir quien llame directamente a Cloudflare, se
 * guardan las dos cuando no coinciden.
 */
export function ipDe(request) {
  const valida = (t) => /^[0-9a-f:.]{3,45}$/i.test(t || '');
  const xff = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const cf = (request.headers.get('cf-connecting-ip') || '').trim();
  if (valida(xff) && valida(cf) && xff !== cf) return `${xff} (conexión desde ${cf})`.slice(0, 120);
  return (valida(xff) ? xff : valida(cf) ? cf : '') || null;
}

/**
 * Firma el contrato. d = { vendedor_nombre, vendedor_dni, vendedor_domicilio, matricula, bastidor, acepto, firma }.
 * Devuelve { ok: true } o { error } (con el campo que falla en `campo`).
 */
export async function firmar(env, k, d, request) {
  if (!['Pendiente', 'Visto'].includes(k.estado)) {
    return { error: k.estado === 'Firmado' ? 'Este contrato ya está firmado.' : k.estado === 'Caducado' ? 'Este enlace ha caducado. Pide uno nuevo.' : 'Este enlace ya no es válido. Pide uno nuevo.' };
  }
  const valores = { ...k.datos };
  for (const [campo, etiqueta, obligatorio] of camposVendedor(k)) {
    const v = texto(d?.[campo], campo === 'vendedor_domicilio' ? 200 : 120);
    if (campo === 'vendedor_dni') {
      const doc = documentoValido(v);
      if (!doc) return { error: 'Revisa el DNI o NIE: la letra no cuadra con el número.', campo };
      valores[campo] = doc;
    } else if (campo === 'matricula') {
      if (!v && !obligatorio) continue;
      const m = matriculaValida(v);
      if (!m) return { error: 'Revisa la matrícula (por ejemplo, 1234 ABC).', campo };
      valores[campo] = m;
    } else if (campo === 'bastidor') {
      if (v && !/^[A-HJ-NPR-Z0-9]{11,17}$/i.test(v.replace(/\s/g, ''))) return { error: 'El número de bastidor tiene 17 letras y números.', campo };
      if (v) valores[campo] = v.replace(/\s/g, '').toUpperCase();
    } else {
      if (obligatorio && v.length < (campo === 'vendedor_nombre' ? 5 : 6)) return { error: `Rellena: ${etiqueta.toLowerCase()}.`, campo };
      if (v) valores[campo] = v;
    }
  }
  if (d?.acepto !== true) return { error: 'Marca la casilla para confirmar que has leído el acuerdo.', campo: 'acepto' };
  if (!bytesFirma(d?.firma)) return { error: 'Falta tu firma: dibújala con el dedo en el recuadro.', campo: 'firma' };

  const firmado = new Date().toISOString();
  valores.fecha = fechaLarga(new Date(firmado));
  const textoFinal = rellenar(k.plantilla, valores);
  const huella = await sha256(JSON.stringify({ contrato: k.id, texto: textoFinal, nombre: valores.vendedor_nombre, dni: valores.vendedor_dni, firma_vendedor: d.firma, firma_empresa: k.firma_empresa || null, firmado }));
  const agente = texto(request.headers.get('user-agent'), 300) || null;
  const r = await env.DB.prepare(`UPDATE contratos SET estado = 'Firmado', firmado = ?, firma_vendedor = ?, firmante_nombre = ?, firmante_dni = ?, texto_firmado = ?,
      datos = ?, ip = ?, agente = ?, huella = ? WHERE id = ? AND estado IN ('Pendiente', 'Visto')`)
    .bind(firmado, d.firma, valores.vendedor_nombre, valores.vendedor_dni, textoFinal, JSON.stringify(valores), ipDe(request), agente, huella, k.id).run();
  if (!r.meta.changes) return { error: 'Este contrato ya está firmado.' };

  // la captación pasa a «Firmado» y se queda con los datos que ha puesto el vendedor
  await env.DB.prepare(`UPDATE captaciones SET estado = CASE WHEN estado IN ('Contactado', 'Pendiente de firma') THEN 'Firmado' ELSE estado END,
      vendedor_nombre = ?, vendedor_dni = ?, vendedor_domicilio = COALESCE(?, vendedor_domicilio), matricula = COALESCE(?, matricula), actualizado = datetime('now') WHERE id = ?`)
    .bind(valores.vendedor_nombre, valores.vendedor_dni, valores.vendedor_domicilio || null, valores.matricula || null, k.captacion_id).run();
  return { ok: true, firmado, valores };
}

/** Avisos tras la firma: al móvil del dueño y por correo (al dueño y, si tiene correo, al vendedor con su enlace). */
export async function avisarFirma(env, k, valores, origen) {
  const cap = await obtenerCaptacion(env.DB, k.captacion_id).catch(() => null);
  const coche = valores.coche || cap?.titulo || 'el coche';
  const tareas = [avisarTodos(env.DB, { titulo: 'Contrato firmado', cuerpo: `${valores.vendedor_nombre} ha firmado el acuerdo de ${coche}`.slice(0, 140), url: `/admin/captaciones/${k.captacion_id}`, tag: `contrato-${k.id}` }).catch(() => {})];
  if (env.RESEND_API_KEY) {
    const remitente = env.CORREO_REMITENTE || MARCA.remitente;
    const juan = (await ajuste(env.DB, 'correo_avisos').catch(() => null)) || env.CORREO_DESTINO || MARCA.correo;
    const enviar = (para, asunto, html, extra = {}) => fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: remitente, to: [para], subject: asunto, html, ...extra }),
    }).then((r) => { if (!r.ok) console.error('Resend', r.status); }).catch((e) => console.error('Resend', e?.message));
    const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    tareas.push(enviar(juan, `Contrato firmado: ${coche}`.slice(0, 150), `<p><b>${esc(valores.vendedor_nombre)}</b> (DNI/NIE ${esc(valores.vendedor_dni)}) ha firmado el acuerdo de <b>${esc(coche)}</b>.</p><p><a href="${origen}/admin/captaciones/${k.captacion_id}">Ver la captación y descargar el contrato</a></p>`));
    const correo = cap?.vendedor_email;
    if (correo) {
      tareas.push(enviar(correo, `Tu copia del acuerdo con ${valores.empresa_nombre || MARCA.nombre}`.slice(0, 150), `<p>Hola, ${esc(valores.vendedor_nombre)}:</p><p>Gracias por firmar el acuerdo para la venta de tu <b>${esc(coche)}</b>.</p><p>Puedes descargar tu copia en PDF cuando quieras desde este enlace:<br><a href="${origen}/firmar/${k.token}">${origen}/firmar/${k.token}</a></p><p>Un saludo,<br>${esc(valores.empresa_representante || valores.empresa_nombre || MARCA.nombre)}</p>`, { reply_to: juan }));
    }
  }
  await Promise.all(tareas);
}

/** Todo lo que necesita el navegador para montar el PDF del contrato firmado. */
export async function datosPdf(env, k) {
  const aj = await ajustesContrato(env.DB);
  const v = k.datos || {};
  const canal = { whatsapp: 'WhatsApp', correo: 'correo electrónico', enlace: 'enlace copiado' }[k.canal] || k.canal || '—';
  return {
    id: k.id,
    texto: k.texto_firmado,
    empresa: { nombre: v.empresa_nombre || aj.empresa_nombre, representante: v.empresa_representante || aj.empresa_representante },
    firmante: { nombre: k.firmante_nombre, dni: k.firmante_dni },
    firmaEmpresa: k.firma_empresa || null,
    firmaVendedor: k.firma_vendedor,
    huella: k.huella,
    registro: [
      ['Contrato', `n.º ${k.id}`],
      ['Firmado por', `${k.firmante_nombre} · DNI/NIE ${k.firmante_dni}`],
      ['Fecha y hora de la firma (hora de España)', fechaHora(k.firmado)],
      ['Enlace enviado por', `${canal}${k.destino ? ` a ${k.destino}` : ''} el ${fechaHora(k.enviado || k.creado)}`],
      ['Primera apertura del enlace', fechaHora(k.visto)],
      ['Dirección IP', k.ip || '—'],
      ['Navegador y dispositivo', k.agente || '—'],
    ],
  };
}
