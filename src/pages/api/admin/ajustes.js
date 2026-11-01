import { guardarAjuste } from '../../../lib/datos.js';
import { comprobarContrasena, guardarContrasena, quitarSoporte, permitirSoporte, crearSesion, cabeceraCookie, crearEnlaceJuan, MIN_LONGITUD } from '../../../lib/acceso.js';
const json = (d, status = 200, extra = {}) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra } });

export async function POST({ request, locals }) {
  const db = locals.runtime.env.DB;
  const d = await request.json().catch(() => ({}));
  if (d.accion === 'correo') {
    const correo = String(d.correo || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return json({ ok: false, error: 'Ese correo no parece válido.' }, 400);
    await guardarAjuste(db, 'correo_avisos', correo);
    return json({ ok: true });
  }
  const usuario = locals.usuario?.usuario || 'juan';
  const validarNueva = (clave, clave2) => {
    if (typeof clave !== 'string' || clave.length < MIN_LONGITUD) return `La nueva contraseña debe tener al menos ${MIN_LONGITUD} caracteres.`;
    if (clave !== clave2) return 'Las dos contraseñas nuevas no coinciden.';
    return null;
  };
  if (d.accion === 'clave') {
    // cambiar la contraseña con la que se ha entrado
    const r = await comprobarContrasena(db, String(d.actual || ''), usuario);
    if (!r.ok) return json({ ok: false, error: r.bloqueado ? `Demasiados intentos. Espera ${r.bloqueado} minutos.` : 'La contraseña actual no es correcta.' }, 401);
    const mal = validarNueva(d.clave, d.clave2);
    if (mal) return json({ ok: false, error: mal }, 400);
    await guardarContrasena(db, d.clave, usuario);
    return json({ ok: true }, 200, { 'Set-Cookie': cabeceraCookie(await crearSesion(db, usuario)) });
  }
  const soloSoporte = () => json({ ok: false, error: 'Esto lo gestiona NeumorStudio.' }, 403);
  if (d.accion === 'soporte') {
    // cambiar la contraseña de soporte (solo el propio soporte; el dueño solo puede quitar o permitir el acceso)
    if (usuario !== 'soporte') return soloSoporte();
    const r = await comprobarContrasena(db, String(d.actual || ''), usuario);
    if (!r.ok) return json({ ok: false, error: r.bloqueado ? `Demasiados intentos. Espera ${r.bloqueado} minutos.` : 'Tu contraseña actual no es correcta.' }, 401);
    const mal = validarNueva(d.clave, d.clave2);
    if (mal) return json({ ok: false, error: mal }, 400);
    await guardarContrasena(db, d.clave, 'soporte');
    return json({ ok: true });
  }
  if (d.accion === 'enlace_juan') {
    if (usuario !== 'soporte') return soloSoporte();
    // enlace de un solo uso para que el dueño ponga su propia contraseña (sustituye al anterior si lo había)
    const { codigo, caduca } = await crearEnlaceJuan(db);
    return json({ ok: true, codigo, caduca });
  }
  if (d.accion === 'soporte_quitar') {
    if (usuario !== 'juan') return json({ ok: false, error: 'Solo el dueño puede quitar el acceso de soporte.' }, 403);
    await quitarSoporte(db);
    return json({ ok: true });
  }
  if (d.accion === 'soporte_permitir') {
    if (usuario !== 'juan') return json({ ok: false, error: 'Solo el dueño puede permitir el acceso de soporte.' }, 403);
    await permitirSoporte(db);
    return json({ ok: true });
  }
  if (d.accion === 'costes') {
    const costes = {};
    for (const k of ['transporte', 'gestoria_import', 'itv_homologacion', 'placas_tasas', 'cambio_nombre', 'gestoria_nacional']) {
      const n = Math.round(Number(d[k]));
      if (Number.isFinite(n) && n >= 0) costes[k] = n;
    }
    await guardarAjuste(db, 'costes', JSON.stringify(costes));
    return json({ ok: true });
  }
  return json({ ok: false, error: 'Acción desconocida.' }, 400);
}
