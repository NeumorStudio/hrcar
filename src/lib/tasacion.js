// Tasación por coches parecidos, como hace el tasador de coches.net: se buscan anuncios del mismo modelo, de años y
// kilómetros cercanos, con el mismo combustible y cambio; se quitan los precios fuera de mercado y se calcula la
// mediana, la horquilla y un precio estimado para los kilómetros de este coche.
// Cada portal se consulta en una llamada aparte (el plan gratuito de Cloudflare limita la CPU por petición) y el
// cálculo final, que es barato, en otra.
import { hidratacion } from './anuncio.js';

const NAVEGADOR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9',
};
export const FUENTES = ['cochesnet', 'autoscout'];
const NOMBRE_FUENTE = { cochesnet: 'coches.net', autoscout: 'AutoScout24' };
const plano = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const slug = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };
const familia = (c) => {
  const s = String(c || '').toLowerCase();
  if (/enchuf/.test(s)) return 'phev';
  if (/h[ií]brid/.test(s)) return 'hibrido';
  if (/el[eé]ctric/.test(s)) return 'electrico';
  if (/di[eé]sel/.test(s)) return 'diesel';
  if (/gasolina/.test(s)) return 'gasolina';
  if (/glp/.test(s)) return 'glp';
  if (/gnc/.test(s)) return 'gnc';
  return null;
};

/** Años y kilómetros que se buscan alrededor del coche. */
export function rangos(o) {
  const anio = Number(o.anio) || null;
  const km = Number(o.km);
  const tieneKm = Number.isFinite(km) && km >= 0 && o.km !== null && o.km !== '';
  const margen = tieneKm ? Math.max(25000, Math.round(km * 0.35)) : null;
  return {
    anioDesde: anio ? anio - 1 : null,
    anioHasta: anio ? anio + 1 : null,
    kmDesde: tieneKm ? Math.max(0, Math.round((km - margen) / 1000) * 1000) : null,
    kmHasta: tieneKm ? Math.round((km + margen) / 1000) * 1000 : null,
  };
}

async function traer(url) {
  const r = await fetch(url, { headers: NAVEGADOR, redirect: 'follow', signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`ha respondido ${r.status}`);
  const html = await r.text();
  if (/Ups! Parece que algo no va bien|captcha-delivery|Access Denied|Just a moment\.\.\./i.test(html.slice(0, 20000))) throw new Error('no deja leer sus anuncios ahora mismo');
  return html;
}

// ------------------------------------------------------------------ coches.net
const FUEL_CN = { diesel: 1, gasolina: 2, hibrido: 4 };
const CAMBIO_CN = { Automático: 1, Manual: 2 };

const CLAVE_CATALOGO = 'cache:cochesnet-catalogo';
const catalogoGuardado = (env) => env?.FOTOS?.get(CLAVE_CATALOGO, { type: 'json' }).catch(() => null) ?? null;
/** Marcas y modelos de coches.net con sus números (para buscar), guardados 30 días. */
async function catalogoCochesNet(env) {
  const clave = CLAVE_CATALOGO;
  const guardado = await catalogoGuardado(env);
  if (guardado) return guardado;
  const d = hidratacion(await traer('https://www.coches.net/segunda-mano/'));
  const pagina = d?.loaderData ? Object.values(d.loaderData).find((v) => v?.listFiltersOptions?.vehicles) : null;
  const opciones = pagina?.listFiltersOptions?.vehicles?.options;
  if (!Array.isArray(opciones) || !opciones.length) throw new Error('no he podido leer sus marcas y modelos');
  const catalogo = opciones.map((m) => [Number(m.id), m.label, (m.models || []).map((x) => [Number(x.id), x.label])]);
  await env?.FOTOS?.put(clave, JSON.stringify(catalogo), { expirationTtl: 60 * 60 * 24 * 30 }).catch(() => {});
  return catalogo;
}

/** Números de marca y modelo en coches.net para un coche escrito como en el panel («Mercedes-Benz», «Clase A»). */
export function idsCochesNet(catalogo, marca, modelo) {
  const pm = plano(marca);
  const mk = catalogo.find((m) => plano(m[1]) === pm) || catalogo.find((m) => pm && (plano(m[1]).startsWith(pm) || pm.startsWith(plano(m[1]))));
  if (!mk) return null;
  const pmod = plano(modelo).replace(/^clase/, '');
  const quitarClase = (t) => plano(t).replace(/^clase/, '');
  const md = mk[2].find((x) => quitarClase(x[1]) === pmod) || mk[2].find((x) => pmod && quitarClase(x[1]).startsWith(pmod));
  return md ? { makeId: mk[0], modelId: md[0] } : null;
}

async function cochesnet(o, env) {
  let ids = o.cochesnet?.makeId && o.cochesnet?.modelId ? { makeId: o.cochesnet.makeId, modelId: o.cochesnet.modelId } : null;
  if (!ids) {
    // sin el catálogo guardado, esta llamada solo lo trae (leer dos páginas grandes en la misma pasaría del límite de
    // CPU del plan gratuito); el panel vuelve a llamar enseguida
    const guardado = await catalogoGuardado(env);
    if (!guardado) { await catalogoCochesNet(env); return { comparables: [], reintentar: true }; }
    ids = idsCochesNet(guardado, o.marca, o.modelo);
  }
  if (!ids) throw new Error(`no encuentro el ${o.marca} ${o.modelo} en su buscador`);
  const r = rangos(o);
  const q = new URLSearchParams();
  q.set('MakeIds[0]', ids.makeId);
  q.set('ModelIds[0]', ids.modelId);
  if (r.anioDesde) { q.set('MinYear', r.anioDesde); q.set('MaxYear', r.anioHasta); }
  if (r.kmHasta != null) { q.set('MinKms', r.kmDesde); q.set('MaxKms', r.kmHasta); }
  const f = FUEL_CN[familia(o.combustible)];
  if (f) q.set('FuelTypeId', f);
  if (CAMBIO_CN[o.cambio]) q.set('TransmissionTypeId', CAMBIO_CN[o.cambio]);
  const busqueda = `https://www.coches.net/segunda-mano/?${q.toString()}`;
  const d = hidratacion(await traer(busqueda));
  const pagina = d?.loaderData ? Object.values(d.loaderData).find((v) => v?.initialResults?.items) : null;
  if (!pagina) throw new Error('ha cambiado su página de resultados');
  const lista = pagina.initialResults.items.map((x) => ({
    fuente: 'coches.net',
    titulo: String(x.title || [x.make, x.model].filter(Boolean).join(' ')).slice(0, 120),
    precio: num(x.price), km: x.km != null ? Math.round(Number(x.km)) : null, anio: Number(x.year) || null, cv: num(x.hp),
    combustible: x.fuelType || null, profesional: !!x.isProfessional,
    provincia: x.location?.mainProvince || null,
    url: typeof x.url === 'string' && x.url.startsWith('/') ? `https://www.coches.net${x.url}` : null,
    id: x.id ? `cn-${x.id}` : null,
  }));
  return { comparables: lista, busqueda, total: pagina.initialResults.totalResults ?? lista.length };
}

// ------------------------------------------------------------------ AutoScout24 (anuncios de España)
const FUEL_AS = { gasolina: 'B', diesel: 'D', electrico: 'E' };
async function autoscout(o) {
  const r = rangos(o);
  const q = new URLSearchParams({ atype: 'C', cy: 'E', ustate: 'N,U', sort: 'standard', desc: '0' });
  if (r.anioDesde) { q.set('fregfrom', r.anioDesde); q.set('fregto', r.anioHasta); }
  if (r.kmHasta != null) { q.set('kmfrom', r.kmDesde); q.set('kmto', r.kmHasta); }
  const f = FUEL_AS[familia(o.combustible)];
  if (f) q.set('fuel', f);
  if (o.cambio === 'Automático') q.set('gear', 'A');
  if (o.cambio === 'Manual') q.set('gear', 'M');
  const busqueda = `https://www.autoscout24.es/lst/${slug(o.marca)}/${slug(o.modelo)}?${q.toString()}`;
  const html = await traer(busqueda);
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('ha cambiado su página de resultados');
  let d;
  try { d = JSON.parse(m[1]); } catch { throw new Error('ha cambiado su página de resultados'); }
  const pp = d?.props?.pageProps || {};
  const sinPrefijo = (t) => plano(t).replace(/^(serie|clase)/, '');
  const modelo = sinPrefijo(o.modelo);
  const lista = (pp.listings || []).filter((x) => {
    // si el modelo no existe en su buscador, sale la marca entera: se quedan solo los del mismo modelo
    const v = x.vehicle || {};
    if (v.modelGroup) return sinPrefijo(v.modelGroup) === modelo || sinPrefijo(v.model) === modelo;
    const m = sinPrefijo(v.model);
    return m === modelo || (modelo.length >= 2 && m.startsWith(modelo));
  }).map((x) => {
    const v = x.vehicle || {};
    const t = x.tracking || {};
    const potencia = (x.vehicleDetails || []).map((e) => e?.data).find((e) => /CV\)/.test(e || ''));
    return {
      fuente: 'AutoScout24',
      titulo: [v.make, v.model, v.modelVersionInput].filter(Boolean).join(' ').slice(0, 120),
      precio: num(x.price?.priceRaw ?? t.price), km: t.mileage != null ? Math.round(Number(t.mileage)) : num(v.mileageInKm),
      anio: Number(String(t.firstRegistration || '').slice(-4)) || null,
      cv: potencia ? num((potencia.match(/\((\d+)\s*CV\)/) || [])[1]) : null,
      combustible: v.fuel || null, profesional: x.seller?.type ? x.seller.type !== 'PrivateSeller' : null,
      provincia: x.location?.city || null,
      url: typeof x.url === 'string' && x.url.startsWith('/') ? `https://www.autoscout24.es${x.url}` : null,
      id: x.id ? `as-${x.id}` : null,
    };
  });
  return { comparables: lista, busqueda, total: pp.numberOfResults ?? lista.length };
}

/** Anuncios parecidos de un portal: { comparables, busqueda, total } o lanza un error con el motivo en castellano. */
export async function buscarComparables(fuente, o, env) {
  if (!o?.marca || !o?.modelo) throw new Error('Faltan la marca y el modelo para buscar coches parecidos.');
  try {
    if (fuente === 'cochesnet') return await cochesnet(o, env);
    if (fuente === 'autoscout') return await autoscout(o);
  } catch (e) {
    throw new Error(`${NOMBRE_FUENTE[fuente]}: ${e?.name === 'TimeoutError' ? 'no ha contestado a tiempo' : e?.message || 'no ha respondido'}`);
  }
  throw new Error('Fuente desconocida.');
}

// ------------------------------------------------------------------ cálculo
const percentil = (ordenados, p) => {
  if (!ordenados.length) return null;
  const i = (ordenados.length - 1) * p;
  const a = Math.floor(i), b = Math.ceil(i);
  return ordenados[a] + (ordenados[b] - ordenados[a]) * (i - a);
};
const mediana = (lista) => percentil([...lista].sort((a, b) => a - b), 0.5);
const redondear = (n) => (n == null ? null : Math.round(n / 50) * 50);

/**
 * Calcula la tasación con los anuncios encontrados.
 * o = el coche (marca, modelo, año, km, combustible, cambio, potencia_cv, url); lista = comparables de todas las fuentes.
 */
export function calcularTasacion(o, lista) {
  const r = rangos(o);
  const fam = familia(o.combustible);
  const cv = Number(o.potencia_cv) || null;
  const vistos = new Set();
  let base = (Array.isArray(lista) ? lista : []).filter((c) => {
    if (!c || !(c.precio >= 500) || c.precio > 2000000) return false;
    if (o.url && c.url && c.url.split('?')[0] === String(o.url).split('?')[0]) return false; // el propio anuncio
    const clave = c.id || `${c.precio}-${c.km}-${c.anio}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    if (fam && c.combustible && familia(c.combustible) && familia(c.combustible) !== fam && !(fam === 'hibrido' && familia(c.combustible) === 'phev')) return false;
    if (r.anioDesde && c.anio && (c.anio < r.anioDesde || c.anio > r.anioHasta)) return false;
    if (r.kmHasta != null && c.km != null && (c.km < r.kmDesde || c.km > r.kmHasta)) return false;
    return true;
  });
  // misma potencia (±15 %; si se queda en casi nada, ±30 %): un 116d no vale lo que un 120d
  if (cv) {
    const cerca = (m) => base.filter((c) => !c.cv || Math.abs(c.cv - cv) / cv <= m);
    base = cerca(0.15).length >= 4 ? cerca(0.15) : cerca(0.3);
  }
  // precios fuera de mercado (golpes, errores, coches de exposición): fuera por rango intercuartílico
  let quitados = 0;
  if (base.length >= 5) {
    const p = base.map((c) => c.precio).sort((a, b) => a - b);
    const q1 = percentil(p, 0.25), q3 = percentil(p, 0.75), iqr = q3 - q1;
    const antes = base.length;
    base = base.filter((c) => c.precio >= q1 - 1.5 * iqr && c.precio <= q3 + 1.5 * iqr);
    quitados = antes - base.length;
  }
  const precios = base.map((c) => c.precio).sort((a, b) => a - b);
  const n = precios.length;
  const med = mediana(precios);
  // ajuste por kilómetros: pendiente de Theil-Sen (mediana de las pendientes entre pares), solo si baja con los km
  let estimado = med;
  let porKm = null;
  const conKm = base.filter((c) => c.km != null);
  if (o.km != null && o.km !== '' && conKm.length >= 6) {
    const pendientes = [];
    for (let i = 0; i < conKm.length; i++) for (let j = i + 1; j < conKm.length; j++) {
      const dk = conKm[j].km - conKm[i].km;
      if (Math.abs(dk) >= 5000) pendientes.push((conKm[j].precio - conKm[i].precio) / dk);
    }
    const pend = pendientes.length >= 5 ? mediana(pendientes) : null;
    if (pend != null && pend < 0) {
      porKm = Math.max(pend, -0.5); // como mucho 50 € menos cada 100 km de más
      const kmMed = mediana(conKm.map((c) => c.km));
      estimado = med + porKm * (Number(o.km) - kmMed);
      estimado = Math.min(Math.max(estimado, percentil(precios, 0.1)), percentil(precios, 0.9));
    }
  }
  const grupo = (filtro) => { const p = base.filter(filtro).map((c) => c.precio); return p.length >= 3 ? { n: p.length, mediana: redondear(mediana(p)) } : p.length ? { n: p.length, mediana: null } : null; };
  const fuentes = {};
  for (const c of base) fuentes[c.fuente] = (fuentes[c.fuente] || 0) + 1;
  // los más parecidos primero (años y km más cerca)
  const distancia = (c) => (o.anio && c.anio ? Math.abs(c.anio - o.anio) * 20000 : 0) + (o.km != null && c.km != null ? Math.abs(c.km - Number(o.km)) : 0);
  const comparables = [...base].sort((a, b) => distancia(a) - distancia(b)).slice(0, 15)
    .map((c) => ({
      fuente: String(c.fuente || '').slice(0, 30), titulo: String(c.titulo || '').slice(0, 120), precio: c.precio, km: Number.isFinite(c.km) ? c.km : null, anio: Number(c.anio) || null,
      cv: Number(c.cv) || null, profesional: typeof c.profesional === 'boolean' ? c.profesional : null, provincia: c.provincia ? String(c.provincia).slice(0, 60) : null,
      url: typeof c.url === 'string' && /^https:\/\/[^\s"'<>]+$/.test(c.url) ? c.url.slice(0, 500) : null,
    }));
  return {
    fecha: new Date().toISOString(),
    n,
    descartados: quitados,
    estimado: n >= 3 ? redondear(estimado) : null,
    mediana: n ? redondear(med) : null,
    p25: n >= 3 ? redondear(percentil(precios, 0.25)) : null,
    p75: n >= 3 ? redondear(percentil(precios, 0.75)) : null,
    euros_por_1000_km: porKm != null ? Math.round(-porKm * 1000) : null,
    profesionales: grupo((c) => c.profesional === true),
    particulares: grupo((c) => c.profesional === false),
    fuentes,
    filtros: { ...r, combustible: o.combustible || null, cambio: o.cambio || null, cv },
    comparables,
  };
}

/** Lo que el panel necesita del coche para tasarlo (de una captación o de la calculadora), saneado. */
export function objetivo(d) {
  const t = (v, max = 80) => (v == null ? null : String(v).trim().slice(0, max) || null);
  const n = (v, max) => { if (v === '' || v == null) return null; const x = Math.round(Number(v)); return Number.isFinite(x) && x >= 0 && x <= max ? x : null; };
  return {
    marca: t(d?.marca, 40), modelo: t(d?.modelo, 60), version: t(d?.version, 120),
    anio: n(d?.anio, 2100), km: n(d?.km, 3000000), potencia_cv: n(d?.potencia_cv, 2000),
    combustible: t(d?.combustible, 30), cambio: ['Manual', 'Automático'].includes(d?.cambio) ? d.cambio : null,
    url: typeof d?.url === 'string' && /^https?:\/\//.test(d.url) ? d.url.slice(0, 500) : null,
    cochesnet: d?.cochesnet && typeof d.cochesnet === 'object' ? { makeId: n(d.cochesnet.makeId, 1e7), modelId: n(d.cochesnet.modelId, 1e7) } : null,
  };
}
