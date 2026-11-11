import { guardarAjuste, ajuste } from '../../../lib/datos.js';
import { bytesFirma, documentoValido } from '../../../lib/contrato.js';
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
  if (d.accion === 'contrato') {
    // datos de la empresa y plazos que salen en los contratos de captación
    const t = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
    const dias = (v, min, max, por) => { const n = Math.round(Number(v)); return v !== '' && v != null && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : por; };
    const nif = t(d.empresa_nif, 20);
    if (nif && !documentoValido(nif)) return json({ ok: false, error: 'Ese NIF/CIF no parece correcto. Revisa los números y la letra.' }, 400);
    await guardarAjuste(db, 'contrato_ajustes', JSON.stringify({
      empresa_nombre: t(d.empresa_nombre, 120), empresa_nif: nif ? documentoValido(nif) : '', empresa_domicilio: t(d.empresa_domicilio, 200),
      empresa_representante: t(d.empresa_representante, 120), ciudad: t(d.ciudad, 60), plazo_dias: dias(d.plazo_dias, 1, 365, 60), dias_enlace: dias(d.dias_enlace, 1, 60, 14),
      garantia_meses: dias(d.garantia_meses, 1, 60, null), penalizacion: t(d.penalizacion, 60),
    }));
    return json({ ok: true });
  }
  if (d.accion === 'guia') {
    // guías de la primera vez: al pulsar «Entendido» dejan de salir abiertas
    if (!['captaciones'].includes(d.guia)) return json({ ok: false, error: 'Guía desconocida.' }, 400);
    await guardarAjuste(db, `guia_${d.guia}`, '1');
    return json({ ok: true });
  }
  if (d.accion === 'firmante') {
    // el paso de firma al mandar el primer contrato: solo el NIF y quién firma, sin tocar lo demás
    const t = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
    let g = {};
    try { g = JSON.parse((await ajuste(db, 'contrato_ajustes')) || '{}') || {}; } catch { g = {}; }
    if (d.empresa_nif !== undefined) {
      const nif = documentoValido(t(d.empresa_nif, 20));
      if (!nif) return json({ ok: false, error: 'Ese NIF/CIF no parece correcto. Revisa los números y la letra.' }, 400);
      g.empresa_nif = nif;
    }
    if (d.empresa_representante !== undefined) {
      const quien = t(d.empresa_representante, 120);
      if (quien.length < 3) return json({ ok: false, error: 'Pon tu nombre y apellidos.' }, 400);
      g.empresa_representante = quien;
    }
    await guardarAjuste(db, 'contrato_ajustes', JSON.stringify(g));
    return json({ ok: true });
  }
  if (d.accion === 'plantilla') {
    // texto del contrato (vacío o «restaurar»: vuelve el contrato de serie)
    const texto = String(d.plantilla ?? '').replace(/\r\n/g, '\n').trim();
    if (d.restaurar || !texto) { await guardarAjuste(db, 'contrato_plantilla', null); return json({ ok: true }); }
    if (texto.length > 40000) return json({ ok: false, error: 'El contrato es demasiado largo (máximo 40.000 caracteres).' }, 400);
    if (!/\{\{\s*precio_neto\s*\}\}/.test(texto) || !/\{\{\s*vendedor_dni\s*\}\}/.test(texto)) return json({ ok: false, error: 'El contrato tiene que llevar al menos {{precio_neto}} y {{vendedor_dni}}.' }, 400);
    await guardarAjuste(db, 'contrato_plantilla', texto);
    return json({ ok: true });
  }
  if (d.accion === 'firma') {
    // tu firma, que se pone sola en cada contrato que mandas
    if (d.borrar) { await guardarAjuste(db, 'contrato_firma', null); return json({ ok: true }); }
    if (!bytesFirma(d.firma, 300000)) return json({ ok: false, error: 'No se ha podido leer la firma. Bórrala y vuelve a firmar.' }, 400);
    await guardarAjuste(db, 'contrato_firma', d.firma);
    return json({ ok: true });
  }
  return json({ ok: false, error: 'Acción desconocida.' }, 400);
}
