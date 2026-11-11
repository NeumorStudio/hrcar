// Nueva captación a partir del enlace de un anuncio (o con los datos ya leídos en la calculadora).
import { leerAnuncio, portal, normalizarCombustible, normalizarCambio } from '../../../../lib/anuncio.js';
import { crearCaptacion, actualizarCaptacion } from '../../../../lib/captaciones.js';
import { marcaConocida } from '../../../../data/modelos.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function POST({ request, locals }) {
  const db = locals.runtime.env.DB;
  const d = await request.json().catch(() => ({}));
  // desde un mensaje de «Vende tu coche» de la web: el vendedor ya viene con su contacto y los datos del coche
  if (/^\d{1,12}$/.test(String(d.mensaje_id || ''))) {
    const m = await db.prepare('SELECT * FROM mensajes WHERE id = ?').bind(Number(d.mensaje_id)).first();
    if (!m) return json({ ok: false, error: 'Ese mensaje ya no existe.' }, 404);
    let campos = {};
    try { campos = JSON.parse(m.datos || '{}'); } catch { campos = {}; }
    const buscar = (re) => { const k = Object.keys(campos).find((x) => re.test(x)); return k ? String(campos[k]).trim() : null; };
    const numero = (t) => { const n = Number(String(t || '').replace(/[^\d]/g, '')); return Number.isFinite(n) && n > 0 ? n : null; };
    const marca = buscar(/^(marca|make|brand)$/i);
    // el formulario de la web es texto libre o lista («diesel», «Híbrido»…): se pasa a los valores de la ficha
    const combustible = buscar(/^(combustible|fuel)$/i);
    const datos = {
      portal: 'Tu web', marca: marcaConocida(marca) || marca, modelo: buscar(/^(modelo|model)$/i), version: buscar(/^(version|versi[oó]n|variant)$/i),
      anio: numero(buscar(/^(a[nñ]o|anio|year|matriculacion|fecha_matriculacion)$/i))?.toString().slice(0, 4) || null, km: numero(buscar(/^(km|kms|kilometros|kil[oó]metros|mileage)$/i)),
      combustible: normalizarCombustible(combustible) || combustible, cambio: normalizarCambio(buscar(/^(cambio|transmisi[oó]n|transmission|gearbox)$/i)),
      titulo: m.coche || null,
    };
    const precio = numero(buscar(/^(precio|price|precio_deseado|precio_pedido)$/i));
    const id = await crearCaptacion(db, { url: null, datos, precio_anuncio: precio });
    await actualizarCaptacion(db, id, { vendedor_nombre: m.nombre, vendedor_telefono: m.telefono, vendedor_email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email || '') ? m.email : null, notas: `Llegó por «Vende tu coche» de la web (mensaje del ${String(m.fecha).slice(0, 10).split('-').reverse().join('/')}).` });
    return json({ ok: true, id });
  }
  let url = null;
  if (d.url) {
    try { const u = new URL(String(d.url).trim()); if (!/^https?:$/.test(u.protocol)) throw new Error(); url = u.toString(); } catch { return json({ ok: false, error: 'Pega un enlace completo (empieza por https://).' }, 400); }
  }
  let datos = d.datos && typeof d.datos === 'object' ? d.datos : null;
  let aviso = null;
  if (!datos && url) {
    try {
      datos = await leerAnuncio(url);
    } catch (e) {
      datos = { portal: portal(url)?.nombre || null };
      aviso = `No he podido leer el anuncio (${e.message}). Rellena los datos del coche en la ficha.`;
    }
    if (datos.bloqueado) aviso = `${datos.portal || 'El portal'} no ha dejado leer la página. He sacado del enlace lo que dice (marca, modelo, año…); pon el precio y los km a mano.`;
  }
  if (!datos && !url) datos = {};
  const id = await crearCaptacion(db, { url, datos: { ...datos, ...(d.precio_anuncio ? { precio: d.precio_anuncio } : {}) } });
  return json({ ok: true, id, aviso });
}
