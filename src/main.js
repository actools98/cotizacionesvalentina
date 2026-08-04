// main.js - Punto de entrada con categorías, drag & drop y más

import { getModules, addModule, deleteModule, editModule, reorderModules, getCategories, addCategory, editCategory, deleteCategory, reorderCategories } from './state.js';
import { calculateTotal, getSelectedModules } from './components/quoteCalculator.js';
import { fetchExchangeRates, convertCurrency, startAutoRefresh } from './components/currencyConverter.js';
import { generateQuotePDF } from './components/exportPDF.js';
import { renderModulesByCategory, renderAdminModulesByCategory } from './utils/domHelpers.js';
import { formatCurrency } from './utils/formatters.js';
import Sortable from 'sortablejs';

// ---- DOM ----
const modulesContainer = document.getElementById('modules-container');
const totalDisplay = document.getElementById('total-display');
const currencySelect = document.getElementById('currency-select');
const toggleModeBtn = document.getElementById('toggle-mode-btn');
const addModuleContainer = document.getElementById('add-module-container');
const addModuleForm = document.getElementById('add-module-form');
const moduleDescInput = document.getElementById('module-desc');
const modulePriceInput = document.getElementById('module-price');
const quoteActionBtn = document.getElementById('quote-action-btn');
const clientDialog = document.getElementById('client-dialog');
const clientNameInput = document.getElementById('client-name-input');
const productNameInput = document.getElementById('product-name-input');
const dialogConfirm = document.getElementById('dialog-confirm');
const dialogCancel = document.getElementById('dialog-cancel');

// ---- Estado ----
let currentModules = [];
let currentCategories = [];
let currentCurrency = 'COP';
let currentCheckedIds = new Set();
let isEditMode = false;
let sortableInstances = [];

// ---- Inicialización ----
async function init() {
  try {
    await loadData();
    startAutoRefresh();
    currencySelect.value = currentCurrency;
    setEditMode(false);
    bindEvents();
  } catch (error) {
    console.error('Error en inicialización:', error);
    alert('No se pudo cargar la aplicación.');
  }
}

async function loadData() {
  currentCategories = await getCategories();
  currentModules = await getModules();
  // Asegurar que todos los módulos tengan category_id
  if (currentCategories.length > 0) {
    const firstCatId = currentCategories[0].id;
    for (const mod of currentModules) {
      if (!mod.category_id) {
        mod.category_id = firstCatId;
        // Opcional: actualizar en BD, pero lo dejamos así por simplicidad
      }
    }
  }
}

function bindEvents() {
  modulesContainer.addEventListener('change', onModuleCheckChange);
  currencySelect.addEventListener('change', onCurrencyChange);
  toggleModeBtn.addEventListener('click', onToggleMode);
  addModuleForm.addEventListener('submit', onAddModule);
  quoteActionBtn.addEventListener('click', onQuoteAction);
  dialogConfirm.addEventListener('click', onDialogConfirm);
  dialogCancel.addEventListener('click', () => clientDialog.close());
}

// ---- Render ----
function renderAll() {
  if (isEditMode) {
    renderAdminModulesByCategory(modulesContainer, currentModules, currentCategories, handleDeleteModule, handleEditModule);
    addModuleContainer.style.display = 'block';
    // Agregar controles de categoría en modo edición
    renderCategoryControls();
  } else {
    renderModulesByCategory(modulesContainer, currentModules, currentCategories, currentCurrency, convertCurrency, formatCurrency);
    addModuleContainer.style.display = 'none';
  }
  updateTotal();
  initSortable(); // Inicializar drag & drop
}

function renderCategoryControls() {
  // Añadir botón para agregar categoría en el header del modo edición
  const existing = document.getElementById('add-category-btn');
  if (!existing) {
    const container = document.createElement('div');
    container.id = 'category-controls';
    container.style.marginBottom = 'var(--space-md)';
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'new-category-input';
    input.placeholder = 'Nueva categoría';
    const btn = document.createElement('button');
    btn.id = 'add-category-btn';
    btn.className = 'btn btn-secondary';
    btn.textContent = 'Agregar categoría';
    btn.addEventListener('click', onAddCategory);
    container.appendChild(input);
    container.appendChild(btn);
    // Insertar antes del formulario de agregar módulo
    addModuleContainer.parentNode.insertBefore(container, addModuleContainer);
  }
}

function updateTotal() {
  if (!isEditMode) {
    const checkboxes = modulesContainer.querySelectorAll('input[type="checkbox"]:checked');
    const checkedIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    currentCheckedIds = new Set(checkedIds);
  }
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

// ---- Drag & Drop con SortableJS ----
function initSortable() {
  // Destruir instancias previas
  sortableInstances.forEach(s => s.destroy());
  sortableInstances = [];

  const lists = document.querySelectorAll('.module-list');
  lists.forEach(list => {
    const sortable = new Sortable(list, {
      group: 'modules',
      animation: 150,
      handle: '.module-card',
      draggable: '.module-card',
      ghostClass: 'sortable-ghost',
      onEnd: async (evt) => {
        const item = evt.item;
        const fromCategory = evt.from.dataset.categoryId;
        const toCategory = evt.to.dataset.categoryId;
        const newOrder = Array.from(evt.to.children).map(el => el.dataset.id);
        // Construir array de items para reordenar
        const items = newOrder.map((id, index) => ({
          id,
          category_id: toCategory,
          sort_order: index
        }));
        try {
          await reorderModules(items);
          // Recargar datos para mantener consistencia
          currentModules = await getModules();
          renderAll();
        } catch (error) {
          console.error('Error al reordenar:', error);
          alert('Error al guardar el nuevo orden. Recargando...');
          loadData().then(renderAll);
        }
      }
    });
    sortableInstances.push(sortable);
  });

  // También hacer sortable para categorías (opcional)
  // Podríamos permitir arrastrar categorías enteras, pero lo dejamos para otra iteración.
}

// ---- Event handlers ----
function onModuleCheckChange() {
  if (!isEditMode) updateTotal();
}

async function onCurrencyChange(e) {
  currentCurrency = e.target.value;
  // Forzar actualización de tasas
  await fetchExchangeRates(true);
  renderAll();
}

async function onAddModule(e) {
  e.preventDefault();
  const desc = moduleDescInput.value.trim();
  const price = parseFloat(modulePriceInput.value);
  if (!desc || isNaN(price) || price <= 0) {
    alert('Por favor, ingrese una descripción y un precio válido.');
    return;
  }
  // Obtener categoría seleccionada (si hay alguna)
  const categorySelect = document.getElementById('module-category-select');
  const categoryId = categorySelect ? categorySelect.value : (currentCategories[0]?.id || null);

  try {
    await addModule(desc, price, categoryId);
    await loadData();
    renderAll();
    moduleDescInput.value = '';
    modulePriceInput.value = '';
  } catch (error) {
    console.error('Error al agregar módulo:', error);
    alert('Error al agregar el módulo.');
  }
}

async function handleDeleteModule(id) {
  if (!confirm('¿Eliminar este módulo?')) return;
  try {
    await deleteModule(id);
    await loadData();
    renderAll();
  } catch (error) {
    console.error('Error al eliminar:', error);
    alert('Error al eliminar el módulo.');
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
    alert('Precio inválido.');
    return;
  }

  // Opcional: permitir cambiar categoría
  const catOptions = currentCategories.map(c => `${c.id}:${c.name}`).join(', ');
  const newCatId = prompt(`Nueva categoría (ID):\n${catOptions}`, module.category_id);
  const category_id = (newCatId && currentCategories.some(c => c.id === newCatId)) ? newCatId : module.category_id;

  try {
    await editModule(id, newDesc, newPrice, category_id);
    await loadData();
    renderAll();
  } catch (error) {
    console.error('Error al editar:', error);
    alert('Error al editar el módulo.');
  }
}

async function onAddCategory() {
  const input = document.getElementById('new-category-input');
  const name = input.value.trim();
  if (!name) return alert('Ingrese un nombre para la categoría.');
  try {
    await addCategory(name);
    input.value = '';
    await loadData();
    renderAll();
  } catch (error) {
    console.error('Error al agregar categoría:', error);
    alert('Error al agregar categoría.');
  }
}

// ---- Cotización ----
function onQuoteAction() {
  if (currentCheckedIds.size === 0) {
    alert('Seleccione al menos un módulo.');
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
    alert('Complete todos los campos.');
    return;
  }
  const totalCOP = calculateTotal(Array.from(currentCheckedIds), currentModules);
  try {
    await generateQuotePDF(clientName, productName, Array.from(currentCheckedIds), currentCurrency, totalCOP, currentModules);
    clientDialog.close();
  } catch (error) {
    console.error('Error al generar PDF:', error);
    alert('Error al generar el PDF.');
  }
}

// ---- Inicio ----
init();
