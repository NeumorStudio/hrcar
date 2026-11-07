// Contratos de captación: plantilla con huecos ({{campo}}), texto rellenado, validación del DNI, huella y firmas.
// El PDF lo monta el navegador (src/lib/contrato-pdf.js): generar un PDF con imágenes gasta más CPU de la que da
// el plan gratuito de Cloudflare por petición. Lo que vale es lo guardado al firmar (texto, firmas, registro y huella).
// La plantilla se cambia en Ajustes → Contratos. Al enviar un contrato se congela su texto: cambiar la plantilla
// después no toca los contratos ya enviados.

export const PLANTILLA_PROVISIONAL = `# ACUERDO DE INTERMEDIACIÓN PARA LA VENTA DE UN VEHÍCULO

En {{ciudad}}, a {{fecha}}.

## REUNIDOS

De una parte, {{empresa_nombre}}, con NIF {{empresa_nif}} y domicilio en {{empresa_domicilio}}, representada por {{empresa_representante}} (en adelante, «el INTERMEDIARIO»).

De otra parte, {{vendedor_nombre}}, con DNI/NIE {{vendedor_dni}} y domicilio en {{vendedor_domicilio}}, teléfono {{vendedor_telefono}} (en adelante, «el PROPIETARIO»).

## EXPONEN

Que el PROPIETARIO es titular del vehículo {{coche}}, matrícula {{matricula}}, con {{km}} kilómetros, y quiere venderlo a través del INTERMEDIARIO.

## CLÁUSULAS

1. Encargo. El PROPIETARIO encarga al INTERMEDIARIO buscar comprador para el vehículo y gestionar su venta.

2. Precio para el propietario. El PROPIETARIO recibirá {{precio_neto}} por la venta del vehículo. El INTERMEDIARIO podrá ofrecerlo al precio que considere oportuno, y la diferencia entre el precio final de venta y esa cantidad será su retribución.

3. Exclusividad y plazo. Durante {{plazo_dias}} días desde la firma, el PROPIETARIO no venderá el vehículo por su cuenta ni a través de terceros, y retirará en las 24 horas siguientes los anuncios que tenga publicados.

4. Anuncios y fotografías. El PROPIETARIO autoriza al INTERMEDIARIO a anunciar el vehículo y a usar las fotografías y la descripción de su anuncio.

5. Custodia y visitas. El vehículo seguirá en poder del PROPIETARIO, que facilitará que los interesados que le indique el INTERMEDIARIO lo vean y lo prueben.

6. Estado y documentación. El PROPIETARIO declara que la documentación está en regla, que el vehículo no tiene cargas ni embargos y que los kilómetros indicados son reales.

7. Pago y entrega. El PROPIETARIO cobrará el precio acordado en el momento de la venta, antes de entregar el vehículo, las llaves y la documentación. El cambio de titularidad se hará directamente a nombre del comprador.

8. Fin del acuerdo. Si pasado el plazo no se ha vendido el vehículo, el acuerdo termina sin coste para ninguna de las partes, salvo que lo prorroguen por escrito.

9. Protección de datos. Los datos del PROPIETARIO se usarán solo para gestionar esta venta y se conservarán durante los plazos legales. Puede ejercer sus derechos escribiendo al INTERMEDIARIO.

Y en prueba de conformidad, las dos partes firman este acuerdo de forma electrónica.`;

/** Campos que se pueden usar en la plantilla, con lo que significan (para la ayuda de Ajustes). */
export const CAMPOS = [
  ['ciudad', 'Ciudad donde se firma (Ajustes)'], ['fecha', 'Fecha de la firma'],
  ['empresa_nombre', 'Tu nombre o razón social'], ['empresa_nif', 'Tu NIF/CIF'], ['empresa_domicilio', 'Tu domicilio'], ['empresa_representante', 'Quién firma por ti'],
  ['vendedor_nombre', 'Nombre del vendedor (lo confirma él al firmar)'], ['vendedor_dni', 'DNI/NIE del vendedor (lo pone él al firmar)'],
  ['vendedor_domicilio', 'Domicilio del vendedor (lo pone él al firmar)'], ['vendedor_telefono', 'Teléfono del vendedor'], ['vendedor_email', 'Correo del vendedor'],
  ['coche', 'Marca, modelo y versión'], ['matricula', 'Matrícula (si no la tienes, la pone él al firmar)'], ['bastidor', 'Número de bastidor (opcional, lo puede poner él)'],
  ['km', 'Kilómetros'], ['anio', 'Año'], ['precio_neto', 'Lo que recibe el vendedor (€)'], ['plazo_dias', 'Días de exclusividad'],
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
  return String(texto).split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b) => {
    if (b.startsWith('# ')) return { tipo: 'titulo', texto: b.slice(2).trim() };
    if (b.startsWith('## ')) return { tipo: 'apartado', texto: b.slice(3).trim() };
    return { tipo: 'parrafo', texto: b.replace(/\s*\n\s*/g, ' ') };
  });
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
export const fechaHora = (iso) => (iso ? new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');

