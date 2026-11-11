// Lee un anuncio (Wallapop, coches.net, AutoScout24, Milanuncios…) y saca lo que puede: marca, modelo, versión,
// precio, año, km, combustible, cambio, potencia, carrocería, puertas, color, CO₂, descripción, fotos y origen.
// Si el portal bloquea la lectura (mobile.de lo hace; coches.net a veces), se saca lo que dice el propio enlace
// y el resto se rellena a mano.
import { marcaConocida, separarModelo } from '../data/modelos.js';
const MARCAS = ['Abarth', 'Alfa Romeo', 'Audi', 'BMW', 'BYD', 'Citroën', 'Citroen', 'Cupra', 'Dacia', 'DS', 'Fiat', 'Ford', 'Honda', 'Hyundai', 'Jaguar', 'Jeep', 'Kia', 'Land Rover', 'Lexus', 'Mazda', 'Mercedes-Benz', 'Mercedes', 'MG', 'Mini', 'Mitsubishi', 'Nissan', 'Opel', 'Peugeot', 'Porsche', 'Renault', 'SEAT', 'Seat', 'Skoda', 'Smart', 'Subaru', 'Suzuki', 'Tesla', 'Toyota', 'Volkswagen', 'VW', 'Volvo'];
const PORTALES = {
  'wallapop.com': { nombre: 'Wallapop', origen: 'espana' },
  'coches.net': { nombre: 'coches.net', origen: 'espana' },
  'milanuncios.com': { nombre: 'Milanuncios', origen: 'espana' },
  'autocasion.com': { nombre: 'Autocasión', origen: 'espana' },
  'mobile.de': { nombre: 'mobile.de', origen: 'extranjero' },
  'autoscout24.': { nombre: 'AutoScout24', origen: 'extranjero' },
};

const meta = (html, nombre) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${nombre}["'][^>]+content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${nombre}["']`, 'i'));
  return m ? decodificar(m[1]) : null;
};
// Entidades HTML a texto, en una sola pasada (así «&amp;lt;» queda «&lt;» y no «<»). Entiende las numéricas, decimales y
// hexadecimales («&#38;», «&#x27;», «&#243;»), que es como las escriben muchos portales y generadores de páginas.
const ENTIDADES = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü', ccedil: 'ç', iexcl: '¡', iquest: '¿', euro: '€', copy: '©', reg: '®', deg: '°',
  ordm: 'º', ordf: 'ª', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};
export const decodificar = (t) => String(t ?? '').replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (entidad, c) => {
  if (c[0] !== '#') {
    const nombre = Object.hasOwn(ENTIDADES, c) ? c : c.toLowerCase();
    return Object.hasOwn(ENTIDADES, nombre) ? ENTIDADES[nombre] : entidad;
  }
  const n = c[1] === 'x' || c[1] === 'X' ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10);
  return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : entidad;
}).trim();
const numero = (t) => { if (t == null) return null; const n = Number(String(t).replace(/[^\d,.]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n) : null; };
const limpiarMarca = (m) => (m ? String(m).replace(/^VW$/i, 'Volkswagen').replace(/^Mercedes$/i, 'Mercedes-Benz').replace(/^SEAT$/i, 'SEAT').trim() : null);
export const normalizarCombustible = (t) => {
  if (!t) return null;
  const s = String(t).toLowerCase();
  if (/enchuf|plug-?in|phev/.test(s)) return 'Híbrido enchufable';
  if (/h[ií]brid|hybrid/.test(s)) return /di[eé]sel|gasoil/.test(s) ? 'Híbrido diésel' : 'Híbrido gasolina';
  if (/el[eé]ctric|electric|^e$/.test(s)) return 'Eléctrico';
  if (/di[eé]sel|gasoil|^d$/.test(s)) return 'Diésel';
  if (/glp|lpg|autogas/.test(s)) return 'GLP';
  if (/gnc|cng|erdgas/.test(s)) return 'GNC';
  if (/gasolina|benzin|petrol|^b$|^g$/.test(s)) return 'Gasolina';
  return null;
};
export const normalizarCambio = (t) => (!t ? null : /autom|dsg|s[- ]tronic|tiptronic/i.test(t) ? 'Automático' : /manual|schalt/i.test(t) ? 'Manual' : null);

/** Texto de una descripción: sin etiquetas HTML ni entidades, con los saltos de línea de siempre. */
export const textoLimpio = (t, max = 5000) => {
  if (!t) return null;
  const limpio = decodificar(String(t).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return limpio ? limpio.slice(0, max) : null;
};
const fotosValidas = (lista) => [...new Set((lista || []).map((f) => (typeof f === 'string' ? f : f?.url || f?.urls?.big || f?.urls?.medium || f?.src || null))
  .filter((f) => typeof f === 'string' && /^https:\/\/[^\s"'<>]+$/.test(f)))].slice(0, 20);

const COLORES = {
  WHITE: 'Blanco', BLACK: 'Negro', GREY: 'Gris', GRAY: 'Gris', SILVER: 'Plata', BLUE: 'Azul', RED: 'Rojo', GREEN: 'Verde',
  YELLOW: 'Amarillo', ORANGE: 'Naranja', BROWN: 'Marrón', BEIGE: 'Beige', GOLD: 'Dorado', GOLDEN: 'Dorado', PURPLE: 'Morado',
  VIOLET: 'Violeta', PINK: 'Rosa', BURGUNDY: 'Granate', MAROON: 'Granate', GARNET: 'Granate', BRONZE: 'Bronce', OCHRE: 'Ocre',
};
const colorDe = (t) => {
  if (!t) return null;
  const k = String(t).replace(/^.*COLOR_/i, '').toUpperCase();
  return COLORES[k] || (/^[A-Za-zÁÉÍÓÚáéíóúñÑ ]{3,20}$/.test(t) && !/COMMON|_/.test(t) ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : null);
};
const carroceriaDe = (t) => {
  if (!t) return null;
  const s = String(t).toUpperCase();
  if (/4X4|SUV|TODOTERRENO|OFF.?ROAD/.test(s)) return '4x4 SUV';
  if (/PICK/.test(s)) return 'Pick-up';
  if (/CABRIO|CONVERTIBLE|DESCAPOTABLE|ROADSTER/.test(s)) return 'Cabrio';
  if (/COUPE|COUPÉ/.test(s)) return 'Coupé';
  if (/FAMILIAR|ESTATE|STATION|WAGON|TOURING|KOMBI/.test(s)) return 'Familiar';
  if (/MONOVOLUMEN|MINIVAN|MPV|VAN_PASSENGER/.test(s)) return 'Monovolumen';
  if (/FURGON|VAN|COMMERCIAL|INDUSTRIAL/.test(s)) return 'Furgoneta';
  if (/COMPACT|HATCH|UTILITARIO|SMALL/.test(s)) return 'Compacto';
  if (/SEDAN|BERLINA|SALOON|LIMOUSINE/.test(s)) return 'Berlina';
  return null;
};

/**
 * Etiqueta de la DGT más probable por combustible y año de matriculación (la real depende de la norma Euro de la
 * ficha técnica: el panel la marca como estimada para que se revise).
 */
export function etiquetaProbable(combustible, anio) {
  const c = String(combustible || '').toLowerCase();
  const a = Number(anio) || 0;
  if (!c) return null;
  if (/el[eé]ctric/.test(c) || /enchuf/.test(c)) return '0';
  if (/h[ií]brid|glp|gnc/.test(c)) return 'ECO';
  if (/gasolina/.test(c)) return a >= 2006 ? 'C' : a >= 2001 ? 'B' : null;
  if (/di[eé]sel/.test(c)) return a >= 2016 ? 'C' : a >= 2006 ? 'B' : null;
  return null;
}

/** La página de «no eres un robot» o de error que algunos portales sirven a los lectores automáticos. */
const esBloqueo = (html) => /Ups! Parece que algo no va bien|Access Denied|Just a moment\.\.\.|captcha-delivery|Pardon Our Interruption|Request unsuccessful/i.test(html.slice(0, 20000));

/** Los datos de la página que React Router deja en `window.__staticRouterHydrationData = JSON.parse("…")` (coches.net). */
export function hidratacion(html) {
  const marca = 'window.__staticRouterHydrationData = JSON.parse("';
  const i = html.indexOf(marca);
  if (i < 0) return null;
  const ini = i + marca.length;
  let fin = ini;
  // el texto acaba en la primera comilla que no esté escapada
  for (;;) {
    fin = html.indexOf('"', fin);
    if (fin < 0) return null;
    let barras = 0;
    for (let k = fin - 1; html[k] === '\\'; k--) barras++;
    if (barras % 2 === 0) break;
    fin++;
  }
  try { return JSON.parse(JSON.parse(`"${html.slice(ini, fin)}"`)); } catch { return null; }
}

/** coches.net: la ficha completa del anuncio viene en los datos de React Router. */
function cochesnet(html) {
  const d = hidratacion(html);
  const pagina = d?.loaderData ? Object.values(d.loaderData).find((v) => v && v.ad) : null;
  if (!pagina) return null;
  const ad = pagina.ad;
  const esp = pagina.vehicleInfo?.specifications || {};
  return {
    titulo: [ad.make, ad.model, ad.version].filter(Boolean).join(' ') || ad.title || null,
    marca: ad.make || esp.make || null,
    modelo: ad.model || esp.model || null,
    version: ad.version || esp.version || null,
    precio: numero(ad.price),
    km: numero(ad.km),
    anio: Number(ad.year) || null,
    combustible: normalizarCombustible(ad.fuelType),
    cambio: /AUTOMATIC/i.test(ad.transmissionType || '') ? 'Automático' : /MANUAL/i.test(ad.transmissionType || '') ? 'Manual' : null,
    potencia_cv: numero(esp.hp ?? ad.hp),
    puertas: numero(esp.doors ?? ad.doors),
    carroceria: carroceriaDe(esp.bodyType),
    color: colorDe(ad.color),
    descripcion: textoLimpio(ad.description),
    fotos: fotosValidas(ad.photos),
    garantia_meses: ad.hasWarranty ? numero(ad.warrantyMonths) : null,
    ubicacion: ad.province || ad.location?.mainProvince || null,
    profesional: typeof ad.isProfessional === 'boolean' ? ad.isProfessional : null,
    // precio medio que coches.net calcula para este coche y en qué franja está el precio (1 caro … 5 muy buen precio)
    precio_medio: numero(ad.priceAverageIndicator),
    indicador_precio: numero(ad.priceRankIndicator),
    cochesnet: { id: ad.id || null, makeId: numero(ad.makeId), modelId: numero(ad.modelId), versionId: numero(ad.versionId) },
  };
}

/**
 * coches.net sin poder leer la página: el enlace ya dice marca, modelo, versión, puertas, combustible, año y provincia
 * («/bmw-serie-1-118d-5p-diesel-2017-en-sevilla-61234567-covo.aspx»).
 */
export function desdeEnlaceCochesNet(url) {
  let ruta = '';
  try { ruta = decodeURIComponent(new URL(url).pathname); } catch { return null; }
  const m = ruta.match(/^\/([a-z0-9-]+)-(\d{6,})-covo\.aspx$/i);
  if (!m) return null;
  let resto = m[1].toLowerCase();
  let ubicacion = null;
  const en = resto.lastIndexOf('-en-');
  if (en > 0) { ubicacion = resto.slice(en + 4).replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()); resto = resto.slice(0, en); }
  const partes = resto.split('-');
  let anio = null;
  if (/^(19|20)\d{2}$/.test(partes[partes.length - 1])) anio = Number(partes.pop());
  const COMB = { gasolina: 'Gasolina', diesel: 'Diésel', electrico: 'Eléctrico', hibrido: 'Híbrido gasolina', glp: 'GLP', gnc: 'GNC' };
  let combustible = null;
  if (COMB[partes[partes.length - 1]]) combustible = COMB[partes.pop()];
  if (partes[partes.length - 1] === 'enchufable' && partes[partes.length - 2] === 'hibrido') { partes.splice(-2); combustible = 'Híbrido enchufable'; }
  let puertas = null;
  const p = partes.findIndex((x) => /^\dp$/.test(x));
  if (p >= 0) { puertas = Number(partes[p][0]); partes.splice(p, 1); }
  // la marca: la más larga que encaja al principio («alfa-romeo», «mercedes-benz», «land-rover»)
  const slug = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const candidata = [...MARCAS].sort((a, b) => b.length - a.length).find((mk) => partes.slice(0, slug(mk).split('-').length).join('-') === slug(mk));
  if (!candidata) return null;
  const marca = marcaConocida(candidata) || limpiarMarca(candidata);
  const { modelo, version } = separarModelo(marca, partes.slice(slug(candidata).split('-').length).join(' '));
  const mayus = (t) => (t ? t.replace(/\b([a-z])/g, (l) => l.toUpperCase()) : t);
  return {
    titulo: [marca, modelo, mayus(version)].filter(Boolean).join(' '),
    marca, modelo, version: mayus(version), anio, combustible, puertas, ubicacion,
    cochesnet: { id: m[2], makeId: null, modelId: null, versionId: null },
  };
}

export function portal(url) {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
  const clave = Object.keys(PORTALES).find((k) => host.includes(k));
  return clave ? { ...PORTALES[clave], host } : { nombre: host, origen: /\.(de|fr|it|nl|be|at|pt)$/.test(host) ? 'extranjero' : 'espana', host };
}

// AutoScout24: la ficha completa viene en el JSON de Next.js (__NEXT_DATA__).
function autoscout(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let d;
  try { d = JSON.parse(m[1]); } catch { return null; }
  const ficha = d?.props?.pageProps?.listingDetails;
  if (!ficha) return null;
  const v = ficha.vehicle || {};
  const co2 = v.wltp?.co2EmissionsCombinedWithFallback?.raw ?? v.co2emissionInGramPerKmWithFallback?.raw ?? null;
  const version = String(v.modelVersionInput || '').replace(/[,\s]+$/, '').trim();
  return {
    titulo: [v.make, v.model, version].filter(Boolean).join(' '),
    marca: v.make || null,
    modelo: v.model || null,
    version: version || null,
    precio: ficha.prices?.public?.priceRaw ?? ficha.prices?.dealer?.priceRaw ?? null,
    km: v.mileageInKmRaw ?? null,
    anio: Number(String(v.firstRegistrationDateRaw || '').slice(0, 4)) || null,
    combustible: normalizarCombustible(v.fuelCategory?.formatted || v.primaryFuel?.formatted),
    cambio: normalizarCambio(v.transmissionType),
    co2: co2 != null ? Math.round(Number(co2)) : null,
    potencia_cv: v.rawPowerInHp ?? null,
    puertas: numero(v.numberOfDoors),
    carroceria: carroceriaDe(v.bodyType || v.bodyTypeLabel),
    color: colorDe(v.bodyColor || v.bodyColorOriginal),
    descripcion: textoLimpio(ficha.description),
    fotos: fotosValidas(ficha.images),
    profesional: ficha.seller?.type ? ficha.seller.type !== 'PrivateSeller' : null,
  };
}

// Wallapop: los datos del coche van en un JSON embebido ("carInfo"). Puede venir con las comillas escapadas.
function wallapop(html) {
  const i = html.indexOf('carInfo');
  if (i < 0) return null;
  const trozo = html.slice(Math.max(0, i - 3000), i + 4000).replace(/\\"/g, '"');
  const texto = (clave) => { const m = trozo.match(new RegExp(`"${clave}":"([^"]*)"`)); return m ? m[1] : null; };
  const campo = (clave) => { const m = trozo.match(new RegExp(`"${clave}":\\{[^{}]*?"value":(?:"([^"]*)"|(-?[\\d.]+))`)); return m ? (m[1] ?? m[2]) : null; };
  const marca = texto('brand');
  const modelo = texto('model');
  const version = campo('version');
  const precio = numero((trozo.match(/"price":\{"cash":\{"amount":([\d.]+)/) || [])[1]);
  return {
    titulo: [marca, modelo, version].filter(Boolean).join(' ') || null,
    marca, modelo, version,
    precio,
    km: numero(campo('km')),
    anio: Number(campo('year')) || null,
    combustible: normalizarCombustible(campo('engine')),
    cambio: normalizarCambio(campo('gearBox')),
    potencia_cv: numero(campo('horsePower')),
    puertas: numero(campo('numDoors')),
    carroceria: carroceriaDe(campo('bodyType')),
    color: colorDe(campo('color')),
  };
}

/** Lo que se sabe sin leer la página (portal bloqueado): en coches.net, lo que dice el enlace. */
function soloEnlace(p, url, bloqueado) {
  const base = { portal: p.nombre, origen: p.origen, titulo: null, precio: null, km: null, anio: null, marca: null, modelo: null, version: null, combustible: null, cambio: null, co2: null, potencia_cv: null, fotos: [], descripcion: null, bloqueado };
  const enlace = p.nombre === 'coches.net' ? desdeEnlaceCochesNet(url) : null;
  return completar(enlace ? { ...base, ...enlace } : base);
}

/** Marca escrita como en el panel y etiqueta DGT estimada si el anuncio no la trae. */
function completar(d) {
  d.marca = marcaConocida(d.marca) || limpiarMarca(d.marca);
  if (!d.etiqueta_dgt) {
    const e = etiquetaProbable(d.combustible, d.anio);
    if (e) { d.etiqueta_dgt = e; d.etiqueta_estimada = true; }
  }
  return d;
}

export function extraer(html, url) {
  const p = portal(url) || {};
  if (esBloqueo(html)) return soloEnlace(p, url, true);
  let titulo = meta(html, 'og:title') || decodificar((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [, ''])[1]);
  // coches.net y similares meten precio y ciudad en el título: «… (2017) - 10.500 € en Alicante | Coches.net»
  titulo = titulo.replace(/\s*[-–|]\s*[\d.,]+\s*€.*$/, '').replace(/\s*\|\s*[^|]*$/, '').trim();
  const descripcion = meta(html, 'og:description') || meta(html, 'description') || '';
  const texto = `${titulo} ${descripcion}`;
  let precio = numero(meta(html, 'product:price:amount') || meta(html, 'og:price:amount'));
  // JSON-LD (mobile.de, AutoScout24 y otros suelen llevarlo)
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } }).filter(Boolean).flat();
  const buscarLd = (obj, claves) => { for (const o of obj) { for (const k of claves) { const v = k.split('.').reduce((a, x) => (a ? a[x] : undefined), o); if (v != null && v !== '') return v; } } return null; };
  precio = precio || numero(buscarLd(ld, ['offers.price', 'price', 'offers.0.price']));
  const km = numero((texto.match(/([\d.]{2,9})\s?km/i) || [])[1]) || numero(buscarLd(ld, ['mileageFromOdometer.value', 'mileageFromOdometer']));
  const anio = Number((texto.match(/\b(19[89]\d|20[0-3]\d)\b/) || [])[1]) || Number(String(buscarLd(ld, ['vehicleModelDate', 'productionDate', 'modelDate']) || '').slice(0, 4)) || null;
  const marca = MARCAS.find((m) => new RegExp(`\\b${m}\\b`, 'i').test(texto)) || buscarLd(ld, ['brand.name', 'brand', 'manufacturer.name']) || null;
  const comb = /di[eé]sel|tdi|dci|hdi|cdi|crdi/i.test(texto) ? 'Diésel' : /h[ií]brid/i.test(texto) ? 'Híbrido gasolina' : /el[eé]ctric|electric/i.test(texto) ? 'Eléctrico' : /gasolina|benzin|petrol|tsi|tfsi/i.test(texto) ? 'Gasolina' : null;
  const co2 = numero((texto.match(/(\d{2,3})\s?g\/km/i) || [])[1]);
  const cambio = /autom[aá]t|automatik|dsg|s[- ]tronic|tiptronic/i.test(texto) ? 'Automático' : /manual|schaltgetriebe/i.test(texto) ? 'Manual' : null;
  const imagen = meta(html, 'og:image');
  const generico = {
    portal: p.nombre, origen: p.origen, titulo: titulo.slice(0, 160), precio, km, anio, marca: limpiarMarca(marca), modelo: null, version: null,
    combustible: comb, cambio, co2, potencia_cv: null,
    fotos: fotosValidas(imagen ? [imagen] : []),
    // la descripción corta de los metadatos solo si parece texto del vendedor y no la frase genérica del portal
    descripcion: descripcion.length > 80 ? textoLimpio(descripcion) : null,
  };

  // Lo que el portal da de forma estructurada manda sobre lo adivinado del título.
  let especifico = null;
  try {
    if (p.nombre === 'AutoScout24') especifico = autoscout(html);
    else if (p.nombre === 'Wallapop') especifico = wallapop(html);
    else if (p.nombre === 'coches.net') especifico = cochesnet(html) || desdeEnlaceCochesNet(url);
  } catch { especifico = null; }
  if (especifico) {
    for (const [k, v] of Object.entries(especifico)) {
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
      generico[k] = k === 'titulo' ? String(v).slice(0, 160) : v;
    }
  }
  return completar(generico);
}

export async function leerAnuncio(url) {
  const p = portal(url) || {};
  let r;
  try {
    r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', Accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'es-ES,es;q=0.9,de;q=0.5' }, redirect: 'follow', signal: AbortSignal.timeout(12000) });
  } catch (e) {
    if (p.nombre === 'coches.net') return soloEnlace(p, url, true);
    throw new Error('sin respuesta');
  }
  // coches.net bloquea a veces la lectura automática: lo que dice el enlace sigue valiendo
  if (!r.ok) {
    if (p.nombre === 'coches.net' && desdeEnlaceCochesNet(url)) return soloEnlace(p, url, true);
    throw new Error(`El portal ha respondido ${r.status}`);
  }
  const html = (await r.text()).slice(0, 2500000);
  return extraer(html, url);
}
