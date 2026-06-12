import { Router } from "express";
import { query } from "../db.js";
const router = Router();

router.get("/", async (_req, res) => {
  try {
    const [
      ordenes,
      stock,
      cobros,
      ordenesRecientes,
      ticketPromedio,
      clientesNuevos,
      eficiencia,
      mecanicosStats,
      topServicios,
      tendencia
    ] = await Promise.all([
      // 1. Estados de órdenes de este mes
      query(`
        SELECT 
          COUNT(*) FILTER (WHERE estado = 'En Proceso') AS en_proceso, 
          COUNT(*) FILTER (WHERE estado = 'Diagnostico') AS diagnostico, 
          COUNT(*) FILTER (WHERE estado = 'Esperando Repuestos') AS esperando, 
          COUNT(*) FILTER (WHERE estado = 'Finalizado') AS finalizado 
        FROM ordenes_servicio 
        WHERE fecha_ingreso >= DATE_TRUNC('month', CURRENT_DATE)
      `),
      // 2. Alertas de stock crítico
      query("SELECT * FROM v_alertas_stock LIMIT 10"),
      // 3. Cobros e ingresos del mes actual y pendientes
      query(`
        SELECT 
          COALESCE(SUM(monto_total) FILTER(WHERE estado IN ('Cancelado', 'Dividido') AND fecha_cobro >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS cobrados_mes, 
          COALESCE(SUM(monto_total) FILTER(WHERE estado = 'Pendiente'), 0) AS pendientes_total 
        FROM cobros
      `),
      // 4. Últimas 5 órdenes de servicio
      query("SELECT id, placa, vehiculo, cliente, estado, total_estimado, fecha_ingreso FROM v_ordenes_completas ORDER BY fecha_ingreso DESC, id DESC LIMIT 5"),
      // 5. Ticket promedio del mes actual
      query(`
        SELECT 
          COALESCE(AVG(total_estimado) FILTER (WHERE estado = 'Finalizado' AND fecha_ingreso >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS ticket_promedio 
        FROM ordenes_servicio
      `),
      // 6. Nuevos clientes este mes
      query("SELECT COUNT(*) AS total FROM clientes WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)"),
      // 7. Eficiencia Operativa (Finalizados / Total del mes)
      query(`
        SELECT 
          COALESCE((COUNT(*) FILTER (WHERE estado = 'Finalizado') * 100.0 / NULLIF(COUNT(*), 0)), 0) AS eficiencia 
        FROM ordenes_servicio 
        WHERE fecha_ingreso >= DATE_TRUNC('month', CURRENT_DATE)
      `),
      // 8. Carga de mecánicos
      query(`
        SELECT 
          m.id, 
          m.nombre, 
          m.activo, 
          COUNT(os.id) FILTER (WHERE os.estado IN ('En Proceso', 'Diagnostico', 'Esperando Repuestos')) AS ordenes_activas, 
          COUNT(os.id) FILTER (WHERE os.estado = 'Finalizado') AS ordenes_completadas 
        FROM mecanicos m 
        LEFT JOIN ordenes_servicio os ON m.id = os.mecanico_id 
        GROUP BY m.id, m.nombre, m.activo 
        ORDER BY ordenes_activas DESC
      `),
      // 9. Servicios más solicitados
      query(`
        SELECT descripcion, COUNT(*) AS cantidad, SUM(cantidad * precio_unitario) AS total 
        FROM items_costo 
        GROUP BY descripcion 
        ORDER BY cantidad DESC 
        LIMIT 5
      `),
      // 10. Tendencia de 6 meses de órdenes e ingresos
      query(`
        SELECT 
          TO_CHAR(d, 'YYYY-MM') as mes,
          COALESCE(COUNT(os.id), 0) as ordenes,
          COALESCE(SUM(os.total_estimado) FILTER (WHERE os.estado = 'Finalizado'), 0) as ingresos
        FROM GENERATE_SERIES(
          DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
          DATE_TRUNC('month', CURRENT_DATE),
          INTERVAL '1 month'
        ) d
        LEFT JOIN ordenes_servicio os ON DATE_TRUNC('month', os.fecha_ingreso) = d
        GROUP BY mes
        ORDER BY mes ASC
      `)
    ]);

    // Calcular ingresos_mes (basado en total_estimado de finalizados del mes) para retrocompatibilidad
    const ingresosMesQuery = await query(`
      SELECT COALESCE(SUM(total_estimado), 0) AS ingresos_mes 
      FROM ordenes_servicio 
      WHERE estado = $1 AND DATE_TRUNC('month', fecha_ingreso) = DATE_TRUNC('month', CURRENT_DATE)
    `, ["Finalizado"]);

    res.json({
      stats: {
        en_proceso: parseInt(ordenes.rows[0]?.en_proceso || 0),
        diagnostico: parseInt(ordenes.rows[0]?.diagnostico || 0),
        esperando: parseInt(ordenes.rows[0]?.esperando || 0),
        finalizado: parseInt(ordenes.rows[0]?.finalizado || 0),
        ingresos_mes: parseFloat(ingresosMesQuery.rows[0]?.ingresos_mes || 0),
        cobrados_mes: parseFloat(cobros.rows[0]?.cobrados_mes || 0),
        pendientes_total: parseFloat(cobros.rows[0]?.pendientes_total || 0),
        ticket_promedio: parseFloat(ticketPromedio.rows[0]?.ticket_promedio || 0),
        clientes_nuevos_mes: parseInt(clientesNuevos.rows[0]?.total || 0),
        eficiencia_operativa: parseFloat(eficiencia.rows[0]?.eficiencia || 0)
      },
      alertas_stock: stock.rows,
      ordenes_recientes: ordenesRecientes.rows,
      mecanicos_stats: mecanicosStats.rows,
      top_servicios: topServicios.rows,
      tendencia_mensual: tendencia.rows
    });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

export default router;
