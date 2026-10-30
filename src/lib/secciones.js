// «Tu web a tu medida»: lo que el dueño decide enseñar u ocultar de su web desde el panel (Ajustes → Tu web).
// En Arbicars le venía todo en un paquete cerrado; aquí cada parte se quita o se pone con un toque.
// Por defecto se ve todo menos lo de NEGOCIO.ocultosIniciales (src/negocio.js): solo se guarda lo oculto.
//
// Cómo se aplica: el middleware pasa cada página pública por un HTMLRewriter que quita lo oculto (enlaces del
// menú y del pie, bloques de la portada, botones) antes de guardarla en la caché. Las páginas quitadas dan 404
// y salen del mapa del sitio. Al guardar, la versión del contenido cambia y la caché se renueva sola.
import { ajuste, preparar } from './datos.js';

/** Páginas que se pueden quitar. Inicio, Stock, las fichas y Contacto siempre están. */
export const PAGINAS = [
  { id: 'encargo', ruta: '/custom-order', nombre: 'Encargo a medida', ayuda: 'El cliente te pide un coche concreto y tú se lo buscas. Si la quitas, también se van el botón «Encargo a medida» de la portada y el anuncio de importación.' },
  { id: 'vende', ruta: '/sell-your-car', nombre: 'Vende tu coche', ayuda: 'Formulario para que te ofrezcan su coche, con fotos.' },
  { id: 'financiacion', ruta: '/finance', nombre: 'Financiación', ayuda: 'Simulador de cuotas y solicitud de financiación (también la calculadora de la portada).' },
  { id: 'servicios', ruta: '/services', nombre: 'Servicios', ayuda: 'La página con todos tus servicios explicados.' },
  { id: 'historia', ruta: '/history', nombre: 'Últimas entregas', ayuda: 'Los coches que ya has vendido (los que marcas como Vendido en el panel). Desde el stock se enlaza cuando hay alguno.' },
];

/** Bloques de la portada, en el orden en que salen. «Stock destacado» siempre está. */
export const PORTADA = [
  { id: 'propuesta', nombre: '«Vende tu coche sin estrés y con total garantía»', ayuda: 'El bloque con la foto de la entrega de llaves, debajo del stock.' },
  { id: 'servicios', nombre: '«Nuestros servicios»', ayuda: 'Tus servicios en cuadros: financiación, garantía, gestión de venta, importación…' },
  { id: 'importacion', nombre: '«¿Un coche muy concreto? Te lo traemos»', ayuda: 'El anuncio grande de la importación a medida.' },
  { id: 'nosotros', nombre: '«Sobre nosotros»', ayuda: 'Quiénes sois.' },
];

/** Botones que se pueden quitar de toda la web. */
export const BOTONES = [
  { id: 'whatsapp', nombre: 'Barra de WhatsApp y Llamar en el móvil', ayuda: 'La barra fija de abajo en el móvil, con WhatsApp y Llamar. El WhatsApp de arriba y el de cada coche se quedan.' },
  { id: 'reserva', nombre: '«Reservar por 100 €» en cada coche', ayuda: 'Te llega como pre-reserva y la señal se acuerda por teléfono. Si está quitado, en los coches quedan «Pedir información», «Llamar» y WhatsApp.' },
];

const CLAVE = 'web_oculto';
const ID = (grupo, id) => `${grupo}:${id}`;
export const VALIDOS = new Set([
  ...PAGINAS.map((p) => ID('pagina', p.id)),
  ...PORTADA.map((b) => ID('portada', b.id)),
  ...BOTONES.map((b) => ID('boton', b.id)),
]);

/** Lista de lo oculto (p. ej. ['pagina:alquiler', 'boton:reserva']). */
export function deTexto(valor) {
  try {
    const lista = JSON.parse(valor || '[]');
    return Array.isArray(lista) ? lista.filter((x) => VALIDOS.has(x)) : [];
  } catch {
    return [];
  }
}
export const leerOcultos = async (db) => deTexto(await ajuste(db, CLAVE));

export async function guardarOcultos(db, lista) {
  const limpia = [...new Set(lista.filter((x) => VALIDOS.has(x)))].sort();
  await preparar(db);
  // las dos cosas o ninguna: lo oculto y la versión del contenido (con la versión nueva, la caché se renueva)
  await db.batch([
    limpia.length
      ? db.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor').bind(CLAVE, JSON.stringify(limpia))
      : db.prepare('DELETE FROM ajustes WHERE clave = ?').bind(CLAVE),
    db.prepare("INSERT INTO ajustes (clave, valor) VALUES ('version', '1') ON CONFLICT(clave) DO UPDATE SET valor = CAST(CAST(valor AS INTEGER) + 1 AS TEXT)"),
  ]);
  return limpia;
}

const oculto = (ocultos, grupo, id) => ocultos.includes(ID(grupo, id));

/** ¿Esta dirección es una página que el dueño ha quitado? */
export function rutaQuitada(ruta, ocultos) {
  return PAGINAS.some((p) => oculto(ocultos, 'pagina', p.id) && (ruta === p.ruta || ruta.startsWith(p.ruta + '/')));
}
/** Las rutas visibles de una lista (para el mapa del sitio). */
export const rutasVisibles = (rutas, ocultos) => rutas.filter((r) => !rutaQuitada(r, ocultos));

/** Selectores CSS de lo que hay que quitar en una página. */
export function selectores(ruta, ocultos) {
  const s = [];
  for (const p of PAGINAS) {
    if (!oculto(ocultos, 'pagina', p.id)) continue;
    // enlaces del menú, de la cabecera, del pie y de los botones que llevan a esa página,
    // y los bloques que dependen de ella (data-lidi-pagina, p. ej. la calculadora de la portada)
    s.push(`a[href="${p.ruta}"]`, `a[href^="${p.ruta}#"]`, `a[href^="${p.ruta}?"]`, `[data-lidi-pagina="${p.id}"]`);
    // sin encargo a medida, fuera también el anuncio de importación de la portada
    if (p.id === 'encargo') s.push('[data-editor-section="importacion"]');
  }
  if (ruta === '/') for (const b of PORTADA) if (oculto(ocultos, 'portada', b.id)) s.push(`[data-editor-section="${b.id}"]`);
  if (oculto(ocultos, 'boton', 'whatsapp')) s.push('[data-lidi-whatsapp]');
  if (oculto(ocultos, 'boton', 'reserva')) s.push('[data-abrir="reserva"]', '[data-lidi-reserva]');
  return [...new Set(s)];
}

/**
 * Quita del HTML de una página lo que el dueño ha ocultado. Si no hay nada oculto, lo devuelve tal cual.
 * Se le pasa el texto ya leído (no el flujo de Astro): así HTMLRewriter trabaja sobre un cuerpo normal y la
 * respuesta se puede guardar en la caché sin repartir el flujo entre varios lectores.
 */
export async function aplicar(html, ruta, ocultos) {
  const lista = selectores(ruta, ocultos);
  if (!lista.length || typeof HTMLRewriter === 'undefined') return html;
  // eslint-disable-next-line no-undef
  let r = new HTMLRewriter();
  const quitar = { element(e) { e.remove(); } };
  for (const sel of lista) r = r.on(sel, quitar);
  return r.transform(new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })).text();
}
