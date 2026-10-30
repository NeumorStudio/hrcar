// Lee un anuncio (Wallapop, coches.net, AutoScout24, Milanuncios…) y saca lo que puede: título,
// precio, año, km, combustible, cambio, CO₂ y origen. Si el portal bloquea la lectura (mobile.de lo
// hace), se rellena a mano.
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
const decodificar = (t) => t.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const numero = (t) => { if (t == null) return null; const n = Number(String(t).replace(/[^\d,.]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n) : null; };
const limpiarMarca = (m) => (m ? String(m).replace(/^VW$/i, 'Volkswagen').replace(/^Mercedes$/i, 'Mercedes-Benz').replace(/^SEAT$/i, 'SEAT').trim() : null);
const normalizarCombustible = (t) => {
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
const normalizarCambio = (t) => (!t ? null : /autom|dsg|s[- ]tronic|tiptronic/i.test(t) ? 'Automático' : /manual|schalt/i.test(t) ? 'Manual' : null);

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
  };
}

export function extraer(html, url) {
  const p = portal(url) || {};
  let titulo = meta(html, 'og:title') || decodificar((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [, ''])[1]);
  // coches.net y similares meten precio y ciudad en el título: «… (2017) - 10.500 € en Alicante | Coches.net»
  titulo = titulo.replace(/\s*[-–|]\s*[\d.,]+\s*€.*$/, '').replace(/\s*\|\s*[^|]*$/, '').trim();
  const descripcion = meta(html, 'og:description') || meta(html, 'description') || '';
  const texto = `${titulo} ${descripcion}`;
  let precio = numero(meta(html, 'product:price:amount') || meta(html, 'og:price:amount'));
  // JSON-LD (coches.net, mobile.de, AutoScout24 suelen llevarlo)
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } }).filter(Boolean).flat();
  const buscarLd = (obj, claves) => { for (const o of obj) { for (const k of claves) { const v = k.split('.').reduce((a, x) => (a ? a[x] : undefined), o); if (v != null && v !== '') return v; } } return null; };
  precio = precio || numero(buscarLd(ld, ['offers.price', 'price', 'offers.0.price']));
  const km = numero((texto.match(/([\d.]{2,9})\s?km/i) || [])[1]) || numero(buscarLd(ld, ['mileageFromOdometer.value', 'mileageFromOdometer']));
  const anio = Number((texto.match(/\b(19[89]\d|20[0-3]\d)\b/) || [])[1]) || Number(String(buscarLd(ld, ['vehicleModelDate', 'productionDate', 'modelDate']) || '').slice(0, 4)) || null;
  const marca = MARCAS.find((m) => new RegExp(`\\b${m}\\b`, 'i').test(texto)) || buscarLd(ld, ['brand.name', 'brand', 'manufacturer.name']) || null;
  const comb = /di[eé]sel|tdi|dci|hdi|cdi|crdi/i.test(texto) ? 'Diésel' : /h[ií]brid/i.test(texto) ? 'Híbrido gasolina' : /el[eé]ctric|electric/i.test(texto) ? 'Eléctrico' : /gasolina|benzin|petrol|tsi|tfsi/i.test(texto) ? 'Gasolina' : null;
  const co2 = numero((texto.match(/(\d{2,3})\s?g\/km/i) || [])[1]);
  const cambio = /autom[aá]t|automatik|dsg|s[- ]tronic|tiptronic/i.test(texto) ? 'Automático' : /manual|schaltgetriebe/i.test(texto) ? 'Manual' : null;
  const generico = { portal: p.nombre, origen: p.origen, titulo: titulo.slice(0, 160), precio, km, anio, marca: limpiarMarca(marca), modelo: null, version: null, combustible: comb, cambio, co2, potencia_cv: null };

  // Lo que el portal da de forma estructurada manda sobre lo adivinado del título.
  let especifico = null;
  try {
    if (p.nombre === 'AutoScout24') especifico = autoscout(html);
    else if (p.nombre === 'Wallapop') especifico = wallapop(html);
  } catch { especifico = null; }
  if (especifico) {
    for (const [k, v] of Object.entries(especifico)) if (v != null && v !== '') generico[k] = k === 'titulo' ? String(v).slice(0, 160) : v;
    generico.marca = limpiarMarca(generico.marca);
  }
  return generico;
}

export async function leerAnuncio(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', Accept: 'text/html,*/*;q=0.8', 'Accept-Language': 'es-ES,es;q=0.9,de;q=0.5' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`El portal ha respondido ${r.status}`);
  const html = (await r.text()).slice(0, 2500000);
  return extraer(html, url);
}
