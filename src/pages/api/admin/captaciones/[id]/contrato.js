// Prepara el contrato de una captación y lo manda (WhatsApp lo abre el panel; el correo sale de aquí por Resend).
import { obtenerCaptacion, ajustesContrato, crearContrato, anularContrato } from '../../../../../lib/captaciones.js';
import { telWhatsApp } from '../../../../../lib/crm.js';
import { origenPublico } from '../../../../../lib/origen.js';
import { MARCA } from '../../../../../lib/marca.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export async function POST({ request, params, locals }) {
  const env = locals.runtime.env;
  const id = /^\d{1,12}$/.test(params.id || '') ? Number(params.id) : null;
  const cap = id ? await obtenerCaptacion(env.DB, id) : null;
  if (!cap) return json({ ok: false, error: 'Esa captación ya no existe.' }, 404);
  const d = await request.json().catch(() => ({}));
  const canal = ['whatsapp', 'correo', 'enlace'].includes(d.canal) ? d.canal : 'enlace';
  if (canal === 'correo' && !cap.vendedor_email) return json({ ok: false, error: 'Pon el correo del vendedor y guarda antes de enviarlo por correo.' }, 400);
  if (canal === 'correo' && !env.RESEND_API_KEY) return json({ ok: false, error: 'El envío de correos no está activado en esta web. Mándalo por WhatsApp o copia el enlace.' }, 400);
  const aj = await ajustesContrato(env.DB);
  let k;
  try {
    k = await crearContrato(env.DB, cap, aj, { canal, destino: canal === 'correo' ? cap.vendedor_email : canal === 'whatsapp' ? cap.vendedor_telefono : null });
  } catch (e) {
    return json({ ok: false, error: e.message }, 400);
  }
  const origen = origenPublico(request, env);
  const enlace = `${origen}/firmar/${k.token}`;
  const coche = [cap.datos?.marca, cap.datos?.modelo].filter(Boolean).join(' ') || cap.titulo || 'tu coche';
  const quien = aj.empresa_representante ? `${aj.empresa_representante.split(' ')[0]}, de ${aj.empresa_nombre}` : aj.empresa_nombre;
  const nombre = (cap.vendedor_nombre || '').split(' ')[0];
  const mensaje = `Hola${nombre ? ` ${nombre}` : ''}, soy ${quien}. Te paso el acuerdo para la venta de tu ${coche}. Lo puedes leer y firmar con el dedo desde el móvil en este enlace (vale ${aj.dias_enlace} días):\n${enlace}`;
  if (canal === 'correo') {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.CORREO_REMITENTE || MARCA.remitente,
        to: [cap.vendedor_email],
        subject: `Acuerdo para la venta de tu ${coche}`.slice(0, 150),
        html: `<p>Hola${nombre ? ` ${esc(nombre)}` : ''}:</p><p>Soy ${esc(quien)}. Te paso el acuerdo para la venta de tu <b>${esc(coche)}</b>. Lo puedes leer y firmar con el dedo desde el móvil o con el ratón desde el ordenador:</p><p><a href="${enlace}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Leer y firmar el acuerdo</a></p><p style="color:#666">El enlace vale ${aj.dias_enlace} días. Si tienes cualquier duda, responde a este correo.</p>`,
        text: mensaje,
      }),
    }).catch(() => null);
    if (!r || !r.ok) return json({ ok: false, error: 'No se ha podido enviar el correo. Prueba por WhatsApp o copia el enlace.', enlace, mensaje }, 502);
  }
  const tel = telWhatsApp(cap.vendedor_telefono);
  return json({ ok: true, id: k.id, enlace, mensaje, whatsapp: `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}` });
}

/** Anular el contrato pendiente (el enlace deja de funcionar). */
export async function PATCH({ request, params, locals }) {
  const env = locals.runtime.env;
  const d = await request.json().catch(() => ({}));
  const cap = /^\d{1,12}$/.test(params.id || '') ? await obtenerCaptacion(env.DB, Number(params.id)) : null;
  const k = cap?.contratos.find((x) => x.id === Number(d.contrato_id));
  if (!k) return json({ ok: false, error: 'No encuentro ese contrato.' }, 404);
  if (d.accion !== 'anular' || !(await anularContrato(env.DB, k.id))) return json({ ok: false, error: 'Ese contrato ya no se puede anular.' }, 400);
  if (cap.estado === 'Pendiente de firma') await env.DB.prepare("UPDATE captaciones SET estado = 'Contactado', actualizado = datetime('now') WHERE id = ?").bind(cap.id).run();
  return json({ ok: true });
}
