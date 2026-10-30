// Textos legales de la web (aviso legal, privacidad, condiciones y cookies), los mismos en los dos diseños.
import { EMAIL, DIRECCION, TELEFONO_BONITO, TITULAR, NIF } from '../diseno2/datos-contacto.js';
import { NEGOCIO, NOMBRE_WEB } from '../negocio.js';

const titular = `${TITULAR || NEGOCIO.nombre}${NIF ? ` (NIF ${NIF})` : ''}`;

/** [id, título, [[subtítulo, párrafo], …]] */
export const LEGALES = [
  ['aviso-legal', 'Aviso legal', [
    ['', 'En cumplimiento de la Ley 34/2002 de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de los siguientes datos identificativos:'],
    ['Titular del sitio web', `Titular: ${titular} · Domicilio: ${DIRECCION} · Email: ${EMAIL} · Teléfono: ${TELEFONO_BONITO}`],
    ['Propiedad intelectual', 'Todos los contenidos del sitio web (textos, imágenes, logotipos) están protegidos por derechos de propiedad intelectual e industrial.'],
    ['Información de los vehículos', 'Los precios, kilómetros y características de los vehículos son orientativos y pueden cambiar sin previo aviso. La disponibilidad se confirma siempre por el concesionario.'],
  ]],
  ['privacidad', 'Política de privacidad', [
    ['Responsable', `${titular} · ${DIRECCION} · ${EMAIL} · ${TELEFONO_BONITO}.`],
    ['Qué datos tratamos y para qué', 'Los datos que nos envías en los formularios (nombre, teléfono, email, datos de tu vehículo y fotos, si las adjuntas) se usan para responder a tu solicitud (información de un coche, pre-reserva, financiación, tasación o búsqueda a medida) y para hacerle seguimiento: guardamos tu contacto y tus mensajes en nuestra agenda de clientes.'],
    ['Legitimación', 'Tu consentimiento al enviar el formulario y, cuando corresponda, la aplicación de medidas precontractuales a petición tuya.'],
    ['Conservación', 'Mientras dure la relación o sea necesario para atender tu solicitud, y después durante los plazos legales aplicables.'],
    ['Destinatarios', 'No cedemos tus datos a terceros salvo obligación legal. Usamos proveedores que actúan como encargados del tratamiento: Cloudflare (alojamiento de la web y de los datos), Vercel (entrega de la web) y Resend (avisos por correo de cada formulario). Pueden tratar datos fuera del Espacio Económico Europeo con las garantías que exige el RGPD (cláusulas contractuales tipo o el Marco de Privacidad de Datos UE-EE. UU.). Si solicitas financiación, tus datos solo se comparten con la entidad financiera con tu autorización.'],
    ['Tus derechos', `Puedes acceder, rectificar, suprimir, oponerte, limitar el tratamiento o pedir la portabilidad escribiendo a ${EMAIL}. También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).`],
  ]],
  ['terminos', 'Términos y condiciones', [
    ['', 'El uso de este sitio web implica la aceptación de estas condiciones.'],
    ['Información y precios', 'La información de los vehículos se ofrece de buena fe y es orientativa. El precio «financiado» y las cuotas del simulador son estimaciones sujetas a la aprobación de la entidad financiera.'],
    ['Pre-reservas', 'Una pre-reserva no es una compraventa. El concesionario confirmará la disponibilidad del vehículo y el cliente dispone de 24 horas para pagar la señal de 100 €; si no se paga en ese plazo, la pre-reserva caduca. Las condiciones de devolución se acuerdan con el concesionario.'],
    ['Responsabilidad', `${TITULAR || NOMBRE_WEB} no se hace responsable del mal uso del sitio ni de los daños derivados de interrupciones técnicas ajenas a su control.`],
  ]],
  ['cookies', 'Política de cookies', [
    ['', 'Este sitio web no utiliza cookies propias ni de terceros con fines publicitarios, analíticos o de seguimiento, por lo que no necesita tu consentimiento.'],
    ['', 'Algunos enlaces llevan a servicios externos (WhatsApp, Google Maps) que tienen sus propias políticas de cookies.'],
  ]],
];

/** Primera capa de información en cada formulario (RGPD art. 13), con enlace a la política completa. */
export const NOTA_PRIVACIDAD = `Responsable: ${NEGOCIO.nombre}. Usamos tus datos para atender tu solicitud y hacerle seguimiento. No los cedemos a nadie, salvo a la entidad financiera si lo autorizas, ni en los casos que obligue la ley. Puedes acceder a ellos, rectificarlos o borrarlos escribiéndonos.`;
export const CONSENTIMIENTO_FINANCIERA = `Acepto que ${NEGOCIO.nombre} comparta mis datos con la entidad financiera para estudiar la financiación.`;
