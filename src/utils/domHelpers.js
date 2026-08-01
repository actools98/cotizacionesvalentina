// domHelpers.js - Funciones para creación y manipulación del DOM

/**
 * Crea una tarjeta de módulo (modo cotización: checkbox + label + precio)
 */
export function createModuleCard(module, currency, convertFn, formatFn) {
  const { id, description, price } = module;
  const priceConverted = convertFn(price, currency);
  const priceFormatted = formatFn(priceConverted, currency);

  const card = document.createElement('div');
  card.className = 'module-card';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.dataset.id = id;
  checkbox.id = `mod-${id}`;
  checkbox.setAttribute('aria-label', `Seleccionar ${description}`);

  const label = document.createElement('label');
  label.className = 'module-label';
  label.htmlFor = `mod-${id}`;
  label.textContent = description;

  const priceSpan = document.createElement('span');
  priceSpan.className = 'module-price';
  priceSpan.textContent = priceFormatted;

  card.appendChild(checkbox);
  card.appendChild(label);
  card.appendChild(priceSpan);

  return card;
}

/**
 * Renderiza la lista de módulos en modo cotización
 */
export function renderModules(container, modules, currency, convertFn, formatFn) {
  container.innerHTML = '';
  modules.forEach(mod => {
    const card = createModuleCard(mod, currency, convertFn, formatFn);
    container.appendChild(card);
  });
}

/**
 * Crea una tarjeta de módulo en modo administración (edición)
 * Incluye botones Editar y Eliminar
 */
export function createAdminModuleCard(module, onDelete, onEdit) {
  const { id, description, price } = module;

  const card = document.createElement('div');
  card.className = 'module-card admin-mode';

  const info = document.createElement('span');
  info.className = 'module-label';
  info.textContent = description;

  const priceSpan = document.createElement('span');
  priceSpan.className = 'module-price';
  priceSpan.textContent = `$ ${Number(price).toLocaleString('es-CO')}`;

  const actions = document.createElement('div');
  actions.className = 'admin-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-edit';
  editBtn.textContent = 'Editar';
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onEdit(id);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-delete';
  deleteBtn.textContent = 'Eliminar';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onDelete(id);
  });

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  card.appendChild(info);
  card.appendChild(priceSpan);
  card.appendChild(actions);

  return card;
}

/**
 * Renderiza la lista de módulos en modo administración
 */
export function renderAdminModules(container, modules, onDelete, onEdit) {
  container.innerHTML = '';
  modules.forEach(mod => {
    const card = createAdminModuleCard(mod, onDelete, onEdit);
    container.appendChild(card);
  });
}
