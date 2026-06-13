import { Router } from "express";
import { query } from "../db.js";
const router = Router();

// Auto-migración: asegurar que la columna 'notas' exista
(async () => {
  try {
    await query("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS notas TEXT;");
  } catch (_) { /* ya existe */ }
})();

// ──────────────────────────────────────────────────────────────
// GET /api/clientes  — Listado CRM con métricas agregadas
// ──────────────────────────────────────────────────────────────
router.get("/", async (_req, res) => {
  try {
    const r = await query(`
      SELECT
        c.*,
        -- Vehículos del cliente con datos de km para alertas predictivas
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id',              v.id,
                'placa',           v.placa,
                'marca_modelo',    v.marca_modelo,
                'anio',            v.anio,
                'km_actual',       v.km_actual,
                'km_ultimo_aceite',      v.km_ultimo_aceite,
                'km_ultimo_frenos',      v.km_ultimo_frenos,
                'km_ultimo_bujias',      v.km_ultimo_bujias,
                'km_ultimo_filtros',     v.km_ultimo_filtros,
                'km_ultimo_refrigerante',v.km_ultimo_refrigerante,
                'km_ultimo_distribucion',v.km_ultimo_distribucion,
                'ultima_visita',         v.ultima_visita
              )
            )
            FROM vehiculos v
            WHERE v.cliente_id = c.id
          ),
          '[]'
        ) AS vehiculos_detalle,

        -- Conteo total de órdenes de servicio
        (
          SELECT COUNT(*)::INT 
          FROM ordenes_servicio os 
          WHERE os.cliente_id = c.id
        ) AS total_servicios,

        -- Gasto acumulado (cobros pagados)
        COALESCE(
          (
            SELECT SUM(co.monto_total)::NUMERIC(10,2) 
            FROM cobros co 
            WHERE co.cliente_id = c.id AND co.estado IN ('Cancelado','Dividido')
          ),
          0
        ) AS total_gastado,

        -- Fecha del último ingreso al taller
        (
          SELECT MAX(os.fecha_ingreso) 
          FROM ordenes_servicio os 
          WHERE os.cliente_id = c.id
        ) AS ultima_visita_taller

      FROM clientes c
      ORDER BY (
        SELECT MAX(os.fecha_ingreso) 
        FROM ordenes_servicio os 
        WHERE os.cliente_id = c.id
      ) DESC NULLS LAST, c.nombre
    `);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────────────────────
// GET /api/clientes/stats/crm  — KPIs globales del CRM
// IMPORTANTE: debe ir ANTES de /:id para evitar colisión en Express
// ──────────────────────────────────────────────────────────────
router.get("/stats/crm", async (_req, res) => {
  try {
    const r = await query(`
      SELECT
        COUNT(DISTINCT c.id)::INT AS total_clientes,
        COUNT(DISTINCT c.id) FILTER (
          WHERE (SELECT COUNT(*) FROM ordenes_servicio WHERE cliente_id = c.id) > 3
             OR (SELECT COALESCE(SUM(monto_total),0) FROM cobros WHERE cliente_id = c.id AND estado IN ('Cancelado','Dividido')) > 1500
        )::INT AS clientes_vip,
        COUNT(DISTINCT c.id) FILTER (
          WHERE (SELECT MAX(fecha_ingreso) FROM ordenes_servicio WHERE cliente_id = c.id) < CURRENT_DATE - INTERVAL '90 days'
             OR (SELECT COUNT(*) FROM ordenes_servicio WHERE cliente_id = c.id) = 0
        )::INT AS clientes_inactivos,
        (SELECT COUNT(*) FROM cobros WHERE estado = 'Pendiente')::INT AS cobros_pendientes
      FROM clientes c
    `);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────────────────────
// GET /api/clientes/:id  — Detalle individual
// ──────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const r = await query("SELECT * FROM clientes WHERE id=$1", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────────────────────
// GET /api/clientes/:id/historial  — Timeline de servicios
// ──────────────────────────────────────────────────────────────
router.get("/:id/historial", async (req, res) => {
  try {
    const r = await query(`
      SELECT
        os.id,
        os.fecha_ingreso,
        os.fecha_entrega,
        os.kilometraje,
        os.falla_reportada,
        os.estado,
        os.total_estimado,
        os.nota_interna,
        v.placa,
        v.marca_modelo,
        m.nombre AS mecanico,
        COALESCE(
          json_agg(
            json_build_object(
              'descripcion',    ic.descripcion,
              'cantidad',       ic.cantidad,
              'precio_unitario',ic.precio_unitario,
              'tipo',           ic.tipo
            )
          ) FILTER (WHERE ic.id IS NOT NULL),
          '[]'
        ) AS items
      FROM ordenes_servicio os
      LEFT JOIN vehiculos v     ON os.vehiculo_id = v.id
      LEFT JOIN mecanicos m     ON os.mecanico_id = m.id
      LEFT JOIN items_costo ic  ON ic.orden_id = os.id
      WHERE os.cliente_id = $1
      GROUP BY os.id, v.placa, v.marca_modelo, m.nombre
      ORDER BY os.fecha_ingreso DESC
    `, [req.params.id]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────────────────────
// POST /api/clientes  — Crear cliente (con notas)
// ──────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { tipo_doc, num_doc, nombre, telefono, correo, direccion, notas } = req.body;
  try {
    const r = await query(
      "INSERT INTO clientes (tipo_doc,num_doc,nombre,telefono,correo,direccion,notas) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [tipo_doc, num_doc, nombre, telefono, correo || null, direccion || null, notas || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Ya existe un cliente con ese documento." });
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/clientes/:id  — Actualizar cliente (con notas)
// ──────────────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  const { tipo_doc, num_doc, nombre, telefono, correo, direccion, notas } = req.body;
  try {
    const r = await query(
      "UPDATE clientes SET tipo_doc=$1,num_doc=$2,nombre=$3,telefono=$4,correo=$5,direccion=$6,notas=$7 WHERE id=$8 RETURNING *",
      [tipo_doc, num_doc, nombre, telefono, correo || null, direccion || null, notas || null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/clientes/:id/notas  — Guardar nota rápida CRM
// ──────────────────────────────────────────────────────────────
router.patch("/:id/notas", async (req, res) => {
  const { notas } = req.body;
  try {
    const r = await query(
      "UPDATE clientes SET notas=$1 WHERE id=$2 RETURNING id, notas",
      [notas || null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/clientes/:id
// ──────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    await query("DELETE FROM clientes WHERE id=$1", [req.params.id]);
    res.json({ message: "Cliente eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
