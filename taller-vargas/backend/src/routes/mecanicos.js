import { Router } from "express";
import { query } from "../db.js";
import { requiereToken, soloAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requiereToken);

// GET /mecanicos  — todos los mecánicos activos con métricas de carga en vivo (para selects)
router.get("/", async (_req, res) => {
  try {
    // Auto-sincronizar operarios de usuarios no registrados en mecanicos
    await query(`
      INSERT INTO mecanicos (nombre, activo)
      SELECT username, TRUE FROM usuarios 
      WHERE rol = 'operario' 
        AND NOT EXISTS (
          SELECT 1 FROM mecanicos WHERE LOWER(TRIM(mecanicos.nombre)) = LOWER(TRIM(usuarios.username))
        )
    `);

    const r = await query(`
      SELECT 
        m.*,
        COUNT(CASE WHEN os.estado NOT IN ('Finalizado','Entregado','No realizo servicio') THEN 1 END)::int AS ordenes_activas
      FROM mecanicos m
      LEFT JOIN ordenes_servicio os ON os.mecanico_id = m.id
      WHERE m.activo = TRUE
      GROUP BY m.id, m.nombre, m.activo, m.created_at
      ORDER BY ordenes_activas ASC, m.nombre ASC
    `);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /mecanicos/stats  — todos los mecánicos con métricas operativas
// IMPORTANTE: debe ir ANTES de /:id para que Express no lo capture como param
router.get("/stats", async (_req, res) => {
  try {
    const r = await query(`
      SELECT
        m.id,
        m.nombre,
        m.activo,
        m.created_at,
        COUNT(CASE WHEN os.estado NOT IN ('Finalizado','No realizo servicio') THEN 1 END)::int AS ordenes_activas,
        COUNT(CASE WHEN os.estado = 'Finalizado' THEN 1 END)::int                            AS ordenes_completadas,
        COUNT(os.id)::int                                                                     AS ordenes_total,
        ROUND(
          COALESCE(
            AVG(
              CASE WHEN os.estado = 'Finalizado' AND os.fecha_entrega IS NOT NULL
                THEN EXTRACT(EPOCH FROM (os.fecha_entrega - os.fecha_ingreso)) / 86400.0
              END
            )
          , 0)::numeric
        , 1) AS dias_promedio_finalizacion
      FROM mecanicos m
      LEFT JOIN ordenes_servicio os ON os.mecanico_id = m.id
      GROUP BY m.id, m.nombre, m.activo, m.created_at
      ORDER BY m.nombre
    `);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /mecanicos  — crear mecánico (Solo Administrador)
router.post("/", soloAdmin, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: "El nombre es requerido" });
  try {
    const r = await query("INSERT INTO mecanicos (nombre) VALUES ($1) RETURNING *", [nombre.trim()]);
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /mecanicos/:id  — actualizar nombre y/o estado activo (Solo Administrador)
router.put("/:id", soloAdmin, async (req, res) => {
  const { nombre, activo } = req.body;
  try {
    const fields = [];
    const values = [];
    let i = 1;
    if (nombre !== undefined) { fields.push(`nombre = $${i++}`); values.push(nombre.trim()); }
    if (activo !== undefined) { fields.push(`activo = $${i++}`); values.push(activo); }
    if (!fields.length) return res.status(400).json({ error: "Nada que actualizar" });
    values.push(req.params.id);
    const r = await query(
      `UPDATE mecanicos SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!r.rows.length) return res.status(404).json({ error: "Mecánico no encontrado" });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
