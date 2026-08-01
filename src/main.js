// main.js - Punto de entrada de la aplicación

import { getModules, saveModules, deleteModule, addModule } from './state.js';
import { calculateTotal, getSelectedModules } from './components/quoteCalculator.js';
import { fetchExchangeRates, convertCurrency } from './components/currencyConverter.js';
import { generateQuotePDF } from './components/exportPDF.js';
import { renderModules, renderAdminList } from './utils/domHelpers.js';
import { formatCurrency } from './utils/formatters.js';

// ---- DOM references ----
const modulesContainer = document.getElementById('modules-container');
const totalDisplay = document.getElementById('total-display');
const adminListContainer = document.getElementById('admin-list-container');
const currencySelect = document.getElementById('currency-select');
const addModuleBtn = document.getElementById('add-module-btn');
const moduleDescInput = document.getElementById('module-desc');
const modulePriceInput = document.getElementById('module-price');
const quoteActionBtn = document.getElementById('quote-action-btn');

// Diálogo
const clientDialog = document.getElementById('client-dialog');
const clientNameInput = document.getElementById('client-name-input');
const dialogConfirm = document.getElementById('dialog-confirm');
const dialogCancel = document.getElementById('dialog-cancel');

// ---- Estado global ----
let currentModules = [];
let currentCurrency = 'COP';
let exchangeRates = null;
let currentCheckedIds = new Set();

// ---- Inicialización ----
async function init() {
  // Cargar módulos desde LocalStorage (o default)
  currentModules = await getModules();

  // Obtener tasas de cambio
  exchangeRates = await fetchExchangeRates();

  // Configurar selector de moneda
  currencySelect.value = currentCurrency;

  // Renderizar todo
  renderAll();

  // Escuchar cambios en checkboxes (delegación)
  modulesContainer.addEventListener('change', onModuleCheckChange);

  // Escuchar cambio de moneda
  currencySelect.addEventListener('change', onCurrencyChange);

  // Escuchar agregar módulo
  addModuleBtn.addEventListener('click', onAddModule);

  // Escuchar botón de cotización
  quoteActionBtn.addEventListener('click', onQuoteAction);

  // Diálogo
  dialogConfirm.addEventListener('click', onDialogConfirm);
  dialogCancel.addEventListener('click', () => clientDialog.close());

  // Cerrar diálogo con Escape o click fuera (comportamiento nativo)
}

// ---- Funciones de renderizado ----
function renderAll() {
  renderModules(modulesContainer, currentModules, currentCurrency, convertCurrency, formatCurrency);
  updateTotal();
  renderAdminList(adminListContainer, currentModules, handleDeleteModule);
}

function updateTotal() {
  // Obtener IDs chequeados desde el DOM
  const checkboxes = modulesContainer.querySelectorAll('input[type="checkbox"]:checked');
  const checkedIds = Array.from(checkboxes).map(cb => cb.dataset.id);
  currentCheckedIds = new Set(checkedIds);

  const totalCOP = calculateTotal(checkedIds);
  const totalConverted = convertCurrency(totalCOP, currentCurrency);
  totalDisplay.textContent = formatCurrency(totalConverted, currentCurrency);
}

// ---- Event handlers ----
function onModuleCheckChange() {
  updateTotal();
}

function onCurrencyChange(e) {
  currentCurrency = e.target.value;
  renderAll();
}

async function onAddModule() {
  const desc = moduleDescInput.value.trim();
  const price = parseFloat(modulePriceInput.value);
  if (!desc || isNaN(price) || price <= 0) {
    alert('Por favor, ingrese una descripción y un precio válido (mayor a 0).');
    return;
  }
  currentModules = addModule(desc, price);
  moduleDescInput.value = '';
  modulePriceInput.value = '';
  renderAll();
}

function handleDeleteModule(id) {
  if (!confirm('¿Eliminar este módulo?')) return;
  currentModules = deleteModule(id);
  renderAll();
}

function onQuoteAction() {
  // Verificar que haya al menos un módulo seleccionado
  if (currentCheckedIds.size === 0) {
    alert('Debe seleccionar al menos un módulo para cotizar.');
    return;
  }
  // Abrir diálogo para nombre del cliente
  clientNameInput.value = '';
  clientDialog.showModal();
  clientNameInput.focus();
}

async function onDialogConfirm(e) {
  e.preventDefault();
  const clientName = clientNameInput.value.trim();
  if (!clientName) {
    alert('Por favor, ingrese el nombre del cliente.');
    return;
  }

  // Calcular total en COP
  const totalCOP = calculateTotal(Array.from(currentCheckedIds));

  // Generar PDF
  try {
    await generateQuotePDF(clientName, Array.from(currentCheckedIds), currentCurrency, totalCOP);
    clientDialog.close();
  } catch (error) {
    console.error('Error al generar PDF:', error);
    alert('Ocurrió un error al generar el PDF. Consulte la consola.');
  }
}

// ---- Iniciar aplicación ----
init().catch(err => {
  console.error('Error en la inicialización:', err);
  alert('No se pudo cargar la aplicación. Revise la consola.');
});
