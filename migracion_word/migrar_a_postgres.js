/**
 * SCRIPT DE INYECCIÓN IDEMPOTENTE A POSTGRESQL
 * TALLER AUTOMOTRIZ VARGAS
 * 
 * Lee el dataset estructurado 'simulacion_datos.json' e inserta de forma relacional y segura:
 * 1. Mecánicos (tabla: mecanicos)
 * 2. Clientes (tabla: clientes) — reutiliza si ya existen por RUC/DNI o nombre
 * 3. Vehículos (tabla: vehiculos) — reutiliza si ya existen por placa
 * 4. Órdenes de Servicio (tabla: ordenes_servicio) — con proforma, notas y recomendaciones
 * 5. Ítems de Costo (tabla: items_costo) — repuestos e insumos vs mano de obra
 * 6. Registro de Cobros (tabla: cobros) — para cuadrar ingresos y KPIs históricos
 * 
 * Soporta banderas:
 *   --dry-run : Ejecuta toda la lógica pero hace ROLLBACK al final (simulación DB)
 */

const fs = require('fs');
const path = require('path');
const pg = require('../taller-vargas/backend/node_modules/pg');
const dotenv = require('../taller-vargas/backend/node_modules/dotenv');

// Cargar variables de entorno del backend si existe
const envPath = path.join(__dirname, '../taller-vargas/backend/.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const IS_DRY_RUN = process.argv.includes('--dry-run');

// Configuración de conexión (Local por defecto o variables de Docker/Prod)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5436', 10),
  user: process.env.DB_USER || 'vargas_user',
  password: process.env.DB_PASSWORD || 'vargas_password',
  database: process.env.DB_NAME || 'taller_vargas_db'
};

const ARCHIVO_JSON = path.join(__dirname, 'simulacion_datos.json');

function normalizarFechaIso(fStr) {
  if (!fStr) return null;
  const s = String(fStr).trim();

  let y = null, m = null, d = null;

  // Caso 1: Formato ISO YYYY-MM-DD
  const matchIso = s.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/);
  if (matchIso) {
    y = parseInt(matchIso[1], 10);
    m = parseInt(matchIso[2], 10);
    d = parseInt(matchIso[3], 10);
  } else {
    // Caso 2: Formato latino DD-MM-YYYY o DD-MM-YY
    const matchLat = s.match(/\b(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})\b/);
    if (!matchLat) return null;
    d = parseInt(matchLat[1], 10);
    m = parseInt(matchLat[2], 10);
    y = parseInt(matchLat[3], 10);
    if (y < 50) y += 2000;
    else if (y < 100) y += 1900;
    else if (y > 200 && y < 1000) y += 1800;
  }

  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;

  // Limitar año razonable
  if (y < 1990 || y > 2035) y = 2024;
  if (m < 1) m = 1;
  if (m > 12) m = 12;

  // Ajustar día al último día válido del mes (ej. 31 de abril -> 30 de abril, 29 feb no bisiesto -> 28 feb)
  const maxDias = new Date(y, m, 0).getDate();
  if (d < 1) d = 1;
  if (d > maxDias) d = maxDias;

  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

async function migrar() {
  console.log('================================================================');
  console.log('🚗 INYECCIÓN DE HISTORIAL A POSTGRESQL — TALLER AUTOMOTRIZ VARGAS');
  console.log(`   Host: ${dbConfig.host}:${dbConfig.port} | DB: ${dbConfig.database} | Modo: ${IS_DRY_RUN ? 'DRY-RUN (Simulación)' : 'REAL (Escritura activa)'}`);
  console.log('================================================================\n');

  if (!fs.existsSync(ARCHIVO_JSON)) {
    console.error(`❌ Error: No se encontró el archivo de datos ${ARCHIVO_JSON}.`);
    console.error('   Ejecuta primero: node migracion_word/simular_migracion.js');
    process.exit(1);
  }

  const rawData = fs.readFileSync(ARCHIVO_JSON, 'utf-8');
  const dataset = JSON.parse(rawData);

  const pool = new pg.Pool(dbConfig);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('🔒 Transacción SQL iniciada.');

    // ─────────────────────────────────────────────────────────────
    // 1. INYECCIÓN DE MECÁNICOS
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- [1/5] Sincronizando Mecánicos ---');
    const mapaMecanicosId = new Map();
    const mecanicosDetectados = dataset.resumen.mecanicosDetectados || [];

    for (const mecNombre of mecanicosDetectados) {
      if (!mecNombre || mecNombre === 'Taller General') continue;
      const res = await client.query('SELECT id, nombre FROM mecanicos WHERE LOWER(nombre) = LOWER($1)', [mecNombre]);
      if (res.rows.length > 0) {
        mapaMecanicosId.set(mecNombre.toLowerCase(), res.rows[0].id);
        console.log(`   ✓ Mecánico existente: ${res.rows[0].nombre} (ID: ${res.rows[0].id})`);
      } else {
        const ins = await client.query('INSERT INTO mecanicos (nombre, activo) VALUES ($1, true) RETURNING id, nombre', [mecNombre]);
        mapaMecanicosId.set(mecNombre.toLowerCase(), ins.rows[0].id);
        console.log(`   + Nuevo mecánico insertado: ${ins.rows[0].nombre} (ID: ${ins.rows[0].id})`);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. INYECCIÓN DE CLIENTES (Idempotente)
    // ─────────────────────────────────────────────────────────────
    // 2. INYECCIÓN DE CLIENTES (Idempotente y libre de colisiones)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- [2/5] Sincronizando Clientes y Empresas ---');
    const mapaClientesId = new Map();

    // Obtener correlativo numérico máximo para códigos temporales ya existentes
    const maxTempRes = await client.query(`
      SELECT COALESCE(MAX(CAST(SUBSTRING(num_doc FROM 6) AS INTEGER)), 0) AS max_num
      FROM clientes
      WHERE num_doc LIKE 'TEMP-%' AND num_doc ~ '^TEMP-[0-9]+$'
    `);
    let nextTempNum = parseInt(maxTempRes.rows[0].max_num || 0, 10) + 1;

    let clisExistentesCount = 0;
    let clisNuevosCount = 0;

    for (const c of dataset.clientes) {
      const esDocReal = c.numDoc && !c.numDoc.startsWith('TEMP-');
      
      // Buscar cliente existente por nombre normalizado (o por documento real si aplica)
      const busqueda = await client.query(`
        SELECT id, nombre, num_doc FROM clientes 
        WHERE LOWER(REPLACE(REPLACE(nombre, '.', ''), ' ', '')) = LOWER(REPLACE(REPLACE($1, '.', ''), ' ', '')) 
           ${esDocReal ? 'OR num_doc = $2' : ''}
        LIMIT 1
      `, esDocReal ? [c.nombre, c.numDoc] : [c.nombre]);

      if (busqueda.rows.length > 0) {
        const cliExistente = busqueda.rows[0];
        mapaClientesId.set(c.nombre.toLowerCase(), cliExistente.id);
        clisExistentesCount++;
      } else {
        const docAsignado = esDocReal 
          ? c.numDoc 
          : `TEMP-${String(nextTempNum++).padStart(5, '0')}`;

        const insCli = await client.query(`
          INSERT INTO clientes (tipo_doc, num_doc, nombre, telefono, notas)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, nombre, num_doc
        `, [
          c.tipoDoc,
          docAsignado,
          c.nombre,
          c.telefono && c.telefono !== 'Por actualizar' ? c.telefono : '999999999',
          `Migrado desde archivo histórico: ${c.archivoOrigen || 'Histórico Vargas'}`
        ]);

        mapaClientesId.set(c.nombre.toLowerCase(), insCli.rows[0].id);
        clisNuevosCount++;
      }
    }
    console.log(`   ✓ Clientes procesados: ${clisNuevosCount} nuevos registrados, ${clisExistentesCount} existentes reutilizados.`);

    // ─────────────────────────────────────────────────────────────
    // 3. INYECCIÓN DE VEHÍCULOS Y EQUIPOS
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- [3/5] Sincronizando Vehículos y Equipos ---');
    const mapaVehiculosId = new Map();

    function normalizarPlaca(raw) {
      if (!raw) return 'SIN-PLACA';
      let clean = String(raw).trim().toUpperCase();

      // Quitar caracteres iniciales o finales residuales
      clean = clean.replace(/^[:\s.\-]+/, '').replace(/[.\s]+$/, '');
      // Normalizar cualquier tipo de guion
      clean = clean.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D_–—]/g, '-');
      clean = clean.replace(/\s+/g, '');

      // Si es una fecha completa, no es placa
      if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(clean)) return null;

      // Si es odómetro/kilometraje
      if (/^\d{1,3}[´'`]?\d{3}$/.test(clean) || /^\d{5,7}$/.test(clean)) return null;

      // Maquinaria / motores específicos
      if (/HONDA.*GX|GX390/i.test(clean)) return 'MAQ-MOTOR-HONDA';
      if (clean.startsWith('MAQ-') || clean.startsWith('SP-')) return clean.substring(0, 20);

      const soloChars = clean.replace(/[-.]/g, '').trim();

      // Placa moderna peruana (3 alfanum - 3 alfanum)
      if (soloChars.length === 6 && /\d/.test(soloChars) && /[A-Z]/.test(soloChars)) {
        return soloChars.substring(0, 3) + '-' + soloChars.substring(3, 6);
      }

      // Placa antigua peruana (2 letras/alfanum - 3 a 4 dígitos)
      const mOld = soloChars.match(/^([A-Z0-9]{2})([0-9]{3,4})$/);
      if (mOld) return mOld[1] + '-' + mOld[2];

      // Placa de motocicleta (4 dígitos - 2 alfanum)
      const mMoto = soloChars.match(/^([0-9]{4})([A-Z0-9]{2})$/);
      if (mMoto) return mMoto[1] + '-' + mMoto[2];

      return clean.substring(0, 20);
    }

    function sanitizarKm(rawKm) {
      if (!rawKm) return 0;
      const num = parseInt(String(rawKm).replace(/\D/g, ''), 10);
      if (isNaN(num) || num <= 0) return 0;
      if (num <= 600000) return num;
      
      // Si tiene más de 6 dígitos (ej. fechas concatenadas con kilometrajes)
      const s = String(num);
      let cand = parseInt(s.substring(0, 6), 10);
      if (cand > 600000) {
        cand = parseInt(s.substring(0, 5), 10);
      }
      if (cand > 600000 || isNaN(cand)) return 0;
      return cand;
    }

    let vehExistentesCount = 0;
    let vehNuevosCount = 0;

    for (const v of dataset.vehiculos) {
      const placaLimpia = normalizarPlaca(v.placa);
      const cliId = mapaClientesId.get(v.clienteNombre.toLowerCase()) || null;
      const kmLimpio = sanitizarKm(v.kmActual);

      // Si ya lo tenemos mapeado en memoria en esta misma ejecución
      if (mapaVehiculosId.has(placaLimpia)) {
        continue;
      }

      const busqVeh = await client.query('SELECT id, placa, cliente_id, km_actual FROM vehiculos WHERE placa = $1', [placaLimpia]);

      if (busqVeh.rows.length > 0) {
        const vehEx = busqVeh.rows[0];
        mapaVehiculosId.set(placaLimpia, vehEx.id);
        if (kmLimpio && kmLimpio > (vehEx.km_actual || 0)) {
          await client.query('UPDATE vehiculos SET km_actual = $1 WHERE id = $2', [kmLimpio, vehEx.id]);
        }
        vehExistentesCount++;
      } else {
        const insVeh = await client.query(`
          INSERT INTO vehiculos (placa, marca_modelo, tipo_vehiculo, cliente_id, km_actual, ultima_visita)
          VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
          RETURNING id, placa
        `, [
          placaLimpia,
          (v.marcaModelo || 'Vehículo general').substring(0, 250),
          v.tipoVehiculo || 'Sedan',
          cliId,
          kmLimpio
        ]);

        mapaVehiculosId.set(placaLimpia, insVeh.rows[0].id);
        vehNuevosCount++;
      }
    }
    console.log(`   ✓ Vehículos procesados: ${vehNuevosCount} nuevos registrados, ${vehExistentesCount} existentes actualizados.`);

    // ─────────────────────────────────────────────────────────────
    // 4. INYECCIÓN DE ÓRDENES DE SERVICIO, ÍTEMS Y COBROS
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- [4/5] Inyectando Órdenes Históricas, Desglose de Costos y Cobros ---');
    let ordenesInsertadas = 0;
    let ordenesOmitidas = 0;
    let itemsInsertados = 0;
    const totalOrdenes = dataset.ordenes.length;

    for (let idx = 0; idx < totalOrdenes; idx++) {
      const o = dataset.ordenes[idx];
      const placaLimpia = normalizarPlaca(o.placa);
      const vehId = mapaVehiculosId.get(placaLimpia);
      const cliId = mapaClientesId.get(o.cliente.toLowerCase()) || null;

      // Buscar mecánico
      let mecId = null;
      if (o.mecanico && o.mecanico !== 'Taller General') {
        const primerMec = o.mecanico.split(/–|-|\/|,|&/)[0].trim().toLowerCase();
        mecId = mapaMecanicosId.get(primerMec) || null;
      }

      const fechaIngresoSql = normalizarFechaIso(o.fechaIngreso) || '2024-01-01';
      const fechaEntregaSql = normalizarFechaIso(o.fechaSalida) || fechaIngresoSql;
      const fechaCobroSql = normalizarFechaIso(o.fechaPago) || fechaIngresoSql;

      // Verificar si la orden ya fue inyectada previamente para evitar duplicados
      const busqOrd = await client.query(`
        SELECT id FROM ordenes_servicio
        WHERE vehiculo_id = $1 
          AND fecha_ingreso::date = $2::date 
          AND total_estimado = $3
        LIMIT 1
      `, [vehId, fechaIngresoSql, o.totalEstimado]);

      if (busqOrd.rows.length > 0) {
        ordenesOmitidas++;
        continue;
      }

      // Preparar nota interna con toda la metadata histórica
      const lineasNota = [
        `[MIGRACIÓN WORD] Archivo origen: ${o.archivoOrigen}`,
        o.tipoDocumento === 'PROFORMA' ? `Documento original: PROFORMA ${o.numProforma ? '#' + o.numProforma : ''}` : 'Documento original: Orden de trabajo',
        `Mecánico a cargo: ${o.mecanico}`,
        o.estadoPago === 'PAGADO' ? `Estado de pago: CANCELADO ${o.fechaPago ? '(' + o.fechaPago + ')' : ''}` : 'Estado de pago: PENDIENTE'
      ];
      if (o.recomendacionProxima) {
        lineasNota.push(`Recomendación para próximo servicio: ${o.recomendacionProxima}`);
      }

      // Insertar orden_servicio
      const insOrd = await client.query(`
        INSERT INTO ordenes_servicio (
          vehiculo_id, cliente_id, mecanico_id, estado,
          kilometraje, falla_reportada, total_estimado,
          fecha_ingreso, fecha_entrega, nota_interna
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, [
        vehId,
        cliId,
        mecId,
        'Finalizado',
        o.kilometraje ? String(sanitizarKm(o.kilometraje) || o.kilometraje).substring(0, 45) : null,
        (o.fallaReportada || 'Mantenimiento preventivo / correctivo').substring(0, 1000),
        o.totalEstimado || 0,
        fechaIngresoSql,
        fechaEntregaSql,
        lineasNota.join('\n')
      ]);

      const ordenId = insOrd.rows[0].id;
      ordenesInsertadas++;

      // Inserción por lote (batch) de ítems de costo si existen
      if (o.items && o.items.length > 0) {
        const itemValues = [];
        const itemParams = [];
        let pIdx = 1;

        for (const it of o.items) {
          const descSegura = it.descripcion.length > 495 ? it.descripcion.substring(0, 492) + '...' : it.descripcion;
          itemValues.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
          itemParams.push(
            ordenId,
            it.tipo === 'servicio' ? 'servicio' : 'repuesto',
            descSegura,
            Math.max(1, Math.min(999, Math.round(it.cantidad || 1))),
            Math.max(0, Math.min(60000, Number(it.precioUnitario || 0)))
          );
          itemsInsertados++;
        }

        await client.query(`
          INSERT INTO items_costo (orden_id, tipo, descripcion, cantidad, precio_unitario)
          VALUES ${itemValues.join(', ')}
        `, itemParams);
      }

      // Insertar registro en cobros para que cuadren los KPIs financieros
      await client.query(`
        INSERT INTO cobros (
          orden_id, cliente_id, monto_total, estado,
          metodo_pago, tipo_comprobante, fecha_emision, fecha_cobro
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (orden_id) DO NOTHING
      `, [
        ordenId,
        cliId,
        o.totalEstimado || 0,
        o.estadoPago === 'PAGADO' ? 'Cancelado' : 'Pendiente',
        'Efectivo',
        o.tipoDocumento === 'PROFORMA' ? 'Proforma' : 'Nota',
        fechaIngresoSql,
        fechaCobroSql
      ]);

      if ((idx + 1) % 1000 === 0 || idx + 1 === totalOrdenes) {
        const pct = ((idx + 1) / totalOrdenes * 100).toFixed(1);
        console.log(`   [${idx + 1}/${totalOrdenes}] (${pct}%) Órdenes procesadas | Insertadas: ${ordenesInsertadas} | Omitidas: ${ordenesOmitidas} | Ítems: ${itemsInsertados}`);
      }
    }

    console.log(`   ✓ Órdenes de servicio procesadas: ${ordenesInsertadas} insertadas, ${ordenesOmitidas} ya existentes`);
    console.log(`   ✓ Ítems de costo insertados     : ${itemsInsertados}`);

    if (IS_DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('\n🔄 Modo DRY-RUN activo: Se ejecutó ROLLBACK. La base de datos no sufrió modificaciones.');
    } else {
      await client.query('COMMIT');
      console.log('\n💾 COMMIT realizado con éxito: Todos los datos han sido guardados permanentemente.');
    }

    console.log('\n================================================================');
    console.log('🎉 INYECCIÓN COMPLETADA EXITOSAMENTE');
    console.log(`   - Clientes registrados : ${mapaClientesId.size}`);
    console.log(`   - Vehículos vinculados : ${mapaVehiculosId.size}`);
    console.log(`   - Órdenes guardadas    : ${ordenesInsertadas}`);
    console.log(`   - Ítems de costo       : ${itemsInsertados}`);
    console.log('================================================================\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ ERROR DURANTE LA INYECCIÓN (Se ejecutó ROLLBACK):', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

migrar().catch(console.error);
