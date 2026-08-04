// main.js - Punto de entrada de la aplicación (con API + BD)

import { getModules, addModule, deleteModule, editModule } from './state.js';
import { calculateTotal, getSelectedModules } from './components/quoteCalculator.js';
import { fetchExchangeRates, convertCurrency } from './components/currencyConverter.js';
import { generateQuotePDF } from './components/exportPDF.js';
import { renderModules, renderAdminModules } from './utils/domHelpers.js';
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
let isEditMode = false;

// ---- Inicialización ----
async function init() {
  try {
    // 1. Cargar módulos desde la API (BD)
    currentModules = await getModules();
    
    // 2. Obtener tasas de cambio
    exchangeRates = await fetchExchangeRates();
    
    // 3. Configurar selector de moneda
    currencySelect.value = currentCurrency;

    // 4. Configurar modo inicial (cotización)
    setEditMode(false);

    // 5. Escuchar eventos
    modulesContainer.addEventListener('change', onModuleCheckChange);
    currencySelect.addEventListener('change', onCurrencyChange);
    toggleModeBtn.addEventListener('click', onToggleMode);
    addModuleForm.addEventListener('submit', onAddModule);
    quoteActionBtn.addEventListener('click', onQuoteAction);

    // Diálogo
    dialogConfirm.addEventListener('click', onDialogConfirm);
    dialogCancel.addEventListener('click', () => clientDialog.close());

  } catch (error) {
    console.error('Error en la inicialización:', error);
    alert('No se pudo cargar la aplicación. Revise la consola.');
  }
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
  // Solo actualizamos el total si estamos en modo cotización
  if (!isEditMode) {
    const checkboxes = modulesContainer.querySelectorAll('input[type="checkbox"]:checked');
    const checkedIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    currentCheckedIds = new Set(checkedIds);
  }
  
  // Calcular total usando los módulos actuales
  const totalCOP = calculateTotal(Array.from(currentCheckedIds), currentModules);
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

async function onCurrencyChange(e) {
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

  try {
    // Llamar a la API para agregar
    await addModule(desc, price);
    
    // Recargar la lista desde la BD
    currentModules = await getModules();
    
    // Limpiar inputs
    moduleDescInput.value = '';
    modulePriceInput.value = '';
    
    // Re-renderizar
    renderAll();
  } catch (error) {
    console.error('Error al agregar módulo:', error);
    alert('Error al agregar el módulo. Intente de nuevo.');
  }
}

async function handleDeleteModule(id) {
  if (!confirm('¿Eliminar este módulo?')) return;
  
  try {
    await deleteModule(id);
    currentModules = await getModules();
    renderAll();
  } catch (error) {
    console.error('Error al eliminar módulo:', error);
    alert('Error al eliminar el módulo. Intente de nuevo.');
  }
}

async function handleEditModule(id) {
  const module = currentModules.find(m => m.id === id);
  if (!module) return;

  const newDesc = prompt('Nueva descripción:', module.description);
  if (newDesc === null) return;

  const newPriceStr = prompt('Nuevo precio (COP):', module.price);
  if (newPriceStr === null) return;

  const newPrice = parseFloat(newPriceStr);
  if (isNaN(newPrice) || newPrice <= 0) {
    alert('Precio inválido. Debe ser un número mayor a 0.');
    return;
  }

  try {
    await editModule(id, newDesc, newPrice);
    currentModules = await getModules();
    renderAll();
  } catch (error) {
    console.error('Error al editar módulo:', error);
    alert('Error al editar el módulo. Intente de nuevo.');
  }
}

function onQuoteAction() {
  if (currentCheckedIds.size === 0) {
    alert('Debe seleccionar al menos un módulo para cotizar.');
    return;
  }
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

  // Calcular total en COP usando los módulos actuales
  const totalCOP = calculateTotal(Array.from(currentCheckedIds), currentModules);

  try {
    await generateQuotePDF(
      clientName,
      productName,
      Array.from(currentCheckedIds),
      currentCurrency,
      totalCOP,
      currentModules  // <--- Pasamos los módulos completos
    );
    clientDialog.close();
  } catch (error) {
    console.error('Error al generar PDF:', error);
    alert('Ocurrió un error al generar el PDF. Consulte la consola.');
  }
}

// ---- Iniciar aplicación ----
init();
