// Mensajes de la web que no se pudieron guardar en la base de datos (caída o cuota diaria agotada).
// Esperan en KV hasta que el dueño abre el panel; entonces pasan a Mensajes como cualquier otro.
import { guardarMensaje } from './datos.js';
import { clienteDesdeContacto } from './crm.js';

const PREFIJO = 'pendiente:';
const ahoraSql = () => new Date().toISOString().slice(0, 19).replace('T', ' '); // mismo formato que datetime('now')

export async function guardarPendiente(env, m) {
  const clave = `${PREFIJO}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await env.FOTOS.put(clave, JSON.stringify({ ...m, fecha: ahoraSql() }), { expirationTtl: 60 * 60 * 24 * 90 });
}

/** Pasa a la base de datos los mensajes que esperaban. Devuelve cuántos. Nunca lanza error. */
export async function recuperarPendientes(env) {
  try {
    if (!env?.FOTOS) return 0;
    // de 8 en 8: cada mensaje son unas 4 consultas a D1 y el plan gratuito admite 50 por petición
    const { keys } = await env.FOTOS.list({ prefix: PREFIJO, limit: 8 });
    let n = 0;
    for (const k of keys) {
      const m = await env.FOTOS.get(k.name, { type: 'json' });
      await env.FOTOS.delete(k.name); // reclamado: otra carga a la vez ya no lo encuentra
      if (!m) continue;
      try {
        const cliente_id = await clienteDesdeContacto(env.DB, { nombre: m.nombre, telefono: m.telefono, email: m.email, origen: 'web' }).catch(() => null);
        await guardarMensaje(env.DB, { ...m, cliente_id });
        n++;
      } catch (e) {
        await env.FOTOS.put(k.name, JSON.stringify(m), { expirationTtl: 60 * 60 * 24 * 90 }).catch(() => {}); // a esperar otra vez
        throw e;
      }
    }
    return n;
  } catch (e) {
    console.error('No se pudieron recuperar los mensajes pendientes', e);
    return 0;
  }
}
