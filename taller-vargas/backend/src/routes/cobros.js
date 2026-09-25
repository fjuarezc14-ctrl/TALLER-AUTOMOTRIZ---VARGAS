import { Router } from 'express';
import { query, getClient } from '../db.js';
import { requiereToken, soloAdmin } from '../middleware/auth.js';

const router = Router();

async function getNextComprobanteNumero(client, tipo) {
  let prefix = '';
  if (tipo === 'Factura') prefix = 'F001-';
  else if (tipo === 'Boleta') prefix = 'B001-';
  else if (tipo === 'Recibo Interno') prefix = 'RI-';
  else prefix = 'NV-'; // fallback Nota de Venta

  const res = await client.query(
    `SELECT num FROM (
       SELECT comprobante_numero AS num FROM cobros WHERE tipo_comprobante = $1 AND comprobante_numero LIKE $2
       UNION ALL
       SELECT comprobante2_numero AS num FROM cobros WHERE comprobante2 = $1 AND comprobante2_numero LIKE $2
     ) AS t WHERE num IS NOT NULL`,
    [tipo, prefix + '%']
  );

  let maxSeq = 0;
  for (const row of res.rows) {
    if (row.num) {
      const match = row.num.match(/\d+$/);
      if (match) {
        const val = parseInt(match[0], 10);
        if (val > maxSeq) maxSeq = val;
      }
    }
  }
  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// GET /api/cobros
router.get('/', requiereToken, soloAdmin, async (_req, res) => {
  try {
    // Sincronización automática de respaldo: asegurar que toda orden en 'Finalizado' tenga su cobro
    await query(`
      INSERT INTO cobros (orden_id, cliente_id, monto_total, estado, fecha_emision)
      SELECT os.id, os.cliente_id, COALESCE(os.total_estimado, 0.00), 'Pendiente', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date
      FROM ordenes_servicio os
      WHERE os.estado = 'Finalizado'
        AND os.id NOT IN (SELECT orden_id FROM cobros WHERE orden_id IS NOT NULL)
      ON CONFLICT (orden_id) DO NOTHING
    `);

    // Sincronizar monto_total de cobros pendientes si la orden fue recalculada
    await query(`
      UPDATE cobros c
      SET monto_total = COALESCE(os.total_estimado, 0.00)
      FROM ordenes_servicio os
      WHERE c.orden_id = os.id
        AND c.estado = 'Pendiente'
        AND c.monto_total <> COALESCE(os.total_estimado, 0.00)
    `);

    const result = await query(`
      SELECT co.*, 
             to_char(co.fecha_emision, 'YYYY-MM-DD') AS fecha_emision_str,
             to_char(co.fecha_cobro, 'YYYY-MM-DD') AS fecha_cobro_str,
             COALESCE(c.nombre, co.cliente_nombre_libre, 'Cliente Mostrador') AS cliente_nombre,
             COALESCE(c.tipo_doc, 'DNI') AS tipo_doc,
             COALESCE(c.num_doc, co.cliente_doc_libre, '—') AS num_doc,
             c.telefono AS cliente_telefono,
             os.id AS orden_numero,
             COALESCE(v.placa, 'VENTA DIRECTA') AS placa,
             COALESCE(os.nota_interna, co.concepto) AS nota_interna,
             os.falla_reportada,
             m.nombre AS mecanico_nombre
      FROM cobros co
      LEFT JOIN clientes c ON co.cliente_id = c.id
      LEFT JOIN ordenes_servicio os ON co.orden_id = os.id
      LEFT JOIN vehiculos v ON os.vehiculo_id = v.id
      LEFT JOIN mecanicos m ON os.mecanico_id = m.id
      ORDER BY co.fecha_emision DESC, co.id DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/cobros/venta-rapida (Venta de mostrador directa de repuestos sin orden de servicio)
router.post('/venta-rapida', requiereToken, soloAdmin, async (req, res) => {
  const { items, cliente_nombre, cliente_doc, cliente_id, metodo_pago, tipo_comprobante } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Debes incluir al menos un producto en la venta rápida.' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    let totalVenta = 0;
    const detalleItems = [];
    const nombresProductos = [];

    // 1. Validar y descontar stock de cada ítem, registrando en Kardex
    for (const item of items) {
      const repId = parseInt(item.repuesto_id, 10);
      const qty = parseInt(item.cantidad, 10) || 0;
      if (!repId || qty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Todos los productos deben tener cantidad válida mayor a 0.' });
      }

      const prodRes = await client.query('SELECT * FROM almacen WHERE id = $1 FOR UPDATE', [repId]);
      if (!prodRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Producto ID ${repId} no encontrado en almacén.` });
      }
      const prod = prodRes.rows[0];

      if (prod.stock < qty) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Stock insuficiente para "${prod.descripcion}". Disponible: ${prod.stock}, Solicitado: ${qty}` 
        });
      }

      const precioUnit = parseFloat(item.precio_unitario) || parseFloat(prod.precio_venta) || 0;
      const subtotal = qty * precioUnit;
      totalVenta += subtotal;

      // Descontar inventario
      const stockAnterior = prod.stock;
      const stockNuevo = prod.stock - qty;
      await client.query('UPDATE almacen SET stock = $1 WHERE id = $2', [stockNuevo, repId]);

      // Registrar salida en Kardex (movimientos_almacen)
      const cliNom = (cliente_nombre && cliente_nombre.trim()) ? cliente_nombre.trim() : 'Cliente Mostrador';
      await client.query(`
        INSERT INTO movimientos_almacen 
          (repuesto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id)
        VALUES ($1, 'SALIDA', $2, $3, $4, $5, $6)
      `, [
        repId,
        qty,
        stockAnterior,
        stockNuevo,
        `Venta Rápida: ${cliNom}`,
        req.user?.id || null
      ]);

      detalleItems.push({
        id: repId,
        repuesto_id: repId,
        repuesto_cod: prod.codigo,
        codigo: prod.codigo,
        descripcion: prod.descripcion,
        tipo: 'almacen',
        cantidad: qty,
        precio_unitario: precioUnit,
        subtotal: subtotal
      });
      nombresProductos.push(`${qty}x ${prod.descripcion}`);
    }

    // 2. Generar correlativo de comprobante
    const tipoComp = tipo_comprobante || 'Recibo Interno';
    const compNumero = await getNextComprobanteNumero(client, tipoComp);

    // 3. Crear registro de cobro pagado inmediatamente (Cancelado)
    const concepto = `Venta Rápida: ${nombresProductos.slice(0, 3).join(', ')}${nombresProductos.length > 3 ? '...' : ''}`;
    const cliNombreFinal = (cliente_nombre && cliente_nombre.trim()) ? cliente_nombre.trim() : 'Cliente Mostrador';
    const cliDocFinal = (cliente_doc && cliente_doc.trim()) ? cliente_doc.trim() : null;
    const metodoPagoFinal = metodo_pago || 'Efectivo';

    const insertCobroRes = await client.query(`
      INSERT INTO cobros (
        orden_id, cliente_id, monto_total, monto_neto, estado,
        metodo_pago, tipo_comprobante, comprobante_numero,
        fecha_emision, fecha_cobro, concepto,
        cliente_nombre_libre, cliente_doc_libre, detalle_items
      ) VALUES (
        NULL, $1, $2, $2, 'Cancelado',
        $3, $4, $5,
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date,
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date,
        $6, $7, $8, $9
      ) RETURNING *
    `, [
      cliente_id || null,
      totalVenta,
      metodoPagoFinal,
      tipoComp,
      compNumero,
      concepto,
      cliNombreFinal,
      cliDocFinal,
      JSON.stringify(detalleItems)
    ]);

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Venta rápida registrada y cobrada exitosamente',
      cobro: {
        ...insertCobroRes.rows[0],
        cliente_nombre: cliNombreFinal,
        placa: 'VENTA DIRECTA',
        detalle_items: detalleItems
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/cobros/exportar
router.get('/exportar', requiereToken, soloAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT co.*, 
             COALESCE(c.nombre, co.cliente_nombre_libre, 'Cliente Mostrador') AS cliente_nombre,
             COALESCE(c.tipo_doc, 'DNI') AS tipo_doc,
             COALESCE(c.num_doc, co.cliente_doc_libre, '—') AS num_doc,
             os.id AS orden_numero,
             COALESCE(v.placa, 'VENTA DIRECTA') AS placa
      FROM cobros co
      LEFT JOIN clientes c ON co.cliente_id = c.id
      LEFT JOIN ordenes_servicio os ON co.orden_id = os.id
      LEFT JOIN vehiculos v ON os.vehiculo_id = v.id
      ORDER BY co.fecha_emision DESC, co.id DESC
    `);
    
    const headers = [
      'ID Cobro', 'ID Orden', 'Cliente', 'Tipo Doc', 'Num Doc', 'Placa',
      'Comprobante 1', 'Num Comprobante 1', 'Comprobante 2', 'Num Comprobante 2',
      'Monto Total', 'Descuento Tipo', 'Descuento Valor', 'Descuento Realizado',
      'Monto Neto', 'Metodo Pago', 'Estado', 'Fecha Emision', 'Fecha Cobro'
    ];
    
    let csvContent = '\uFEFF' + headers.join(',') + '\n';
    
    for (const row of result.rows) {
      const line = [
        row.id,
        row.orden_id,
        `"${String(row.cliente_nombre || '').replace(/"/g, '""')}"`,
        row.tipo_doc || '',
        row.num_doc || '',
        row.placa || '',
        row.tipo_comprobante || '',
        row.comprobante_numero || '',
        row.comprobante2 || '',
        row.comprobante2_numero || '',
        row.monto_total || '0.00',
        row.descuento_tipo || 'Ninguno',
        row.descuento_valor || '0.00',
        row.descuento_realizado || '0.00',
        row.monto_neto || row.monto_total || '0.00',
        row.metodo_pago || '',
        row.estado || '',
        row.fecha_emision ? new Date(row.fecha_emision).toISOString().slice(0, 10) : '',
        row.fecha_cobro ? new Date(row.fecha_cobro).toISOString().slice(0, 10) : ''
      ];
      csvContent += line.join(',') + '\n';
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte_cobros.csv');
    res.send(csvContent);
  } catch (err) {
    console.error('[cobros] Error al exportar CSV:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cobros/stats
router.get('/stats', requiereToken, soloAdmin, async (_req, res) => {
  try {
    await query(`
      INSERT INTO cobros (orden_id, cliente_id, monto_total, estado, fecha_emision)
      SELECT os.id, os.cliente_id, COALESCE(os.total_estimado, 0.00), 'Pendiente', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date
      FROM ordenes_servicio os
      WHERE os.estado = 'Finalizado'
        AND os.id NOT IN (SELECT orden_id FROM cobros WHERE orden_id IS NOT NULL)
      ON CONFLICT (orden_id) DO NOTHING
    `);

    await query(`
      UPDATE cobros c
      SET monto_total = COALESCE(os.total_estimado, 0.00)
      FROM ordenes_servicio os
      WHERE c.orden_id = os.id
        AND c.estado = 'Pendiente'
        AND c.monto_total <> COALESCE(os.total_estimado, 0.00)
    `);

    const result = await query(`
      SELECT
        COALESCE(SUM(monto_total) FILTER (WHERE estado = 'Pendiente'), 0) AS por_cobrar,
        COALESCE(SUM(COALESCE(monto_neto, monto_total)) FILTER (WHERE estado IN ('Cancelado', 'Dividido')), 0) AS ingresos
      FROM cobros
      WHERE DATE_TRUNC('month', fecha_emision) = DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date)
    `);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// PATCH /api/cobros/:id/cobrar  (registrar pago - cobro simple)
router.patch('/:id/cobrar', requiereToken, soloAdmin, async (req, res) => {
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
           fecha_cobro=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date,
           updated_at=NOW()
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

    // Auto-pasar la orden de servicio a estado 'Entregado' para que salga del Kanban y registrar fecha de entrega real
    const cobro = result.rows[0];
    if (cobro.orden_id) {
      try {
        await client.query(
          `UPDATE ordenes_servicio SET estado='Entregado', fecha_entrega=NOW() WHERE id=$1 AND estado NOT IN ('Entregado')`,
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
router.patch('/:id/dividir', requiereToken, soloAdmin, async (req, res) => {
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
           fecha_cobro=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date,
           updated_at=NOW()
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

    // Auto-pasar la orden de servicio a estado 'Entregado' para que salga del Kanban y registrar fecha de entrega real
    const cobro = result.rows[0];
    if (cobro.orden_id) {
      try {
        await client.query(
          `UPDATE ordenes_servicio SET estado='Entregado', fecha_entrega=NOW() WHERE id=$1 AND estado NOT IN ('Entregado')`,
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
