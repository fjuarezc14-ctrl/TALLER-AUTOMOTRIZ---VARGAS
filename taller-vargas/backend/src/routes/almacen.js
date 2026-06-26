import { Router } from 'express';
import { query, getClient } from '../db.js';
import { requiereAdmin } from './cobros.js';

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
router.post('/', requiereAdmin, async (req, res) => {
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
router.put('/:id', requiereAdmin, async (req, res) => {
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
router.patch('/:id/stock', requiereAdmin, async (req, res) => {
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
router.delete('/:id', requiereAdmin, async (req, res) => {
  try {
    await query('DELETE FROM almacen WHERE id=$1', [req.params.id]);
    res.json({ message: 'Producto eliminado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Solicitudes de mecánicos ───────────────────────────────

// POST /api/almacen/solicitudes  (mecánico solicita repuestos)
router.post('/solicitudes', async (req, res) => {
  const { mecanico_id, orden_id, repuesto_id, cantidad, fecha_entrega, confirmado } = req.body;
  const isConfirmado = confirmado === undefined ? false : !!confirmado;

  try {
    // Verificar stock suficiente
    const stockRes = await query('SELECT stock FROM almacen WHERE id=$1', [repuesto_id]);
    if (!stockRes.rows.length) return res.status(404).json({ error: 'Repuesto no encontrado' });
    if (stockRes.rows[0].stock < cantidad) {
      return res.status(400).json({ error: `Stock insuficiente. Disponible: ${stockRes.rows[0].stock}` });
    }

    // Crear solicitud y descontar stock si está confirmado
    const result = await query(
      `INSERT INTO solicitudes_mecanico (mecanico_id, orden_id, repuesto_id, cantidad, fecha_entrega, confirmado)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [mecanico_id, orden_id || null, repuesto_id, cantidad, fecha_entrega || null, isConfirmado]
    );

    if (isConfirmado) {
      // Descontar stock directamente (confirmado=TRUE desde el inicio)
      await query('UPDATE almacen SET stock = stock - $1 WHERE id=$2', [cantidad, repuesto_id]);
    }

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

// PATCH /api/almacen/solicitudes/:id/confirmar
router.patch('/solicitudes/:id/confirmar', requiereAdmin, async (req, res) => {
  const { id } = req.params;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    // Obtener la solicitud
    const solRes = await client.query('SELECT * FROM solicitudes_mecanico WHERE id = $1', [id]);
    if (!solRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    const sol = solRes.rows[0];
    if (sol.confirmado) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La solicitud ya ha sido confirmada anteriormente' });
    }

    // Obtener el repuesto del almacén
    const repRes = await client.query('SELECT * FROM almacen WHERE id = $1', [sol.repuesto_id]);
    if (!repRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Repuesto no encontrado en el almacén' });
    }
    const rep = repRes.rows[0];

    // Verificar stock
    if (rep.stock < sol.cantidad) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Stock insuficiente. Disponible: ${rep.stock}, Solicitado: ${sol.cantidad}` });
    }

    // 1. Confirmar la solicitud
    await client.query(
      `UPDATE solicitudes_mecanico 
       SET confirmado = TRUE, fecha_entrega = CURRENT_DATE 
       WHERE id = $1`,
      [id]
    );

    // 2. Descontar stock de almacén
    await client.query(
      `UPDATE almacen 
       SET stock = stock - $1 
       WHERE id = $2`,
      [sol.cantidad, sol.repuesto_id]
    );

    // 3. Agregar repuesto a items_costo de la orden si tiene orden_id
    if (sol.orden_id) {
      await client.query(
        `INSERT INTO items_costo (orden_id, tipo, descripcion, cantidad, precio_unitario, repuesto_cod)
         VALUES ($1, 'almacen', $2, $3, $4, $5)`,
        [sol.orden_id, rep.descripcion, sol.cantidad, rep.precio_venta, rep.codigo]
      );

      // 4. Recalcular total estimado de la orden
      const totRes = await client.query(
        `SELECT COALESCE(SUM(cantidad * precio_unitario), 0) AS t 
         FROM items_costo 
         WHERE orden_id = $1`,
        [sol.orden_id]
      );
      await client.query(
        `UPDATE ordenes_servicio 
         SET total_estimado = $1 
         WHERE id = $2`,
        [parseFloat(totRes.rows[0].t), sol.orden_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Solicitud confirmada exitosamente', solicitud_id: id });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/almacen/solicitudes/:id
router.delete('/solicitudes/:id', requiereAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const solRes = await query('SELECT * FROM solicitudes_mecanico WHERE id = $1', [id]);
    if (!solRes.rows.length) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    const sol = solRes.rows[0];
    if (sol.confirmado) {
      return res.status(400).json({ error: 'No se puede eliminar una solicitud ya confirmada.' });
    }
    await query('DELETE FROM solicitudes_mecanico WHERE id = $1', [id]);
    res.json({ message: 'Solicitud eliminada/cancelada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
