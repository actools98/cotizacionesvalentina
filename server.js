import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servir archivos estáticos (la app)
app.use(express.static(path.join(__dirname, 'dist')));

let db;

async function initDb() {
  // Crear carpeta data si no existe
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  const dbPath = path.join(dataDir, 'modules.db');
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      price INTEGER NOT NULL
    )
  `);

  // Cargar datos iniciales si la tabla está vacía
  const row = await db.get('SELECT COUNT(*) as count FROM modules');
  if (row.count === 0) {
    const defaultPath = path.join(__dirname, 'public', 'data', 'default-modules.json');
    let defaults = [];
    if (fs.existsSync(defaultPath)) {
      defaults = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
    } else {
      defaults = [
        { id: 'mod-1', description: 'Costo base de operación', price: 600000 },
        { id: 'mod-2', description: 'Servicio de consultoría básica', price: 350000 },
        { id: 'mod-3', description: 'Implementación de software', price: 1200000 },
        { id: 'mod-4', description: 'Capacitación presencial', price: 450000 },
        { id: 'mod-5', description: 'Soporte técnico mensual', price: 280000 }
      ];
    }
    for (const m of defaults) {
      await db.run('INSERT INTO modules (id, description, price) VALUES (?, ?, ?)', [m.id, m.description, m.price]);
    }
    console.log('📦 Datos iniciales cargados en la BD');
  }
  console.log('✅ Base de datos lista');
}

// ---- Rutas API ----
app.get('/api/modules', async (req, res) => {
  try {
    const modules = await db.all('SELECT * FROM modules ORDER BY description');
    res.json(modules);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener módulos' });
  }
});

app.post('/api/modules', async (req, res) => {
  const { description, price } = req.body;
  if (!description || price === undefined) {
    return res.status(400).json({ error: 'Faltan campos' });
  }
  try {
    const id = `mod-${Date.now()}`;
    await db.run('INSERT INTO modules (id, description, price) VALUES (?, ?, ?)', [id, description, price]);
    const newModule = await db.get('SELECT * FROM modules WHERE id = ?', [id]);
    res.status(201).json(newModule);
  } catch (e) {
    res.status(500).json({ error: 'Error al agregar módulo' });
  }
});

app.put('/api/modules/:id', async (req, res) => {
  const { id } = req.params;
  const { description, price } = req.body;
  if (!description || price === undefined) {
    return res.status(400).json({ error: 'Faltan campos' });
  }
  try {
    const result = await db.run('UPDATE modules SET description = ?, price = ? WHERE id = ?', [description, price, id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Módulo no encontrado' });
    }
    const updated = await db.get('SELECT * FROM modules WHERE id = ?', [id]);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar módulo' });
  }
});

app.delete('/api/modules/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.run('DELETE FROM modules WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Módulo no encontrado' });
    }
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar módulo' });
  }
});

// Para cualquier otra ruta, enviar index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Iniciar
await initDb();
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
