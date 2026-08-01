// state.js - Gestor de estado global y LocalStorage

const STORAGE_KEY = 'actols_modules';

/**
 * Obtiene la lista de módulos desde LocalStorage.
 * Si no existe, la inicializa con los datos del JSON por defecto.
 */
export async function getModules() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.warn('Error parsing stored data, reinitializing.');
    }
  }
  // Inicializar con datos por defecto
  return await initializeDefaultModules();
}

async function initializeDefaultModules() {
  const response = await fetch('data/default-modules.json');
  if (!response.ok) {
    throw new Error('No se pudo cargar el archivo de datos por defecto.');
  }
  const modules = await response.json();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
  return modules;
}

/**
 * Guarda la lista de módulos en LocalStorage.
 */
export function saveModules(modules) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
}

/**
 * Agrega un nuevo módulo.
 */
export function addModule(description, price) {
  const modules = getModulesSync();
  const newId = `mod-${Date.now()}`;
  const newModule = { id: newId, description, price: Number(price) };
  modules.push(newModule);
  saveModules(modules);
  return modules;
}

/**
 * Elimina un módulo por ID.
 */
export function deleteModule(id) {
  let modules = getModulesSync();
  modules = modules.filter(mod => mod.id !== id);
  saveModules(modules);
  return modules;
}

/**
 * Edita un módulo (descripción y precio).
 */
export function editModule(id, newDescription, newPrice) {
  const modules = getModulesSync();
  const index = modules.findIndex(mod => mod.id === id);
  if (index !== -1) {
    modules[index].description = newDescription;
    modules[index].price = Number(newPrice);
    saveModules(modules);
  }
  return modules;
}

/**
 * Sincrónico: obtiene los módulos desde LocalStorage sin async.
 * Útil para operaciones CRUD después de la inicialización.
 */
function getModulesSync() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// Para uso en otros módulos
export function getModulesSyncSafe() {
  return getModulesSync();
}
