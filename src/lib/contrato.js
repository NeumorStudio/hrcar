// Contratos de captación: plantilla con huecos ({{campo}}), texto rellenado, validación del DNI, huella y firmas.
// El PDF lo monta el navegador (src/lib/contrato-pdf.js): generar un PDF con imágenes gasta más CPU de la que da
// el plan gratuito de Cloudflare por petición. Lo que vale es lo guardado al firmar (texto, firmas, registro y huella).
// La plantilla se cambia en Ajustes → Contratos. Al enviar un contrato se congela su texto: cambiar la plantilla
// después no toca los contratos ya enviados.

// Contrato de serie para todos los concesionarios: el «Contrato de venta en exclusiva» que usa LIDIAUTO. Cada dueño lo
// puede cambiar en Ajustes → Contratos; lo que cambia de una web a otra (nombres, NIF, garantía, penalización…) va en huecos.
export const PLANTILLA_SERIE = `# CONTRATO DE VENTA EN EXCLUSIVA

Entre el VENDEDOR, {{vendedor_nombre}}, con DNI/NIE {{vendedor_dni}}, y el ASESOR, {{empresa_representante}}, con DNI/NIF {{empresa_nif}}, de {{empresa_nombre}}.

Fecha: {{fecha}}.

Vehículo: {{coche}}, matrícula {{matricula}}, con {{km}} kilómetros.

## 1. Encargo

El Vendedor encarga al Asesor la gestión profesional de la venta de su vehículo en régimen de exclusiva por un periodo de {{plazo_dias}} días.

## 2. Servicios incluidos

El Asesor gestionará:
- Publicación y promoción del vehículo.
- Atención a interesados.
- Negociación.
- Gestión de la garantía de {{garantia_meses}} meses.
- Cambio de titularidad ante la DGT.

## 3. Exclusividad

Durante la vigencia del acuerdo:
- El vehículo no podrá anunciarse ni venderse por cuenta propia.
- Si el Vendedor encuentra comprador, la operación deberá formalizarse a través del Asesor.

## 4. Precio

Precio de salida acordado: {{precio_neto}}. Cualquier oferta inferior será consultada previamente. El Vendedor autoriza al Asesor a negociar y a comunicarle solo ofertas serias.

## 5. Honorarios

Los honorarios serán asumidos por el Comprador.

## 6. Responsabilidad

El Vendedor declara que el vehículo está libre de cargas y responde por posibles vicios ocultos.

## 7. Penalización

Si el Vendedor incumple la exclusividad, cancela sin causa justificada o vende por su cuenta durante la vigencia, deberá abonar al Asesor una compensación de {{penalizacion}}.`;

/** Campos que se pueden usar en la plantilla, con lo que significan (para la ayuda de Ajustes). */
export const CAMPOS = [
  ['ciudad', 'Ciudad donde se firma (Ajustes)'], ['fecha', 'Fecha de la firma'],
  ['empresa_nombre', 'Tu nombre o razón social'], ['empresa_nif', 'Tu NIF/CIF'], ['empresa_domicilio', 'Tu domicilio'], ['empresa_representante', 'Quién firma por ti'],
  ['vendedor_nombre', 'Nombre del vendedor (lo confirma él al firmar)'], ['vendedor_dni', 'DNI/NIE del vendedor (lo pone él al firmar)'],
  ['vendedor_domicilio', 'Domicilio del vendedor (lo pone él al firmar)'], ['vendedor_telefono', 'Teléfono del vendedor'], ['vendedor_email', 'Correo del vendedor'],
  ['coche', 'Marca, modelo y versión'], ['matricula', 'Matrícula (si no la tienes, la pone él al firmar)'], ['bastidor', 'Número de bastidor (opcional, lo puede poner él)'],
  ['km', 'Kilómetros'], ['anio', 'Año'], ['precio_neto', 'Lo que recibe el vendedor (€)'], ['plazo_dias', 'Días de exclusividad'],
  ['garantia_meses', 'Meses de garantía que gestionas (Ajustes)'], ['penalizacion', 'Compensación si el vendedor rompe la exclusiva (Ajustes)'],
];
/** Lo que rellena el vendedor al firmar (si la plantilla lo pide): [campo, etiqueta, obligatorio]. */
export const DEL_VENDEDOR = [
  ['vendedor_nombre', 'Nombre y apellidos', true],
  ['vendedor_dni', 'DNI o NIE', true],
  ['vendedor_domicilio', 'Domicilio', true],
  ['matricula', 'Matrícula del coche', true],
  ['bastidor', 'Número de bastidor (opcional)', false],
];
const HUECO = '__________';

export const usaCampo = (plantilla, campo) => new RegExp(`\\{\\{\\s*${campo}\\s*\\}\\}`).test(plantilla);
/** Texto con los huecos rellenados; lo que falta queda como «__________». */
export function rellenar(plantilla, valores) {
  return String(plantilla).replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => {
    const v = valores?.[k];
    return v == null || String(v).trim() === '' ? HUECO : String(v).trim();
  });
}
/** Bloques del texto: [{ tipo: 'titulo'|'apartado'|'parrafo', texto }]. */
export function bloques(texto) {
  const salida = [];
  for (const b of String(texto).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)) {
    if (b.startsWith('# ')) { salida.push({ tipo: 'titulo', texto: b.slice(2).trim() }); continue; }
    if (b.startsWith('## ')) { salida.push({ tipo: 'apartado', texto: b.slice(3).trim() }); continue; }
    // dentro de un bloque, las líneas que empiezan por «- » o «• » son una lista; el resto, párrafo
    let parrafo = [];
    let lista = [];
    const cerrar = () => {
      if (parrafo.length) salida.push({ tipo: 'parrafo', texto: parrafo.join(' ') });
      if (lista.length) salida.push({ tipo: 'lista', items: lista });
      parrafo = []; lista = [];
    };
    for (const linea of b.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const item = /^[-•●]\s+(.*)$/.exec(linea);
      if (item) { if (parrafo.length && !lista.length) { salida.push({ tipo: 'parrafo', texto: parrafo.join(' ') }); parrafo = []; } lista.push(item[1]); }
      else { if (lista.length) cerrar(); parrafo.push(linea); }
    }
    cerrar();
  }
  return salida;
}

// ------------------------------------------------------------------ DNI, NIE y CIF
const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE';
/** DNI o NIE con la letra bien (12345678Z, X1234567L) o un CIF de empresa. Devuelve el documento normalizado o null. */
export function documentoValido(t) {
  const d = String(t || '').toUpperCase().replace(/[\s.-]/g, '');
  if (/^\d{8}[A-Z]$/.test(d)) return LETRAS[Number(d.slice(0, 8)) % 23] === d[8] ? d : null;
  if (/^[XYZ]\d{7}[A-Z]$/.test(d)) return LETRAS[Number('XYZ'.indexOf(d[0]) + d.slice(1, 8)) % 23] === d[8] ? d : null;
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(d)) return d; // CIF: se acepta la forma
  return null;
}
export const matriculaValida = (t) => {
  const m = String(t || '').toUpperCase().replace(/[\s-]/g, '');
  return /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(m) || /^[A-Z]{1,2}\d{4}[A-Z]{0,2}$/.test(m) ? m : null;
};

// ------------------------------------------------------------------ huella y firmas
export async function sha256(datos) {
  const bytes = typeof datos === 'string' ? new TextEncoder().encode(datos) : datos;
  const h = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
/** Firma dibujada: PNG en data URL, de tamaño razonable y que de verdad sea un PNG. Devuelve los bytes o null. */
export function bytesFirma(dataUrl, maxBytes = 400000) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m || m[1].length > maxBytes * 1.4) return null;
  let bin;
  try { bin = atob(m[1]); } catch { return null; }
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  const firmaPng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 100 || firmaPng.some((x, i) => b[i] !== x)) return null;
  return b;
}
export const tokenNuevo = () => {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const TOKEN_VALIDO = /^[A-Za-z0-9_-]{30,64}$/;

export const fechaLarga = (d = new Date()) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });
/** Solo el día (dd/mm/aaaa) en hora de España: lo guardado a las 23:30 en UTC ya es el día siguiente aquí. */
export const fechaDia = (iso) => (iso ? new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
export const fechaHora = (iso) => (iso ? new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');

