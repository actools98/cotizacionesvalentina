// main.js - Punto de entrada de la aplicación

import { getModules, saveModules, deleteModule, addModule, editModule } from './state.js';
import { calculateTotal, getSelectedModules } from './components/quoteCalculator.js';
import { fetchExchangeRates, convertCurrency } from './components/currencyConverter.js';
import { generateQuotePDF } from './components/exportPDF.js';
import { renderModules, renderAdminModules, renderAddForm } from './utils/domHelpers.js';
import { formatCurrency } from './utils/formatters.js';

// ---- DOM references ----
const modulesContainer = document.getElementById('modules-container');
const totalDisplay = document.getElementById('total-display');
const currencySelect = document.getElementById('currency-select');
const toggleModeBtn = document.getElementById('toggle-mode-btn');
const addModuleContainer = document.getElementById('add-module-container');
const addModuleForm = document.getElementById('add-module-form');
const moduleDescInput = document.getElementById('module-desc');
const modulePriceInput = document.getElementById('module-price');
const quoteActionBtn = document.getElementById('quote-action-btn');

// Diálogo
const clientDialog = document.getElementById('client-dialog');
const clientNameInput = document.getElementById('client-name-input');
const productNameInput = document.getElementById('product-name-input');
const dialogConfirm = document.getElementById('dialog-confirm');
const dialogCancel = document.getElementById('dialog-cancel');

// ---- Estado global ----
let currentModules = [];
let currentCurrency = 'COP';
let exchangeRates = null;
let currentCheckedIds = new Set();
let isEditMode = false; // false = modo cotización, true = modo edición

// ---- Inicialización ----
async function init() {
  currentModules = await getModules();
  exchangeRates = await fetchExchangeRates();
  currencySelect.value = currentCurrency;

  // Configurar modo inicial (cotización)
  setEditMode(false);

  // Escuchar cambios en checkboxes (delegación)
  modulesContainer.addEventListener('change', onModuleCheckChange);

  // Escuchar cambio de moneda
  currencySelect.addEventListener('change', onCurrencyChange);

  // Escuchar toggle de modo
  toggleModeBtn.addEventListener('click', onToggleMode);

  // Escuchar submit del formulario de agregar
  addModuleForm.addEventListener('submit', onAddModule);

  // Escuchar botón de cotización
  quoteActionBtn.addEventListener('click', onQuoteAction);

  // Diálogo
  dialogConfirm.addEventListener('click', onDialogConfirm);
  dialogCancel.addEventListener('click', () => clientDialog.close());

  // Cerrar diálogo con Escape (comportamiento nativo)
}

// ---- Funciones de renderizado ----
function renderAll() {
  if (isEditMode) {
    renderAdminModules(modulesContainer, currentModules, handleDeleteModule, handleEditModule);
    addModuleContainer.style.display = 'block';
  } else {
    renderModules(modulesContainer, currentModules, currentCurrency, convertCurrency, formatCurrency);
    addModuleContainer.style.display = 'none';
  }
  updateTotal();
}

function updateTotal() {
  // Obtener IDs chequeados desde el DOM (solo en modo cotización)
  if (!isEditMode) {
    const checkboxes = modulesContainer.querySelectorAll('input[type="checkbox"]:checked');
    const checkedIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    currentCheckedIds = new Set(checkedIds);
  } else {
    // En modo edición, mantenemos el total de los seleccionados previamente
    // (podríamos resetearlo, pero mejor lo dejamos)
  }

  const totalCOP = calculateTotal(Array.from(currentCheckedIds));
  const totalConverted = convertCurrency(totalCOP, currentCurrency);
  totalDisplay.textContent = formatCurrency(totalConverted, currentCurrency);
}

// ---- Modo edición ----
function setEditMode(enabled) {
  isEditMode = enabled;
  toggleModeBtn.textContent = isEditMode ? 'Cotizar' : 'Editar';
  toggleModeBtn.classList.toggle('active', isEditMode);
  renderAll();
}

function onToggleMode() {
  setEditMode(!isEditMode);
}

// ---- Event handlers ----
function onModuleCheckChange() {
  if (!isEditMode) updateTotal();
}

function onCurrencyChange(e) {
  currentCurrency = e.target.value;
  renderAll();
}

async function onAddModule(e) {
  e.preventDefault();
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

function handleEditModule(id) {
  const module = currentModules.find(m => m.id === id);
  if (!module) return;

  const newDesc = prompt('Nueva descripción:', module.description);
  if (newDesc === null) return; // Canceló

  const newPriceStr = prompt('Nuevo precio (COP):', module.price);
  if (newPriceStr === null) return;

  const newPrice = parseFloat(newPriceStr);
  if (isNaN(newPrice) || newPrice <= 0) {
    alert('Precio inválido. Debe ser un número mayor a 0.');
    return;
  }

  currentModules = editModule(id, newDesc, newPrice);
  renderAll();
}

function onQuoteAction() {
  // Verificar que haya al menos un módulo seleccionado
  if (currentCheckedIds.size === 0) {
    alert('Debe seleccionar al menos un módulo para cotizar.');
    return;
  }
  // Abrir diálogo
  clientNameInput.value = '';
  productNameInput.value = '';
  clientDialog.showModal();
  clientNameInput.focus();
}

async function onDialogConfirm(e) {
  e.preventDefault();
  const clientName = clientNameInput.value.trim();
  const productName = productNameInput.value.trim();
  if (!clientName || !productName) {
    alert('Por favor, complete todos los campos.');
    return;
  }

  const totalCOP = calculateTotal(Array.from(currentCheckedIds));

  try {
    await generateQuotePDF(clientName, productName, Array.from(currentCheckedIds), currentCurrency, totalCOP);
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
