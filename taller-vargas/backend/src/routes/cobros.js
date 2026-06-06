import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// GET /api/cobros
router.get('/', async (_req, res) => {
  try {
    const result = await query(`
      SELECT co.*, c.nombre AS cliente_nombre, c.tipo_doc, c.num_doc,
             os.id AS orden_numero, v.placa
      FROM cobros co
      LEFT JOIN clientes c ON co.cliente_id = c.id
      LEFT JOIN ordenes_servicio os ON co.orden_id = os.id
      LEFT JOIN vehiculos v ON os.vehiculo_id = v.id
      ORDER BY co.fecha_emision DESC, co.id DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/cobros/stats
router.get('/stats', async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        COALESCE(SUM(monto_total) FILTER (WHERE estado = 'Pendiente'), 0) AS por_cobrar,
        COALESCE(SUM(monto_total) FILTER (WHERE estado = 'Cancelado'), 0) AS ingresos
      FROM cobros
      WHERE DATE_TRUNC('month', fecha_emision) = DATE_TRUNC('month', CURRENT_DATE)
    `);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/cobros/:id/cobrar  (registrar pago - cobro simple)
router.patch('/:id/cobrar', async (req, res) => {
  const { metodo_pago, tipo_comprobante } = req.body;
  try {
    const result = await query(
      `UPDATE cobros
       SET estado='Cancelado', metodo_pago=$1, tipo_comprobante=$2, fecha_cobro=CURRENT_DATE
       WHERE id=$3 RETURNING *`,
      [metodo_pago, tipo_comprobante, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Cobro no encontrado' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/cobros/:id/dividir  (pago dividido - requerimiento AÑADIR.txt)
router.patch('/:id/dividir', async (req, res) => {
  const {
    metodo_pago, tipo_comprobante,
    pagador2_nombre, pagador2_doc,
    monto_pagador1, monto_pagador2, comprobante2
  } = req.body;
  try {
    const result = await query(
      `UPDATE cobros
       SET estado='Dividido', metodo_pago=$1, tipo_comprobante=$2,
           es_dividido=TRUE,
           pagador2_nombre=$3, pagador2_doc=$4,
           monto_pagador1=$5, monto_pagador2=$6, comprobante2=$7,
           fecha_cobro=CURRENT_DATE
       WHERE id=$8 RETURNING *`,
      [metodo_pago, tipo_comprobante,
       pagador2_nombre, pagador2_doc,
       monto_pagador1, monto_pagador2, comprobante2,
       req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Cobro no encontrado' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
