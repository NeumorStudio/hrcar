import { obtenerCoche, actualizarCoche, cambiarEstado, borrarCoche, subirAlPrincipio, asignarFotos, ESTADOS } from '../../../../lib/datos.js';
import { registrarVenta, ventaDeCoche, borrarVenta } from '../../../../lib/crm.js';
import { validarCoche, validarVenta } from '../../../../lib/validar.js';
import { borrarFotos, nombreDeRuta } from '../../../../lib/fotos.js';
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

/** Al dejar de estar vendido, se quita su última venta del registro (si el dueño lo pide). */
async function quitarVenta(db, slug) {
  const v = await ventaDeCoche(db, slug);
  if (v) await borrarVenta(db, v.id);
}

export async function PUT({ request, params, locals }) {
  const env = locals.runtime.env;
  const db = env.DB;
  const existente = await obtenerCoche(db, params.slug);
  if (!existente) return json({ ok: false, error: 'Ese coche ya no existe.' }, 404);
  const datos = await request.json().catch(() => null);
  if (!datos) return json({ ok: false, error: 'Datos no válidos.' }, 400);
  const { coche, error } = validarCoche(datos);
  if (error) return json({ ok: false, error }, 400);
  // la imagen para compartir (1200x630) se conserva mientras no cambie la portada
  coche.og_imagen = existente.fotos[0] === coche.fotos[0] ? existente.og_imagen : null;
  coche.ficha_campos = null; // al editar, la ficha muestra todos los datos
  if (existente.estado === 'Vendido' && coche.estado === 'Vendido') coche.fecha_venta = existente.fecha_venta;
  await actualizarCoche(db, params.slug, coche);
  await asignarFotos(db, params.slug, coche.fotos.map(nombreDeRuta));
  // las fotos que el dueño quitó se borran ahora, cuando el cambio ya está guardado (si cancela, no se pierde nada)
  const quitadas = existente.fotos.filter((f) => String(f).startsWith('/fotos/') && !coche.fotos.includes(f));
  if (quitadas.length) locals.runtime.ctx.waitUntil(borrarFotos(env, quitadas, request.url).catch(() => {}));
  // ventas: marcar como vendido apunta la venta; dejar de estarlo puede quitarla
  if (coche.estado === 'Vendido' && existente.estado !== 'Vendido') {
    const venta = validarVenta(datos.venta, { ...existente, ...coche, slug: params.slug });
    if (venta) await registrarVenta(db, venta);
  } else if (existente.estado === 'Vendido' && coche.estado !== 'Vendido' && datos.quitar_venta) {
    await quitarVenta(db, params.slug);
  }
  return json({ ok: true, slug: params.slug });
}

export async function PATCH({ request, params, locals }) {
  const db = locals.runtime.env.DB;
  const existente = await obtenerCoche(db, params.slug);
  if (!existente) return json({ ok: false, error: 'Ese coche ya no existe.' }, 404);
  const { estado, accion, quitar_venta: quitar } = await request.json().catch(() => ({}));
  if (accion === 'primero') {
    await subirAlPrincipio(db, params.slug);
    return json({ ok: true });
  }
  if (!ESTADOS.includes(estado)) return json({ ok: false, error: 'Estado no válido.' }, 400);
  await cambiarEstado(db, params.slug, estado);
  if (existente.estado === 'Vendido' && estado !== 'Vendido' && quitar) await quitarVenta(db, params.slug);
  return json({ ok: true, estado });
}

/** Lo que hay que saber antes de cambiar el estado desde el inventario: si tiene una venta apuntada. */
export async function GET({ params, locals }) {
  const db = locals.runtime.env.DB;
  const coche = await obtenerCoche(db, params.slug);
  if (!coche) return json({ ok: false, error: 'Ese coche ya no existe.' }, 404);
  const venta = await ventaDeCoche(db, params.slug);
  return json({ ok: true, estado: coche.estado, venta: venta ? { id: venta.id, precio_venta: venta.precio_venta, fecha: venta.fecha } : null });
}

export async function DELETE({ params, locals, request }) {
  const env = locals.runtime.env;
  const coche = await obtenerCoche(env.DB, params.slug);
  if (!coche) return json({ ok: true });
  await borrarCoche(env.DB, params.slug);
  // las fotos subidas desde el panel se borran con el coche (de KV, de la caché y del índice)
  locals.runtime.ctx.waitUntil(borrarFotos(env, coche.fotos.filter((x) => String(x).startsWith('/fotos/')), request.url).catch(() => {}));
  return json({ ok: true });
}
