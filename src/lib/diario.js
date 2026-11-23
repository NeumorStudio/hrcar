// Lo que se hace una vez al día. Cloudflare Pages no tiene cron: lo lanza la primera visita del día a la web
// (después de responder) o al inicio del panel. Baja los precios programados, apunta en Tareas las ITV que
// caducan y borra las visitas de hace más de un año.
import { preparar, tocar } from './datos.js';
import { tituloLimpio } from './nombres.js';

/** Fecha de hoy en España (AAAA-MM-DD): a medianoche en Madrid ya es otro día, aunque en UTC no. */
export const hoyMadrid = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d);
export const sumarDias = (fecha, n) => {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
const fechaEs = (f) => f.split('-').reverse().join('/');

/** Días en stock: desde la fecha de entrada o, si no la tiene, desde que se dio de alta. */
export const diasEnStock = (c, hoy = hoyMadrid()) => {
  const desde = c.fecha_entrada || String(c.creado || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(desde) ? Math.max(0, diasEntre(desde, hoy)) : null;
};

// ------------------------------------------------------------ bajada de precio programada
// El plan baja el precio que se ve (el de oferta), así la web enseña el precio normal tachado.
// bajada = { cantidad, cada, minimo, desde, inicio }: «desde» es el precio que se veía el día «inicio».
const pasosHasta = (b, hoy) => Math.floor(Math.max(0, diasEntre(b.inicio, hoy)) / b.cada);
const precioTrasPasos = (b, pasos) => Math.max(b.minimo, b.desde - pasos * b.cantidad);

/** El precio que toca hoy según el plan, o null si todavía no toca ninguna bajada. */
export function precioPlan(b, hoy = hoyMadrid()) {
  if (!b?.inicio || b.desde == null) return null;
  const pasos = pasosHasta(b, hoy);
  return pasos < 1 ? null : precioTrasPasos(b, pasos);
}

/** La siguiente bajada: { fecha, precio }, o null si ya está en el mínimo. */
export function proximaBajada(b, hoy = hoyMadrid()) {
  if (!b?.inicio || b.desde == null) return null;
  const pasos = pasosHasta(b, hoy) + 1;
  const precio = precioTrasPasos(b, pasos);
  if (precio >= precioTrasPasos(b, pasos - 1)) return null;
  return { fecha: sumarDias(b.inicio, pasos * b.cada), precio };
}

/** Al guardar: si no cambian ni el precio que se ve ni el plan, sigue contando; si cambia algo, empieza hoy. */
export function planBajada(nuevo, existente, hoy = hoyMadrid()) {
  const b = nuevo.bajada;
  if (!b) return null;
  const visible = nuevo.precio_oferta ?? nuevo.precio;
  const antes = existente?.bajada;
  const igual = antes && antes.cantidad === b.cantidad && antes.cada === b.cada && antes.minimo === b.minimo
    && (existente.precio_oferta ?? existente.precio) === visible;
  return igual ? antes : { ...b, desde: visible, inicio: hoy };
}

/** El nuevo precio de oferta que toca hoy a un coche, o null si no cambia. */
function bajadaDeHoy(c, hoy) {
  if (c.estado !== 'Disponible' || !c.bajada) return null;
  const objetivo = precioPlan(c.bajada, hoy);
  if (objetivo == null || objetivo >= (c.precio_oferta ?? c.precio) || objetivo >= c.precio) return null;
  return objetivo;
}

// ------------------------------------------------------------ la tarea del día
let hecho = null; // día ya hecho en este isolate: no se vuelve a preguntar a la base de datos
let enCurso = null;

/** Lanza la tarea del día si no se ha hecho hoy. Devuelve una promesa que no falla. */
export function tareasDelDia(db) {
  const hoy = hoyMadrid();
  if (hecho === hoy) return Promise.resolve(false);
  enCurso ??= hacer(db, hoy)
    .then((r) => { hecho = hoy; return r; })
    .catch((e) => { console.error('Tarea del día', e?.message || e); return false; })
    .finally(() => { enCurso = null; });
  return enCurso;
}

async function hacer(db, hoy) {
  await preparar(db);
  // solo una petición se queda con el día, aunque lleguen varias a la vez
  const turno = await db.prepare("INSERT INTO ajustes (clave, valor) VALUES ('tareas_dia', ?1) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor WHERE ajustes.valor < excluded.valor").bind(hoy).run();
  if (!turno.meta?.changes) return false;

  // 1. bajadas de precio
  const { results: conPlan } = await db.prepare("SELECT slug, estado, precio, precio_oferta, bajada FROM coches WHERE bajada IS NOT NULL AND estado = 'Disponible'").all();
  const bajadas = [];
  for (const f of conPlan) {
    let bajada = null;
    try { bajada = JSON.parse(f.bajada); } catch { continue; }
    const nuevo = bajadaDeHoy({ ...f, bajada }, hoy);
    if (nuevo != null) bajadas.push(db.prepare("UPDATE coches SET precio_oferta = ?, actualizado = datetime('now') WHERE slug = ?").bind(nuevo, f.slug));
  }
  if (bajadas.length) {
    await db.batch(bajadas);
    await tocar(db); // la web se vuelve a generar con los precios nuevos
  }

  // 2. ITV que caduca en los próximos 30 días (o ya caducada): una tarea por coche y fecha
  const { results: itv } = await db.prepare("SELECT slug, titulo, marca, modelo, itv FROM coches WHERE itv IS NOT NULL AND itv <= ? AND estado != 'Vendido'").bind(sumarDias(hoy, 30)).all();
  const tareas = itv.map((c) => {
    const titulo = c.itv < hoy
      ? `ITV caducada: ${tituloLimpio(c)} (desde el ${fechaEs(c.itv)})`
      : `Pasar la ITV del ${tituloLimpio(c)} (caduca el ${fechaEs(c.itv)})`;
    const aviso = sumarDias(c.itv, -7) > hoy ? sumarDias(c.itv, -7) : hoy; // una semana antes, o hoy si ya no da tiempo
    // una sola tarea por coche y fecha de ITV (si ya avisó de que caducaba, no vuelve a avisar de que ha caducado)
    return db.prepare("INSERT INTO tareas (titulo, fecha, coche) SELECT ?1, ?2, ?3 WHERE NOT EXISTS (SELECT 1 FROM tareas WHERE coche = ?3 AND instr(titulo, 'ITV') > 0 AND instr(titulo, ?4) > 0)")
      .bind(titulo.slice(0, 200), aviso, c.slug, fechaEs(c.itv));
  });
  if (tareas.length) await db.batch(tareas);

  // 3. las visitas de hace más de 400 días ya no se enseñan
  await db.prepare('DELETE FROM visitas WHERE dia < ?').bind(sumarDias(hoy, -400)).run();
  return true;
}
