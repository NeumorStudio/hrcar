import { crearCoche, obtenerCoche, asignarFotos } from '../../../../lib/datos.js';
import { registrarVenta } from '../../../../lib/crm.js';
import { validarCoche, generarSlug, validarVenta } from '../../../../lib/validar.js';
import { nombreDeRuta } from '../../../../lib/fotos.js';
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
  return json({ ok: true, slug: creado.slug });
}
