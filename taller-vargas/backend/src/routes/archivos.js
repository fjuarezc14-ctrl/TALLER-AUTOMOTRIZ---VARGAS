import { Router } from 'express';
import { query } from '../db.js';
import fs from 'fs/promises';
import path from 'path';

import { requiereToken, soloAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requiereToken);

// Migración inline: asegurar columnas cliente_id y vehiculo_id en archivos
(async () => {
  try {
    await query(`ALTER TABLE archivos ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL`);
    await query(`ALTER TABLE archivos ADD COLUMN IF NOT EXISTS vehiculo_id INTEGER REFERENCES vehiculos(id) ON DELETE SET NULL`);
    await query(`ALTER TABLE archivos ADD COLUMN IF NOT EXISTS fecha_inicio DATE`);
    await query(`ALTER TABLE archivos ADD COLUMN IF NOT EXISTS notas TEXT`);
  } catch (e) {
    console.warn('[archivos] Migración inline:', e.message);
  }
})();

// GET /api/archivos
router.get('/', async (_req, res) => {
  try {
    const result = await query(`
      SELECT a.*,
        c.nombre  AS cliente_nombre,
        v.placa   AS vehiculo_placa,
        v.marca_modelo AS vehiculo_modelo
      FROM archivos a
      LEFT JOIN clientes  c ON a.cliente_id  = c.id
      LEFT JOIN vehiculos v ON a.vehiculo_id = v.id
      ORDER BY a.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Extensiones permitidas de uso común en taller
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.pdf', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx'];

// POST /api/archivos
router.post('/', async (req, res) => {
  const { titulo, filename, tipo, size_mb, area, subido_por, cliente_id, vehiculo_id, notas, fileData } = req.body;
  try {
    // Validar nombre de archivo y extensión
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Nombre de archivo inválido.' });
    }

    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({
        error: `Formato de archivo no permitido. Solo se permiten imágenes, PDFs y documentos de oficina (${ALLOWED_EXTENSIONS.join(', ')}).`
      });
    }

    let finalSizeMb = size_mb || 0;

    // Si viene fileData (base64), decodificarlo y guardarlo en el disco
    if (fileData) {
      const buffer = Buffer.from(fileData, 'base64');
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB
      
      if (buffer.length > maxSizeBytes) {
        return res.status(400).json({ error: 'El archivo excede el tamaño máximo permitido de 10MB.' });
      }

      finalSizeMb = parseFloat((buffer.length / (1024 * 1024)).toFixed(2));
      
      const uploadsDir = path.join(process.cwd(), 'uploads');
      
      // Crear la carpeta si no existe
      await fs.mkdir(uploadsDir, { recursive: true });
      
      const filePath = path.join(uploadsDir, filename);
      await fs.writeFile(filePath, buffer);
    }

    const result = await query(
      `INSERT INTO archivos (titulo, filename, tipo, size_mb, area, subido_por, cliente_id, vehiculo_id, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [titulo, filename, tipo, finalSizeMb, area, subido_por || 'Administrador',
       cliente_id || null, vehiculo_id || null, notas || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[archivos] Error al subir archivo:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/archivos/:id
router.delete('/:id', soloAdmin, async (req, res) => {
  try {
    // Primero buscar el nombre del archivo para borrarlo del disco
    const fileResult = await query('SELECT filename FROM archivos WHERE id=$1', [req.params.id]);
    if (fileResult.rows.length > 0) {
      const filename = fileResult.rows[0].filename;
      const filePath = path.join(process.cwd(), 'uploads', filename);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        // Ignorar si el archivo no existe en el disco
        console.warn(`[archivos] El archivo ${filename} no existía físicamente en disco.`, err.message);
      }
    }

    await query('DELETE FROM archivos WHERE id=$1', [req.params.id]);
    res.json({ message: 'Archivo eliminado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
