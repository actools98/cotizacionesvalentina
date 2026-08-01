// quoteCalculator.js - Lógica de sumatoria de módulos seleccionados

import { getModulesSyncSafe } from '../state.js';

/**
 * Calcula el total sumando los precios de los módulos marcados.
 * @param {string[]} checkedIds - Array de IDs de módulos seleccionados.
 * @returns {number} Total en COP (base).
 */
export function calculateTotal(checkedIds) {
  const modules = getModulesSyncSafe();
  let total = 0;
  checkedIds.forEach(id => {
    const mod = modules.find(m => m.id === id);
    if (mod) total += mod.price;
  });
  return total;
}

/**
 * Obtiene la lista de módulos seleccionados (objetos completos).
 */
export function getSelectedModules(checkedIds) {
  const modules = getModulesSyncSafe();
  return checkedIds.map(id => modules.find(m => m.id === id)).filter(Boolean);
}
