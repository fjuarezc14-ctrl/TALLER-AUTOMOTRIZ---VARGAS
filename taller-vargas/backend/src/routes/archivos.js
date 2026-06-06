import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// GET /api/archivos
router.get('/', async (_req, res) => {
  try {
    const result = await query('SELECT * FROM archivos ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/archivos
router.post('/', async (req, res) => {
  const { titulo, filename, tipo, size_mb, area, subido_por } = req.body;
  try {
    const result = await query(
      `INSERT INTO archivos (titulo, filename, tipo, size_mb, area, subido_por)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [titulo, filename, tipo, size_mb || 0, area, subido_por || 'Admin']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/archivos/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM archivos WHERE id=$1', [req.params.id]);
    res.json({ message: 'Archivo eliminado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
