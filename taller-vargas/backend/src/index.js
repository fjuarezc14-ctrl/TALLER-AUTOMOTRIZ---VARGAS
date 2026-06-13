import "dotenv/config";
import express from "express";
import cors from "cors";

import clientesRouter   from "./routes/clientes.js";
import vehiculosRouter  from "./routes/vehiculos.js";
import mecanicosRouter  from "./routes/mecanicos.js";
import ordenesRouter    from "./routes/ordenes.js";
import almacenRouter    from "./routes/almacen.js";
import cobrosRouter     from "./routes/cobros.js";
import archivosRouter   from "./routes/archivos.js";
import dashboardRouter  from "./routes/dashboard.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "25mb" }));

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
