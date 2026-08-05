// main.js - Punto de entrada con categorías, drag & drop, portafolios (menú flotante), tasas manuales

import { getModules, addModule, deleteModule, editModule, reorderModules, getCategories, addCategory, editCategory, deleteCategory, reorderCategories, getPortfolios, addPortfolio, editPortfolio, deletePortfolio } from './state.js';
import { calculateTotal, getSelectedModules } from './components/quoteCalculator.js';
import { fetchExchangeRates, convertCurrency, startAutoRefresh, saveManualRates, getCurrentRates } from './components/currencyConverter.js';
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
const portfoliosCard = document.getElementById('portfolios-card'); // El bloque en el sidebar

// Portafolios (modal)
const portfoliosOpenBtn = document.getElementById('portfolios-open-btn');
const portfoliosDialog = document.getElementById('portfolios-dialog');
const portfoliosListModal = document.getElementById('portfolios-list-modal');
const portfoliosDialogClose = document.getElementById('portfolios-dialog-close');

// Tasas
const ratesToggleBtn = document.getElementById('rates-toggle-btn');
const ratesDialog = document.getElementById('rates-dialog');
const rateUsdInput = document.getElementById('rate-usd');
const rateEurInput = document.getElementById('rate-eur');
const ratesDialogSave = document.getElementById('rates-dialog-save');
const ratesDialogCancel = document.getElementById('rates-dialog-cancel');
const ratesDialogReset = document.getElementById('rates-dialog-reset');
const ratesDialogClose = document.getElementById('rates-dialog-close');

// ---- Estado ----
let currentModules = [];
let currentCategories = [];
let currentPortfolios = [];
let currentCurrency = 'COP';
let currentCheckedIds = new Set();
let isEditMode = false;
let sortableInstances = [];
let openPortfolioMenuId = null; // ID del portafolio cuyo menú está abierto

// ---- Inicialización ----
async function init() {
  try {
    await loadData();
    startAutoRefresh();
    currencySelect.value = currentCurrency;
    setEditMode(false);
    bindEvents();
    renderPortfoliosModal();
    // Ocultar/mostrar portafolios según modo inicial
    updatePortfoliosVisibility();
  } catch (error) {
    console.error('Error en inicialización:', error);
    alert('No se pudo cargar la aplicación.');
  }
}

async function loadData() {
  currentCategories = await getCategories();
  currentModules = await getModules();
  currentPortfolios = await getPortfolios();
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
  portfoliosOpenBtn.addEventListener('click', openPortfoliosDialog);
  portfoliosDialogClose.addEventListener('click', closePortfoliosDialog);

  // Tasas
  ratesToggleBtn.addEventListener('click', openRatesDialog);
  ratesDialogClose.addEventListener('click', closeRatesDialog);
  ratesDialogCancel.addEventListener('click', closeRatesDialog);
  ratesDialogSave.addEventListener('click', onSaveRates);
  ratesDialogReset.addEventListener('click', onResetRates);

  // Clic fuera de los menús de portafolios para cerrarlos
  document.addEventListener('click', (e) => {
    if (openPortfolioMenuId) {
      // Verificar si el clic fue fuera del menú y del botón
      const menu = document.querySelector(`.pf-context-menu[data-id="${openPortfolioMenuId}"]`);
      const button = document.querySelector(`.pf-name-btn[data-id="${openPortfolioMenuId}"]`);
      if (menu && button && !menu.contains(e.target) && !button.contains(e.target)) {
        closePortfolioMenu();
      }
    }
  });
}

// ---- Render general ----
function renderAll() {
  if (isEditMode) {
    renderAdminModulesByCategory(modulesContainer, currentModules, currentCategories, handleDeleteModule, handleEditModule, handleEditCategory, handleDeleteCategory);
    addModuleContainer.style.display = 'block';
    document.getElementById('total-card').style.display = 'none';
    renderCategoryControls();
  } else {
    renderModulesByCategory(modulesContainer, currentModules, currentCategories, currentCurrency, convertCurrency, formatCurrency);
    addModuleContainer.style.display = 'none';
    document.getElementById('total-card').style.display = 'flex';
    const catControls = document.getElementById('category-controls');
    if (catControls) catControls.remove();
  }
  updateTotal();
  // Iniciar sortable solo si estamos en modo edición
  if (isEditMode) {
    initSortable();
  } else {
    destroySortable();
  }
  renderPortfoliosModal();
  updatePortfoliosVisibility();
}

function updatePortfoliosVisibility() {
  // Mostrar portafolios solo en modo cotizar
  if (portfoliosCard) {
    portfoliosCard.style.display = isEditMode ? 'none' : 'flex';
  }
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

// ---- Sortable (Drag & Drop) ----
function initSortable() {
  destroySortable();
  const lists = document.querySelectorAll('.module-list');
  lists.forEach(list => {
    const sortable = new Sortable(list, {
      group: 'modules',
      animation: 150,
      handle: '.module-card',
      draggable: '.module-card',
      ghostClass: 'sortable-ghost',
      onEnd: async (evt) => {
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

function destroySortable() {
  sortableInstances.forEach(s => s.destroy());
  sortableInstances = [];
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
  let confirmMsg = '¿Eliminar esta categoría?';
  if (modulesInCat.length > 0) {
    confirmMsg = `La categoría tiene ${modulesInCat.length} módulo(s). ¿Eliminar de todos modos? Se moverán a la categoría por defecto.`;
  }
  if (!confirm(confirmMsg)) return;
  try {
    await deleteCategory(id);
    await loadData();
    renderAll();
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    alert('Error al eliminar categoría.');
  }
}

// ---- Portafolios: Modal y CRUD con menú flotante ----
function openPortfoliosDialog() {
  renderPortfoliosModal();
  portfoliosDialog.showModal();
}

function closePortfoliosDialog() {
  portfoliosDialog.close();
  closePortfolioMenu();
}

function renderPortfoliosModal() {
  portfoliosListModal.innerHTML = '';
  if (currentPortfolios.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = 'No hay portafolios. Añade uno.';
    portfoliosListModal.appendChild(empty);
    // Añadir botón "Añadir portafolio" aunque esté vacío
    appendAddPortfolioButton();
    return;
  }

  currentPortfolios.forEach(pf => {
    const item = document.createElement('div');
    item.className = 'portfolio-item-modal';

    // Botón principal (nombre del portafolio)
    const nameBtn = document.createElement('button');
    nameBtn.className = 'pf-name-btn';
    nameBtn.textContent = pf.name;
    nameBtn.dataset.id = pf.id;
    nameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePortfolioMenu(pf.id, nameBtn);
    });

    // Menú contextual (flotante)
    const menu = document.createElement('div');
    menu.className = 'pf-context-menu';
    menu.dataset.id = pf.id;
    menu.style.display = 'none'; // oculto por defecto

    // Opciones del menú
    const options = [
      { label: 'Abrir', action: 'open', cls: '' },
      { label: 'Copiar enlace', action: 'copy', cls: '' },
      { label: 'Editar', action: 'edit', cls: '' },
      { label: 'Borrar', action: 'delete', cls: 'danger' }
    ];
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = `pf-menu-item ${opt.cls}`;
      btn.textContent = opt.label;
      btn.dataset.action = opt.action;
      btn.dataset.id = pf.id;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePortfolioAction(opt.action, pf.id);
        closePortfolioMenu(); // cerrar después de la acción
      });
      menu.appendChild(btn);
    });

    // Formulario de edición (inline, similar al de añadir)
    const editForm = document.createElement('div');
    editForm.className = 'pf-edit-form';
    editForm.dataset.id = pf.id;
    editForm.style.display = 'none';

    const editNameInput = document.createElement('input');
    editNameInput.type = 'text';
    editNameInput.placeholder = 'Nombre';
    editNameInput.value = pf.name;

    const editLinkInput = document.createElement('input');
    editLinkInput.type = 'url';
    editLinkInput.placeholder = 'Enlace';
    editLinkInput.value = pf.link;

    const saveEditBtn = document.createElement('button');
    saveEditBtn.className = 'btn btn-success';
    saveEditBtn.textContent = 'Guardar';
    saveEditBtn.addEventListener('click', () => {
      const newName = editNameInput.value.trim();
      const newLink = editLinkInput.value.trim();
      if (!newName || !newLink) {
        alert('Complete ambos campos.');
        return;
      }
      onEditPortfolio(pf.id, newName, newLink);
    });

    const cancelEditBtn = document.createElement('button');
    cancelEditBtn.className = 'btn btn-secondary';
    cancelEditBtn.textContent = 'Cancelar';
    cancelEditBtn.addEventListener('click', () => {
      editForm.style.display = 'none';
      menu.style.display = 'flex'; // volver a mostrar menú
    });

    editForm.appendChild(editNameInput);
    editForm.appendChild(editLinkInput);
    editForm.appendChild(saveEditBtn);
    editForm.appendChild(cancelEditBtn);

    item.appendChild(nameBtn);
    item.appendChild(menu);
    item.appendChild(editForm);
    portfoliosListModal.appendChild(item);
  });

  // Botón "Añadir portafolio" al final
  appendAddPortfolioButton();
}

function appendAddPortfolioButton() {
  const addContainer = document.createElement('div');
  addContainer.className = 'add-portfolio-container';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.textContent = '+ Añadir portafolio';
  addBtn.id = 'add-portfolio-main-btn';
  addBtn.addEventListener('click', () => {
    // Ocultar el botón de añadir y mostrar el formulario
    const container = addBtn.parentElement;
    const form = container.querySelector('.add-portfolio-form-inline');
    if (form) {
      form.style.display = 'flex';
      addBtn.style.display = 'none';
    } else {
      // Crear formulario inline
      const newForm = document.createElement('div');
      newForm.className = 'add-portfolio-form-inline pf-edit-form';
      const inputName = document.createElement('input');
      inputName.type = 'text';
      inputName.placeholder = 'Nombre';
      inputName.id = 'new-pf-name';
      const inputLink = document.createElement('input');
      inputLink.type = 'url';
      inputLink.placeholder = 'Enlace';
      inputLink.id = 'new-pf-link';
      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-success';
      saveBtn.textContent = 'Guardar';
      saveBtn.addEventListener('click', () => {
        const name = inputName.value.trim();
        const link = inputLink.value.trim();
        if (!name || !link) {
          alert('Complete ambos campos.');
          return;
        }
        onAddPortfolio(name, link);
      });
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.textContent = 'Cancelar';
      cancelBtn.addEventListener('click', () => {
        newForm.style.display = 'none';
        addBtn.style.display = 'block';
      });
      newForm.appendChild(inputName);
      newForm.appendChild(inputLink);
      newForm.appendChild(saveBtn);
      newForm.appendChild(cancelBtn);
      container.appendChild(newForm);
      addBtn.style.display = 'none';
      newForm.style.display = 'flex';
    }
  });
  addContainer.appendChild(addBtn);
  portfoliosListModal.appendChild(addContainer);
}

function togglePortfolioMenu(id, buttonElement) {
  const menu = document.querySelector(`.pf-context-menu[data-id="${id}"]`);
  if (!menu) return;
  // Si el menú ya está abierto y es el mismo, lo cerramos
  if (openPortfolioMenuId === id && menu.style.display === 'flex') {
    closePortfolioMenu();
    return;
  }
  // Cerrar cualquier menú abierto
  closePortfolioMenu();
  // Mostrar el nuevo menú
  menu.style.display = 'flex';
  openPortfolioMenuId = id;
  // Posicionar el menú cerca del botón (usando fixed para que no se desborde)
  const rect = buttonElement.getBoundingClientRect();
  const menuWidth = 200; // ancho aproximado
  let left = rect.left + rect.width / 2 - menuWidth / 2;
  let top = rect.bottom + 6;
  // Ajustar para que no se salga de la pantalla
  const maxLeft = window.innerWidth - menuWidth - 10;
  if (left > maxLeft) left = maxLeft;
  if (left < 10) left = 10;
  if (top + menu.offsetHeight > window.innerHeight) {
    top = rect.top - menu.offsetHeight - 6;
  }
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.position = 'fixed';
  menu.style.zIndex = '1000';
}

function closePortfolioMenu() {
  if (openPortfolioMenuId) {
    const menu = document.querySelector(`.pf-context-menu[data-id="${openPortfolioMenuId}"]`);
    if (menu) menu.style.display = 'none';
    openPortfolioMenuId = null;
  }
}

function handlePortfolioAction(action, id) {
  if (action === 'open') {
    const pf = currentPortfolios.find(p => p.id === id);
    if (pf && pf.link) window.open(pf.link, '_blank');
  } else if (action === 'copy') {
    const pf = currentPortfolios.find(p => p.id === id);
    if (pf && pf.link) {
      navigator.clipboard.writeText(pf.link).then(() => {
        alert('Enlace copiado al portapapeles.');
      }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = pf.link;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Enlace copiado al portapapeles.');
      });
    }
  } else if (action === 'edit') {
    // Mostrar formulario de edición inline y ocultar menú
    const menu = document.querySelector(`.pf-context-menu[data-id="${id}"]`);
    const editForm = document.querySelector(`.pf-edit-form[data-id="${id}"]`);
    if (menu && editForm) {
      menu.style.display = 'none';
      editForm.style.display = 'flex';
      // Rellenar con datos actuales
      const pf = currentPortfolios.find(p => p.id === id);
      if (pf) {
        editForm.querySelector('input[type="text"]').value = pf.name;
        editForm.querySelector('input[type="url"]').value = pf.link;
      }
    }
    closePortfolioMenu(); // cerrar el menú flotante
  } else if (action === 'delete') {
    if (confirm('¿Eliminar este portafolio?')) {
      onDeletePortfolio(id);
    }
  }
}

async function onAddPortfolio(name, link) {
  try {
    await addPortfolio(name, link);
    currentPortfolios = await getPortfolios();
    renderPortfoliosModal();
  } catch (error) {
    console.error('Error al agregar portafolio:', error);
    alert('Error al agregar portafolio.');
  }
}

async function onEditPortfolio(id, name, link) {
  try {
    await editPortfolio(id, name, link);
    currentPortfolios = await getPortfolios();
    renderPortfoliosModal();
  } catch (error) {
    console.error('Error al editar portafolio:', error);
    alert('Error al editar portafolio.');
  }
}

async function onDeletePortfolio(id) {
  try {
    await deletePortfolio(id);
    currentPortfolios = await getPortfolios();
    renderPortfoliosModal();
  } catch (error) {
    console.error('Error al eliminar portafolio:', error);
    alert('Error al eliminar portafolio.');
  }
}

// ---- Tasas de cambio personalizadas (base 1000 COP) ----
function openRatesDialog() {
  const rates = getCurrentRates();
  if (rates) {
    // Mostrar valor por 1000 COP
    rateUsdInput.value = rates.USD * 1000;
    rateEurInput.value = rates.EUR * 1000;
  } else {
    rateUsdInput.value = '';
    rateEurInput.value = '';
  }
  ratesDialog.showModal();
}

function closeRatesDialog() {
  ratesDialog.close();
}

function onSaveRates() {
  const usd = parseFloat(rateUsdInput.value);
  const eur = parseFloat(rateEurInput.value);
  if (isNaN(usd) || isNaN(eur) || usd <= 0 || eur <= 0) {
    alert('Ingrese valores numéricos positivos.');
    return;
  }
  // Guardar tasa por 1 COP (dividir entre 1000)
  saveManualRates(usd / 1000, eur / 1000);
  fetchExchangeRates(true);
  renderAll();
  closeRatesDialog();
  alert('Tasas guardadas correctamente.');
}

function onResetRates() {
  if (confirm('¿Restablecer a las tasas de la API? Se perderán las tasas manuales.')) {
    localStorage.removeItem('actols_manual_rates');
    fetchExchangeRates(true);
    renderAll();
    closeRatesDialog();
    alert('Tasas restablecidas.');
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
