import { Router } from "express";
import { query } from "../db.js";
const router = Router();

router.get("/", async (_req, res) => {
  try {
    const [ordenes, stock, cobros, ordenesRecientes] = await Promise.all([
      query(`SELECT COUNT(*) FILTER (WHERE estado = $1) AS en_proceso, COUNT(*) FILTER (WHERE estado = $2) AS diagnostico, COUNT(*) FILTER (WHERE estado = $3) AS esperando, COUNT(*) FILTER (WHERE estado = $4) AS finalizado FROM ordenes_servicio WHERE fecha_ingreso >= DATE_TRUNC('month', CURRENT_DATE)`, ["En Proceso","Diagnostico","Esperando Repuestos","Finalizado"]),
      query("SELECT * FROM v_alertas_stock LIMIT 10"),
      query(`SELECT COALESCE(SUM(total_estimado), 0) AS ingresos_mes FROM ordenes_servicio WHERE estado = $1 AND DATE_TRUNC('month', fecha_ingreso) = DATE_TRUNC('month', CURRENT_DATE)`, ["Finalizado"]),
      query("SELECT id, placa, vehiculo, cliente, estado, total_estimado, fecha_ingreso FROM v_ordenes_completas ORDER BY fecha_ingreso DESC, id DESC LIMIT 5")
    ]);
    res.json({
      stats: {
        en_proceso: parseInt(ordenes.rows[0]?.en_proceso || 0),
        diagnostico: parseInt(ordenes.rows[0]?.diagnostico || 0),
        esperando: parseInt(ordenes.rows[0]?.esperando || 0),
        finalizado: parseInt(ordenes.rows[0]?.finalizado || 0),
        ingresos_mes: parseFloat(cobros.rows[0]?.ingresos_mes || 0),
      },
      alertas_stock: stock.rows,
      ordenes_recientes: ordenesRecientes.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
