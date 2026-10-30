// Calculadora de importación: cuánto cuesta un coche puesto en España y qué margen deja.
// El impuesto de matriculación (IEDMT) va por tramos de CO2 (Ley 38/1992, tramos vigentes).
export const TRAMOS_CO2 = [
  { hasta: 120, tipo: 0 },
  { hasta: 159, tipo: 4.75 },
  { hasta: 199, tipo: 9.75 },
  { hasta: Infinity, tipo: 14.75 },
];
export const tipoMatriculacion = (co2) => TRAMOS_CO2.find((t) => (co2 ?? 0) <= t.hasta).tipo;

// Costes orientativos que el dueño puede cambiar en Ajustes (se guardan en la base de datos).
export const COSTES_POR_DEFECTO = {
  transporte: 900,        // coche traído de Alemania/Europa
  gestoria_import: 300,   // gestoría y trámites de importación
  itv_homologacion: 150,  // ITV + ficha reducida/homologación
  placas_tasas: 100,      // placas y tasas de Tráfico
  cambio_nombre: 60,      // tasa de transferencia (coche español)
  gestoria_nacional: 100, // gestoría del cambio de nombre
};

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

/**
 * d: { precio_compra, origen: 'espana'|'extranjero', co2, valor_fiscal, iva_pct, arreglos, otros, precio_venta, costes:{...} }
 */
export function calcular(d, costes = COSTES_POR_DEFECTO) {
  const c = { ...COSTES_POR_DEFECTO, ...costes };
  const precio = num(d.precio_compra);
  const extranjero = d.origen === 'extranjero';
  const lineas = [['Precio de compra', precio]];
  if (extranjero) {
    const base = num(d.valor_fiscal) || precio;
    const tipo = tipoMatriculacion(num(d.co2));
    const iva = Math.round(precio * num(d.iva_pct) / 100);
    if (iva) lineas.push([`IVA (${num(d.iva_pct)} %)`, iva]);
    lineas.push(['Transporte', num(d.transporte ?? c.transporte)]);
    lineas.push([`Impuesto de matriculación (${tipo} % de ${base.toLocaleString('es-ES')} €)`, Math.round(base * tipo / 100)]);
    lineas.push(['Gestoría e importación', num(d.gestoria ?? c.gestoria_import)]);
    lineas.push(['ITV y homologación', num(d.itv ?? c.itv_homologacion)]);
    lineas.push(['Placas y tasas de Tráfico', num(d.placas ?? c.placas_tasas)]);
  } else {
    lineas.push(['Cambio de nombre (tasa)', num(d.cambio_nombre ?? c.cambio_nombre)]);
    lineas.push(['Gestoría', num(d.gestoria ?? c.gestoria_nacional)]);
  }
  if (num(d.arreglos)) lineas.push(['Reparaciones y puesta a punto', num(d.arreglos)]);
  if (num(d.otros)) lineas.push(['Otros gastos', num(d.otros)]);
  const coste = lineas.reduce((a, [, v]) => a + v, 0);
  const venta = num(d.precio_venta);
  const beneficio = venta ? venta - coste : null;
  return { lineas, coste, venta, beneficio, margen: beneficio != null && venta ? Math.round(beneficio / venta * 1000) / 10 : null };
}
