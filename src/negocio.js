// Datos del concesionario. Es lo único que cambia de un cliente a otro, junto con:
//   - src/diseno2/contenido.js  (textos de la web: servicios, preguntas, portada…)
//   - public/img/marca/         (logo e iconos) y public/img/v2/ (fotos de las secciones)
//   - src/data/coches.json      (stock inicial: solo se carga en una base de datos nueva)
// Plantilla de concesionarios de NeumorStudio. Cliente: H & R Car (Zaragoza).

export const NEGOCIO = {
  nombre: 'H & R Car',
  // dominio propio sin https ni www (p. ej. 'hrcar.es'). Vacío = todavía sin dominio: la web sale como «provisional»
  // y todas sus direcciones llevan noindex para que Google no indexe la dirección técnica.
  dominio: '',
  provisional: 'https://hrcar.vercel.app',

  telefono: '+34685447955',
  telefonoBonito: '685 44 79 55',
  whatsapp: '34685447955',
  email: 'albapelu967@gmail.com',

  // PENDIENTE: dirección exacta. En la web de Arbicars solo ponía «zona de Zaragoza».
  direccion: 'Zaragoza',
  localidad: 'Zaragoza',
  provincia: 'Zaragoza',
  codigoPostal: '',
  // sin dirección exacta, el mapa abre la ciudad (buscar «H&R Car» en Maps lleva a otro concesionario de Zaragoza)
  mapa: 'https://www.google.com/maps/search/?api=1&query=Zaragoza',
  // PENDIENTE: confirmar. Es el horario que tenía en Arbicars, y parece un error (8:00–9:30 y 21:00–22:20).
  horario: 'Lunes a sábado: 8:00–9:30 y 21:00–22:20 · Domingos cerrado',
  horarioLd: ['Mo-Sa 08:00-09:30', 'Mo-Sa 21:00-22:20'],

  // Titular legal (nombre y apellidos o razón social) y NIF: la LSSI obliga a publicarlos en el aviso legal.
  // PENDIENTE: pedírselos al cliente. Mientras estén vacíos, el aviso legal pone el nombre comercial.
  titular: '',
  nif: '',

  lema: 'Confianza y acompañamiento en cada paso',
  // cómo se nombra al dueño en el panel («Contraseña del dueño», «Has entrado como Dueño»)
  dueno: 'el dueño',
  duenoNombre: 'Dueño',

  logo: '/img/marca/logo.webp', // redondo, con fondo blanco propio: vale en la cabecera oscura y en el panel claro
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
