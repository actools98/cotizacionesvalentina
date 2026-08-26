import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import templateHtml from '../templates/pdfTemplate.html?raw';
import { formatCurrency } from '../utils/formatters.js';
import { convertCurrency } from './currencyConverter.js';

export async function generateQuotePDF(clientName, productName, selectedModules, currency, totalCOP) {
  // 1. Rellenar plantilla
  let html = templateHtml
    .replace(/\{\{clientName\}\}/g, clientName)
    .replace(/\{\{productName\}\}/g, productName)
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('es-CO'));

  const servicesRowsHtml = selectedModules.map(mod => {
    const price = convertCurrency(mod.price, currency);
    const priceFormatted = formatCurrency(price, currency);
    let detailHtml = '';
    if (mod.detail && mod.detail.trim() !== '') {
      const detailWithBreaks = mod.detail.replace(/\r?\n/g, '<br>');
      detailHtml = `<span class="service-detail">${detailWithBreaks}</span>`;
    }
    return `
      <tr class="service-row">
        <td>
          <span class="service-name">${mod.description}</span>
          ${detailHtml}
        </td>
        <td class="service-price">${priceFormatted}</td>
      </tr>
    `;
  }).join('');

  html = html.replace('{{servicesRows}}', servicesRowsHtml);

  const totalConverted = convertCurrency(totalCOP, currency);
  const totalFormatted = formatCurrency(totalConverted, currency);
  html = html.replace('{{total}}', totalFormatted);

  // 2. Crear iframe invisible pero ubicado en pantalla para evitar el recorte del navegador
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '0px';       // Fija la posición visible
  iframe.style.left = '0px';      // Fija la posición visible
  iframe.style.width = '794px';   // 210mm a 96dpi
  iframe.style.height = '1123px'; // Altura mínima obligatoria
  iframe.style.border = 'none';
  iframe.style.background = '#ffffff';
  iframe.style.opacity = '0';     // Lo vuelve invisible al ojo
  iframe.style.zIndex = '-9999';
  iframe.style.pointerEvents = 'none';
  
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  await new Promise(resolve => {
    iframe.onload = resolve;
    if (iframe.contentWindow && iframe.contentWindow.document.readyState === 'complete') {
      resolve();
    }
  });
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const body = iframe.contentDocument.body;
    const container = iframe.contentDocument.querySelector('.pdf-container');
    
    // Ajustar altura al contenido real
    iframe.style.height = body.scrollHeight + 'px';

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: false,
      // Forzar coordenadas
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      width: 794,
      windowWidth: 794,
    });

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Escalar para que el ancho sea exactamente 210mm (A4)
    const scaleX = 210 / imgWidth;
    const finalWidth = 210;
    const finalHeight = imgHeight * scaleX;

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [finalWidth, finalHeight]
    });

    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, finalWidth, finalHeight);

    pdf.save(`Cotizacion_${clientName.replace(/\s+/g, '_')}.pdf`);

  } catch (error) {
    console.error('Error al generar PDF:', error);
    throw error;
  } finally {
    document.body.removeChild(iframe);
  }
}
