// currencyConverter.js - Conexión a API de tasas de cambio con refresco

const API_URL = 'https://api.exchangerate-api.com/v4/latest/COP';
let exchangeRates = null;
let lastFetchTime = 0;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutos

export async function fetchExchangeRates(force = false) {
  const now = Date.now();
  if (!force && exchangeRates && (now - lastFetchTime) < REFRESH_INTERVAL) {
    return exchangeRates;
  }

  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Error al obtener tasas de cambio');
    const data = await response.json();
    exchangeRates = data.rates;
    lastFetchTime = now;
    console.log('💱 Tasas de cambio actualizadas');
    return exchangeRates;
  } catch (error) {
    console.error('API de divisas falló:', error);
    // Fallback
    if (!exchangeRates) {
      exchangeRates = { USD: 0.00025, EUR: 0.00023 };
    }
    return exchangeRates;
  }
}

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

// Iniciar refresco automático
export function startAutoRefresh() {
  fetchExchangeRates(true);
  setInterval(() => fetchExchangeRates(true), REFRESH_INTERVAL);
}
