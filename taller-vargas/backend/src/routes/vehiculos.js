import { Router } from "express";
import { query } from "../db.js";
const router = Router();

router.get("/", async (_req, res) => {
  try {
    const r = await query("SELECT v.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono FROM vehiculos v LEFT JOIN clientes c ON v.cliente_id = c.id ORDER BY v.ultima_visita DESC NULLS LAST");
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/:id/historial", async (req, res) => {
  try {
    const r = await query("SELECT os.id, os.fecha_ingreso, os.kilometraje, os.falla_reportada, os.total_estimado, os.estado FROM ordenes_servicio os WHERE os.vehiculo_id=$1 ORDER BY os.fecha_ingreso DESC", [req.params.id]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req, res) => {
  const { placa, marca_modelo, anio, cliente_id } = req.body;
  try {
    const r = await query("INSERT INTO vehiculos (placa,marca_modelo,anio,cliente_id,ultima_visita) VALUES ($1,$2,$3,$4,CURRENT_DATE) RETURNING *", [placa.toUpperCase(),marca_modelo,anio||null,cliente_id||null]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code==="23505") return res.status(409).json({ error: "Ya existe un vehiculo con esa placa." });
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  const { placa, marca_modelo, anio, cliente_id } = req.body;
  try {
    const r = await query("UPDATE vehiculos SET placa=$1,marca_modelo=$2,anio=$3,cliente_id=$4 WHERE id=$5 RETURNING *", [placa.toUpperCase(),marca_modelo,anio||null,cliente_id||null,req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Vehiculo no encontrado" });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
