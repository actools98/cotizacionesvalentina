// currencyConverter.js - Conexión a API de tasas de cambio

const API_URL = 'https://api.exchangerate-api.com/v4/latest/COP';

let exchangeRates = null;

/**
 * Obtiene las tasas de cambio desde la API.
 * Almacena en memoria para la sesión actual.
 */
export async function fetchExchangeRates() {
  if (exchangeRates) return exchangeRates;
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Error al obtener tasas de cambio');
    const data = await response.json();
    exchangeRates = data.rates;
    return exchangeRates;
  } catch (error) {
    console.error('API de divisas falló:', error);
    // Fallback: tasas aproximadas (para demostración)
    exchangeRates = { USD: 0.00025, EUR: 0.00023 };
    return exchangeRates;
  }
}

/**
 * Convierte un monto en COP a la moneda solicitada.
 * @param {number} amountCOP - Monto en pesos colombianos.
 * @param {string} currency - 'COP', 'USD' o 'EUR'.
 * @returns {number} Monto convertido.
 */
export function convertCurrency(amountCOP, currency) {
  if (currency === 'COP') return amountCOP;
  if (!exchangeRates) {
    console.warn('Tasas no cargadas, usando COP por defecto');
    return amountCOP;
  }
  const rate = exchangeRates[currency];
  if (!rate) return amountCOP;
  return amountCOP * rate;
}
