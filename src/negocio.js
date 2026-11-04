// Datos del concesionario. Es lo único que cambia de un cliente a otro, junto con:
//   - src/diseno2/contenido.js  (textos de la web: servicios, preguntas, portada…)
//   - public/img/marca/         (logo e iconos) y public/img/v2/ (fotos de las secciones)
//   - src/data/coches.json      (stock inicial: solo se carga en una base de datos nueva)
// Plantilla de concesionarios de NeumorStudio. Cliente: H & R Car (Albacete).

export const NEGOCIO = {
  nombre: 'H & R Car',
  // dominio propio sin https ni www (p. ej. 'hrcar.es'). Vacío = todavía sin dominio: la web sale como «provisional»
  // y todas sus direcciones llevan noindex para que Google no indexe la dirección técnica.
  dominio: 'hrcar.es',
  provisional: 'https://hrcar.vercel.app',

  telefono: '+34685447955',
  telefonoBonito: '685 44 79 55',
  whatsapp: '34685447955',
  email: 'albapelu967@gmail.com',

  // dirección que se ve en la web (orientativa, para saber dónde ver los coches) y domicilio completo del aviso legal
  direccion: 'C/ Mariana Pineda, 1 · Albacete',
  domicilio: 'C/ Mariana Pineda, 1, ático 7, Albacete',
  // solo calle y número, sin la ciudad: es lo que va en los datos para Google (streetAddress). Vacío = se usa «direccion».
  calle: 'C/ Mariana Pineda, 1',
  localidad: 'Albacete',
  provincia: 'Albacete',
  codigoPostal: '',
  mapa: 'https://www.google.com/maps/search/?api=1&query=Calle%20Mariana%20Pineda%201%2C%20Albacete',
  // el dueño ha dado las horas, no los días: por eso no van días ni horario en los datos para Google (horarioLd)
  horario: 'De 9:00 a 15:00 y de 16:30 a 21:00',
  horarioLd: [],

  // Titular legal (nombre y apellidos o razón social) y NIF para el aviso legal. El dueño solo quiere nombre y dirección.
  titular: 'Humberto Paredes Durán',
  nif: '',

  lema: 'Confianza y acompañamiento en cada paso',
  // cómo se nombra al dueño en el panel («Contraseña del dueño», «Has entrado como Dueño»)
  dueno: 'el dueño',
  duenoNombre: 'Dueño',

  logo: '/img/marca/logo-cromado.webp', // redondo, cromado sobre gris (el que eligió Humberto); nombre nuevo para saltarse la caché de /img
  // cómo se escribe la marca al lado del logo en la cabecera: [parte blanca, parte de color]
  marca: ['H&R', 'Car'],

  // Avisos por correo de cada formulario (Resend, si está RESEND_API_KEY). El remitente tiene que ser de un
  // dominio verificado en la cuenta de Resend: el de NeumorStudio sirve para todos los clientes.
  remitente: 'H & R Car web <avisos@neumorstudio.com>',
  // La cuenta de Resend es compartida con otros proyectos (la peluquería manda ahí sus citas, 100 correos al día en
  // el plan gratuito). Pasado este tope, los mensajes siguen llegando al panel y al móvil, pero no por correo.
  topeCorreosDia: 20,

  // Lo que sale oculto en una web nueva (el dueño lo enciende en Panel → Tu web).
  ocultosIniciales: ['boton:reserva'],
};

/** Dirección pública de la web: el dominio propio si lo hay; si no, la provisional. */
export const SITIO = NEGOCIO.dominio ? `https://${NEGOCIO.dominio}` : NEGOCIO.provisional;
/** Hosts «buenos» (los que se indexan). Sin dominio, ninguno: todo lleva noindex. */
export const HOSTS_PROPIOS = NEGOCIO.dominio ? [NEGOCIO.dominio, `www.${NEGOCIO.dominio}`] : [];
export const WHATSAPP_URL = `https://wa.me/${NEGOCIO.whatsapp}`;
/** Nombre del sitio como se ve en textos legales y pies («H & R Car» o el dominio si lo hay). */
export const NOMBRE_WEB = NEGOCIO.dominio || NEGOCIO.nombre;
