import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "./db.js";

import clientesRouter   from "./routes/clientes.js";
import vehiculosRouter  from "./routes/vehiculos.js";
import mecanicosRouter  from "./routes/mecanicos.js";
import ordenesRouter    from "./routes/ordenes.js";
import almacenRouter    from "./routes/almacen.js";
import cobrosRouter     from "./routes/cobros.js";
import archivosRouter   from "./routes/archivos.js";
import dashboardRouter  from "./routes/dashboard.js";
import authRouter       from "./routes/auth.js";
import usuariosRouter   from "./routes/usuarios.js";

// Redefinir la vista v_ordenes_completas para incluir la columna diagnostico y cliente_telefono
async function runDbMigrations() {
  try {
    // Eliminar la vista primero para poder alterar los tipos de columna o añadir nuevas referenciadas
    await query(`DROP VIEW IF EXISTS v_ordenes_completas CASCADE;`);
    // Migrar columnas de la tabla a TIMESTAMP WITH TIME ZONE para soportar hora exacta
    await query(`
      ALTER TABLE ordenes_servicio ALTER COLUMN fecha_ingreso TYPE TIMESTAMP WITH TIME ZONE;
      ALTER TABLE ordenes_servicio ALTER COLUMN fecha_ingreso SET DEFAULT NOW();
      ALTER TABLE ordenes_servicio ALTER COLUMN fecha_entrega TYPE TIMESTAMP WITH TIME ZONE;
    `);
    // Añadir nuevas columnas operativas y de garantía si no existen
    await query(`
      ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS conductor_nombre VARCHAR(255);
      ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS conductor_doc VARCHAR(20);
      ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS conductor_telefono VARCHAR(20);
      ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS es_garantia BOOLEAN DEFAULT FALSE;
      ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS garantia_motivo TEXT;
      ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS mecanico_negligente_id INTEGER;
    `);
    // Migrar columnas de la tabla cobros para descuentos y comprobante_numero
    await query(`
      ALTER TABLE cobros ADD COLUMN IF NOT EXISTS descuento_tipo VARCHAR(20) DEFAULT NULL;
      ALTER TABLE cobros ADD COLUMN IF NOT EXISTS descuento_valor DECIMAL(10,2) DEFAULT 0;
      ALTER TABLE cobros ADD COLUMN IF NOT EXISTS descuento_realizado DECIMAL(10,2) DEFAULT 0;
      ALTER TABLE cobros ADD COLUMN IF NOT EXISTS monto_neto DECIMAL(10,2) DEFAULT NULL;
      ALTER TABLE cobros ADD COLUMN IF NOT EXISTS comprobante_numero VARCHAR(50) DEFAULT NULL;
      ALTER TABLE cobros ADD COLUMN IF NOT EXISTS comprobante2_numero VARCHAR(50) DEFAULT NULL;
    `);
    // Crear índices para optimizar búsquedas por placa de vehículos y documento de clientes
    await query(`
      CREATE INDEX IF NOT EXISTS idx_clientes_num_doc ON clientes(num_doc);
      CREATE INDEX IF NOT EXISTS idx_vehiculos_placa ON vehiculos(placa);
    `);
    await query(`
      CREATE VIEW v_ordenes_completas AS
      SELECT os.id, os.cliente_id, os.vehiculo_id, os.mecanico_id, os.estado, os.kilometraje, os.nivel_combustible, os.falla_reportada,
        os.repuestos_esperando, os.total_estimado, os.fecha_ingreso, os.fecha_entrega,
        os.nota_interna, os.created_at, os.diagnostico,
        os.conductor_nombre, os.conductor_doc, os.conductor_telefono,
        os.es_garantia, os.garantia_motivo, os.mecanico_negligente_id,
        v.placa, v.marca_modelo AS vehiculo, v.anio,
        v.n_motor AS vehiculo_motor, v.color AS vehiculo_color, v.tipo_vehiculo AS vehiculo_clase,
        c.nombre AS cliente, c.telefono, c.telefono AS cliente_telefono, c.num_doc, c.tipo_doc, c.direccion AS cliente_direccion,
        m.nombre AS mecanico,
        m_neg.nombre AS mecanico_negligente,
        co.id AS cobro_id, co.estado AS cobro_estado
      FROM ordenes_servicio os
      LEFT JOIN vehiculos v ON os.vehiculo_id = v.id
      LEFT JOIN clientes c ON os.cliente_id = c.id
      LEFT JOIN mecanicos m ON os.mecanico_id = m.id
      LEFT JOIN mecanicos m_neg ON os.mecanico_negligente_id = m_neg.id
      LEFT JOIN cobros co ON co.orden_id = os.id;
    `);
    console.log("[DB] Vista v_ordenes_completas y columnas actualizadas satisfactoriamente");
  } catch (err) {
    console.error("[DB ERROR] Error al ejecutar migración de la vista v_ordenes_completas:", err.message);
  }
}
runDbMigrations();

// ── Migración y seed de tabla de usuarios (auth) ────────────
async function runAuthMigration() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        rol VARCHAR(50) NOT NULL CHECK (rol IN ('administrador', 'operario')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Crear usuarios por defecto si la tabla está vacía
    const existentes = await query('SELECT COUNT(*) FROM usuarios');
    if (parseInt(existentes.rows[0].count) === 0) {
      const salt = await bcrypt.genSalt(10);
      const adminHash    = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'vargas2026', salt);
      const operarioHash = await bcrypt.hash(process.env.OPERARIO_PASSWORD || 'taller123', salt);
      await query(
        `INSERT INTO usuarios (username, password_hash, rol) VALUES
         ($1, $2, 'administrador'),
         ($3, $4, 'operario')
         ON CONFLICT (username) DO NOTHING`,
        ['admin', adminHash, 'operario', operarioHash]
      );
      console.log('[Auth] Usuarios por defecto creados: admin (administrador), operario (operario)');
    }
    console.log('[DB] Tabla de usuarios verificada/migrada correctamente.');
  } catch (err) {
    console.error('[DB ERROR] Error al migrar tabla de usuarios:', err.message);
  }
}
runAuthMigration();

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

app.use("/api/auth",       authRouter);
app.use("/api/dashboard",  dashboardRouter);
app.use("/api/clientes",   clientesRouter);
app.use("/api/vehiculos",  vehiculosRouter);
app.use("/api/mecanicos",  mecanicosRouter);
app.use("/api/ordenes",    ordenesRouter);
app.use("/api/almacen",    almacenRouter);
app.use("/api/cobros",     cobrosRouter);
app.use("/api/archivos",   archivosRouter);
app.use("/api/usuarios",   usuariosRouter);

// ── Login inline (redundante, garantiza compatibilidad Docker) ──
const JWT_SECRET = process.env.JWT_SECRET || 'taller_vargas_secret_key_2026';
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos.' });
  try {
    const r = await query('SELECT id, username, password_hash, rol FROM usuarios WHERE username=$1', [username.toLowerCase().trim()]);
    const u = r.rows[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash))) return res.status(401).json({ error: 'Credenciales incorrectas.' });
    const token = jwt.sign({ id: u.id, username: u.username, rol: u.rol }, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token, user: { id: u.id, username: u.username, rol: u.rol } });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});
app.get('/api/auth/me', (req, res) => {
  const h = req.headers['authorization'];
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requerido.' });
  try { return res.json({ user: jwt.verify(h.split(' ')[1], JWT_SECRET) }); }
  catch { return res.status(401).json({ error: 'Token inválido.' }); }
});

app.use((_req, res) => res.status(404).json({ error: "Ruta no encontrada" }));
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));

app.listen(PORT, () => {
  console.log(`🔧 Taller Vargas API en http://localhost:${PORT}`);
  
  // Imprimir recomendación de PIN con bcrypt si detecta texto plano
  const rawPin = process.env.ADMIN_PIN || "1234";
  if (!rawPin.startsWith("$2a$") && !rawPin.startsWith("$2b$") && !rawPin.startsWith("$2y$")) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(rawPin, salt);
    console.log(`\n=============================================================`);
    console.log(`🛡️  RECOMENDACIÓN DE SEGURIDAD (ADMIN_PIN)`);
    console.log(`Tu ADMIN_PIN actualmente está guardado en texto plano.`);
    console.log(`Para producción, se recomienda encriptarlo en tu archivo .env.`);
    console.log(`Copia y reemplaza la variable con el siguiente hash:`);
    console.log(`ADMIN_PIN="${hash}"`);
    console.log(`=============================================================\n`);
  }
});
