import { Router } from 'express';
import { query, getClient } from '../db.js';
import { requiereToken, soloAdmin } from '../middleware/auth.js';

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

// GET /api/almacen/proveedores (lista de nombres de proveedores registrados para autocompletado)
router.get('/proveedores', requiereToken, async (_req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT proveedor 
      FROM movimientos_almacen 
      WHERE proveedor IS NOT NULL AND TRIM(proveedor) != '' 
      ORDER BY proveedor ASC
    `);
    res.json(result.rows.map(r => r.proveedor));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/almacen
router.post('/', requiereToken, soloAdmin, async (req, res) => {
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
router.put('/:id', requiereToken, soloAdmin, async (req, res) => {
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

// GET /api/almacen/:id/kardex (historial de movimientos de un repuesto)
router.get('/:id/kardex', requiereToken, soloAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT m.*, 
             mec.nombre AS mecanico_nombre,
             v.placa, v.marca_modelo AS vehiculo,
             u.username AS usuario_nombre
      FROM movimientos_almacen m
      LEFT JOIN mecanicos mec ON m.mecanico_id = mec.id
      LEFT JOIN ordenes_servicio os ON m.orden_id = os.id
      LEFT JOIN vehiculos v ON os.vehiculo_id = v.id
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      WHERE m.repuesto_id = $1
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT 100
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/almacen/:id/stock  (ajuste rápido de stock con registro en Kardex)
router.patch('/:id/stock', requiereToken, soloAdmin, async (req, res) => {
  const { operacion, cantidad, proveedor, costo_unitario, motivo, mecanico_id, orden_id } = req.body;
  const qty = Math.abs(parseInt(cantidad, 10) || 0);
  if (qty <= 0) return res.status(400).json({ error: 'Cantidad debe ser un número entero mayor a 0.' });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const prodRes = await client.query('SELECT * FROM almacen WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!prodRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    const prod = prodRes.rows[0];
    const stockAnterior = parseInt(prod.stock, 10) || 0;
    let stockNuevo = stockAnterior;

    if (operacion === 'sumar') {
      stockNuevo = stockAnterior + qty;
      const nuevoCosto = (costo_unitario !== undefined && costo_unitario !== null && costo_unitario !== '') 
        ? Math.max(0, parseFloat(costo_unitario) || 0) 
        : null;

      if (nuevoCosto !== null && nuevoCosto > 0) {
        await client.query('UPDATE almacen SET stock=$1, costo=$2 WHERE id=$3', [stockNuevo, nuevoCosto, req.params.id]);
      } else {
        await client.query('UPDATE almacen SET stock=$1 WHERE id=$2', [stockNuevo, req.params.id]);
      }

      await client.query(`
        INSERT INTO movimientos_almacen 
          (repuesto_id, tipo, cantidad, stock_anterior, stock_nuevo, proveedor, costo_unitario, motivo, usuario_id)
        VALUES ($1, 'INGRESO', $2, $3, $4, $5, $6, $7, $8)
      `, [
        req.params.id,
        qty,
        stockAnterior,
        stockNuevo,
        (proveedor && proveedor.trim()) ? proveedor.trim() : null,
        nuevoCosto !== null ? nuevoCosto : prod.costo,
        (motivo && motivo.trim()) ? motivo.trim() : 'Ingreso de stock en almacén',
        req.user?.id || null
      ]);
    } else {
      if (stockAnterior < qty) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `No hay suficiente stock para realizar el retiro. Stock actual: ${stockAnterior}` });
      }
      stockNuevo = stockAnterior - qty;
      await client.query('UPDATE almacen SET stock=$1 WHERE id=$2', [stockNuevo, req.params.id]);

      await client.query(`
        INSERT INTO movimientos_almacen 
          (repuesto_id, tipo, cantidad, stock_anterior, stock_nuevo, mecanico_id, orden_id, motivo, usuario_id)
        VALUES ($1, 'SALIDA', $2, $3, $4, $5, $6, $7, $8)
      `, [
        req.params.id,
        qty,
        stockAnterior,
        stockNuevo,
        mecanico_id ? parseInt(mecanico_id, 10) : null,
        orden_id ? parseInt(orden_id, 10) : null,
        (motivo && motivo.trim()) ? motivo.trim() : 'Retiro manual de stock',
        req.user?.id || null
      ]);
    }

    const updatedRes = await client.query('SELECT *, (stock <= stock_min) AS alerta_stock FROM almacen WHERE id=$1', [req.params.id]);
    await client.query('COMMIT');
    res.json(updatedRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/almacen/:id
router.delete('/:id', requiereToken, soloAdmin, async (req, res) => {
  try {
    await query('DELETE FROM almacen WHERE id=$1', [req.params.id]);
    res.json({ message: 'Producto eliminado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Solicitudes de mecánicos ───────────────────────────────

// POST /api/almacen/solicitudes  (mecánico solicita repuestos)
router.post('/solicitudes', requiereToken, async (req, res) => {
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
      await query(`
        INSERT INTO movimientos_almacen 
          (repuesto_id, tipo, cantidad, stock_anterior, stock_nuevo, mecanico_id, orden_id, motivo, usuario_id)
        VALUES ($1, 'SALIDA', $2, $3, $4, $5, $6, $7, $8)
      `, [
        repuesto_id,
        cantidad,
        stockRes.rows[0].stock,
        stockRes.rows[0].stock - cantidad,
        mecanico_id || null,
        orden_id || null,
        orden_id ? `Retiro directo de taller para OS #${orden_id}` : 'Retiro directo de taller',
        req.user?.id || null
      ]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/almacen/solicitudes
router.get('/solicitudes', requiereToken, async (_req, res) => {
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
router.patch('/solicitudes/:id/confirmar', requiereToken, soloAdmin, async (req, res) => {
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

    // 2b. Registrar en Kardex de movimientos_almacen
    await client.query(`
      INSERT INTO movimientos_almacen 
        (repuesto_id, tipo, cantidad, stock_anterior, stock_nuevo, mecanico_id, orden_id, motivo, usuario_id)
      VALUES ($1, 'SALIDA', $2, $3, $4, $5, $6, $7, $8)
    `, [
      sol.repuesto_id,
      sol.cantidad,
      rep.stock,
      rep.stock - sol.cantidad,
      sol.mecanico_id,
      sol.orden_id || null,
      sol.orden_id ? `Despacho de taller vinculado a OS #${sol.orden_id}` : 'Despacho de taller a mecánico',
      req.user?.id || null
    ]);

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
router.delete('/solicitudes/:id', requiereToken, soloAdmin, async (req, res) => {
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
