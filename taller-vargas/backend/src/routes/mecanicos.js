import { Router } from "express";
import { query } from "../db.js";
const router = Router();

router.get("/", async (_req, res) => {
  try {
    const r = await query("SELECT * FROM mecanicos WHERE activo=TRUE ORDER BY nombre");
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req, res) => {
  const { nombre } = req.body;
  try {
    const r = await query("INSERT INTO mecanicos (nombre) VALUES ($1) RETURNING *", [nombre]);
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
