import { Router } from "express";
import { query } from "../db.js";
const router = Router();

// GET /mecanicos  — todos los mecánicos activos (para selects)
router.get("/", async (_req, res) => {
  try {
    const r = await query("SELECT * FROM mecanicos WHERE activo=TRUE ORDER BY nombre");
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
          AVG(
            CASE WHEN os.estado = 'Finalizado' AND os.fecha_entrega IS NOT NULL
              THEN (os.fecha_entrega - os.fecha_ingreso)
            END
          )
        , 1) AS dias_promedio_finalizacion
      FROM mecanicos m
      LEFT JOIN ordenes_servicio os ON os.mecanico_id = m.id
      GROUP BY m.id, m.nombre, m.activo, m.created_at
      ORDER BY m.nombre
    `);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /mecanicos  — crear mecánico
router.post("/", async (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: "El nombre es requerido" });
  try {
    const r = await query("INSERT INTO mecanicos (nombre) VALUES ($1) RETURNING *", [nombre.trim()]);
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /mecanicos/:id  — actualizar nombre y/o estado activo
router.put("/:id", async (req, res) => {
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
