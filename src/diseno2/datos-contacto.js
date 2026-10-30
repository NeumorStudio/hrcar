// Datos de contacto que se repiten por toda la web (salen de src/negocio.js).
import { tituloLimpio } from '../lib/nombres.js';
import { eurosMiles, precioFinal } from '../lib/formato.js';
import { NEGOCIO, WHATSAPP_URL } from '../negocio.js';
export const TELEFONO = NEGOCIO.telefono;
export const TELEFONO_BONITO = NEGOCIO.telefonoBonito;
export const WHATSAPP = WHATSAPP_URL;
export const EMAIL = NEGOCIO.email;
export const DIRECCION = NEGOCIO.direccion;
export const MAPA = NEGOCIO.mapa;
export const HORARIO = NEGOCIO.horario;
export const TITULAR = NEGOCIO.titular;
export const NIF = NEGOCIO.nif;
/** WhatsApp con el coche ya escrito (nombre, año y precio): así el dueño sabe cuál es sin preguntar. */
export const whatsappCoche = (c) => {
  const precio = precioFinal(c);
  const detalle = [c.anio, precio > 0 ? eurosMiles(precio) : null].filter(Boolean).join(', ');
  return `${WHATSAPP}?text=${encodeURIComponent(`Hola, me interesa el ${tituloLimpio(c)}${detalle ? ` (${detalle})` : ''} que tenéis en la web.`)}`;
};
