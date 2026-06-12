import { Router } from "express";
import { query, getClient } from "../db.js";
const router = Router();

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
  const { vehiculo_id, cliente_id, mecanico_id, kilometraje, nivel_combustible, falla_reportada } = req.body;
  try {
    const r = await query("INSERT INTO ordenes_servicio (vehiculo_id,cliente_id,mecanico_id,kilometraje,nivel_combustible,falla_reportada,estado) VALUES ($1,$2,$3,$4,$5,$6,'Diagnostico') RETURNING *",
      [vehiculo_id,cliente_id,mecanico_id||null,kilometraje,nivel_combustible,falla_reportada||""]);
    
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
  const { vehiculo_id,cliente_id,mecanico_id,kilometraje,nivel_combustible,falla_reportada,estado,repuestos_esperando,fecha_entrega,nota_interna } = req.body;
  try {
    const r = await query("UPDATE ordenes_servicio SET vehiculo_id=$1,cliente_id=$2,mecanico_id=$3,kilometraje=$4,nivel_combustible=$5,falla_reportada=$6,estado=$7,repuestos_esperando=$8,fecha_entrega=$9,nota_interna=$10 WHERE id=$11 RETURNING *",
      [vehiculo_id,cliente_id,mecanico_id,kilometraje,nivel_combustible,falla_reportada,estado,repuestos_esperando||"",fecha_entrega||null,nota_interna||"",req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Orden no encontrada" });
    
    let kmVal = null;
    if (kilometraje) {
      const cleanKm = String(kilometraje).replace(/[^0-9]/g, '');
      if (cleanKm) kmVal = parseInt(cleanKm);
    }
    if (kmVal && kmVal > 0) {
      await query("UPDATE vehiculos SET km_actual=$1 WHERE id=$2", [kmVal, vehiculo_id]);
    }

    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/:id/estado", async (req, res) => {
  const { estado, repuestos_esperando, pasar_facturacion } = req.body;
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const totalRes = await client.query("SELECT COALESCE(SUM(cantidad*precio_unitario),0) AS total FROM items_costo WHERE orden_id=$1", [req.params.id]);
    const total = parseFloat(totalRes.rows[0].total);
    const ordRes = await client.query("UPDATE ordenes_servicio SET estado=$1,repuestos_esperando=$2,total_estimado=$3 WHERE id=$4 RETURNING *", [estado,repuestos_esperando||"",total,req.params.id]);
    
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
    await client.query("UPDATE ordenes_servicio SET total_estimado=$1 WHERE id=$2", [parseFloat(tot.rows[0].t),req.params.id]);
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
    await client.query("UPDATE ordenes_servicio SET total_estimado=$1 WHERE id=$2", [parseFloat(tot.rows[0].t),req.params.id]);
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

export default router;

