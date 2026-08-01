// domHelpers.js - Funciones para creación y manipulación del DOM

/**
 * Crea una tarjeta de módulo (checkbox + label + precio).
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
 * Renderiza la lista de módulos en un contenedor.
 */
export function renderModules(container, modules, currency, convertFn, formatFn) {
  container.innerHTML = '';
  modules.forEach(mod => {
    const card = createModuleCard(mod, currency, convertFn, formatFn);
    container.appendChild(card);
  });
}

/**
 * Crea un elemento de administración (fila con botón eliminar).
 */
export function createAdminItem(module, onDelete) {
  const { id, description, price } = module;

  const item = document.createElement('div');
  item.className = 'admin-item';

  const info = document.createElement('div');
  info.className = 'admin-item-info';

  const descSpan = document.createElement('span');
  descSpan.className = 'admin-desc';
  descSpan.textContent = description;

  const priceSpan = document.createElement('span');
  priceSpan.className = 'admin-price';
  priceSpan.textContent = `$ ${Number(price).toLocaleString('es-CO')}`;

  info.appendChild(descSpan);
  info.appendChild(priceSpan);

  const actions = document.createElement('div');
  actions.className = 'admin-item-actions';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger';
  deleteBtn.textContent = 'Eliminar';
  deleteBtn.addEventListener('click', () => onDelete(id));

  actions.appendChild(deleteBtn);
  item.appendChild(info);
  item.appendChild(actions);

  return item;
}

/**
 * Renderiza la lista de administración.
 */
export function renderAdminList(container, modules, onDelete) {
  container.innerHTML = '';
  modules.forEach(mod => {
    const item = createAdminItem(mod, onDelete);
    container.appendChild(item);
  });
}
