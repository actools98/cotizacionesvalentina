// exportPDF.js - Generación del PDF con jspdf y autotable

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getSelectedModules } from './quoteCalculator.js';
import { convertCurrency } from './currencyConverter.js';
import { formatCurrency } from '../utils/formatters.js';

/**
 * Genera y descarga el PDF de la cotización.
 * @param {string} clientName - Nombre del cliente.
 * @param {string[]} checkedIds - IDs de los módulos seleccionados.
 * @param {string} currency - Moneda activa ('COP', 'USD', 'EUR').
 * @param {number} totalCOP - Total en COP (base).
 */
export async function generateQuotePDF(clientName, checkedIds, currency, totalCOP) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Título
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Cotización - Actols', pageWidth / 2, 20, { align: 'center' });

  // Datos del cliente y fecha
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${clientName}`, 14, 35);
  const today = new Date().toLocaleDateString('es-CO');
  doc.text(`Fecha: ${today}`, 14, 42);

  // Módulos seleccionados
  const selected = getSelectedModules(checkedIds);
  const tableRows = selected.map(mod => {
    const priceConverted = convertCurrency(mod.price, currency);
    const priceFormatted = formatCurrency(priceConverted, currency);
    return [mod.description, priceFormatted];
  });

  // Total convertido
  const totalConverted = convertCurrency(totalCOP, currency);
  const totalFormatted = formatCurrency(totalConverted, currency);

  // Tabla
  doc.autoTable({
    startY: 50,
    head: [['Descripción', 'Precio']],
    body: tableRows,
    foot: [['Total', totalFormatted]],
    theme: 'striped',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [79, 70, 229] }, // --color-primary
    footStyles: { fillColor: [240, 240, 240], textColor: [15, 23, 42], fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
  });

  // Pie de página
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Esta cotización es válida por 30 días.', 14, finalY);
  doc.text('Actols · Soluciones empresariales', 14, finalY + 7);

  // Guardar PDF
  const fileName = `Cotizacion_${clientName.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
