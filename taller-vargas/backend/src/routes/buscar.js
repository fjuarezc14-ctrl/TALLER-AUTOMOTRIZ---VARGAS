import { Router } from "express";
import { query } from "../db.js";
import { requiereToken } from "../middleware/auth.js";

const router = Router();
router.use(requiereToken);

router.get("/", async (req, res) => {
  try {
    const rawQuery = (req.query.q || "").trim();
    if (!rawQuery || rawQuery.length < 2) {
      return res.json({ vehiculos: [], clientes: [], ordenes: [] });
    }

    const likeTerm = `%${rawQuery}%`;
    const cleanPlate = rawQuery.replace(/[^a-zA-Z0-9]/g, "");
    const cleanPlateTerm = `%${cleanPlate}%`;

    // 1. Vehículos
    const vehiculosPromise = query(
      `SELECT v.id, v.placa, v.marca_modelo, v.anio, v.vin, c.nombre AS cliente_nombre
       FROM vehiculos v
       LEFT JOIN clientes c ON v.cliente_id = c.id
       WHERE REPLACE(COALESCE(v.placa, ''), '-', '') ILIKE $1
          OR v.marca_modelo ILIKE $2
          OR v.vin ILIKE $2
          OR c.nombre ILIKE $2
       ORDER BY 
         CASE 
           WHEN UPPER(REPLACE(COALESCE(v.placa, ''), '-', '')) = UPPER($3) THEN 0
           ELSE 1 
         END,
         v.ultima_visita DESC NULLS LAST
       LIMIT 5`,
      [cleanPlateTerm, likeTerm, cleanPlate]
    );

    // 2. Clientes
    const clientesPromise = query(
      `SELECT id, nombre, tipo_doc, num_doc, telefono, correo
       FROM clientes
       WHERE nombre ILIKE $1
          OR num_doc ILIKE $1
          OR telefono ILIKE $1
          OR correo ILIKE $1
       ORDER BY id DESC
       LIMIT 5`,
      [likeTerm]
    );

    // 3. Órdenes de Servicio
    const isOrderQuery = /^os[-\s]?\d+/i.test(rawQuery) || /^\d+$/.test(rawQuery);
    const cleanNum = rawQuery.replace(/[^0-9]/g, "");
    
    let ordSql;
    let ordParams;
    if (isOrderQuery && cleanNum.length > 0) {
      ordSql = `
        SELECT os.id, os.estado, os.total_estimado, os.falla_reportada, v.placa, c.nombre AS cliente
        FROM ordenes_servicio os
        LEFT JOIN vehiculos v ON os.vehiculo_id = v.id
        LEFT JOIN clientes c ON os.cliente_id = c.id
        WHERE CAST(os.id AS TEXT) ILIKE $1
           OR REPLACE(COALESCE(v.placa, ''), '-', '') ILIKE $2
           OR c.nombre ILIKE $3
        ORDER BY 
          CASE WHEN CAST(os.id AS TEXT) = $4 THEN 0 ELSE 1 END,
          os.id DESC
        LIMIT 5
      `;
      ordParams = [`%${cleanNum}%`, cleanPlateTerm, likeTerm, cleanNum];
    } else {
      ordSql = `
        SELECT os.id, os.estado, os.total_estimado, os.falla_reportada, v.placa, c.nombre AS cliente
        FROM ordenes_servicio os
        LEFT JOIN vehiculos v ON os.vehiculo_id = v.id
        LEFT JOIN clientes c ON os.cliente_id = c.id
        WHERE REPLACE(COALESCE(v.placa, ''), '-', '') ILIKE $1
           OR c.nombre ILIKE $2
           OR os.falla_reportada ILIKE $2
        ORDER BY 
          CASE 
            WHEN UPPER(REPLACE(COALESCE(v.placa, ''), '-', '')) = UPPER($3) THEN 0
            ELSE 1 
          END,
          os.id DESC
        LIMIT 5
      `;
      ordParams = [cleanPlateTerm, likeTerm, cleanPlate];
    }

    const [vehiculosRes, clientesRes, ordenesRes] = await Promise.all([
      vehiculosPromise,
      clientesPromise,
      query(ordSql, ordParams)
    ]);

    res.json({
      vehiculos: vehiculosRes.rows || [],
      clientes: clientesRes.rows || [],
      ordenes: ordenesRes.rows || []
    });
  } catch (err) {
    console.error("[ERROR BUSQUEDA GLOBAL]", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
