import { NEGOCIO, SITIO } from '../../../negocio.js';
// Copia de seguridad: descarga en un archivo todo lo que hay en la base de datos (coches, clientes, mensajes,
// tareas, ventas y cálculos). Las fotos no van dentro (están en KV); en el archivo sí van sus nombres.
// No incluye contraseñas, claves ni sesiones.
import { preparar } from '../../../lib/datos.js';

const TABLAS = ['coches', 'clientes', 'mensajes', 'tareas', 'ventas', 'calculos', 'fotos'];
const AJUSTES_PUBLICOS = ['correo_avisos', 'costes', 'version'];

export async function GET({ locals }) {
  const db = locals.runtime.env.DB;
  await preparar(db);
  const copia = { web: SITIO, creada: new Date().toISOString(), tablas: {} };
  for (const t of TABLAS) {
    const { results } = await db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all();
    copia.tablas[t] = results;
  }
  const { results } = await db.prepare(`SELECT clave, valor FROM ajustes WHERE clave IN (${AJUSTES_PUBLICOS.map(() => '?').join(', ')})`).bind(...AJUSTES_PUBLICOS).all();
  copia.tablas.ajustes = results;
  const dia = copia.creada.slice(0, 10);
  return new Response(JSON.stringify(copia, null, 1), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${NEGOCIO.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-copia-${dia}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
