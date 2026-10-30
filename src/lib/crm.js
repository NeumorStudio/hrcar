// Clientes, tareas, ventas y cálculos del panel (lo que en Arbicars era el CRM de pago).
import { preparar, normTel, normEmail } from './datos.js';

const ahora = () => new Date().toISOString().slice(0, 10);

/** Número para wa.me: con prefijo de país (los móviles españoles de 9 cifras llevan el 34). '' si no vale. */
export const telWhatsApp = (t) => {
  const d = normTel(t);
  if (d.length < 9) return '';
  return d.length === 9 ? `34${d}` : d;
};
/** Texto comparable para buscar: sin tildes, en minúsculas y con los espacios justos. */
export const llanoBusqueda = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** ¿Coincide la búsqueda? Todas las palabras tienen que estar (en cualquier orden); «clasea» encuentra «Clase A». */
export function coincide(texto, busqueda) {
  const t = llanoBusqueda(texto);
  const junto = t.replace(/[\s.-]/g, '');
  return llanoBusqueda(busqueda).split(' ').filter(Boolean).every((p) => t.includes(p) || junto.includes(p.replace(/[.-]/g, '')));
}

// ------------------------------------------------------------------ clientes
const POR_PAGINA = 100;
const CONTADORES = `(SELECT COUNT(*) FROM mensajes m WHERE m.cliente_id = c.id) AS mensajes,
      (SELECT COUNT(*) FROM tareas t WHERE t.cliente_id = c.id AND t.hecha = 0) AS tareas,
      (SELECT COUNT(*) FROM ventas v WHERE v.cliente_id = c.id) AS ventas`;

/** Clientes de 100 en 100, los que se movieron hace menos primero. Con `q`, busca en todos (sin tildes). */
export async function listarClientes(db, { q = '', pagina = 1 } = {}) {
  await preparar(db);
  if (q.trim()) {
    const { results } = await db.prepare('SELECT id, nombre, telefono, email FROM clientes ORDER BY actualizado DESC').all();
    const qTel = normTel(q);
    const ids = results.filter((c) => coincide(`${c.nombre} ${c.email || ''}`, q) || (qTel.length >= 3 && normTel(c.telefono).includes(qTel))).map((c) => c.id);
    const mostrar = ids.slice(0, 90); // D1 admite 100 parámetros por consulta
    if (!mostrar.length) return { clientes: [], total: 0, paginas: 1 };
    const { results: lista } = await db.prepare(`SELECT c.*, ${CONTADORES} FROM clientes c WHERE c.id IN (${mostrar.map(() => '?').join(', ')}) ORDER BY c.actualizado DESC`).bind(...mostrar).all();
    return { clientes: lista, total: ids.length, paginas: 1 };
  }
  const [cuenta, { results }] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS n FROM clientes').first(),
    db.prepare(`SELECT c.*, ${CONTADORES} FROM clientes c ORDER BY c.actualizado DESC LIMIT ? OFFSET ?`).bind(POR_PAGINA, (Math.max(1, pagina) - 1) * POR_PAGINA).all(),
  ]);
  return { clientes: results, total: cuenta.n, paginas: Math.max(1, Math.ceil(cuenta.n / POR_PAGINA)) };
}
/** Lo justo para un desplegable: los clientes con actividad más reciente. */
export async function clientesRecientes(db, limite = 150) {
  await preparar(db);
  const { results } = await db.prepare('SELECT id, nombre, telefono FROM clientes ORDER BY actualizado DESC LIMIT ?').bind(limite).all();
  return results;
}
export async function obtenerCliente(db, id) {
  await preparar(db);
  const c = await db.prepare('SELECT * FROM clientes WHERE id = ?').bind(id).first();
  if (!c) return null;
  const [m, t, v] = await Promise.all([
    db.prepare('SELECT * FROM mensajes WHERE cliente_id = ? ORDER BY id DESC').bind(id).all(),
    db.prepare('SELECT * FROM tareas WHERE cliente_id = ? ORDER BY hecha, fecha, hora').bind(id).all(),
    db.prepare('SELECT * FROM ventas WHERE cliente_id = ? ORDER BY fecha DESC').bind(id).all(),
  ]);
  return { ...c, mensajes: m.results.map((x) => ({ ...x, datos: JSON.parse(x.datos || '{}') })), tareas: t.results, ventas: v.results };
}
export async function crearCliente(db, c) {
  await preparar(db);
  const r = await db.prepare('INSERT INTO clientes (nombre, telefono, email, notas, origen, tel_norm, email_norm) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(c.nombre, c.telefono || null, c.email || null, c.notas || null, c.origen || 'manual', normTel(c.telefono) || null, normEmail(c.email) || null).run();
  return r.meta.last_row_id;
}
export async function actualizarCliente(db, id, c) {
  await db.prepare("UPDATE clientes SET nombre = ?, telefono = ?, email = ?, notas = ?, tel_norm = ?, email_norm = ?, actualizado = datetime('now') WHERE id = ?")
    .bind(c.nombre, c.telefono || null, c.email || null, c.notas || null, normTel(c.telefono) || null, normEmail(c.email) || null, id).run();
}
export async function borrarCliente(db, id) {
  await db.batch([
    db.prepare('UPDATE mensajes SET cliente_id = NULL WHERE cliente_id = ?').bind(id),
    db.prepare('UPDATE tareas SET cliente_id = NULL WHERE cliente_id = ?').bind(id),
    db.prepare('UPDATE ventas SET cliente_id = NULL WHERE cliente_id = ?').bind(id),
    db.prepare('DELETE FROM clientes WHERE id = ?').bind(id),
  ]);
}
/** Busca por teléfono o email; si no existe y hay nombre, lo crea. Devuelve el id o null. */
export async function clienteDesdeContacto(db, { nombre, telefono, email, origen }) {
  await preparar(db);
  const tel = normTel(telefono);
  const em = normEmail(email);
  if (!tel && !em) return null;
  // por índice: no hace falta leer todos los clientes en cada formulario
  const donde = [tel ? 'tel_norm = ?' : null, em ? 'email_norm = ?' : null].filter(Boolean).join(' OR ');
  const existente = await db.prepare(`SELECT id FROM clientes WHERE ${donde} ORDER BY id LIMIT 1`).bind(...[tel, em].filter(Boolean)).first();
  if (existente) {
    await db.prepare("UPDATE clientes SET actualizado = datetime('now'), telefono = COALESCE(telefono, ?), email = COALESCE(email, ?), tel_norm = COALESCE(tel_norm, ?), email_norm = COALESCE(email_norm, ?) WHERE id = ?")
      .bind(telefono || null, email || null, tel || null, em || null, existente.id).run();
    return existente.id;
  }
  return crearCliente(db, { nombre: nombre || telefono || email, telefono, email, origen: origen || 'web' });
}

// ------------------------------------------------------------------ tareas
/** Las pendientes (todas) y las 30 últimas hechas: las hechas antiguas no hace falta leerlas. */
export async function listarTareas(db) {
  await preparar(db);
  const [pendientes, hechas] = await Promise.all([
    db.prepare(`SELECT t.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
      FROM tareas t LEFT JOIN clientes c ON c.id = t.cliente_id WHERE t.hecha = 0 ORDER BY t.fecha IS NULL, t.fecha, t.hora, t.id`).all(),
    db.prepare(`SELECT t.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
      FROM tareas t LEFT JOIN clientes c ON c.id = t.cliente_id WHERE t.hecha = 1 ORDER BY t.id DESC LIMIT 30`).all(),
  ]);
  const hoy = ahora();
  return [...pendientes.results, ...hechas.results].map((t) => ({ ...t, atrasada: !t.hecha && t.fecha && t.fecha < hoy, esHoy: !t.hecha && t.fecha === hoy }));
}
export async function crearTarea(db, t) {
  await preparar(db);
  const r = await db.prepare('INSERT INTO tareas (titulo, fecha, hora, cliente_id, coche, notas) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(t.titulo, t.fecha || null, t.hora || null, t.cliente_id || null, t.coche || null, t.notas || null).run();
  return r.meta.last_row_id;
}
export async function marcarTarea(db, id, hecha) {
  await db.prepare('UPDATE tareas SET hecha = ? WHERE id = ?').bind(hecha ? 1 : 0, id).run();
}
export async function borrarTarea(db, id) {
  await db.prepare('DELETE FROM tareas WHERE id = ?').bind(id).run();
}

// ------------------------------------------------------------------ ventas
export async function listarVentas(db) {
  await preparar(db);
  const { results } = await db.prepare('SELECT v.*, c.nombre AS cliente_nombre FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id ORDER BY v.fecha DESC, v.id DESC').all();
  return results;
}
export async function registrarVenta(db, v) {
  await preparar(db);
  const r = await db.prepare('INSERT INTO ventas (coche, titulo, cliente_id, comprador, precio_venta, coste, fecha, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(v.coche || null, v.titulo, v.cliente_id || null, v.comprador || null, v.precio_venta, v.coste ?? null, v.fecha || ahora(), v.notas || null).run();
  return r.meta.last_row_id;
}
export async function borrarVenta(db, id) {
  await db.prepare('DELETE FROM ventas WHERE id = ?').bind(id).run();
}
/** La última venta apuntada de un coche (o null). */
export async function ventaDeCoche(db, slug) {
  await preparar(db);
  return db.prepare('SELECT * FROM ventas WHERE coche = ? ORDER BY id DESC LIMIT 1').bind(slug).first();
}
export function resumenVentas(ventas) {
  const mes = ahora().slice(0, 7);
  const del = ventas.filter((v) => v.fecha.startsWith(mes));
  const suma = (l, k) => l.reduce((a, v) => a + (v[k] ?? 0), 0);
  const beneficio = (l) => l.filter((v) => v.coste != null).reduce((a, v) => a + v.precio_venta - v.coste, 0);
  return { mes, coches: del.length, facturado: suma(del, 'precio_venta'), beneficio: beneficio(del), total: ventas.length, facturadoTotal: suma(ventas, 'precio_venta'), beneficioTotal: beneficio(ventas) };
}

// ------------------------------------------------------------------ cálculos de importación
export async function listarCalculos(db) {
  await preparar(db);
  const { results } = await db.prepare('SELECT * FROM calculos ORDER BY id DESC LIMIT 50').all();
  return results.map((c) => ({ ...c, datos: JSON.parse(c.datos || '{}') }));
}
export async function guardarCalculo(db, c) {
  await preparar(db);
  const r = await db.prepare('INSERT INTO calculos (titulo, url, datos) VALUES (?, ?, ?)').bind(c.titulo || null, c.url || null, JSON.stringify(c.datos || {})).run();
  return r.meta.last_row_id;
}
export async function borrarCalculo(db, id) {
  await db.prepare('DELETE FROM calculos WHERE id = ?').bind(id).run();
}

// ------------------------------------------------------------------ resumen para el inicio
export async function resumenPanel(db) {
  await preparar(db);
  const hoy = ahora();
  const mes = hoy.slice(0, 7);
  const [coches, nuevos, tareas, ventasMes] = await Promise.all([
    db.prepare('SELECT estado, COUNT(*) AS n FROM coches GROUP BY estado').all(),
    db.prepare('SELECT COUNT(*) AS n FROM mensajes WHERE leido = 0').first(),
    db.prepare(`SELECT t.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono FROM tareas t LEFT JOIN clientes c ON c.id = t.cliente_id
      WHERE t.hecha = 0 AND (t.fecha IS NULL OR t.fecha <= ?) ORDER BY t.fecha, t.hora LIMIT 20`).bind(hoy).all(),
    // solo las ventas de este mes (por índice), no todo el histórico
    db.prepare(`SELECT COUNT(*) AS coches, COALESCE(SUM(precio_venta), 0) AS facturado,
      COALESCE(SUM(CASE WHEN coste IS NOT NULL THEN precio_venta - coste ELSE 0 END), 0) AS beneficio FROM ventas WHERE fecha >= ?`).bind(`${mes}-01`).first(),
  ]);
  const estados = Object.fromEntries(coches.results.map((r) => [r.estado, r.n]));
  return { estados, mensajesNuevos: nuevos.n, tareas: tareas.results.map((t) => ({ ...t, atrasada: t.fecha && t.fecha < hoy })), ventas: { mes, ...ventasMes } };
}
