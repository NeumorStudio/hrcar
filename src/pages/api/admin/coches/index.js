import { crearCoche, obtenerCoche, asignarFotos } from '../../../../lib/datos.js';
import { registrarVenta } from '../../../../lib/crm.js';
import { validarCoche, generarSlug, validarVenta } from '../../../../lib/validar.js';
import { nombreDeRuta } from '../../../../lib/fotos.js';
import { actualizarCaptacion } from '../../../../lib/captaciones.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function POST({ request, locals }) {
  const db = locals.runtime.env.DB;
  const datos = await request.json().catch(() => null);
  if (!datos) return json({ ok: false, error: 'Datos no válidos.' }, 400);
  const { coche, error } = validarCoche(datos);
  if (error) return json({ ok: false, error }, 400);
  let slug = generarSlug(coche);
  while (await obtenerCoche(db, slug)) slug = generarSlug(coche);
  const creado = await crearCoche(db, { ...coche, slug, og_imagen: null });
  await asignarFotos(db, slug, coche.fotos.map(nombreDeRuta));
  // dado de alta ya vendido (para apuntar una venta pasada): también va al registro de ventas
  const venta = coche.estado === 'Vendido' ? validarVenta(datos.venta, creado) : null;
  if (venta) await registrarVenta(db, venta);
  // publicado desde una captación: queda ligado a ella (y la captación pasa a «Publicado»)
  const captacion = /^\d{1,12}$/.test(String(datos.captacion_id || '')) ? Number(datos.captacion_id) : null;
  if (captacion) await actualizarCaptacion(db, captacion, { coche: creado.slug, estado: 'Publicado' }).catch((e) => console.error('captación', e?.message));
  return json({ ok: true, slug: creado.slug });
}
