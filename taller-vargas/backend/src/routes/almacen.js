import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// GET /api/almacen
router.get('/', async (_req, res) => {
  try {
    const result = await query(`
      SELECT *, (stock <= stock_min) AS alerta_stock
      FROM almacen ORDER BY categoria, descripcion
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/almacen/alertas
router.get('/alertas', async (_req, res) => {
  try {
    const result = await query('SELECT * FROM v_alertas_stock');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/almacen/mecanico  (vista sin precios)
router.get('/mecanico', async (_req, res) => {
  try {
    const result = await query(`
      SELECT id, codigo, descripcion, categoria, stock, stock_min
      FROM almacen 
      WHERE stock > 0
      ORDER BY categoria, descripcion
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/almacen
router.post('/', async (req, res) => {
  const { codigo, descripcion, categoria, stock, stock_min, costo, precio_venta } = req.body;
  try {
    const result = await query(
      `INSERT INTO almacen (codigo, descripcion, categoria, stock, stock_min, costo, precio_venta)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [codigo.toUpperCase(), descripcion, categoria, stock, stock_min, costo, precio_venta]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un producto con ese código.' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/almacen/:id
router.put('/:id', async (req, res) => {
  const { codigo, descripcion, categoria, stock, stock_min, costo, precio_venta } = req.body;
  try {
    const result = await query(
      `UPDATE almacen SET codigo=$1, descripcion=$2, categoria=$3, stock=$4,
       stock_min=$5, costo=$6, precio_venta=$7 WHERE id=$8 RETURNING *`,
      [codigo.toUpperCase(), descripcion, categoria, stock, stock_min, costo, precio_venta, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/almacen/:id/stock  (ajuste rápido de stock)
router.patch('/:id/stock', async (req, res) => {
  const { operacion, cantidad } = req.body; // operacion: 'sumar' | 'restar'
  try {
    const op = operacion === 'sumar' ? '+' : '-';
    const result = await query(
      `UPDATE almacen SET stock = stock ${op} $1 WHERE id=$2 RETURNING *`,
      [Math.abs(cantidad), req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    if (result.rows[0].stock < 0) {
      await query('UPDATE almacen SET stock = 0 WHERE id=$1', [req.params.id]);
      return res.status(400).json({ error: 'No hay suficiente stock para realizar el retiro.' });
    }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/almacen/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM almacen WHERE id=$1', [req.params.id]);
    res.json({ message: 'Producto eliminado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Solicitudes de mecánicos ───────────────────────────────

// POST /api/almacen/solicitudes  (mecánico solicita repuestos)
router.post('/solicitudes', async (req, res) => {
  const { mecanico_id, orden_id, repuesto_id, cantidad, fecha_entrega } = req.body;
  try {
    // Verificar stock suficiente
    const stockRes = await query('SELECT stock FROM almacen WHERE id=$1', [repuesto_id]);
    if (!stockRes.rows.length) return res.status(404).json({ error: 'Repuesto no encontrado' });
    if (stockRes.rows[0].stock < cantidad) {
      return res.status(400).json({ error: `Stock insuficiente. Disponible: ${stockRes.rows[0].stock}` });
    }

    // Crear solicitud y descontar stock en una transacción
    const result = await query(
      `INSERT INTO solicitudes_mecanico (mecanico_id, orden_id, repuesto_id, cantidad, fecha_entrega, confirmado)
       VALUES ($1,$2,$3,$4,$5, TRUE) RETURNING *`,
      [mecanico_id, orden_id || null, repuesto_id, cantidad, fecha_entrega]
    );

    // Descontar stock directamente (confirmado=TRUE desde el inicio)
    await query('UPDATE almacen SET stock = stock - $1 WHERE id=$2', [cantidad, repuesto_id]);

    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/almacen/solicitudes
router.get('/solicitudes', async (_req, res) => {
  try {
    const result = await query(`
      SELECT sm.*, m.nombre AS mecanico_nombre, a.descripcion AS repuesto_desc,
             a.codigo AS repuesto_cod, os.id AS orden_numero
      FROM solicitudes_mecanico sm
      JOIN mecanicos m ON sm.mecanico_id = m.id
      JOIN almacen a ON sm.repuesto_id = a.id
      LEFT JOIN ordenes_servicio os ON sm.orden_id = os.id
      ORDER BY sm.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
