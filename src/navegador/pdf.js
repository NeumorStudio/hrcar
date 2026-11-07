// Entrada para el navegador: window.ContratoPDF.descargar(datos) monta el PDF del contrato firmado y lo descarga.
import { pdfContrato } from '../lib/contrato-pdf.js';

const bytesDe = (dataUrl) => {
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  const bin = atob(m[1]);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
};

window.ContratoPDF = {
  async descargar(d, nombreArchivo) {
    const bytes = await pdfContrato({ ...d, firmaEmpresa: bytesDe(d.firmaEmpresa), firmaVendedor: bytesDe(d.firmaVendedor) });
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo || `contrato-${d.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
};
