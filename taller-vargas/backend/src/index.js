import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { query } from "./db.js";

import clientesRouter   from "./routes/clientes.js";
import vehiculosRouter  from "./routes/vehiculos.js";
import mecanicosRouter  from "./routes/mecanicos.js";
import ordenesRouter    from "./routes/ordenes.js";
import almacenRouter    from "./routes/almacen.js";
import cobrosRouter     from "./routes/cobros.js";
import archivosRouter   from "./routes/archivos.js";
import dashboardRouter  from "./routes/dashboard.js";

// Redefinir la vista v_ordenes_completas para incluir la columna diagnostico y cliente_telefono
async function runDbMigrations() {
  try {
    // Migrar columnas de la tabla a TIMESTAMP WITH TIME ZONE para soportar hora exacta
    await query(`
      ALTER TABLE ordenes_servicio ALTER COLUMN fecha_ingreso TYPE TIMESTAMP WITH TIME ZONE;
      ALTER TABLE ordenes_servicio ALTER COLUMN fecha_ingreso SET DEFAULT NOW();
      ALTER TABLE ordenes_servicio ALTER COLUMN fecha_entrega TYPE TIMESTAMP WITH TIME ZONE;
    `);
    await query(`DROP VIEW IF EXISTS v_ordenes_completas CASCADE;`);
    await query(`
      CREATE VIEW v_ordenes_completas AS
      SELECT os.id, os.cliente_id, os.vehiculo_id, os.mecanico_id, os.estado, os.kilometraje, os.nivel_combustible, os.falla_reportada,
        os.repuestos_esperando, os.total_estimado, os.fecha_ingreso, os.fecha_entrega,
        os.nota_interna, os.created_at, os.diagnostico,
        v.placa, v.marca_modelo AS vehiculo, v.anio,
        v.n_motor AS vehiculo_motor, v.color AS vehiculo_color, v.tipo_vehiculo AS vehiculo_clase,
        c.nombre AS cliente, c.telefono, c.telefono AS cliente_telefono, c.num_doc, c.tipo_doc, c.direccion AS cliente_direccion,
        m.nombre AS mecanico,
        co.id AS cobro_id, co.estado AS cobro_estado
      FROM ordenes_servicio os
      LEFT JOIN vehiculos v ON os.vehiculo_id = v.id
      LEFT JOIN clientes c ON os.cliente_id = c.id
      LEFT JOIN mecanicos m ON os.mecanico_id = m.id
      LEFT JOIN cobros co ON co.orden_id = os.id;
    `);
    console.log("[DB] Vista v_ordenes_completas actualizada satisfactoriamente");
  } catch (err) {
    console.error("[DB ERROR] Error al ejecutar migración de la vista v_ordenes_completas:", err.message);
  }
}
runDbMigrations();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "25mb" }));

// Servir archivos estáticos subidos
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Desactivar caché en todas las respuestas de la API
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", project: "taller-vargas", port: PORT, timestamp: new Date().toISOString() });
});

app.use("/api/dashboard",  dashboardRouter);
app.use("/api/clientes",   clientesRouter);
app.use("/api/vehiculos",  vehiculosRouter);
app.use("/api/mecanicos",  mecanicosRouter);
app.use("/api/ordenes",    ordenesRouter);
app.use("/api/almacen",    almacenRouter);
app.use("/api/cobros",     cobrosRouter);
app.use("/api/archivos",   archivosRouter);

app.use((_req, res) => res.status(404).json({ error: "Ruta no encontrada" }));
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));

app.listen(PORT, () => {
  console.log(`🔧 Taller Vargas API en http://localhost:${PORT}`);
});
