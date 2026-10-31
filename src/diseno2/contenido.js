// Textos de la web de H & R Car, tomados de su web de Arbicars (portada, servicios, preguntas frecuentes…).
// Las fotos de /img-web/ se cambian desde el panel (Imágenes de la web); las de /img/servicios/ son fijas.
// Condiciones que ha confirmado el dueño: garantía de 6 meses (cada coche puede llevar otra cifra desde el panel),
// financiación con respuesta en 24 horas e importación. Entrega a domicilio, de momento no.
import { NEGOCIO } from '../negocio.js';

const N = NEGOCIO.nombre;
const ZONA = NEGOCIO.localidad;

export const PORTADA = {
  title: `${N} · Coches de ocasión en ${ZONA}`,
  description: `${N}, concesionario en ${ZONA}: compra y venta de coches con confianza, transparencia y acompañamiento. Financiación, garantía e importación a medida.`,
  antetitulo: `${N} · ${ZONA}`,
  h1: 'Encuentra tu coche ideal sin sorpresas',
  entradilla: 'Gestión de venta completa, con confianza, transparencia y acompañamiento en cada paso.',
  cifras: [['Total', 'Confianza'], ['Garantizada', 'Transparencia'], ['Personalizado', 'Acompañamiento']],
  stockAntetitulo: 'Nuestro stock',
  stockTitulo: 'Descubre los mejores modelos alemanes y de otras marcas',
  // cuando aún hay pocos coches: el aviso de «te lo buscamos» que tenía la web de Arbicars
  sinVerlo: { titulo: '¿No ves lo que buscas?', texto: 'Dinos modelo, presupuesto y preferencias. Te avisamos cuando encontremos algo que encaje perfectamente contigo.' },
  propuesta: {
    antetitulo: 'Ventaja real',
    titulo: 'Vende tu coche sin estrés y con total garantía',
    texto: `En ${N} transformamos la venta de tu coche en una experiencia segura y sin complicaciones. Nos encargamos de todo, desde la valoración hasta la entrega al nuevo propietario, garantizando transparencia y rapidez.`,
    puntos: [
      'Control mecánico y documental antes de la entrega',
      'Garantía de 6 meses en todos nuestros coches',
      'Nos encargamos del papeleo y de la transferencia',
      'Financiación flexible con respuesta en 24 horas',
    ],
  },
  servicios: { antetitulo: 'Nuestros servicios', titulo: 'Todo lo que necesitas para conducir sin preocupaciones' },
  importacion: {
    antetitulo: 'Importación a medida',
    titulo: '¿Un coche muy concreto? Te lo traemos.',
    texto: 'Traemos el coche que deseas desde cualquier parte del mundo, con gestión completa y sin complicaciones.',
  },
  nosotros: {
    antetitulo: 'Sobre nosotros',
    titulo: 'Expertos en gestión de ventas',
    parrafos: [
      `${N} ayuda a propietarios y compradores a cerrar la venta de su coche con total tranquilidad. Combinamos tecnología y conocimiento del mercado del automóvil.`,
      'Trabajamos con total transparencia, con informes claros y un proceso sin sorpresas. Cada operación se gestiona con ética, respeto al cliente y una atención personalizada.',
    ],
  },
};

export const SERVICIOS = [
  { titulo: 'Financiación', texto: 'Te proponemos cuotas realistas según tu caso, con respuesta en 24 horas.', foto: '/img-web/financiacion.webp', enlace: '/finance' },
  { titulo: 'Garantía', texto: '6 meses de garantía en todos nuestros coches, que cubre los componentes principales. La gestionamos nosotros.', foto: '/img-web/taller.webp' },
  { titulo: 'Gestión de venta', texto: 'Nos encargamos de todo el proceso, desde la valoración hasta la entrega, para que no tengas que mover un dedo.', foto: '/img-web/acompanamiento.webp', enlace: '/sell-your-car' },
  { titulo: 'Importación', texto: 'Traemos el vehículo que deseas desde cualquier parte del mundo, gestionando aduanas y logística.', foto: '/img-web/importacion.webp', enlace: '/custom-order' },
  { titulo: 'Coches a la carta', texto: 'Seleccionamos el modelo que más se ajuste a tus gustos y necesidades.', foto: '/img/servicios/a-la-carta.webp', enlace: '/custom-order' },
  { titulo: 'Tu coche como parte de pago', texto: 'Tasamos tu coche actual y descontamos su valor del precio del que te llevas.', foto: '/img/servicios/entrega.webp', enlace: '/sell-your-car' },
];

/** Preguntas de la portada. */
export const PREGUNTAS = [
  ['¿Qué tipos de vehículos ofrecéis?', `En ${N} tenemos una selección de marcas alemanas y de otras marcas, tanto nuevos como de segunda mano.`],
  ['¿Los coches tienen garantía?', 'Sí, todos tienen 6 meses de garantía que cubre los componentes principales. La gestionamos nosotros.'],
  [`¿Puedo financiar mi compra con ${N}?`, 'Sí. Normalmente basta con tu DNI, la última nómina y un recibo bancario con tu IBAN, y te damos respuesta en menos de 24 horas.'],
  ['¿Aceptáis mi coche como parte de pago?', 'Sí. Lo tasamos y descontamos su valor del precio final.'],
  ['¿Realizáis importaciones de vehículos?', 'Sí, gestionamos la importación de coches desde cualquier país: aduanas, transporte y trámites.'],
];

export const PREGUNTAS_STOCK = [
  ['¿Puedo probar los coches antes de comprar?', `Sí, en ${N} organizamos pruebas de conducción para que conozcas el coche en detalle.`],
  ['¿Los precios incluyen impuestos y tasas?', 'Los precios que ves son finales e incluyen todos los impuestos y tasas aplicables.'],
  ['¿Ofrecéis garantía en los coches de segunda mano?', 'Sí: todos nuestros coches tienen 6 meses de garantía que cubre los componentes principales.'],
];

export const PREGUNTAS_FICHA = [
  ['¿Puedo probar el coche antes de comprarlo?', 'Sí. Escríbenos por WhatsApp o llámanos y quedamos para que lo veas y lo pruebes.'],
  ['¿Aceptáis mi coche como parte de pago?', 'Sí. Lo tasamos y descontamos su valor del precio final.'],
  ['¿Tiene garantía?', 'Sí, 6 meses de garantía que cubre los componentes principales.'],
];

export const PREGUNTAS_CONTACTO = [
  ['¿Cuál es el horario de atención?', NEGOCIO.horario + '.'],
  ['¿Puedo contactar por WhatsApp?', `Sí, escribe al ${NEGOCIO.telefonoBonito} y te respondemos rápidamente.`],
  [`¿Dónde está ${N}?`, `En ${NEGOCIO.direccion}. Escríbenos antes de venir y quedamos para que veas el coche.`],
];

export const ENCARGO = {
  h1: 'Encargo a medida',
  texto: 'Solicita el coche que siempre has querido, con gestión total de importación y entrega.',
  pasos: [
    ['Selección', 'Nos dices el modelo, el equipamiento y, si lo tienes claro, el país de origen.'],
    ['Gestión', 'Nos encargamos de la compra, los trámites de aduanas y el transporte.'],
    ['Entrega', 'Te entregamos el coche con toda la documentación, listo para conducir.'],
  ],
  preguntas: [
    ['¿Cuánto tarda un encargo desde la solicitud hasta la entrega?', 'Depende del origen del coche y de la logística, pero trabajamos para que sea lo más rápido posible.'],
    ['¿Qué documentación necesito para empezar un encargo?', 'Solo tu identificación y los datos del coche que quieres; nosotros gestionamos el resto.'],
    ['¿Puedo personalizar el equipamiento del coche que encargo?', 'Sí, te ofrecemos opciones de personalización y accesorios según tus preferencias.'],
  ],
};

export const VENDE = {
  h1: 'Vende tu coche fácilmente',
  texto: 'Tasa tu coche gratis y consigue la mejor oferta. Nos cuentas cómo es, nos mandas unas fotos y te damos una valoración.',
  preguntas: [
    ['¿Cuánto tardáis en tasar mi coche?', 'Normalmente recibes una valoración inicial en menos de 24 horas laborables tras enviar el formulario.'],
    ['¿Es necesario que el coche esté libre de cargas?', 'No necesariamente: podemos encargarnos de cancelar reservas de dominio o deudas pendientes si el valor del coche lo cubre.'],
  ],
};

export const FINANCIACION = {
  h1: 'Financiación a tu medida',
  texto: 'Soluciones de crédito flexibles, adaptadas a tu situación. Calcula tu cuota y, si te encaja, pídenos el estudio: es gratis y sin compromiso.',
  ventajas: ['Respuesta en menos de 24 horas', 'Cuotas realistas según tu caso', 'Sin comisiones ocultas'],
  documentos: ['DNI / NIE en vigor', 'Última nómina', 'Recibo bancario con tu IBAN'],
  preguntas: [
    ['¿Qué necesito para pedir financiación?', 'Normalmente basta con tu DNI, la última nómina y un recibo bancario donde aparezca tu IBAN. Te damos respuesta en menos de 24 horas.'],
    ['¿Puedo combinar la financiación con la importación de un coche?', 'Sí, tenemos planes de financiación que incluyen tanto la compra como los costes de importación.'],
    [`¿Hay algún coste adicional al financiar con ${N}?`, 'No: nuestras condiciones son claras y sin cargos ocultos. Cualquier gasto adicional se detalla antes de firmar.'],
  ],
};

export const SERVICIOS_PAGINA = {
  h1: 'Todo lo que necesitas para conducir sin preocupaciones',
  texto: `Desde la financiación hasta la entrega de las llaves: en ${N} nos ocupamos de todo.`,
  preguntas: [
    [`¿Cómo funciona la financiación con ${N}?`, 'Estudiamos tu caso y te proponemos una cuota realista, con respuesta en menos de 24 horas y sin sorpresas.'],
    ['¿Qué incluye la garantía?', 'Cubre los componentes principales del coche durante 6 meses desde la entrega.'],
  ],
};

/** Frase de la garantía en la ficha de cada coche. */
export const garantiaFicha = (meses) =>
  `Revisado antes de la entrega y con garantía de ${meses || 6} meses que cubre los componentes principales.`;
