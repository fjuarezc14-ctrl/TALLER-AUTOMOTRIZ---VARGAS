import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

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

// POST /api/archivos
router.post('/', async (req, res) => {
  const { titulo, filename, tipo, size_mb, area, subido_por, cliente_id, vehiculo_id, notas } = req.body;
  try {
    const result = await query(
      `INSERT INTO archivos (titulo, filename, tipo, size_mb, area, subido_por, cliente_id, vehiculo_id, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [titulo, filename, tipo, size_mb || 0, area, subido_por || 'Administrador',
       cliente_id || null, vehiculo_id || null, notas || null]
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
