import { Router } from "express";
import { query } from "../db.js";
const router = Router();

router.get("/", async (_req, res) => {
  try {
    const r = await query("SELECT c.*, COALESCE(json_agg(v.placa) FILTER (WHERE v.placa IS NOT NULL), '[]') AS vehiculos FROM clientes c LEFT JOIN vehiculos v ON v.cliente_id = c.id GROUP BY c.id ORDER BY c.nombre");
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/:id", async (req, res) => {
  try {
    const r = await query("SELECT * FROM clientes WHERE id=$1", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req, res) => {
  const { tipo_doc, num_doc, nombre, telefono, correo, direccion } = req.body;
  try {
    const r = await query("INSERT INTO clientes (tipo_doc,num_doc,nombre,telefono,correo,direccion) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [tipo_doc,num_doc,nombre,telefono,correo||null,direccion||null]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code==="23505") return res.status(409).json({ error: "Ya existe un cliente con ese documento." });
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  const { tipo_doc, num_doc, nombre, telefono, correo, direccion } = req.body;
  try {
    const r = await query("UPDATE clientes SET tipo_doc=$1,num_doc=$2,nombre=$3,telefono=$4,correo=$5,direccion=$6 WHERE id=$7 RETURNING *", [tipo_doc,num_doc,nombre,telefono,correo||null,direccion||null,req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await query("DELETE FROM clientes WHERE id=$1", [req.params.id]);
    res.json({ message: "Cliente eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
