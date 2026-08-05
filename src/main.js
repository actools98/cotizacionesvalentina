// main.js - Punto de entrada con categorías, drag & drop, portafolios, etc.

import { getModules, addModule, deleteModule, editModule, reorderModules, getCategories, addCategory, editCategory, deleteCategory, reorderCategories, getPortfolios, addPortfolio, editPortfolio, deletePortfolio } from './state.js';
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
const moduleCategorySelect = document.getElementById('module-category-select');
const quoteActionBtn = document.getElementById('quote-action-btn');
const clientDialog = document.getElementById('client-dialog');
const clientNameInput = document.getElementById('client-name-input');
const productNameInput = document.getElementById('product-name-input');
const dialogConfirm = document.getElementById('dialog-confirm');
const dialogCancel = document.getElementById('dialog-cancel');

// Portafolios
const portfoliosToggleBtn = document.getElementById('portfolios-toggle-btn');
const portfoliosDropdown = document.getElementById('portfolios-dropdown');
const portfoliosList = document.getElementById('portfolios-list');
const addPortfolioBtn = document.getElementById('add-portfolio-btn');
const newPortfolioName = document.getElementById('new-portfolio-name');
const newPortfolioLink = document.getElementById('new-portfolio-link');

// ---- Estado ----
let currentModules = [];
let currentCategories = [];
let currentPortfolios = [];
let currentCurrency = 'COP';
let currentCheckedIds = new Set();
let isEditMode = false;
let sortableInstances = [];
let portfoliosVisible = false;

// ---- Inicialización ----
async function init() {
  try {
    await loadData();
    startAutoRefresh();
    currencySelect.value = currentCurrency;
    setEditMode(false);
    bindEvents();
    renderPortfolios();
  } catch (error) {
    console.error('Error en inicialización:', error);
    alert('No se pudo cargar la aplicación.');
  }
}

async function loadData() {
  currentCategories = await getCategories();
  currentModules = await getModules();
  currentPortfolios = await getPortfolios();
  // Asegurar que los módulos tengan categoría
  if (currentCategories.length > 0) {
    const firstCatId = currentCategories[0].id;
    for (const mod of currentModules) {
      if (!mod.category_id) mod.category_id = firstCatId;
    }
  }
  populateCategorySelect();
}

function populateCategorySelect() {
  moduleCategorySelect.innerHTML = '';
  currentCategories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    moduleCategorySelect.appendChild(opt);
  });
}

function bindEvents() {
  modulesContainer.addEventListener('change', onModuleCheckChange);
  currencySelect.addEventListener('change', onCurrencyChange);
  toggleModeBtn.addEventListener('click', onToggleMode);
  addModuleForm.addEventListener('submit', onAddModule);
  quoteActionBtn.addEventListener('click', onQuoteAction);
  dialogConfirm.addEventListener('click', onDialogConfirm);
  dialogCancel.addEventListener('click', () => clientDialog.close());

  // Portafolios
  portfoliosToggleBtn.addEventListener('click', togglePortfolios);
  addPortfolioBtn.addEventListener('click', onAddPortfolio);

  // Delegación para acciones de portafolio
  portfoliosList.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (action === 'edit') onEditPortfolio(id);
    else if (action === 'delete') onDeletePortfolio(id);
    else if (action === 'open') onOpenPortfolio(id);
    else if (action === 'copy') onCopyPortfolioLink(id);
  });
}

// ---- Render general ----
function renderAll() {
  if (isEditMode) {
    renderAdminModulesByCategory(modulesContainer, currentModules, currentCategories, handleDeleteModule, handleEditModule);
    addModuleContainer.style.display = 'block';
    document.getElementById('total-card').style.display = 'none'; // Ocultar total en edición
    renderCategoryControls();
  } else {
    renderModulesByCategory(modulesContainer, currentModules, currentCategories, currentCurrency, convertCurrency, formatCurrency);
    addModuleContainer.style.display = 'none';
    document.getElementById('total-card').style.display = 'flex'; // Mostrar total en cotizar
    const catControls = document.getElementById('category-controls');
    if (catControls) catControls.remove();
  }
  updateTotal();
  initSortable();
  renderPortfolios();
}

function renderCategoryControls() {
  const existing = document.getElementById('category-controls');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'category-controls';
  container.style.marginBottom = 'var(--space-md)';
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'new-category-input';
  input.placeholder = 'Nueva categoría';
  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary';
  btn.textContent = 'Agregar categoría';
  btn.addEventListener('click', onAddCategory);
  container.appendChild(input);
  container.appendChild(btn);
  addModuleContainer.parentNode.insertBefore(container, addModuleContainer);
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

function onToggleMode() { setEditMode(!isEditMode); }

// ---- Drag & Drop ----
function initSortable() {
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
        const items = newOrder.map((id, index) => ({
          id,
          category_id: toCategory,
          sort_order: index
        }));
        try {
          await reorderModules(items);
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
}

// ---- Módulos: CRUD ----
async function onAddModule(e) {
  e.preventDefault();
  const desc = moduleDescInput.value.trim();
  const price = parseFloat(modulePriceInput.value);
  if (!desc || isNaN(price) || price <= 0) {
    alert('Ingrese descripción y precio válido.');
    return;
  }
  const categoryId = moduleCategorySelect.value || currentCategories[0]?.id || null;
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

// ---- Categorías: CRUD ----
async function onAddCategory() {
  const input = document.getElementById('new-category-input');
  const name = input.value.trim();
  if (!name) return alert('Ingrese un nombre.');
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

async function handleEditCategory(id) {
  const cat = currentCategories.find(c => c.id === id);
  if (!cat) return;
  const newName = prompt('Nuevo nombre de categoría:', cat.name);
  if (newName === null || newName.trim() === '') return;
  try {
    await editCategory(id, newName.trim());
    await loadData();
    renderAll();
  } catch (error) {
    console.error('Error al editar categoría:', error);
    alert('Error al editar categoría.');
  }
}

async function handleDeleteCategory(id) {
  const modulesInCat = currentModules.filter(m => m.category_id === id);
  if (modulesInCat.length > 0) {
    if (!confirm(`La categoría tiene ${modulesInCat.length} módulo(s). ¿Eliminar de todos modos? Se moverán a la categoría por defecto.`)) {
      return;
    }
  } else {
    if (!confirm('¿Eliminar esta categoría?')) return;
  }
  try {
    await deleteCategory(id);
    await loadData();
    renderAll();
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    alert('Error al eliminar categoría.');
  }
}

// ---- Portafolios: CRUD ----
function renderPortfolios() {
  portfoliosList.innerHTML = '';
  if (currentPortfolios.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = 'No hay portafolios. Agrega uno.';
    portfoliosList.appendChild(empty);
  } else {
    currentPortfolios.forEach(pf => {
      const item = document.createElement('div');
      item.className = 'portfolio-item';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'pf-name';
      nameSpan.textContent = pf.name;
      const actions = document.createElement('div');
      actions.className = 'pf-actions';
      // Abrir
      const openBtn = document.createElement('button');
      openBtn.dataset.action = 'open';
      openBtn.dataset.id = pf.id;
      openBtn.textContent = 'Abrir';
      openBtn.title = 'Abrir enlace';
      // Copiar
      const copyBtn = document.createElement('button');
      copyBtn.dataset.action = 'copy';
      copyBtn.dataset.id = pf.id;
      copyBtn.textContent = 'Copiar';
      copyBtn.title = 'Copiar enlace';
      // Editar
      const editBtn = document.createElement('button');
      editBtn.dataset.action = 'edit';
      editBtn.dataset.id = pf.id;
      editBtn.textContent = 'Editar';
      // Borrar
      const deleteBtn = document.createElement('button');
      deleteBtn.dataset.action = 'delete';
      deleteBtn.dataset.id = pf.id;
      deleteBtn.textContent = 'Borrar';

      actions.appendChild(openBtn);
      actions.appendChild(copyBtn);
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      item.appendChild(nameSpan);
      item.appendChild(actions);
      portfoliosList.appendChild(item);
    });
  }
}

function togglePortfolios() {
  portfoliosVisible = !portfoliosVisible;
  portfoliosDropdown.style.display = portfoliosVisible ? 'block' : 'none';
}

async function onAddPortfolio() {
  const name = newPortfolioName.value.trim();
  const link = newPortfolioLink.value.trim();
  if (!name || !link) {
    alert('Ingrese nombre y enlace.');
    return;
  }
  try {
    await addPortfolio(name, link);
    newPortfolioName.value = '';
    newPortfolioLink.value = '';
    currentPortfolios = await getPortfolios();
    renderPortfolios();
  } catch (error) {
    console.error('Error al agregar portafolio:', error);
    alert('Error al agregar portafolio.');
  }
}

async function onEditPortfolio(id) {
  const pf = currentPortfolios.find(p => p.id === id);
  if (!pf) return;
  const newName = prompt('Nuevo nombre:', pf.name);
  if (newName === null) return;
  const newLink = prompt('Nuevo enlace:', pf.link);
  if (newLink === null) return;
  try {
    await editPortfolio(id, newName.trim(), newLink.trim());
    currentPortfolios = await getPortfolios();
    renderPortfolios();
  } catch (error) {
    console.error('Error al editar portafolio:', error);
    alert('Error al editar portafolio.');
  }
}

async function onDeletePortfolio(id) {
  if (!confirm('¿Eliminar este portafolio?')) return;
  try {
    await deletePortfolio(id);
    currentPortfolios = await getPortfolios();
    renderPortfolios();
  } catch (error) {
    console.error('Error al eliminar portafolio:', error);
    alert('Error al eliminar portafolio.');
  }
}

function onOpenPortfolio(id) {
  const pf = currentPortfolios.find(p => p.id === id);
  if (pf && pf.link) {
    window.open(pf.link, '_blank');
  }
}

function onCopyPortfolioLink(id) {
  const pf = currentPortfolios.find(p => p.id === id);
  if (pf && pf.link) {
    navigator.clipboard.writeText(pf.link).then(() => {
      alert('Enlace copiado al portapapeles.');
    }).catch(() => {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = pf.link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Enlace copiado al portapapeles.');
    });
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

// ---- Event handlers varios ----
function onModuleCheckChange() {
  if (!isEditMode) updateTotal();
}

async function onCurrencyChange(e) {
  currentCurrency = e.target.value;
  await fetchExchangeRates(true);
  renderAll();
}

// ---- Inicio ----
init();
