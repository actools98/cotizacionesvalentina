import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Servir archivos estáticos desde la carpeta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---- Configuración de multer ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads', 'portfolios');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const basename = uuidv4();
    cb(null, `${basename}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo imágenes y PDF.'));
    }
  }
});

let db;

async function initDb() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  const dbPath = path.join(dataDir, 'modules.db');
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      category_id TEXT REFERENCES categories(id),
      sort_order INTEGER DEFAULT 0
    )
  `);

  // Tabla portafolios con link y file_name
  await db.exec(`
    CREATE TABLE IF NOT EXISTS portfolios (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      link TEXT,
      file_name TEXT,
      sort_order INTEGER DEFAULT 0
    )
  `);

  // Cargar datos por defecto si no existen (categorías y módulos)
  const catCount = await db.get('SELECT COUNT(*) as count FROM categories');
  if (catCount.count === 0) {
    const defaultCats = [
      { id: 'cat-1', name: 'General', sort_order: 0 },
      { id: 'cat-2', name: 'Consultoría', sort_order: 1 },
      { id: 'cat-3', name: 'Implementación', sort_order: 2 },
      { id: 'cat-4', name: 'Capacitación', sort_order: 3 },
      { id: 'cat-5', name: 'Soporte', sort_order: 4 }
    ];
    for (const c of defaultCats) {
      await db.run('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)', [c.id, c.name, c.sort_order]);
    }
    console.log('📂 Categorías por defecto creadas');
  }

  const modCount = await db.get('SELECT COUNT(*) as count FROM modules');
  if (modCount.count === 0) {
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
    const firstCat = await db.get('SELECT id FROM categories ORDER BY sort_order LIMIT 1');
    if (firstCat) {
      for (let i = 0; i < defaults.length; i++) {
        const m = defaults[i];
        await db.run(
          'INSERT INTO modules (id, description, price, category_id, sort_order) VALUES (?, ?, ?, ?, ?)',
          [m.id, m.description, m.price, firstCat.id, i]
        );
      }
      console.log('📦 Módulos por defecto cargados');
    }
  }

  console.log('✅ Base de datos lista');
}

// ============================================================
// RUTAS API
// ============================================================

// ---- Categorías (igual que antes) ----
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db.all('SELECT * FROM categories ORDER BY sort_order');
    res.json(categories);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

app.post('/api/categories', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const id = `cat-${Date.now()}`;
    const maxOrder = await db.get('SELECT MAX(sort_order) as max FROM categories');
    const order = (maxOrder?.max ?? -1) + 1;
    await db.run('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)', [id, name, order]);
    const newCat = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    res.status(201).json(newCat);
  } catch (e) {
    res.status(500).json({ error: 'Error al crear categoría' });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const result = await db.run('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    const updated = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const defaultCat = await db.get('SELECT id FROM categories ORDER BY sort_order LIMIT 1');
    if (defaultCat) {
      await db.run('UPDATE modules SET category_id = ? WHERE category_id = ?', [defaultCat.id, id]);
    }
    await db.run('DELETE FROM categories WHERE id = ?', [id]);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
});

app.patch('/api/categories/reorder', async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Se requiere un arreglo de items' });
  }
  try {
    for (const item of items) {
      await db.run('UPDATE categories SET sort_order = ? WHERE id = ?', [item.sort_order, item.id]);
    }
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al reordenar categorías' });
  }
});

// ---- Módulos (igual que antes) ----
app.get('/api/modules', async (req, res) => {
  try {
    const modules = await db.all(`
      SELECT m.*, c.name as category_name 
      FROM modules m 
      LEFT JOIN categories c ON m.category_id = c.id 
      ORDER BY c.sort_order, m.sort_order
    `);
    res.json(modules);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener módulos' });
  }
});

app.post('/api/modules', async (req, res) => {
  const { description, price, category_id } = req.body;
  if (!description || price === undefined) {
    return res.status(400).json({ error: 'Faltan campos' });
  }
  try {
    const id = `mod-${Date.now()}`;
    let catId = category_id;
    if (!catId) {
      const firstCat = await db.get('SELECT id FROM categories ORDER BY sort_order LIMIT 1');
      catId = firstCat?.id || null;
    }
    const maxOrder = await db.get('SELECT MAX(sort_order) as max FROM modules WHERE category_id = ?', [catId]);
    const order = (maxOrder?.max ?? -1) + 1;

    await db.run(
      'INSERT INTO modules (id, description, price, category_id, sort_order) VALUES (?, ?, ?, ?, ?)',
      [id, description, price, catId, order]
    );
    const newModule = await db.get('SELECT * FROM modules WHERE id = ?', [id]);
    res.status(201).json(newModule);
  } catch (e) {
    res.status(500).json({ error: 'Error al agregar módulo' });
  }
});

app.put('/api/modules/:id', async (req, res) => {
  const { id } = req.params;
  const { description, price, category_id } = req.body;
  if (!description || price === undefined) {
    return res.status(400).json({ error: 'Faltan campos' });
  }
  try {
    await db.run('UPDATE modules SET description = ?, price = ?, category_id = ? WHERE id = ?', [description, price, category_id, id]);
    const updated = await db.get('SELECT * FROM modules WHERE id = ?', [id]);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar módulo' });
  }
});

app.delete('/api/modules/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.run('DELETE FROM modules WHERE id = ?', [id]);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar módulo' });
  }
});

app.patch('/api/modules/reorder', async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Se requiere un arreglo de items' });
  }
  try {
    for (const item of items) {
      await db.run('UPDATE modules SET category_id = ?, sort_order = ? WHERE id = ?', [item.category_id, item.sort_order, item.id]);
    }
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al reordenar módulos' });
  }
});

// ---- Portafolios (con subida de archivos) ----
app.get('/api/portfolios', async (req, res) => {
  try {
    const portfolios = await db.all('SELECT * FROM portfolios ORDER BY sort_order');
    res.json(portfolios);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener portafolios' });
  }
});

app.post('/api/portfolios', upload.single('file'), async (req, res) => {
  const { name, link } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre es requerido' });
  if (!link && !req.file) {
    return res.status(400).json({ error: 'Debe proporcionar un enlace o un archivo.' });
  }

  try {
    const id = `pf-${Date.now()}`;
    const maxOrder = await db.get('SELECT MAX(sort_order) as max FROM portfolios');
    const order = (maxOrder?.max ?? -1) + 1;

    const file_name = req.file ? req.file.filename : null;

    await db.run(
      'INSERT INTO portfolios (id, name, link, file_name, sort_order) VALUES (?, ?, ?, ?, ?)',
      [id, name, link || null, file_name, order]
    );
    const newPf = await db.get('SELECT * FROM portfolios WHERE id = ?', [id]);
    res.status(201).json(newPf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear portafolio' });
  }
});

app.put('/api/portfolios/:id', upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const { name, link } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre es requerido' });

  try {
    const current = await db.get('SELECT file_name FROM portfolios WHERE id = ?', [id]);
    if (!current) return res.status(404).json({ error: 'Portafolio no encontrado' });

    let file_name = current.file_name;
    if (req.file) {
      // Borrar archivo anterior si existe
      if (file_name) {
        const oldPath = path.join(__dirname, 'uploads', 'portfolios', file_name);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      file_name = req.file.filename;
    }

    await db.run(
      'UPDATE portfolios SET name = ?, link = ?, file_name = ? WHERE id = ?',
      [name, link || null, file_name, id]
    );
    const updated = await db.get('SELECT * FROM portfolios WHERE id = ?', [id]);
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar portafolio' });
  }
});

app.delete('/api/portfolios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const current = await db.get('SELECT file_name FROM portfolios WHERE id = ?', [id]);
    if (current && current.file_name) {
      const filePath = path.join(__dirname, 'uploads', 'portfolios', current.file_name);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    await db.run('DELETE FROM portfolios WHERE id = ?', [id]);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar portafolio' });
  }
});

// Servir el frontend (para cualquier otra ruta)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Iniciar servidor
await initDb();
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
