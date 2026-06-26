import { Router } from 'express';
import { query, getClient } from '../db.js';
import bcrypt from 'bcryptjs';

const router = Router();

// Helper para verificar el PIN administrativo (soporta bcrypt y texto plano)
export function verificarPin(inputPin, correctPin) {
  const cleanInput = String(inputPin || '').trim();
  const cleanCorrect = String(correctPin || '1234').trim();

  // Si el PIN guardado parece ser un hash de bcrypt, comparamos usando bcrypt
  if (cleanCorrect.startsWith('$2a$') || cleanCorrect.startsWith('$2b$') || cleanCorrect.startsWith('$2y$')) {
    try {
      return bcrypt.compareSync(cleanInput, cleanCorrect);
    } catch (err) {
      console.error('[PIN] Error al verificar hash bcrypt:', err.message);
      return false;
    }
  }

  // De lo contrario, fallback a comparación directa en texto plano
  return cleanInput === cleanCorrect;
}

// Middleware para validar que se provea el PIN correcto de administración
export function requiereAdmin(req, res, next) {
  const pinHeader = req.headers['x-admin-pin'];
  const correctPin = process.env.ADMIN_PIN || '1234';
  if (!verificarPin(pinHeader, correctPin)) {
    return res.status(401).json({ error: 'Acceso no autorizado. PIN incorrecto.' });
  }
  next();
}

// POST /api/cobros/verificar-pin
router.post('/verificar-pin', (req, res) => {
  const { pin } = req.body;
  const correctPin = process.env.ADMIN_PIN || '1234';
  if (verificarPin(pin, correctPin)) {
    return res.json({ valido: true });
  }
  res.status(401).json({ error: 'PIN de administración incorrecto.' });
});

async function getNextComprobanteNumero(client, tipo) {
  let prefix = '';
  if (tipo === 'Factura') prefix = 'F001-';
  else if (tipo === 'Boleta') prefix = 'B001-';
  else if (tipo === 'Recibo Interno') prefix = 'RI-';
  else prefix = 'NV-'; // fallback Nota de Venta

  // We search for both comprobante_numero and comprobante2_numero to get the absolute maximum sequence number
  const res = await client.query(
    `SELECT comprobante_numero AS num FROM cobros WHERE tipo_comprobante = $1 AND comprobante_numero LIKE $2
     UNION
     SELECT comprobante2_numero AS num FROM cobros WHERE comprobante2 = $1 AND comprobante2_numero LIKE $2
     ORDER BY num DESC LIMIT 1`,
    [tipo, prefix + '%']
  );

  let nextSeq = 1;
  if (res.rows.length > 0) {
    const lastNum = res.rows[0].num;
    const match = lastNum.match(/\d+$/);
    if (match) {
      nextSeq = parseInt(match[0], 10) + 1;
    }
  }
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// GET /api/cobros
router.get('/', requiereAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT co.*, c.nombre AS cliente_nombre, c.tipo_doc, c.num_doc, c.telefono AS cliente_telefono,
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
router.get('/stats', requiereAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        COALESCE(SUM(monto_total) FILTER (WHERE estado = 'Pendiente'), 0) AS por_cobrar,
        COALESCE(SUM(COALESCE(monto_neto, monto_total)) FILTER (WHERE estado IN ('Cancelado', 'Dividido')), 0) AS ingresos
      FROM cobros
      WHERE DATE_TRUNC('month', fecha_emision) = DATE_TRUNC('month', CURRENT_DATE)
    `);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/cobros/:id/cobrar  (registrar pago - cobro simple)
router.patch('/:id/cobrar', requiereAdmin, async (req, res) => {
  const { metodo_pago, tipo_comprobante, descuento_tipo, descuento_valor, descuento_realizado, monto_neto } = req.body;
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Generate next correlative number
    const comprobante_numero = await getNextComprobanteNumero(client, tipo_comprobante);

    const result = await client.query(
      `UPDATE cobros
       SET estado='Cancelado', 
           metodo_pago=$1, 
           tipo_comprobante=$2, 
           comprobante_numero=$3,
           descuento_tipo=$4,
           descuento_valor=$5,
           descuento_realizado=$6,
           monto_neto=$7,
           fecha_cobro=CURRENT_DATE
       WHERE id=$8 RETURNING *`,
      [
        metodo_pago,
        tipo_comprobante,
        comprobante_numero,
        descuento_tipo || null,
        descuento_valor ? parseFloat(descuento_valor) : 0.00,
        descuento_realizado ? parseFloat(descuento_realizado) : 0.00,
        monto_neto ? parseFloat(monto_neto) : null,
        req.params.id
      ]
    );
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(404).json({ error: 'Cobro no encontrado' });
    }

    // Auto-pasar la orden de servicio a estado 'Entregado' para que salga del Kanban
    const cobro = result.rows[0];
    if (cobro.orden_id) {
      try {
        await client.query(
          `UPDATE ordenes_servicio SET estado='Entregado' WHERE id=$1 AND estado NOT IN ('Entregado')`,
          [cobro.orden_id]
        );
      } catch (orderErr) {
        console.error("[cobros] Error actualizando orden de servicio a Entregado:", orderErr.message);
      }
    }

    await client.query("COMMIT");
    res.json(cobro);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/cobros/:id/dividir  (pago dividido - requerimiento AÑADIR.txt)
router.patch('/:id/dividir', requiereAdmin, async (req, res) => {
  const {
    metodo_pago, tipo_comprobante,
    pagador2_nombre, pagador2_doc,
    monto_pagador1, monto_pagador2, comprobante2,
    descuento_tipo, descuento_valor, descuento_realizado, monto_neto
  } = req.body;
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Generate next correlative numbers
    const comprobante_numero = await getNextComprobanteNumero(client, tipo_comprobante);
    const comprobante2_numero = await getNextComprobanteNumero(client, comprobante2);

    const result = await client.query(
      `UPDATE cobros
       SET estado='Dividido', 
           metodo_pago=$1, 
           tipo_comprobante=$2,
           comprobante_numero=$3,
           es_dividido=TRUE,
           pagador2_nombre=$4, 
           pagador2_doc=$5,
           monto_pagador1=$6, 
           monto_pagador2=$7, 
           comprobante2=$8,
           comprobante2_numero=$9,
           descuento_tipo=$10,
           descuento_valor=$11,
           descuento_realizado=$12,
           monto_neto=$13,
           fecha_cobro=CURRENT_DATE
       WHERE id=$14 RETURNING *`,
      [
        metodo_pago,
        tipo_comprobante,
        comprobante_numero,
        pagador2_nombre,
        pagador2_doc,
        monto_pagador1 ? parseFloat(monto_pagador1) : 0.00,
        monto_pagador2 ? parseFloat(monto_pagador2) : 0.00,
        comprobante2,
        comprobante2_numero,
        descuento_tipo || null,
        descuento_valor ? parseFloat(descuento_valor) : 0.00,
        descuento_realizado ? parseFloat(descuento_realizado) : 0.00,
        monto_neto ? parseFloat(monto_neto) : null,
        req.params.id
      ]
    );
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(404).json({ error: 'Cobro no encontrado' });
    }

    // Auto-pasar la orden de servicio a estado 'Entregado' para que salga del Kanban
    const cobro = result.rows[0];
    if (cobro.orden_id) {
      try {
        await client.query(
          `UPDATE ordenes_servicio SET estado='Entregado' WHERE id=$1 AND estado NOT IN ('Entregado')`,
          [cobro.orden_id]
        );
      } catch (orderErr) {
        console.error("[cobros] Error actualizando orden de servicio a Entregado:", orderErr.message);
      }
    }

    await client.query("COMMIT");
    res.json(cobro);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
