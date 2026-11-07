// PDF del contrato firmado, montado en el navegador con pdf-lib (lo usan la página de firma y el panel).
// Se empaqueta en dist/firmar/pdf.js (herramientas/empaquetar.mjs).
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { bloques } from './contrato.js';

// Las fuentes estándar del PDF solo llevan los caracteres de Europa occidental: lo demás se sustituye.
const paraPdf = (t) => String(t ?? '')
  .replace(/[‘’‚]/g, "'").replace(/[“”„«»]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
  .replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080)).replace(/[  ]/g, ' ')
  .replace(/[^\x20-\x7e¡-ÿ€\n]/g, '');

function partirLineas(texto, fuente, tam, ancho) {
  const lineas = [];
  for (const parrafo of paraPdf(texto).split('\n')) {
    let linea = '';
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (fuente.widthOfTextAtSize(prueba, tam) <= ancho) { linea = prueba; continue; }
      if (linea) lineas.push(linea);
      linea = palabra;
      while (fuente.widthOfTextAtSize(linea, tam) > ancho && linea.length > 1) { // palabras larguísimas
        let k = linea.length - 1;
        while (k > 1 && fuente.widthOfTextAtSize(linea.slice(0, k), tam) > ancho) k--;
        lineas.push(linea.slice(0, k));
        linea = linea.slice(k);
      }
    }
    lineas.push(linea);
  }
  return lineas;
}

/**
 * PDF del contrato firmado: el texto, las dos firmas y una última hoja con el registro de la firma electrónica.
 * c = { id, texto, empresa: { nombre, representante }, firmante: { nombre, dni }, firmaEmpresa (bytes|null),
 *       firmaVendedor (bytes), registro: [[etiqueta, valor]], huella }
 */
export async function pdfContrato(c) {
  const doc = await PDFDocument.create();
  doc.setTitle(paraPdf(bloques(c.texto).find((b) => b.tipo === 'titulo')?.texto || 'Contrato'));
  doc.setAuthor(paraPdf(c.empresa?.nombre || ''));
  doc.setCreator(paraPdf(`Panel ${c.empresa?.nombre || ''}`.trim()));
  doc.setCreationDate(new Date());
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const [W, H, M] = [595.28, 841.89, 56];
  const ancho = W - M * 2;
  const gris = rgb(0.38, 0.38, 0.42);
  let pagina = null;
  let y = 0;
  let numero = 0;
  const nueva = () => {
    pagina = doc.addPage([W, H]);
    numero++;
    y = H - M;
    pagina.drawText(paraPdf(`Contrato n.º ${c.id} · Huella SHA-256 ${c.huella.slice(0, 16)}… · Página ${numero}`), { x: M, y: 30, size: 7.5, font: normal, color: gris });
  };
  const sitio = (alto) => { if (!pagina || y - alto < M) nueva(); };
  const escribir = (texto, { fuente = normal, tam = 10.5, interlinea = 14.5, antes = 0, despues = 8, centrado = false, color } = {}) => {
    y -= antes;
    for (const l of partirLineas(texto, fuente, tam, ancho)) {
      sitio(interlinea);
      const x = centrado ? M + (ancho - fuente.widthOfTextAtSize(l, tam)) / 2 : M;
      pagina.drawText(l, { x, y: y - tam, size: tam, font: fuente, ...(color ? { color } : {}) });
      y -= interlinea;
    }
    y -= despues;
  };

  nueva();
  for (const b of bloques(c.texto)) {
    if (b.tipo === 'titulo') escribir(b.texto, { fuente: negrita, tam: 14, interlinea: 18, despues: 14, centrado: true });
    else if (b.tipo === 'apartado') escribir(b.texto, { fuente: negrita, tam: 11, antes: 4, despues: 6 });
    else escribir(b.texto, { despues: 8, interlinea: 14.5 });
  }

  // firmas
  sitio(152);
  y -= 6;
  const col = (ancho - 24) / 2;
  const caja = async (x, titulo, nombre, detalle, bytes) => {
    pagina.drawText(paraPdf(titulo), { x, y: y - 10, size: 9, font: negrita, color: gris });
    pagina.drawRectangle({ x, y: y - 112, width: col, height: 92, borderColor: rgb(0.8, 0.8, 0.83), borderWidth: 0.8 });
    if (bytes) {
      try {
        const img = await doc.embedPng(bytes);
        const k = Math.min((col - 16) / img.width, 80 / img.height);
        pagina.drawImage(img, { x: x + (col - img.width * k) / 2, y: y - 106, width: img.width * k, height: img.height * k });
      } catch { /* firma ilegible: queda el recuadro */ }
    }
    pagina.drawText(paraPdf(nombre || ''), { x, y: y - 126, size: 9.5, font: normal });
    if (detalle) pagina.drawText(paraPdf(detalle), { x, y: y - 139, size: 8.5, font: normal, color: gris });
  };
  await caja(M, 'EL INTERMEDIARIO', c.empresa?.representante || c.empresa?.nombre, c.empresa?.representante && c.empresa?.nombre ? `por ${c.empresa.nombre}` : '', c.firmaEmpresa);
  await caja(M + col + 24, 'EL PROPIETARIO', c.firmante?.nombre, c.firmante?.dni ? `DNI/NIE ${c.firmante.dni}` : '', c.firmaVendedor);
  y -= 150;

  // registro de la firma electrónica
  nueva();
  escribir('Registro de la firma electrónica', { fuente: negrita, tam: 13, interlinea: 17, despues: 10 });
  escribir('Este documento se firmó de forma electrónica desde un enlace personal enviado al propietario. Estos son los datos que se registraron en el momento de la firma:', { tam: 9.5, interlinea: 13, despues: 10, color: gris });
  for (const [k, v] of c.registro) {
    sitio(30);
    pagina.drawText(paraPdf(k), { x: M, y: y - 9, size: 8.5, font: negrita, color: gris });
    y -= 13;
    escribir(String(v ?? '—'), { tam: 9.5, interlinea: 12.5, despues: 6 });
  }
  escribir(`Huella SHA-256 del texto firmado, de los datos del firmante y de su firma: ${c.huella}. Cualquier cambio en el texto o en las firmas daría una huella distinta.`, { tam: 8.5, interlinea: 12, antes: 6, color: gris });
  return doc.save();
}
