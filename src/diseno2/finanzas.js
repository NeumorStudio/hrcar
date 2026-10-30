// Cuota orientativa: mismo tipo (TIN 6,97 %) y fórmula que el simulador de la web actual.
export const TIN = 0.0697;
export const PLAZO_POR_DEFECTO = 60; // meses (el simulador de su web de Arbicars arrancaba en 60)
export const IMPORTE_POR_DEFECTO = 15000;
export function cuotaMensual(importe, meses = PLAZO_POR_DEFECTO, tin = TIN) {
  const r = tin / 12;
  if (!importe || importe <= 0) return 0;
  return Math.round((importe * r) / (1 - Math.pow(1 + r, -meses)));
}

// Publicidad de financiación (Ley 16/2011 de crédito al consumo): si se anuncia una cuota hay que dar la TAE y un
// ejemplo representativo. Se calcula con los mismos datos del simulador y sin comisiones; si la financiera del concesionario
// cobra comisión de apertura, hay que añadirla aquí y la TAE sube. Desde el 20-11-2026 (Directiva (UE) 2023/2225)
// la publicidad de crédito tiene que llevar además el aviso «Pedir dinero prestado cuesta dinero».
const dos = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
const pct = (n) => (n * 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const TAE = Math.pow(1 + TIN / 12, 12) - 1;
export function ejemploRepresentativo(importe = IMPORTE_POR_DEFECTO, meses = PLAZO_POR_DEFECTO) {
  const r = TIN / 12;
  const cuota = (importe * r) / (1 - Math.pow(1 + r, -meses));
  const total = cuota * meses;
  return `Ejemplo para un coche de ${dos(importe).replace(',00', '')} € al contado financiado al 100 % a ${meses} meses: ${meses} cuotas de ${dos(cuota)} €, TIN ${pct(TIN)} %, TAE ${pct(TAE)} %, importe total adeudado ${dos(total)} € (sin comisiones). Financiación sujeta a la aprobación de la entidad financiera, que fija las condiciones finales. Pedir dinero prestado cuesta dinero.`;
}

/**
 * TAE real de un coche con «precio financiando» más alto que el de contado: el cliente se lleva un coche que vale
 * `contado` y paga cuotas calculadas sobre `financiado`, así que la diferencia es coste del crédito y sube la TAE.
 * Devuelve la TAE en tanto por uno.
 */
export function taeCoche(contado, financiado, meses = PLAZO_POR_DEFECTO, tin = TIN) {
  if (!(contado > 0) || !(financiado > contado)) return TAE;
  const r0 = tin / 12;
  const cuota = (financiado * r0) / (1 - Math.pow(1 + r0, -meses));
  const valor = (r) => (cuota * (1 - Math.pow(1 + r, -meses))) / r; // lo que «vale» hoy pagar esas cuotas al tipo r
  let bajo = r0, alto = 1;
  for (let i = 0; i < 80; i++) { const m = (bajo + alto) / 2; if (valor(m) > contado) bajo = m; else alto = m; }
  return Math.pow(1 + (bajo + alto) / 2, 12) - 1;
}
export const porcentaje = (n) => pct(n);

/** Nota de los listados: el ejemplo representativo y qué pasa con los coches que tienen precio financiado. */
export const notaCuotas = () => `*Cuota orientativa. ${ejemploRepresentativo()} En los coches con precio financiado más alto que el de contado, la cuota se calcula sobre ese precio y su TAE es mayor: la tienes en la ficha de cada coche.`;
