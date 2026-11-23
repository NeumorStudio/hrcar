// Lo que enseña la página Estadísticas del panel: visitas por día, de dónde llegan, coches más vistos y contactos.
import { preparar } from './datos.js';
import { hoyMadrid, sumarDias, diasEnStock } from './diario.js';
import { DENTRO } from './visitas.js';

const PAGINAS = { '/': 'Portada', '/stock': 'Stock', '/contact': 'Contacto', '/finance': 'Financiación', '/sell-your-car': 'Vende tu coche',
  '/custom-order': 'Encargo a medida', '/services': 'Servicios', '/history': 'Sobre nosotros', '/blog': 'Blog' };

const filas = (r) => r.results || [];

export async function estadisticas(db, dias) {
  await preparar(db);
  const hoy = hoyMadrid();
  const desde = sumarDias(hoy, -(dias - 1));
  const antes = sumarDias(desde, -dias); // el periodo anterior, para comparar
  const q = (sql, ...v) => db.prepare(sql).bind(...v).all().then(filas);
  const [porDia, porOrigen, porRuta, previo, contactos, porCoche, coches] = await Promise.all([
    q('SELECT dia, SUM(n) AS vistas, SUM(CASE WHEN origen != ?2 THEN n ELSE 0 END) AS visitas FROM visitas WHERE dia >= ?1 GROUP BY dia', desde, DENTRO),
    q('SELECT origen, SUM(n) AS n FROM visitas WHERE dia >= ?1 AND origen != ?2 GROUP BY origen ORDER BY n DESC', desde, DENTRO),
    q('SELECT ruta, SUM(n) AS n FROM visitas WHERE dia >= ?1 GROUP BY ruta ORDER BY n DESC LIMIT 300', desde),
    q('SELECT SUM(n) AS vistas, SUM(CASE WHEN origen != ?3 THEN n ELSE 0 END) AS visitas FROM visitas WHERE dia >= ?1 AND dia < ?2', antes, desde, DENTRO),
    q("SELECT formulario, COUNT(*) AS n FROM mensajes WHERE fecha >= ?1 GROUP BY formulario ORDER BY n DESC", `${desde} 00:00:00`),
    q("SELECT coche, COUNT(*) AS n FROM mensajes WHERE fecha >= ?1 AND coche IS NOT NULL AND coche != '' GROUP BY coche", `${desde} 00:00:00`),
    q('SELECT slug, titulo, estado, precio, precio_oferta, fecha_entrada, creado FROM coches'),
  ]);

  // un punto por día, también los días sin visitas
  const mapa = new Map(porDia.map((d) => [d.dia, d]));
  const serie = Array.from({ length: dias }, (_, i) => {
    const dia = sumarDias(desde, i);
    const d = mapa.get(dia);
    return { dia, vistas: d?.vistas || 0, visitas: d?.visitas || 0 };
  });
  const total = (k) => serie.reduce((s, d) => s + d[k], 0);

  const fichas = new Map(coches.map((c) => [c.slug, c]));
  const pedidos = new Map(porCoche.map((c) => [c.coche, c.n]));
  const masVistos = porRuta
    .filter((r) => r.ruta.startsWith('/stock/') && fichas.has(r.ruta.slice(7)))
    .slice(0, 10)
    .map((r) => {
      const c = fichas.get(r.ruta.slice(7));
      return { ...c, vistas: r.n, contactos: pedidos.get(c.slug) || 0, dias: diasEnStock(c, hoy) };
    });
  const paginas = porRuta
    .filter((r) => !r.ruta.startsWith('/stock/'))
    .slice(0, 8)
    .map((r) => ({ ruta: r.ruta, nombre: PAGINAS[r.ruta] || r.ruta, n: r.n }));

  return {
    dias, desde, hoy, serie, porOrigen, masVistos, paginas, contactos,
    vistas: total('vistas'), visitas: total('visitas'),
    contactosTotal: contactos.reduce((s, c) => s + c.n, 0),
    previo: { vistas: previo[0]?.vistas || 0, visitas: previo[0]?.visitas || 0 },
  };
}
