// Captaciones (coches de particulares que el concesionario vende por ellos) y sus contratos.
import { preparar, ajuste } from './datos.js';
import { COSTES_POR_DEFECTO } from './importacion.js';
import { PLANTILLA_PROVISIONAL, tokenNuevo, fechaLarga } from './contrato.js';
import { MARCA } from './marca.js';

export const ESTADOS_CAPTACION = ['Contactado', 'Pendiente de firma', 'Firmado', 'Publicado', 'Vendido', 'Descartado'];
export const AYUDA_ESTADO_CAPTACION = {
  Contactado: 'Has hablado con el vendedor; falta mandarle el contrato.',
  'Pendiente de firma': 'Le has mandado el contrato y aún no lo ha firmado.',
  Firmado: 'Contrato firmado: ya puedes publicarlo en tu web.',
  Publicado: 'Está en tu inventario, a la venta.',
  Vendido: 'Vendido: la comisión queda apuntada en Ventas.',
  Descartado: 'No siguió adelante.',
};
const json = (t, por = {}) => { try { return JSON.parse(t || ''); } catch { return por; } };
const texto = (v, max = 200) => (v == null ? null : String(v).trim().slice(0, max) || null);
const entero = (v, min = 0, max = 10000000) => {
  if (v === '' || v == null) return null;
  const n = Math.round(Number(String(v).replace(',', '.')));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
};

/** Datos de la empresa y opciones de los contratos (Ajustes → Contratos). */
export async function ajustesContrato(db) {
  const g = json(await ajuste(db, 'contrato_ajustes'), {});
  return {
    empresa_nombre: g.empresa_nombre || MARCA.nombre,
    empresa_nif: g.empresa_nif || '',
    empresa_domicilio: g.empresa_domicilio || MARCA.domicilio,
    empresa_representante: g.empresa_representante || MARCA.representante || MARCA.titular || '',
    ciudad: g.ciudad || MARCA.localidad,
    plazo_dias: Number(g.plazo_dias) || 60,
    dias_enlace: Number(g.dias_enlace) || 14,
    plantilla: (await ajuste(db, 'contrato_plantilla')) || MARCA.plantilla || PLANTILLA_PROVISIONAL,
    plantilla_propia: !!(await ajuste(db, 'contrato_plantilla')) || !!MARCA.plantilla,
    plantilla_editada: !!(await ajuste(db, 'contrato_plantilla')),
    firma: (await ajuste(db, 'contrato_firma')) || null,
  };
}

/** Gastos por defecto de una captación: cambio de nombre + gestoría nacional (los de la calculadora). */
export async function gastosPorDefecto(db) {
  const costes = { ...COSTES_POR_DEFECTO, ...json(await ajuste(db, 'costes'), {}) };
  return (Number(costes.cambio_nombre) || 0) + (Number(costes.gestoria_nacional) || 0);
}

const deFila = (f) => (f ? { ...f, datos: json(f.datos, {}), tasacion: f.tasacion ? json(f.tasacion, null) : null } : null);
/** Estado que se enseña: si el coche ya está vendido en el inventario, la captación está vendida. */
const estadoVisible = (f) => (f.coche_estado === 'Vendido' && f.estado !== 'Descartado' ? 'Vendido' : f.estado);
export const comision = (c) => (c.precio_venta != null && c.precio_neto != null ? c.precio_venta - c.precio_neto - (c.gastos || 0) : null);

export async function listarCaptaciones(db, { estado = '' } = {}) {
  await preparar(db);
  const { results } = await db.prepare(`SELECT c.id, c.estado, c.url, c.portal, c.titulo, c.datos, c.vendedor_nombre, c.vendedor_telefono,
      c.precio_anuncio, c.precio_neto, c.precio_venta, c.gastos, c.coche, c.creado, c.actualizado, co.estado AS coche_estado,
      (SELECT estado FROM contratos k WHERE k.captacion_id = c.id ORDER BY k.id DESC LIMIT 1) AS contrato_estado,
      (SELECT caduca FROM contratos k WHERE k.captacion_id = c.id ORDER BY k.id DESC LIMIT 1) AS contrato_caduca
    FROM captaciones c LEFT JOIN coches co ON co.slug = c.coche ORDER BY c.actualizado DESC LIMIT 300`).all();
  const lista = results.map((f) => ({ ...deFila(f), estado: estadoVisible(f) }));
  const cuenta = Object.fromEntries(ESTADOS_CAPTACION.map((e) => [e, 0]));
  for (const c of lista) cuenta[c.estado] = (cuenta[c.estado] || 0) + 1;
  const activas = (c) => !['Vendido', 'Descartado'].includes(c.estado);
  return { captaciones: estado ? lista.filter((c) => c.estado === estado) : lista.filter(activas), cuenta, activas: lista.filter(activas).length };
}

export async function obtenerCaptacion(db, id) {
  await preparar(db);
  const f = await db.prepare('SELECT c.*, co.estado AS coche_estado, co.titulo AS coche_titulo FROM captaciones c LEFT JOIN coches co ON co.slug = c.coche WHERE c.id = ?').bind(id).first();
  if (!f) return null;
  const { results } = await db.prepare('SELECT id, token, estado, canal, destino, creado, enviado, visto, firmado, caduca, firmante_nombre, firmante_dni, huella FROM contratos WHERE captacion_id = ? ORDER BY id DESC').bind(id).all();
  return { ...deFila(f), estado: estadoVisible(f), contratos: results.map(conCaducidad) };
}

/** Un contrato pendiente cuyo enlace ya pasó de fecha se enseña como «Caducado». */
export const conCaducidad = (k) => (['Pendiente', 'Visto'].includes(k.estado) && k.caduca && k.caduca < new Date().toISOString() ? { ...k, estado: 'Caducado' } : k);

/** Crea una captación con lo leído del anuncio. Devuelve su id. */
export async function crearCaptacion(db, { url, datos, precio_anuncio }) {
  await preparar(db);
  const d = datos && typeof datos === 'object' ? datos : {};
  const gastos = await gastosPorDefecto(db);
  const titulo = texto(d.titulo || [d.marca, d.modelo, d.version].filter(Boolean).join(' '), 160);
  const r = await db.prepare(`INSERT INTO captaciones (url, portal, titulo, datos, precio_anuncio, gastos) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(texto(url, 500), texto(d.portal, 40), titulo, JSON.stringify(limpiarDatos(d)), entero(precio_anuncio ?? d.precio), gastos).run();
  return r.meta.last_row_id;
}

/** Solo lo que sirve del anuncio, con tamaños razonables (la tabla no es un vertedero). */
export function limpiarDatos(d) {
  const t = (k, max) => texto(d[k], max);
  const n = (k, max) => entero(d[k], 0, max);
  return {
    portal: t('portal', 40), origen: d.origen === 'extranjero' ? 'extranjero' : 'espana',
    titulo: t('titulo', 160), marca: t('marca', 60), modelo: t('modelo', 80), version: t('version', 160),
    anio: n('anio', 2100), km: n('km', 3000000), precio: n('precio', 10000000), combustible: t('combustible', 40), cambio: t('cambio', 20),
    potencia_cv: n('potencia_cv', 2000), puertas: n('puertas', 9), carroceria: t('carroceria', 40), color: t('color', 40),
    etiqueta_dgt: ['0', 'ECO', 'C', 'B'].includes(d.etiqueta_dgt) ? d.etiqueta_dgt : null, etiqueta_estimada: !!d.etiqueta_estimada,
    co2: n('co2', 600), garantia_meses: n('garantia_meses', 120), ubicacion: t('ubicacion', 60),
    descripcion: t('descripcion', 5000), fotos: Array.isArray(d.fotos) ? d.fotos.filter((f) => typeof f === 'string' && /^https:\/\/[^\s"'<>]{8,600}$/.test(f)).slice(0, 20) : [],
    profesional: typeof d.profesional === 'boolean' ? d.profesional : null,
    precio_medio: n('precio_medio', 10000000), indicador_precio: n('indicador_precio', 9),
    cochesnet: d.cochesnet && typeof d.cochesnet === 'object' ? { id: texto(d.cochesnet.id, 20), makeId: entero(d.cochesnet.makeId, 0, 1e7), modelId: entero(d.cochesnet.modelId, 0, 1e7) } : null,
    bloqueado: !!d.bloqueado,
  };
}

/** Cambios desde la ficha: vendedor, números, estado, notas y datos del coche. */
export async function actualizarCaptacion(db, id, d) {
  const actual = await obtenerCaptacion(db, id);
  if (!actual) return null;
  const campos = {};
  const poner = (k, v) => { if (v !== undefined) campos[k] = v; };
  if ('vendedor_nombre' in d) poner('vendedor_nombre', texto(d.vendedor_nombre, 120));
  if ('vendedor_telefono' in d) poner('vendedor_telefono', texto(d.vendedor_telefono, 30));
  if ('vendedor_email' in d) {
    const e = texto(d.vendedor_email, 120);
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('El correo del vendedor no parece válido.');
    poner('vendedor_email', e);
  }
  if ('matricula' in d) poner('matricula', texto(d.matricula, 20)?.toUpperCase().replace(/[\s-]/g, '') ?? null);
  for (const k of ['precio_anuncio', 'precio_neto', 'precio_venta', 'gastos']) if (k in d) poner(k, entero(d[k]));
  if ('notas' in d) poner('notas', texto(d.notas, 5000));
  if ('estado' in d && ESTADOS_CAPTACION.includes(d.estado)) {
    // con el contrato ya firmado no se vuelve a «Contactado» ni a «Pendiente de firma» (p. ej. una ficha abierta de antes)
    const firmado = actual.contratos.some((k) => k.estado === 'Firmado');
    if (!(firmado && ['Contactado', 'Pendiente de firma'].includes(d.estado))) poner('estado', d.estado);
  }
  if ('titulo' in d) poner('titulo', texto(d.titulo, 160));
  if (d.datos && typeof d.datos === 'object') poner('datos', JSON.stringify(limpiarDatos({ ...actual.datos, ...d.datos })));
  if ('tasacion' in d) poner('tasacion', d.tasacion ? JSON.stringify(d.tasacion).slice(0, 60000) : null);
  if ('coche' in d) poner('coche', texto(d.coche, 120));
  const claves = Object.keys(campos);
  if (!claves.length) return actual;
  await db.prepare(`UPDATE captaciones SET ${claves.map((k) => `${k} = ?`).join(', ')}, actualizado = datetime('now') WHERE id = ?`).bind(...claves.map((k) => campos[k]), id).run();
  return obtenerCaptacion(db, id);
}

export async function borrarCaptacion(db, id) {
  await db.batch([db.prepare('DELETE FROM contratos WHERE captacion_id = ?').bind(id), db.prepare('DELETE FROM captaciones WHERE id = ?').bind(id)]);
}

/** Captación ligada a un coche del inventario (para enseñarla en su ficha). */
export async function captacionDeCoche(db, slug) {
  await preparar(db);
  return db.prepare('SELECT id, vendedor_nombre, precio_neto, gastos FROM captaciones WHERE coche = ? ORDER BY id DESC LIMIT 1').bind(slug).first();
}

// ------------------------------------------------------------------ contratos
const MAYUS = (t) => (t ? String(t).toUpperCase() : t);
const eurosTexto = (n) => (n == null ? null : `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} euros`);

/** Valores de la plantilla para una captación (los del vendedor que falten los pone él al firmar). */
export function valoresContrato(cap, aj) {
  const d = cap.datos || {};
  return {
    ciudad: aj.ciudad, fecha: fechaLarga(),
    empresa_nombre: aj.empresa_nombre, empresa_nif: aj.empresa_nif, empresa_domicilio: aj.empresa_domicilio, empresa_representante: aj.empresa_representante,
    vendedor_nombre: cap.vendedor_nombre, vendedor_dni: cap.vendedor_dni, vendedor_domicilio: cap.vendedor_domicilio,
    vendedor_telefono: cap.vendedor_telefono, vendedor_email: cap.vendedor_email,
    coche: [d.marca, d.modelo, d.version].filter(Boolean).join(' ') || cap.titulo, matricula: MAYUS(cap.matricula), bastidor: null,
    km: d.km != null ? String(d.km).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : null, anio: d.anio ? String(d.anio) : null,
    precio_neto: eurosTexto(cap.precio_neto), plazo_dias: String(aj.plazo_dias),
  };
}

/** Crea un contrato nuevo para la captación (anula los pendientes anteriores). Devuelve { id, token, caduca }. */
export async function crearContrato(db, cap, aj, { canal, destino }) {
  if (cap.precio_neto == null) throw new Error('Pon primero lo que recibe el vendedor (precio neto).');
  if (!cap.vendedor_nombre) throw new Error('Pon primero el nombre del vendedor.');
  const token = tokenNuevo();
  const caduca = new Date(Date.now() + aj.dias_enlace * 86400000).toISOString();
  const valores = valoresContrato(cap, aj);
  // de una vez (anular los anteriores, crear el nuevo y cambiar el estado): dos envíos a la vez no dejan dos enlaces válidos
  const r = await db.batch([
    db.prepare("UPDATE contratos SET estado = 'Anulado' WHERE captacion_id = ? AND estado IN ('Pendiente', 'Visto')").bind(cap.id),
    db.prepare(`INSERT INTO contratos (captacion_id, token, canal, destino, plantilla, datos, firma_empresa, caduca, enviado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
      .bind(cap.id, token, texto(canal, 20), texto(destino, 120), aj.plantilla, JSON.stringify(valores), aj.firma, caduca),
    db.prepare("UPDATE captaciones SET estado = CASE WHEN estado IN ('Contactado', 'Pendiente de firma') THEN 'Pendiente de firma' ELSE estado END, actualizado = datetime('now') WHERE id = ?").bind(cap.id),
  ]);
  return { id: r[1].meta.last_row_id, token, caduca };
}

export async function contratoPorToken(db, token) {
  await preparar(db);
  const k = await db.prepare('SELECT * FROM contratos WHERE token = ?').bind(token).first();
  return k ? conCaducidad({ ...k, datos: json(k.datos, {}) }) : null;
}
export async function contratoPorId(db, id) {
  await preparar(db);
  const k = await db.prepare('SELECT * FROM contratos WHERE id = ?').bind(id).first();
  return k ? conCaducidad({ ...k, datos: json(k.datos, {}) }) : null;
}
export async function marcarVisto(db, id) {
  await db.prepare("UPDATE contratos SET estado = 'Visto', visto = datetime('now') WHERE id = ? AND estado = 'Pendiente'").bind(id).run();
}
export async function anularContrato(db, id) {
  const r = await db.prepare("UPDATE contratos SET estado = 'Anulado' WHERE id = ? AND estado IN ('Pendiente', 'Visto')").bind(id).run();
  return r.meta.changes > 0;
}
/** Contratos pendientes de firma (para el Inicio). */
export async function contarPendientesFirma(db) {
  await preparar(db);
  const r = await db.prepare("SELECT COUNT(*) AS n FROM contratos WHERE estado IN ('Pendiente', 'Visto') AND caduca > ?").bind(new Date().toISOString()).first();
  return r?.n || 0;
}
