// state.js - Comunicación con la API

const API_URL = '/api/modules';

export async function getModules() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('Error al obtener módulos');
    return await res.json();
  } catch (error) {
    console.error('Error fetching modules:', error);
    return [];
  }
}

export async function addModule(description, price) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, price: Number(price) })
  });
  if (!res.ok) throw new Error('Error al agregar módulo');
  return await res.json();
}

export async function deleteModule(id) {
  const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar módulo');
  return true;
}

export async function editModule(id, description, price) {
  const res = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, price: Number(price) })
  });
  if (!res.ok) throw new Error('Error al editar módulo');
  return await res.json();
}
