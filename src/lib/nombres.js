// Cómo se nombra un coche en la web y en el panel.
// Los anuncios importados de Arbicars repiten el modelo al principio de la versión
// ("Audi Q2 Q2 Advanced…", "Jaguar F Pace F-PACE 2.0…"): aquí se quita la repetición
// sin tocar los datos. Un título que no empiece por marca + modelo se respeta tal cual.

const llano = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Quita de `texto` las primeras palabras si juntas dicen lo mismo que `prefijo` (sin mirar mayúsculas, guiones ni espacios). */
export function sinPrefijo(texto, prefijo) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  const p = llano(prefijo);
  if (!p || !t) return t;
  const palabras = t.split(' ');
  let acumulado = '';
  for (let i = 0; i < palabras.length; i++) {
    acumulado += llano(palabras[i]);
    if (acumulado === p) return palabras.slice(i + 1).join(' ');
    if (!p.startsWith(acumulado)) return t;
  }
  return t;
}

/** "Marca Modelo versión" sin el modelo repetido. */
export function tituloLimpio(c) {
  const t = String(c?.titulo ?? '').replace(/\s+/g, ' ').trim();
  const cabeza = [c?.marca, c?.modelo].filter(Boolean).join(' ');
  if (!cabeza) return t;
  const resto = sinPrefijo(t, cabeza);
  if (resto === t) return t;
  return [cabeza, sinPrefijo(resto, c.modelo)].filter(Boolean).join(' ');
}

/** Para tarjetas y fichas: el nombre ("Marca Modelo") y la versión por separado. */
export function partesTitulo(c) {
  const limpio = tituloLimpio(c);
  const cabeza = [c?.marca, c?.modelo].filter(Boolean).join(' ');
  const version = cabeza ? sinPrefijo(limpio, cabeza) : limpio;
  if (!cabeza || version === limpio) return { nombre: limpio, version: '' };
  return { nombre: cabeza, version };
}

// Valores de combustible que llegan "en crudo" de los anuncios importados.
const MOTORES = {
  mild_hybrid_gasoline: ['Híbrido ligero (gasolina)', 'Híbr. ligero'],
  mild_hybrid_diesel: ['Híbrido ligero (diésel)', 'Híbr. ligero'],
  plug_in_hybrid: ['Híbrido enchufable', 'Híbr. ench.'],
  hybrid: ['Híbrido', 'Híbrido'],
  electric: ['Eléctrico', 'Eléctrico'],
  gasoline: ['Gasolina', 'Gasolina'],
  petrol: ['Gasolina', 'Gasolina'],
  diesel: ['Diésel', 'Diésel'],
  lpg: ['GLP', 'GLP'],
  cng: ['GNC', 'GNC'],
};
const CORTOS = { 'Híbrido enchufable': 'Híbr. ench.', 'Híbrido gasolina': 'Híbrido', 'Híbrido diésel': 'Híbr. diésel' };

/** Combustible legible. `corto` para las tarjetas, donde hay poco sitio. */
export function motor(combustible, corto = false) {
  const v = String(combustible ?? '').trim();
  if (!v) return '';
  const m = MOTORES[v.toLowerCase()];
  if (m) return corto ? m[1] : m[0];
  return corto ? CORTOS[v] || v : v;
}
