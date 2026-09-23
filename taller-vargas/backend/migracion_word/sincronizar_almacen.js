// ============================================================
// SINCRONIZADOR DE CATÁLOGO MAESTRO DE ALMACÉN
// Extrae los repuestos únicos del historial y los registra en
// la tabla `almacen` con su categoría, precio promedio y stock.
// ============================================================

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pg = require('pg');
const dotenv = require('dotenv');

const { Client } = pg;

// Cargar variables de entorno del backend si existe
const envCandidates = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../taller-vargas/backend/.env')
];
for (const cand of envCandidates) {
  if (fs.existsSync(cand)) {
    dotenv.config({ path: cand });
    break;
  }
}

const isDryRun = process.argv.includes('--dry-run');

function categorizar(n) {
  const s = n.toLowerCase();
  if (s.includes('filtro')) return 'Filtros';
  if (s.includes('freno') || s.includes('pastilla') || s.includes('disco') || s.includes('zapata') || s.includes('caliper')) return 'Frenos';
  if (s.includes('aceite') || s.includes('grasa') || s.includes('aditivo') || s.includes('liquido') || s.includes('refrigerante') || s.includes('hidrolina')) return 'Lubricantes y Fluidos';
  if (s.includes('amortiguador') || s.includes('trapecio') || s.includes('rotula') || s.includes('bocina') || s.includes('muelle') || s.includes('palier') || s.includes('terminal') || s.includes('guardapolvo') || s.includes('triceta') || s.includes('barra')) return 'Suspensión y Dirección';
  if (s.includes('faja') || s.includes('polea') || s.includes('radiador') || s.includes('manguera') || s.includes('bomba') || s.includes('reten') || s.includes('empaque') || s.includes('termostato') || s.includes('caja') || s.includes('embrague')) return 'Motor y Transmisión';
  if (s.includes('bujia') || s.includes('faro') || s.includes('foco') || s.includes('bateria') || s.includes('alternador') || s.includes('arrancador') || s.includes('fusible') || s.includes('sensor')) return 'Eléctrico';
  return 'Insumos de Taller';
}

async function sincronizarAlmacen() {
  const jsonPath = path.join(__dirname, 'simulacion_datos.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ No se encontró simulacion_datos.json. Ejecuta primero simular_migracion.js');
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const simulacion = JSON.parse(raw);
  const repuestos = simulacion.catalogoRepuestosTop || [];

  console.log('================================================================');
  console.log(`📦 POBLANDO CATÁLOGO DE ALMACÉN DESDE HISTORIAL WORD`);
  console.log(`   Modo: ${isDryRun ? 'DRY-RUN (Simulación sin guardar)' : 'REAL (Escritura en BD)'}`);
  console.log(`   Total repuestos detectados: ${repuestos.length}`);
  console.log('================================================================\n');

  let connStr = process.env.DATABASE_URL;
  if (connStr && connStr.includes('@db:') && !fs.existsSync('/.dockerenv')) {
    connStr = connStr.replace('@db:5432', '@localhost:5436').replace('@db:', '@localhost:5436');
  }

  const client = new Client(
    connStr
      ? { connectionString: connStr }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5436', 10),
          user: process.env.DB_USER || 'vargas_user',
          password: process.env.DB_PASSWORD || 'vargas_password',
          database: process.env.DB_NAME || 'taller_vargas_db',
        }
  );

  await client.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtener productos ya existentes para evitar duplicados
    const resExistentes = await client.query('SELECT id, codigo, LOWER(TRIM(descripcion)) as desc_norm FROM almacen');
    const descMap = new Map();
    resExistentes.rows.forEach(r => descMap.set(r.desc_norm, r));

    // Determinar siguiente correlativo de SKU
    const resCodigos = await client.query("SELECT codigo FROM almacen WHERE codigo LIKE 'REP-%'");
    let maxNum = 0;
    resCodigos.rows.forEach(r => {
      const match = r.codigo.match(/REP-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    let insertados = 0;
    let omitidos = 0;

    for (const r of repuestos) {
      const nombreNorm = r.nombre.toLowerCase().trim();
      if (descMap.has(nombreNorm)) {
        omitidos++;
        continue;
      }

      maxNum++;
      const codigo = `REP-${String(maxNum).padStart(3, '0')}`;
      const categoria = categorizar(r.nombre);
      const precioVenta = parseFloat(r.precioPromedio || 0);
      const costo = parseFloat((precioVenta * 0.70).toFixed(2));
      const stock = 0; // Inicia en 0 para evitar inventarios ficticios
      const stockMin = 2;
      const descripcion = r.nombre.length > 490 ? r.nombre.substring(0, 487) + '...' : r.nombre;

      await client.query(
        `INSERT INTO almacen (codigo, descripcion, categoria, stock, stock_min, costo, precio_venta)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [codigo, descripcion, categoria, stock, stockMin, costo, precioVenta]
      );

      descMap.set(nombreNorm, { codigo, descripcion });
      insertados++;
    }

    if (isDryRun) {
      await client.query('ROLLBACK');
      console.log(`\n🔍 [DRY-RUN] Simulación exitosa: Se habrían insertado ${insertados} repuestos (${omitidos} omitidos por ya existir).`);
    } else {
      await client.query('COMMIT');
      console.log(`\n💾 COMMIT exitoso: Se insertaron ${insertados} repuestos en la tabla 'almacen' (${omitidos} omitidos por ya existir).`);
    }

    console.log('================================================================');
    console.log(`🎉 SINCRONIZACIÓN DE ALMACÉN COMPLETADA`);
    console.log(`   - Nuevos repuestos en Almacén : ${insertados}`);
    console.log(`   - Existentes conservados      : ${omitidos}`);
    console.log('================================================================\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la sincronización de almacén:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

sincronizarAlmacen();
