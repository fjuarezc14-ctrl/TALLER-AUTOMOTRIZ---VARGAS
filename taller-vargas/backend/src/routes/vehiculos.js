import { Router } from "express";
import { query } from "../db.js";
const router = Router();

router.get("/", async (_req, res) => {
  try {
    const r = await query(`
      SELECT v.*,
        c.nombre AS cliente_nombre,
        c.telefono AS cliente_telefono
      FROM vehiculos v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      ORDER BY v.ultima_visita DESC NULLS LAST
    `);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/:id/historial", async (req, res) => {
  try {
    const r = await query(`
      SELECT os.id, os.fecha_ingreso, os.kilometraje, os.falla_reportada,
        os.total_estimado, os.estado, os.nota_interna
      FROM ordenes_servicio os
      WHERE os.vehiculo_id=$1
      ORDER BY os.fecha_ingreso DESC
    `, [req.params.id]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req, res) => {
  const {
    placa, marca_modelo, anio, cliente_id,
    vin, n_motor, tipo_motor, transmision, color, tipo_vehiculo,
    km_actual, km_ultimo_servicio,
    km_ultimo_aceite, km_ultimo_frenos, km_ultimo_bujias, km_ultimo_filtros,
    km_ultimo_liquido_frenos, km_ultimo_refrigerante, km_ultimo_distribucion
  } = req.body;
  try {
    const r = await query(`
      INSERT INTO vehiculos
        (placa, marca_modelo, anio, cliente_id, ultima_visita,
         vin, n_motor, tipo_motor, transmision, color, tipo_vehiculo,
         km_actual, km_ultimo_servicio,
         km_ultimo_aceite, km_ultimo_frenos, km_ultimo_bujias, km_ultimo_filtros,
         km_ultimo_liquido_frenos, km_ultimo_refrigerante, km_ultimo_distribucion)
      VALUES ($1,$2,$3,$4,CURRENT_DATE,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *
    `, [
      placa.toUpperCase(), marca_modelo, anio || null, cliente_id || null,
      vin || null, n_motor || null, tipo_motor || null,
      transmision || null, color || null, tipo_vehiculo || 'Sedan',
      km_actual || null, km_ultimo_servicio || null,
      km_ultimo_aceite || null, km_ultimo_frenos || null, km_ultimo_bujias || null, km_ultimo_filtros || null,
      km_ultimo_liquido_frenos || null, km_ultimo_refrigerante || null, km_ultimo_distribucion || null
    ]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Ya existe un vehiculo con esa placa." });
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  const {
    placa, marca_modelo, anio, cliente_id,
    vin, n_motor, tipo_motor, transmision, color, tipo_vehiculo,
    km_actual, km_ultimo_servicio,
    km_ultimo_aceite, km_ultimo_frenos, km_ultimo_bujias, km_ultimo_filtros,
    km_ultimo_liquido_frenos, km_ultimo_refrigerante, km_ultimo_distribucion
  } = req.body;
  try {
    const r = await query(`
      UPDATE vehiculos SET
        placa=$1, marca_modelo=$2, anio=$3, cliente_id=$4,
        vin=$5, n_motor=$6, tipo_motor=$7, transmision=$8,
        color=$9, tipo_vehiculo=$10, km_actual=$11, km_ultimo_servicio=$12,
        km_ultimo_aceite=$13, km_ultimo_frenos=$14, km_ultimo_bujias=$15, km_ultimo_filtros=$16,
        km_ultimo_liquido_frenos=$17, km_ultimo_refrigerante=$18, km_ultimo_distribucion=$19
      WHERE id=$20
      RETURNING *
    `, [
      placa.toUpperCase(), marca_modelo, anio || null, cliente_id || null,
      vin || null, n_motor || null, tipo_motor || null,
      transmision || null, color || null, tipo_vehiculo || 'Sedan',
      km_actual || null, km_ultimo_servicio || null,
      km_ultimo_aceite || null, km_ultimo_frenos || null, km_ultimo_bujias || null, km_ultimo_filtros || null,
      km_ultimo_liquido_frenos || null, km_ultimo_refrigerante || null, km_ultimo_distribucion || null,
      req.params.id
    ]);
    if (!r.rows.length) return res.status(404).json({ error: "Vehiculo no encontrado" });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
