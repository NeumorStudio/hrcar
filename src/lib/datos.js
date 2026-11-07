// Acceso a la base de datos (Cloudflare D1). Un coche se maneja siempre como el mismo
// objeto que usaba coches.json, así las plantillas no cambian.
import semilla from '../data/coches.json';
import { NEGOCIO } from '../negocio.js';

const CAMPOS_JSON = ['fotos', 'ficha_campos'];
const COLUMNAS = [
  'slug', 'titulo', 'marca', 'modelo', 'version', 'estado', 'tipo', 'carroceria', 'combustible', 'cambio',
  'puertas', 'potencia_cv', 'color', 'etiqueta_dgt', 'garantia_meses', 'ubicacion', 'anio', 'km',
  'precio', 'precio_oferta', 'precio_financiado', 'reservable', 'fotos', 'descripcion', 'notas',
  'matricula', 'coste', 'ficha_campos', 'og_imagen', 'orden', 'fecha_venta',
];
export const ESTADOS = ['Disponible', 'Próximamente', 'Reservado', 'Vendido', 'Oculto'];
/** Estados que no se enseñan en la web pública: «Oculto» es un coche que el dueño aún prepara o retira un tiempo. */
export const NO_PUBLICOS = ['Oculto'];
export const TIPOS = ['Ocasión', 'Km 0', 'Seminuevo', 'Nuevo', 'Demo', 'Gerencia', 'Renting'];

const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS coches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    titulo TEXT NOT NULL,
    marca TEXT, modelo TEXT, version TEXT,
    estado TEXT NOT NULL DEFAULT 'Disponible',
    tipo TEXT DEFAULT 'Ocasión',
    carroceria TEXT, combustible TEXT, cambio TEXT,
    puertas INTEGER, potencia_cv INTEGER, color TEXT, etiqueta_dgt TEXT,
    garantia_meses INTEGER, ubicacion TEXT, anio INTEGER, km INTEGER,
    precio INTEGER, precio_oferta INTEGER, precio_financiado INTEGER,
    reservable INTEGER NOT NULL DEFAULT 1,
    fotos TEXT NOT NULL DEFAULT '[]',
    descripcion TEXT, notas TEXT, matricula TEXT, coste INTEGER,
    ficha_campos TEXT, og_imagen TEXT,
    orden INTEGER NOT NULL DEFAULT 0,
    fecha_venta TEXT,
    creado TEXT NOT NULL DEFAULT (datetime('now')),
    actualizado TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS mensajes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL DEFAULT (datetime('now')),
    formulario TEXT, asunto TEXT, coche TEXT, nombre TEXT, email TEXT, telefono TEXT,
    datos TEXT NOT NULL DEFAULT '{}', pagina TEXT, fotos INTEGER NOT NULL DEFAULT 0,
    leido INTEGER NOT NULL DEFAULT 0, enviado INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS fotos (
    nombre TEXT PRIMARY KEY, tipo TEXT, bytes INTEGER, coche TEXT,
    creado TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  'CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT)',
  `CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL, telefono TEXT, email TEXT, notas TEXT, origen TEXT,
    creado TEXT NOT NULL DEFAULT (datetime('now')), actualizado TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS tareas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL, fecha TEXT, hora TEXT, cliente_id INTEGER, coche TEXT, notas TEXT,
    hecha INTEGER NOT NULL DEFAULT 0, creado TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coche TEXT, titulo TEXT NOT NULL, cliente_id INTEGER, comprador TEXT,
    precio_venta INTEGER NOT NULL, coste INTEGER, fecha TEXT NOT NULL, notas TEXT,
    creado TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS calculos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT, url TEXT, datos TEXT NOT NULL DEFAULT '{}', creado TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // Captaciones: coches de particulares que LIDIAUTO vende por ellos (precio neto para el dueño + su comisión).
  `CREATE TABLE IF NOT EXISTS captaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estado TEXT NOT NULL DEFAULT 'Contactado',
    url TEXT, portal TEXT, titulo TEXT, datos TEXT NOT NULL DEFAULT '{}',
    vendedor_nombre TEXT, vendedor_telefono TEXT, vendedor_email TEXT, vendedor_dni TEXT, vendedor_domicilio TEXT,
    matricula TEXT, precio_anuncio INTEGER, precio_neto INTEGER, precio_venta INTEGER, gastos INTEGER,
    tasacion TEXT, coche TEXT, notas TEXT,
    creado TEXT NOT NULL DEFAULT (datetime('now')), actualizado TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // Contratos que firma el vendedor desde un enlace (texto congelado al enviarlo, firma, registro y PDF).
  `CREATE TABLE IF NOT EXISTS contratos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    captacion_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE,
    estado TEXT NOT NULL DEFAULT 'Pendiente',
    canal TEXT, destino TEXT, plantilla TEXT NOT NULL, datos TEXT NOT NULL DEFAULT '{}',
    firma_empresa TEXT, firma_vendedor TEXT, firmante_nombre TEXT, firmante_dni TEXT, texto_firmado TEXT,
    creado TEXT NOT NULL DEFAULT (datetime('now')), enviado TEXT, visto TEXT, firmado TEXT, caduca TEXT NOT NULL,
    ip TEXT, agente TEXT, huella TEXT, pdf_huella TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS suscripciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL UNIQUE, datos TEXT NOT NULL, usuario TEXT, dispositivo TEXT, creado TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];
// columnas añadidas después de la primera versión
const COLUMNAS_NUEVAS = [
  ['mensajes', 'cliente_id', 'INTEGER'],
  ['clientes', 'tel_norm', 'TEXT'], // teléfono y email normalizados: buscar un cliente sin leer toda la tabla
  ['clientes', 'email_norm', 'TEXT'],
];
// Sin índices, cada listado de clientes leía clientes × mensajes filas y agotaba la cuota diaria gratuita de D1.
const INDICES = [
  'CREATE INDEX IF NOT EXISTS idx_coches_estado ON coches(estado)',
  'CREATE INDEX IF NOT EXISTS idx_mensajes_cliente ON mensajes(cliente_id)',
  'CREATE INDEX IF NOT EXISTS idx_mensajes_leido ON mensajes(leido)',
  'CREATE INDEX IF NOT EXISTS idx_tareas_cliente ON tareas(cliente_id, hecha)',
  'CREATE INDEX IF NOT EXISTS idx_tareas_hecha ON tareas(hecha, fecha)',
  'CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id)',
  'CREATE INDEX IF NOT EXISTS idx_ventas_coche ON ventas(coche)',
  'CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha)',
  'CREATE INDEX IF NOT EXISTS idx_fotos_coche ON fotos(coche)',
  'CREATE INDEX IF NOT EXISTS idx_clientes_tel ON clientes(tel_norm)',
  'CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email_norm)',
  'CREATE INDEX IF NOT EXISTS idx_clientes_actualizado ON clientes(actualizado)',
  'CREATE INDEX IF NOT EXISTS idx_captaciones_estado ON captaciones(estado, actualizado)',
  'CREATE INDEX IF NOT EXISTS idx_captaciones_coche ON captaciones(coche)',
  'CREATE INDEX IF NOT EXISTS idx_contratos_captacion ON contratos(captacion_id)',
];
// Súbelo cuando cambien ESQUEMA, COLUMNAS_NUEVAS o INDICES: así cada arranque solo hace una lectura.
const VERSION_ESQUEMA = '3';

/** Teléfono comparable: solo cifras, sin 00 ni el prefijo de España (600 11 22 33 = +34 600112233). */
export const normTel = (t) => {
  let d = String(t || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('34')) d = d.slice(2);
  return d;
};
export const normEmail = (e) => String(e || '').trim().toLowerCase();

let listo = null;
/** Crea las tablas la primera vez, las pone al día y carga el stock inicial en una base nueva. */
export async function preparar(db) {
  if (!listo) {
    listo = (async () => {
      const hecho = await db.prepare("SELECT valor FROM ajustes WHERE clave = 'esquema'").first('valor').catch(() => null);
      if (hecho === VERSION_ESQUEMA) return;
      await db.batch(ESQUEMA.map((s) => db.prepare(s)));
      for (const [tabla, col, tipo] of COLUMNAS_NUEVAS) {
        const { results } = await db.prepare(`PRAGMA table_info(${tabla})`).all();
        if (!results.some((c) => c.name === col)) await db.prepare(`ALTER TABLE ${tabla} ADD COLUMN ${col} ${tipo}`).run();
      }
      await db.batch(INDICES.map((s) => db.prepare(s)));
      // clientes de antes: rellenar el teléfono y el email normalizados (en SQL, pocas consultas aunque haya miles)
      const SIN_SEPARADORES = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefono, ' ', ''), '-', ''), '.', ''), '(', ''), ')', ''), '+', ''), '/', ''), CHAR(160), ''), CHAR(9), '')";
      await db.batch([
        db.prepare(`UPDATE clientes SET tel_norm = ${SIN_SEPARADORES} WHERE tel_norm IS NULL AND telefono IS NOT NULL`),
        db.prepare("UPDATE clientes SET tel_norm = SUBSTR(tel_norm, 3) WHERE tel_norm LIKE '00%'"),
        db.prepare("UPDATE clientes SET tel_norm = SUBSTR(tel_norm, 3) WHERE LENGTH(tel_norm) = 11 AND tel_norm LIKE '34%'"),
        db.prepare("UPDATE clientes SET tel_norm = NULL WHERE tel_norm = ''"),
        db.prepare('UPDATE clientes SET email_norm = LOWER(TRIM(email)) WHERE email_norm IS NULL AND email IS NOT NULL'),
      ]);
      // lo que el SQL no supo dejar en cifras (otros caracteres raros), con la misma función que usa la web
      const { results: raros } = await db.prepare("SELECT id, telefono FROM clientes WHERE tel_norm GLOB '*[^0-9]*' LIMIT 20").all();
      for (const c of raros) await db.prepare('UPDATE clientes SET tel_norm = ? WHERE id = ?').bind(normTel(c.telefono) || null, c.id).run();
      // solo una base recién creada recibe el stock inicial (si el dueño borra todos sus coches, no vuelven)
      const nueva = hecho === null && !(await db.prepare("SELECT 1 AS x FROM ajustes WHERE clave = 'version'").first());
      if (nueva && !(await db.prepare('SELECT 1 AS x FROM coches LIMIT 1').first())) {
        if (semilla.length) await db.batch(semilla.map((c, i) => insercion(db, { ...c, orden: i })));
        await db.batch([
          db.prepare("INSERT OR REPLACE INTO ajustes (clave, valor) VALUES ('version', '1')"),
          // lo que sale oculto en una web nueva (p. ej. «Reservar por 100 €»): el dueño lo enciende en Tu web
          ...(NEGOCIO.ocultosIniciales.length ? [db.prepare("INSERT OR IGNORE INTO ajustes (clave, valor) VALUES ('web_oculto', ?)").bind(JSON.stringify(NEGOCIO.ocultosIniciales))] : []),
        ]);
      }
      await db.prepare("INSERT INTO ajustes (clave, valor) VALUES ('esquema', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor").bind(VERSION_ESQUEMA).run();
    })().catch((e) => { listo = null; throw e; });
  }
  return listo;
}

function aFila(c) {
  const fila = {};
  for (const k of COLUMNAS) {
    let v = c[k];
    if (v === undefined) v = null;
    if (CAMPOS_JSON.includes(k)) v = v == null ? (k === 'fotos' ? '[]' : null) : JSON.stringify(v);
    if (k === 'reservable') v = v === false || v === 0 ? 0 : 1;
    if (v === '') v = null;
    fila[k] = v;
  }
  return fila;
}

function insercion(db, c) {
  const fila = aFila(c);
  const cols = Object.keys(fila);
  return db.prepare(`INSERT INTO coches (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).bind(...cols.map((k) => fila[k]));
}

export function deFila(f) {
  if (!f) return null;
  const c = { ...f };
  for (const k of CAMPOS_JSON) c[k] = c[k] ? JSON.parse(c[k]) : (k === 'fotos' ? [] : null);
  c.reservable = c.reservable !== 0;
  return c;
}

// Primero lo que se puede comprar ya; dentro de cada grupo, el orden que pone el dueño (los nuevos, arriba).
const ORDEN = "ORDER BY CASE estado WHEN 'Disponible' THEN 0 WHEN 'Próximamente' THEN 1 WHEN 'Reservado' THEN 2 WHEN 'Oculto' THEN 3 ELSE 4 END, orden ASC, id DESC";
const EN_VENTA = "estado NOT IN ('Vendido', 'Oculto')";
const ORDEN_VENDIDOS = 'ORDER BY COALESCE(fecha_venta, actualizado) DESC, id DESC';

/** Todos los coches (solo para el panel y tareas puntuales: con los años crece mucho). */
export async function listarCoches(db) {
  await preparar(db);
  const { results } = await db.prepare(`SELECT * FROM coches ${ORDEN}`).all();
  return results.map(deFila);
}

/** Los que se pueden comprar o reservar (ni vendidos ni ocultos), en el orden del listado. */
export async function listarEnVenta(db) {
  await preparar(db);
  const { results } = await db.prepare(`SELECT * FROM coches WHERE ${EN_VENTA} ${ORDEN}`).all();
  return results.map(deFila);
}

/** Coches que ve el dueño en el inventario sin pedir los vendidos: en venta y ocultos. */
export async function listarEnStock(db) {
  await preparar(db);
  const { results } = await db.prepare(`SELECT * FROM coches WHERE estado != 'Vendido' ${ORDEN}`).all();
  return results.map(deFila);
}

/** Lo que enseña la web pública en los listados: los coches en venta y los últimos vendidos. */
export async function listarPublicos(db, vendidos = 12) {
  const [enVenta, ultimos] = await Promise.all([listarEnVenta(db), vendidos > 0 ? listarVendidos(db, vendidos) : []]);
  return [...enVenta, ...ultimos];
}

/** Los últimos vendidos (para «Últimas entregas» y el inventario), del más reciente al más antiguo. */
export async function listarVendidos(db, limite = 24, desde = 0) {
  await preparar(db);
  const { results } = await db.prepare(`SELECT * FROM coches WHERE estado = 'Vendido' ${ORDEN_VENDIDOS} LIMIT ? OFFSET ?`).bind(limite, desde).all();
  return results.map(deFila);
}

/** Cuántos coches hay en cada estado: { Disponible: 5, Vendido: 40, … } */
export async function contarPorEstado(db) {
  await preparar(db);
  const { results } = await db.prepare('SELECT estado, COUNT(*) AS n FROM coches GROUP BY estado').all();
  return Object.fromEntries(results.map((r) => [r.estado, r.n]));
}

/** Tres coches en venta parecidos a este (misma marca primero y precio cercano), para el final de la ficha. */
export async function listarParecidos(db, c, limite = 3) {
  await preparar(db);
  const precio = c.precio_oferta ?? c.precio ?? 0;
  const { results } = await db.prepare(`SELECT * FROM coches WHERE ${EN_VENTA} AND slug != ?
    ORDER BY CASE WHEN marca = ? THEN 0 ELSE 1 END, ABS(COALESCE(precio_oferta, precio, 0) - ?), orden LIMIT ?`).bind(c.slug, c.marca ?? '', precio, limite).all();
  return results.map(deFila);
}

/** Lo justo para el mapa del sitio. */
export async function listarParaMapa(db) {
  await preparar(db);
  const { results } = await db.prepare(`SELECT slug, actualizado FROM coches WHERE ${EN_VENTA} ${ORDEN}`).all();
  return results;
}

/** Marcas y modelos ya usados, para autocompletar en el alta. */
export async function marcasYModelos(db) {
  await preparar(db);
  const [m, mo] = await Promise.all([
    db.prepare('SELECT DISTINCT marca AS v FROM coches WHERE marca IS NOT NULL').all(),
    db.prepare('SELECT DISTINCT modelo AS v FROM coches WHERE modelo IS NOT NULL ORDER BY modelo').all(),
  ]);
  return { marcas: m.results.map((r) => r.v), modelos: mo.results.map((r) => r.v) };
}

/** Coches para los desplegables (tareas, ventas): los que hay en stock y los últimos vendidos. */
export async function cochesParaElegir(db, vendidos = 20) {
  await preparar(db);
  const [a, b] = await Promise.all([
    db.prepare(`SELECT slug, titulo, estado, coste, precio, precio_oferta FROM coches WHERE estado != 'Vendido' ${ORDEN}`).all(),
    db.prepare(`SELECT slug, titulo, estado, coste, precio, precio_oferta FROM coches WHERE estado = 'Vendido' ${ORDEN_VENDIDOS} LIMIT ?`).bind(vendidos).all(),
  ]);
  return [...a.results, ...b.results];
}

export async function obtenerCoche(db, slug) {
  await preparar(db);
  return deFila(await db.prepare('SELECT * FROM coches WHERE slug = ?').bind(slug).first());
}

export async function crearCoche(db, c) {
  await preparar(db);
  const { minimo } = await db.prepare('SELECT MIN(orden) AS minimo FROM coches').first();
  await insercion(db, { ...c, orden: (minimo ?? 1) - 1 }).run(); // los nuevos salen los primeros
  await tocar(db);
  return obtenerCoche(db, c.slug);
}

export async function actualizarCoche(db, slug, c) {
  await preparar(db);
  const fila = aFila(c);
  delete fila.slug;
  delete fila.orden;
  const cols = Object.keys(fila);
  await db.prepare(`UPDATE coches SET ${cols.map((k) => `${k} = ?`).join(', ')}, actualizado = datetime('now') WHERE slug = ?`)
    .bind(...cols.map((k) => fila[k]), slug).run();
  await tocar(db);
  return obtenerCoche(db, slug);
}

export async function cambiarEstado(db, slug, estado) {
  await preparar(db);
  await db.prepare("UPDATE coches SET estado = ?, fecha_venta = CASE WHEN ? = 'Vendido' THEN date('now') ELSE NULL END, actualizado = datetime('now') WHERE slug = ?")
    .bind(estado, estado, slug).run();
  await tocar(db);
}

export async function borrarCoche(db, slug) {
  await preparar(db);
  await db.prepare('DELETE FROM coches WHERE slug = ?').bind(slug).run();
  await tocar(db);
}

export async function subirAlPrincipio(db, slug) {
  await preparar(db);
  const { minimo } = await db.prepare('SELECT MIN(orden) AS minimo FROM coches').first();
  await db.prepare("UPDATE coches SET orden = ?, actualizado = datetime('now') WHERE slug = ?").bind((minimo ?? 1) - 1, slug).run();
  await tocar(db);
}

// ------------------------------------------------------------------ ajustes
export async function ajuste(db, clave) {
  await preparar(db);
  const f = await db.prepare('SELECT valor FROM ajustes WHERE clave = ?').bind(clave).first();
  return f ? f.valor : null;
}
export async function guardarAjuste(db, clave, valor) {
  await preparar(db);
  if (valor === null) await db.prepare('DELETE FROM ajustes WHERE clave = ?').bind(clave).run();
  else await db.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor').bind(clave, valor).run();
}
/** Cambia la versión del contenido: así la caché de las páginas públicas se renueva. */
export async function tocar(db) {
  await db.prepare("INSERT INTO ajustes (clave, valor) VALUES ('version', '1') ON CONFLICT(clave) DO UPDATE SET valor = CAST(CAST(valor AS INTEGER) + 1 AS TEXT)").run();
}
export async function version(db) {
  return (await ajuste(db, 'version')) ?? '0';
}
/** Versión del contenido y lo que el dueño oculta de la web, en una sola lectura (el middleware lo pide en cada página). */
export async function estadoWeb(db) {
  await preparar(db);
  const { results } = await db.prepare("SELECT clave, valor FROM ajustes WHERE clave IN ('version', 'web_oculto')").all();
  const m = Object.fromEntries(results.map((f) => [f.clave, f.valor]));
  return { version: m.version ?? '0', oculto: m.web_oculto ?? null };
}

// ------------------------------------------------------------------ mensajes
export async function guardarMensaje(db, m) {
  await preparar(db);
  const r = await db.prepare(
    "INSERT INTO mensajes (formulario, asunto, coche, nombre, email, telefono, datos, pagina, fotos, enviado, cliente_id, fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))",
  ).bind(m.formulario, m.asunto, m.coche || null, m.nombre || null, m.email || null, m.telefono || null, JSON.stringify(m.datos ?? {}), m.pagina || null, m.fotos ?? 0, m.enviado ? 1 : 0, m.cliente_id ?? null, m.fecha || null).run();
  return r.meta.last_row_id;
}
export async function marcarEnviado(db, id) {
  await db.prepare('UPDATE mensajes SET enviado = 1 WHERE id = ?').bind(id).run();
}
/** Mensajes de 50 en 50 (los más nuevos primero). `antes`: id desde el que seguir; `nuevos`: solo los sin leer. */
export async function listarMensajes(db, { antes = null, nuevos = false, limite = 50 } = {}) {
  await preparar(db);
  const donde = [nuevos ? 'leido = 0' : null, antes ? 'id < ?' : null].filter(Boolean);
  const { results } = await db.prepare(`SELECT * FROM mensajes ${donde.length ? `WHERE ${donde.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ?`)
    .bind(...(antes ? [antes] : []), limite + 1).all();
  const lista = results.slice(0, limite).map((m) => ({ ...m, datos: JSON.parse(m.datos || '{}') }));
  return { mensajes: lista, hayMas: results.length > limite };
}
export async function ultimosSinLeer(db, limite = 3) {
  await preparar(db);
  const { results } = await db.prepare('SELECT * FROM mensajes WHERE leido = 0 ORDER BY id DESC LIMIT ?').bind(limite).all();
  return results.map((m) => ({ ...m, datos: JSON.parse(m.datos || '{}') }));
}
export async function marcarTodosLeidos(db) {
  await db.prepare('UPDATE mensajes SET leido = 1 WHERE leido = 0').run();
}
export async function contarMensajesNuevos(db) {
  await preparar(db);
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM mensajes WHERE leido = 0').first();
  return n;
}
export async function marcarLeido(db, id, leido = true) {
  await db.prepare('UPDATE mensajes SET leido = ? WHERE id = ?').bind(leido ? 1 : 0, id).run();
}
export async function borrarMensaje(db, id) {
  await db.prepare('DELETE FROM mensajes WHERE id = ?').bind(id).run();
}

// ------------------------------------------------------------------ fotos (índice de las guardadas en KV)
export async function registrarFoto(db, nombre, tipo, bytes, coche = null) {
  await preparar(db);
  await db.prepare('INSERT OR REPLACE INTO fotos (nombre, tipo, bytes, coche) VALUES (?, ?, ?, ?)').bind(nombre, tipo, bytes, coche).run();
}
export async function asignarFotos(db, slug, nombres) {
  await db.prepare('UPDATE fotos SET coche = NULL WHERE coche = ?').bind(slug).run();
  if (nombres.length) await db.batch(nombres.map((n) => db.prepare('UPDATE fotos SET coche = ? WHERE nombre = ?').bind(slug, n)));
}
export async function borrarFoto(db, nombre) {
  await db.prepare('DELETE FROM fotos WHERE nombre = ?').bind(nombre).run();
}
export async function borrarRegistroFotos(db, nombres) {
  for (let i = 0; i < nombres.length; i += 50) {
    const lote = nombres.slice(i, i + 50);
    await db.prepare(`DELETE FROM fotos WHERE nombre IN (${lote.map(() => '?').join(', ')})`).bind(...lote).run();
  }
}
/** Espacio que ocupan las fotos subidas (bytes) y cuántas son. El plan gratuito de KV da 1 GB. */
export async function espacioFotos(db) {
  await preparar(db);
  const r = await db.prepare('SELECT COALESCE(SUM(bytes), 0) AS bytes, COUNT(*) AS n FROM fotos').first();
  return { bytes: r.bytes, n: r.n };
}
/**
 * Fotos subidas hace más de 8 días que no están en ningún coche (se subieron y no se llegó a guardar, o se quitaron).
 * (Un borrador del panel dura 7 días: si se recupera, sus fotos siguen ahí.)
 * Antes de darlas por perdidas se comprueba que ningún coche las use.
 */
export async function fotosHuerfanas(db, limite = 10) {
  await preparar(db);
  const { results } = await db.prepare("SELECT nombre FROM fotos WHERE coche IS NULL AND creado < datetime('now', '-8 days') LIMIT ?").bind(limite).all();
  if (!results.length) return [];
  const { results: coches } = await db.prepare('SELECT fotos FROM coches').all();
  const usadas = new Set(coches.flatMap((c) => JSON.parse(c.fotos || '[]')).map((f) => String(f).split('/').pop()));
  return results.map((f) => f.nombre).filter((n) => !usadas.has(n));
}
/** Coches vendidos hace más de `dias` con más de una foto subida: se puede dejar solo la portada. */
export async function vendidosConFotos(db, dias = 180) {
  await preparar(db);
  const { results } = await db.prepare("SELECT slug, fotos FROM coches WHERE estado = 'Vendido' AND COALESCE(fecha_venta, actualizado) < date('now', ?)").bind(`-${dias} days`).all();
  return results.map((c) => ({ slug: c.slug, fotos: JSON.parse(c.fotos || '[]') })).filter((c) => c.fotos.slice(1).some((f) => String(f).startsWith('/fotos/')));
}
/** Deja un coche con solo su portada (sin tocar la fecha de actualización ni la caché de la web más de la cuenta). */
export async function dejarSoloPortada(db, slug, portada) {
  await db.prepare('UPDATE coches SET fotos = ? WHERE slug = ?').bind(JSON.stringify(portada ? [portada] : []), slug).run();
}
