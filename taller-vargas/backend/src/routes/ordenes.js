import { Router } from "express";
import { query, getClient } from "../db.js";
import { requiereToken } from "../middleware/auth.js";
const router = Router();

// ── Rutas públicas para clientes (no requieren token) ─────

// GET /ordenes/:id/publica — consulta pública y segura de la orden para el cliente
router.get("/:id/publica", async (req, res) => {
  try {
    const [ord, items] = await Promise.all([
      query(`
        SELECT id, estado, kilometraje, total_estimado, created_at,
               placa, vehiculo, cliente, cliente_telefono, num_doc
        FROM v_ordenes_completas
        WHERE id=$1`, [req.params.id]),
      query("SELECT * FROM v_items_por_orden WHERE orden_id=$1 ORDER BY id", [req.params.id])
    ]);
    if (!ord.rows.length) return res.status(404).json({ error: "Orden no encontrada" });
    res.json({ ...ord.rows[0], items: items.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /ordenes/:id/confirmar — aprobación digital del cliente para iniciar trabajos
router.post("/:id/confirmar", async (req, res) => {
  try {
    const r = await query(
      `UPDATE ordenes_servicio
       SET estado='En Proceso'
       WHERE id=$1 AND estado='Diagnostico'
       RETURNING *`,
      [req.params.id]
    );
    if (!r.rows.length) {
      const check = await query("SELECT estado FROM ordenes_servicio WHERE id=$1", [req.params.id]);
      if (!check.rows.length) return res.status(404).json({ error: "Orden no encontrada" });
      return res.status(400).json({ 
        error: `La orden ya se encuentra en estado: ${check.rows[0].estado}.` 
      });
    }
    res.json({ message: "Orden confirmada correctamente", orden: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── A partir de aquí todas las rutas requieren token de autenticación ──
router.use(requiereToken);

router.get("/", async (_req, res) => {
  try { res.json((await query("SELECT * FROM v_ordenes_completas ORDER BY id DESC")).rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/proceso", async (_req, res) => {
  try { res.json((await query("SELECT * FROM v_ordenes_completas WHERE estado IN ($1,$2) ORDER BY id DESC", ["En Proceso","Esperando Repuestos"])).rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/:id", async (req, res) => {
  try {
    const [ord, items] = await Promise.all([
      query("SELECT * FROM v_ordenes_completas WHERE id=$1", [req.params.id]),
      query("SELECT * FROM v_items_por_orden WHERE orden_id=$1 ORDER BY id", [req.params.id])
    ]);
    if (!ord.rows.length) return res.status(404).json({ error: "Orden no encontrada" });
    res.json({ ...ord.rows[0], items: items.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req, res) => {
  const { vehiculo_id, cliente_id, mecanico_id, kilometraje, nivel_combustible, falla_reportada, diagnostico, fecha_ingreso, conductor_nombre, conductor_doc, conductor_telefono, es_garantia, garantia_motivo, mecanico_negligente_id } = req.body;
  try {
    const r = await query("INSERT INTO ordenes_servicio (vehiculo_id,cliente_id,mecanico_id,kilometraje,nivel_combustible,falla_reportada,estado,diagnostico,fecha_ingreso,conductor_nombre,conductor_doc,conductor_telefono,es_garantia,garantia_motivo,mecanico_negligente_id) VALUES ($1,$2,$3,$4,$5,$6,'Diagnostico',$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *",
      [vehiculo_id,cliente_id,mecanico_id||null,kilometraje,nivel_combustible,falla_reportada||"",diagnostico ? JSON.stringify(diagnostico) : null, fecha_ingreso || new Date(), conductor_nombre||null, conductor_doc||null, conductor_telefono||null, es_garantia||false, garantia_motivo||null, mecanico_negligente_id||null]);
    
    let kmVal = null;
    if (kilometraje) {
      const cleanKm = String(kilometraje).replace(/[^0-9]/g, '');
      if (cleanKm) kmVal = parseInt(cleanKm);
    }
    if (kmVal && kmVal > 0) {
      await query("UPDATE vehiculos SET km_actual=$1, ultima_visita=CURRENT_DATE WHERE id=$2", [kmVal, vehiculo_id]);
    } else {
      await query("UPDATE vehiculos SET ultima_visita=CURRENT_DATE WHERE id=$1", [vehiculo_id]);
    }
    
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id", async (req, res) => {
  const { vehiculo_id,cliente_id,mecanico_id,kilometraje,nivel_combustible,falla_reportada,estado,repuestos_esperando,fecha_entrega,nota_interna,fecha_ingreso,
    conductor_nombre, conductor_doc, conductor_telefono, es_garantia, garantia_motivo, mecanico_negligente_id } = req.body;
  const client = await getClient();
  try {
    await client.query("BEGIN");
    if (estado === "Entregado") {
      const cobroCheck = await client.query("SELECT estado FROM cobros WHERE orden_id = $1", [req.params.id]);
      if (cobroCheck.rows.length > 0 && cobroCheck.rows[0].estado === "Pendiente") {
        await client.query("ROLLBACK");
        client.release();
        return res.status(400).json({ error: "No se puede marcar como Entregado porque tiene un cobro pendiente en Facturación." });
      }
    }
    
    // Calculate total_estimado based on es_garantia
    const totalRes = await client.query("SELECT COALESCE(SUM(cantidad*precio_unitario),0) AS total FROM items_costo WHERE orden_id=$1", [req.params.id]);
    let total = parseFloat(totalRes.rows[0].total);
    if (es_garantia) {
      total = 0.00;
    }

    const r = await client.query(`UPDATE ordenes_servicio SET 
      vehiculo_id=$1,
      cliente_id=$2,
      mecanico_id=$3,
      kilometraje=$4,
      nivel_combustible=$5,
      falla_reportada=$6,
      estado=$7,
      repuestos_esperando=$8,
      fecha_entrega=$9,
      nota_interna=$10,
      fecha_ingreso=COALESCE($11,fecha_ingreso),
      conductor_nombre=$12,
      conductor_doc=$13,
      conductor_telefono=$14,
      es_garantia=$15,
      garantia_motivo=$16,
      mecanico_negligente_id=$17,
      total_estimado=$18
      WHERE id=$19 RETURNING *`,
      [
        vehiculo_id,
        cliente_id,
        mecanico_id,
        kilometraje,
        nivel_combustible,
        falla_reportada,
        estado,
        repuestos_esperando||"",
        fecha_entrega||null,
        nota_interna||"",
        fecha_ingreso||null,
        conductor_nombre||null,
        conductor_doc||null,
        conductor_telefono||null,
        es_garantia||false,
        garantia_motivo||null,
        mecanico_negligente_id||null,
        total,
        req.params.id
      ]);
      
    if (!r.rows.length) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(404).json({ error: "Orden no encontrada" });
    }
    
    let kmVal = null;
    if (kilometraje) {
      const cleanKm = String(kilometraje).replace(/[^0-9]/g, '');
      if (cleanKm) kmVal = parseInt(cleanKm);
    }
    if (kmVal && kmVal > 0) {
      await client.query("UPDATE vehiculos SET km_actual=$1 WHERE id=$2", [kmVal, vehiculo_id]);
    }

    await client.query("COMMIT");
    res.json(r.rows[0]);
  } catch (err) { 
    await client.query("ROLLBACK"); 
    res.status(500).json({ error: err.message }); 
  } finally {
    client.release();
  }
});

router.patch("/:id/estado", async (req, res) => {
  const { estado, repuestos_esperando, pasar_facturacion, fecha_entrega } = req.body;
  const client = await getClient();
  try {
    await client.query("BEGIN");
    if (estado === "Entregado") {
      const cobroCheck = await client.query("SELECT estado FROM cobros WHERE orden_id = $1", [req.params.id]);
      if (cobroCheck.rows.length > 0 && cobroCheck.rows[0].estado === "Pendiente") {
        await client.query("ROLLBACK");
        client.release();
        return res.status(400).json({ error: "No se puede marcar como Entregado porque tiene un cobro pendiente en Facturación." });
      }
    }
    const totalRes = await client.query("SELECT COALESCE(SUM(cantidad*precio_unitario),0) AS total FROM items_costo WHERE orden_id=$1", [req.params.id]);
    let total = parseFloat(totalRes.rows[0].total);
    const ordCheck = await client.query("SELECT es_garantia FROM ordenes_servicio WHERE id=$1", [req.params.id]);
    if (ordCheck.rows.length > 0 && ordCheck.rows[0].es_garantia) {
      total = 0.00;
    }
    const ordRes = await client.query("UPDATE ordenes_servicio SET estado=$1,repuestos_esperando=$2,total_estimado=$3,fecha_entrega=$4 WHERE id=$5 RETURNING *", 
      [estado, repuestos_esperando||"", total, fecha_entrega || null, req.params.id]);
    
    const ordObj = ordRes.rows[0];
    if (estado === "Finalizado" && ordObj && ordObj.vehiculo_id) {
      // Extraer el kilometraje como entero
      const rawKm = ordObj.kilometraje;
      let kmVal = null;
      if (rawKm) {
        const cleanKm = rawKm.replace(/[^0-9]/g, '');
        if (cleanKm) kmVal = parseInt(cleanKm);
      }

      if (kmVal && kmVal > 0) {
        // Consultar los ítems de costo para ver qué se hizo
        const itemsRes = await client.query("SELECT descripcion FROM items_costo WHERE orden_id=$1", [req.params.id]);
        const descripciones = itemsRes.rows.map(item => item.descripcion.toLowerCase());

        const updates = [];
        const params = [kmVal];
        let paramIndex = 2;

        // Analizar palabras clave para actualizar kilometraje de componentes
        if (descripciones.some(d => /aceite|oil|lubricante/i.test(d))) {
          updates.push(`km_ultimo_aceite = $${paramIndex++}`);
          params.push(kmVal);
        }
        if (descripciones.some(d => /freno|pastilla|zapata|disco\s*freno/i.test(d))) {
          updates.push(`km_ultimo_frenos = $${paramIndex++}`);
          params.push(kmVal);
        }
        if (descripciones.some(d => /bujia|spark\s*plug|ignicion/i.test(d))) {
          updates.push(`km_ultimo_bujias = $${paramIndex++}`);
          params.push(kmVal);
        }
        if (descripciones.some(d => /filtro\s*aire|filtro\s*cabina|filtro\s*gasolina|filtro\s*polen|filtro\s*aceite/i.test(d))) {
          updates.push(`km_ultimo_filtros = $${paramIndex++}`);
          params.push(kmVal);
        }
        if (descripciones.some(d => /liquido\s*freno|dot\s*4|dot4/i.test(d))) {
          updates.push(`km_ultimo_liquido_frenos = $${paramIndex++}`);
          params.push(kmVal);
        }
        if (descripciones.some(d => /refrigerante|coolant|anticongelante/i.test(d))) {
          updates.push(`km_ultimo_refrigerante = $${paramIndex++}`);
          params.push(kmVal);
        }
        if (descripciones.some(d => /faja|correa|distribucion|timing\s*belt/i.test(d))) {
          updates.push(`km_ultimo_distribucion = $${paramIndex++}`);
          params.push(kmVal);
        }

        // Siempre actualizar kilometraje actual, kilometraje de último servicio general y fecha
        updates.push(`km_actual = $1`);
        updates.push(`km_ultimo_servicio = $1`);
        updates.push(`ultima_visita = CURRENT_DATE`);

        params.push(ordObj.vehiculo_id);
        const queryStr = `UPDATE vehiculos SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
        await client.query(queryStr, params);
      }
    }

    if (estado==="Finalizado" && pasar_facturacion && total>0) {
      await client.query("INSERT INTO cobros (orden_id,cliente_id,monto_total,estado,fecha_emision) VALUES ($1,$2,$3,$4,CURRENT_DATE) ON CONFLICT DO NOTHING",
        [req.params.id,ordObj.cliente_id,total,"Pendiente"]);
    }
    await client.query("COMMIT");
    res.json({ ...ordObj, total_calculado: total });
  } catch (err) { await client.query("ROLLBACK"); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

router.post("/:id/items", async (req, res) => {
  const { tipo, descripcion, cantidad, precio_unitario, repuesto_cod } = req.body;
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const item = await client.query("INSERT INTO items_costo (orden_id,tipo,descripcion,cantidad,precio_unitario,repuesto_cod) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [req.params.id,tipo||"manual",descripcion,cantidad,precio_unitario,repuesto_cod||null]);
    if (tipo==="almacen" && repuesto_cod) {
      await client.query("UPDATE almacen SET stock=stock-$1 WHERE codigo=$2", [cantidad,repuesto_cod]);
    }
    const tot = await client.query("SELECT COALESCE(SUM(cantidad*precio_unitario),0) AS t FROM items_costo WHERE orden_id=$1", [req.params.id]);
    let totalVal = parseFloat(tot.rows[0].t);
    const ordCheck = await client.query("SELECT es_garantia FROM ordenes_servicio WHERE id=$1", [req.params.id]);
    if (ordCheck.rows.length > 0 && ordCheck.rows[0].es_garantia) {
      totalVal = 0.00;
    }
    await client.query("UPDATE ordenes_servicio SET total_estimado=$1 WHERE id=$2", [totalVal, req.params.id]);
    await client.query("COMMIT");
    res.status(201).json(item.rows[0]);
  } catch (err) { await client.query("ROLLBACK"); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

router.delete("/:id/items/:itemId", async (req, res) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const it = await client.query("SELECT * FROM items_costo WHERE id=$1 AND orden_id=$2", [req.params.itemId,req.params.id]);
    if (!it.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Item no encontrado" }); }
    await client.query("DELETE FROM items_costo WHERE id=$1", [req.params.itemId]);
    if (it.rows[0].tipo==="almacen" && it.rows[0].repuesto_cod) {
      await client.query("UPDATE almacen SET stock=stock+$1 WHERE codigo=$2", [it.rows[0].cantidad,it.rows[0].repuesto_cod]);
    }
    const tot = await client.query("SELECT COALESCE(SUM(cantidad*precio_unitario),0) AS t FROM items_costo WHERE orden_id=$1", [req.params.id]);
    let totalVal = parseFloat(tot.rows[0].t);
    const ordCheck = await client.query("SELECT es_garantia FROM ordenes_servicio WHERE id=$1", [req.params.id]);
    if (ordCheck.rows.length > 0 && ordCheck.rows[0].es_garantia) {
      totalVal = 0.00;
    }
    await client.query("UPDATE ordenes_servicio SET total_estimado=$1 WHERE id=$2", [totalVal, req.params.id]);
    await client.query("COMMIT");
    res.json({ message: "Item eliminado" });
  } catch (err) { await client.query("ROLLBACK"); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// PATCH /ordenes/:id/mecanico  — reasignación rápida de mecánico desde el Kanban
router.patch("/:id/mecanico", async (req, res) => {
  const { mecanico_id } = req.body;
  try {
    const r = await query(
      "UPDATE ordenes_servicio SET mecanico_id=$1 WHERE id=$2 RETURNING *",
      [mecanico_id || null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Orden no encontrada" });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /ordenes/:id/diagnostico — guardar el diagnóstico JSON
router.patch("/:id/diagnostico", async (req, res) => {
  const { diagnostico } = req.body;
  try {
    const r = await query(
      "UPDATE ordenes_servicio SET diagnostico=$1 WHERE id=$2 RETURNING *",
      [diagnostico ? JSON.stringify(diagnostico) : null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Orden no encontrada" });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;

