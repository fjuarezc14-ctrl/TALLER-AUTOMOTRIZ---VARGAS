/**
 * SIMULADOR Y EXTRACTOR ESTRUCTURAL DE HISTORIAL WORD (.DOCX)
 * TALLER AUTOMOTRIZ VARGAS
 * 
 * Lee todos los documentos .docx en ./migracion_word, extrae y normaliza:
 * - Clientes y empresas
 * - Vehículos y equipos
 * - Órdenes de servicio históricas fechadas
 * - Desglose de Repuestos/Insumos vs Mano de Obra/Servicios
 * 
 * Genera:
 * 1. simulacion_datos.json (Dataset estructurado para la futura ingesta SQL)
 * 2. reporte_simulacion.html (Dashboard visual interactivo para revisión)
 */

const fs = require('fs');
const path = require('path');
const mammoth = require('../taller-vargas/backend/node_modules/mammoth');

const DIR_MIGRACION = __dirname;
const ARCHIVO_JSON = path.join(DIR_MIGRACION, 'simulacion_datos.json');
const ARCHIVO_HTML = path.join(DIR_MIGRACION, 'reporte_simulacion.html');

// Extractor y parseador robusto de montos monetarios (maneja separadores de miles y decimales)
function parsearMonto(str) {
  if (!str) return 0;
  const s = String(str).trim();

  // 1. Detectar fechas escritas con guiones o barras (ej. 16-01-19, 15/02/2019)
  if (/\b\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}\b/.test(s)) return 0;

  // 2. Detectar RUC (11 dígitos), DNI (8 dígitos), teléfonos (9 dígitos), CCI (14-20 dígitos) sin decimales
  const soloDigitos = s.replace(/\D/g, '');
  if ((soloDigitos.length === 8 || soloDigitos.length === 9 || soloDigitos.length === 11 || soloDigitos.length >= 14) && !/[.,]\d{2}$/.test(s)) {
    return 0; // Es RUC, DNI, teléfono o cuenta bancaria CCI
  }

  let raw = s.replace(/[^0-9.,]/g, '').trim();
  if (!raw) return 0;

  const lastDot = raw.lastIndexOf('.');
  const lastComma = raw.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastDot > lastComma) {
      // 2,676.00 -> 2676.00
      raw = raw.replace(/,/g, '');
    } else {
      // 2.676,00 -> 2676.00
      raw = raw.replace(/\./g, '').replace(',', '.');
    }
  } else if (lastComma !== -1) {
    const partes = raw.split(',');
    if (partes.length === 2 && partes[1].length === 2) {
      raw = raw.replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }
  }
  const val = parseFloat(raw);
  if (isNaN(val) || val <= 0 || val > 60000) return 0;
  return Number(val.toFixed(2));
}

function esDocumentoAdministrativo(file) {
  const f = file.toUpperCase();
  return (
    f.startsWith('DECLARACI') ||
    f.startsWith('CARTA') ||
    f.startsWith('ANEXO') ||
    f.startsWith('ACTA') ||
    f.startsWith('CONSTANCIA') ||
    f.startsWith('CONFORMIDAD') ||
    f.startsWith('FORMATO') ||
    f.startsWith('DOCUMENTOS A PRESENTAR') ||
    f.startsWith('FOTOS') ||
    f.startsWith('CURRICULUM') ||
    f.startsWith('CONTRATO') ||
    f.startsWith('DJ ') ||
    f.startsWith('DJ_') ||
    f.includes('COTIZACION ESSALUD') ||
    f.includes('DOCUMENTOS DE COTIZACION') ||
    f.includes('RED ASISTENCIAL') ||
    f.includes('ABONO CUENTA') ||
    f.includes('DETRACCION') ||
    f.includes('HOJA DE INVENTARIO') ||
    f.includes('PLAN DE MANTENIMIENTO')
  );
}

// Normalizador y deduplicador de Clientes
function normalizarCliente(nombreRaw) {
  if (!nombreRaw) return { nombre: 'Cliente General', tipoDoc: 'DNI', key: 'cliente general' };
  let nombre = nombreRaw.trim().replace(/\s+/g, ' ');

  nombre = nombre.replace(/^(?:SEÑOR(?:A|ITA|ES)?|SRA\.?|SR\.?|CLIENTE)\s*[:\-]?\s*/i, '').trim();

  const esEmpresa = /\b(?:S\.?A\.?C\.?|S\.?A\.?|E\.?I\.?R\.?L\.?|S\.?R\.?L\.?|S\.?A\.?A\.?|CENTRO DE SALUD|MINERA|CONSORCIO|DISTRIBUIDORA|EMPRESA|FONDO\s+SOCIAL|FONCODES|UNIDAD\s+EJECUTORA|MUNICIPALIDAD|GOBIERNO|MINISTERIO|DIRECCION|RED\s+DE\s+SALUD|HOSPITAL|POSTA|ASOCIACION|COOPERATIVA|INSTITUTO|COMISARIA|SUB\s+REGION|UGEL)\b/i.test(nombre);

  let key = nombre.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(?:s\.?a\.?c\.?|s\.?a\.?|e\.?i\.?r\.?l\.?|s\.?r\.?l\.?|s\.?a\.?a\.?)\b/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let nombreFormateado = nombre;
  if (/gloria/i.test(key)) {
    nombreFormateado = 'Gloria S.A.C.';
    key = 'gloria';
  } else if (/greisy/i.test(key)) {
    nombreFormateado = 'Greisy Sánchez';
    key = 'greisy sanchez';
  } else if (/wilson/i.test(key)) {
    nombreFormateado = 'Wilson Díaz';
    key = 'wilson diaz';
  } else if (/michi/i.test(key)) {
    nombreFormateado = 'Fondo Social Michiquillay';
    key = 'fondo social michiquillay';
  } else if (/foncodes/i.test(key)) {
    if (!/elmer\s+saenz/i.test(nombre)) {
      nombreFormateado = 'FONCODES - Unidad Ejecutora 004';
      key = 'foncodes';
    }
  } else if (/hospital\s+regional/i.test(key)) {
    nombreFormateado = 'Hospital Regional Docente de Cajamarca';
    key = 'hospital regional docente de cajamarca';
  } else if (/marvisur/i.test(key)) {
    nombreFormateado = 'Arequipa Expreso Marvisur E.I.R.L.';
    key = 'arequipa expreso marvisur';
  } else if (/yannet/i.test(key) && /vargas/i.test(key)) {
    nombreFormateado = 'Yannet Liliana Vargas Castro';
    key = 'yannet liliana vargas castro';
  }

  return {
    nombre: nombreFormateado,
    tipoDoc: (esEmpresa || /gloria|centro de salud|michi|foncodes|hospital|marvisur/i.test(key)) ? 'RUC' : 'DNI',
    key: key || nombre.toLowerCase()
  };
}

// Normalizador de Mecánicos
function normalizarMecanico(str) {
  if (!str) return 'Taller General';
  let s = str.trim();
  const lower = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (lower === 'moises') return 'Moisés';
  if (lower === 'jose luis') return 'José Luis';
  if (lower === 'sangay') return 'Sangay';
  if (lower === 'elmer') return 'Elmer';
  if (lower === 'choca') return 'Choca';
  if (lower === 'elvis') return 'Elvis';
  if (lower === 'alex') return 'Alex';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Normalizador de fecha a formato YYYY-MM-DD
function normalizarFecha(str) {
  if (!str) return { fechaIngreso: null, fechaSalida: null, textoOriginal: '' };
  const raw = String(str).trim();
  
  // Detectar "salió" o fechas compuestas
  let fechaSalida = null;
  const matchSalio = raw.match(/sali[oó]\s*[:\-]?\s*(\d{1,2}[-/. ]\d{1,2}[-/. ]\d{2,4})/i);
  if (matchSalio) {
    fechaSalida = convertirAFechaIso(matchSalio[1]);
  }

  // Buscar la fecha principal
  const matchFecha = raw.match(/\b(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})\b/);
  const fechaIngreso = matchFecha ? convertirAFechaIso(matchFecha[0]) : null;

  return {
    fechaIngreso: fechaIngreso || '2024-01-01',
    fechaSalida: fechaSalida,
    textoOriginal: raw
  };
}

function convertirAFechaIso(fStr) {
  if (!fStr) return null;
  const p = fStr.split(/[-/. ]/).map(s => s.trim()).filter(Boolean);
  if (p.length < 3) return null;
  let d = parseInt(p[0], 10);
  let m = parseInt(p[1], 10);
  let y = parseInt(p[2], 10);

  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;

  // Corregir años de 2 dígitos o tipográficos
  if (y < 50) y += 2000;
  else if (y < 100) y += 1900;
  else if (y > 200 && y < 1000) y += 1800; // Ej: 201 -> 2001 aprox

  if (m < 1 || m > 12) m = 1;
  if (d < 1 || d > 31) d = 1;

  const mStr = String(m).padStart(2, '0');
  const dStr = String(d).padStart(2, '0');
  return `${y}-${mStr}-${dStr}`;
}

// Normalizador de Kilometraje
function normalizarKm(str) {
  if (!str) return { kmActual: null, kmSiguiente: null, textoOriginal: '' };
  const raw = String(str).trim();
  if (/TRABAJO|MECANICO|CANTIDAD/i.test(raw)) {
    return { kmActual: null, kmSiguiente: null, textoOriginal: raw };
  }

  // Detectar sugerencias tipo 49,989+6,000
  let kmSiguiente = null;
  const partesPlus = raw.split('+');
  if (partesPlus.length > 1) {
    const extra = parseInt(partesPlus[1].replace(/[^\d]/g, ''), 10);
    if (!isNaN(extra)) kmSiguiente = extra;
  }

  const limpio = partesPlus[0].replace(/[^\d]/g, '');
  const kmActual = parseInt(limpio, 10);

  return {
    kmActual: isNaN(kmActual) ? null : kmActual,
    kmSiguiente: kmSiguiente,
    textoOriginal: raw
  };
}

// Normalizador estricto de placa vehicular o maquinaria
function normalizarPlaca(raw) {
  if (!raw) return 'SIN-PLACA';
  let clean = String(raw).trim().toUpperCase();

  // 1. Quitar caracteres iniciales o finales residuales
  clean = clean.replace(/^[:\s.\-]+/, '').replace(/[.\s]+$/, '');
  // Normalizar cualquier tipo de guion
  clean = clean.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D_–—]/g, '-');
  clean = clean.replace(/\s+/g, '');

  // 2. Si es una fecha completa (ej. 17-09-18, 15-12-2023), NO es placa
  if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(clean)) return null;

  // 3. Si es un kilometraje (ej. 197'689 o dígitos puros)
  if (/^\d{1,3}[´'`]?\d{3}$/.test(clean) || /^\d{5,7}$/.test(clean)) return null;

  // 4. Maquinaria / motores específicos
  if (/HONDA.*GX|GX390/i.test(clean)) return 'MAQ-MOTOR-HONDA';
  if (clean.startsWith('MAQ-') || clean.startsWith('SP-')) return clean.substring(0, 20);

  // Limpiar guiones y puntos internos para reestructurar
  const soloChars = clean.replace(/[-.]/g, '').trim();

  // 5. Placa moderna peruana (3 alfanum - 3 alfanum, ej. M1X-844, M4F-858, M4Y-029)
  if (soloChars.length === 6 && /\d/.test(soloChars) && /[A-Z]/.test(soloChars)) {
    return soloChars.substring(0, 3) + '-' + soloChars.substring(3, 6);
  }

  // 6. Placa antigua peruana (2 letras/alfanum - 3 a 4 dígitos, ej. PL-3453, QG-497, FB-892)
  const mOld = soloChars.match(/^([A-Z0-9]{2})([0-9]{3,4})$/);
  if (mOld) return mOld[1] + '-' + mOld[2];

  // 7. Placa de motocicleta (4 dígitos - 2 alfanum)
  const mMoto = soloChars.match(/^([0-9]{4})([A-Z0-9]{2})$/);
  if (mMoto) return mMoto[1] + '-' + mMoto[2];

  return clean.substring(0, 20);
}

// Extractor de Placa desde texto o nombre de archivo
function extraerPlaca(texto, nombreArchivo) {
  // 1. En el encabezado
  if (texto) {
    const match = texto.match(/PLACA\s*:\s*([^<\r\n]+)/i);
    if (match && match[1].trim()) {
      const p = normalizarPlaca(match[1]);
      if (p && p.length >= 5 && p !== 'SIN-PLACA' && /\d/.test(p)) return p;
    }
  }
  // 2. En el nombre de archivo (formato estándar peruano ABC-123 o M7Q-770 con dígitos requeridos)
  const matchPlacaArchivo = nombreArchivo.match(/\b([A-Z0-9]{3}[-\s]?[0-9][A-Z0-9]{2})\b/i) ||
                            nombreArchivo.match(/\b([A-Z]{1,3}[-\s]?[0-9]{3,4})\b/i);
  if (matchPlacaArchivo) {
    const cand = normalizarPlaca(matchPlacaArchivo[1]);
    if (/\d/.test(cand) && cand.replace(/[^A-Z0-9]/g, '').length >= 5) {
      return cand;
    }
  }

  // 3. Caso especial (maquinaria/generador/sin placa)
  const base = path.basename(nombreArchivo, path.extname(nombreArchivo)).toUpperCase();
  if (/GENERADOR|ELECTROGENO/i.test(base)) return 'MAQ-GENERADOR';
  if (/MONTACARGA/i.test(base)) return 'MAQ-MONTACARGA';
  if (/TROMPO/i.test(base)) return 'MAQ-TROMPO';
  if (/TRACTOR/i.test(base)) return 'MAQ-TRACTOR';
  if (/RETROEXCAVA/i.test(base)) return 'MAQ-RETROEXCAVA';
  if (/SOLDADORA/i.test(base)) return 'MAQ-SOLDADORA';
  if (/MOTOR.*ESTACIONARIO/i.test(base)) return 'MAQ-MOTOR-ESTAC';

  return 'SIN-PLACA';
}

// Limpiador de texto de celdas
function cleanCell(html) {
  return html ? html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

async function ejecutarSimulacion() {
  console.log('================================================================');
  console.log('🚗 INICIANDO SIMULACIÓN DE MIGRACIÓN: TALLER AUTOMOTRIZ VARGAS');
  console.log('================================================================\n');

  function buscarArchivosDocx(dir) {
    let encontrados = [];
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (!item.startsWith('.') && item !== 'node_modules') {
            encontrados = encontrados.concat(buscarArchivosDocx(full));
          }
        } else if (item.endsWith('.docx') && !item.startsWith('~$')) {
          encontrados.push(full);
        }
      }
    } catch (_) {}
    return encontrados;
  }

  const dirEmpresas = path.join(DIR_MIGRACION, 'CLIENTES - EMPRESAS');
  const dirPersonas = path.join(DIR_MIGRACION, 'CLIENTES - PERSONAS');
  
  let filesPaths = [];
  if (fs.existsSync(dirEmpresas) || fs.existsSync(dirPersonas)) {
    if (fs.existsSync(dirEmpresas)) filesPaths = filesPaths.concat(buscarArchivosDocx(dirEmpresas));
    if (fs.existsSync(dirPersonas)) filesPaths = filesPaths.concat(buscarArchivosDocx(dirPersonas));
  } else {
    filesPaths = buscarArchivosDocx(DIR_MIGRACION);
  }

  console.log(`📁 Archivos Word (.docx) detectados en carpeta y subcarpetas: ${filesPaths.length}\n`);

  const mapaClientes = new Map();
  const mapaVehiculos = new Map();
  const listaOrdenes = [];
  const setOrdenesDetectadas = new Set();
  const catalogoRepuestos = new Map();
  const catalogoServicios = new Map();
  const listaMecanicos = new Set();
  const alertasMigracion = [];

  let totalItemsExtraidos = 0;
  let montoTotalHistorico = 0;

  for (let idx = 0; idx < filesPaths.length; idx++) {
    const filePath = filesPaths[idx];
    const file = path.basename(filePath);
    
    // Loguear progreso cada 50 archivos o al inicio/fin para un output limpio
    if (idx === 0 || (idx + 1) % 50 === 0 || idx + 1 === filesPaths.length) {
      const pct = ((idx + 1) / filesPaths.length * 100).toFixed(1);
      console.log(`[${idx + 1}/${filesPaths.length}] (${pct}%) Procesando: "${file}" | Clientes: ${mapaClientes.size} | Vehículos: ${mapaVehiculos.size} | Órdenes: ${listaOrdenes.length}`);
    }

    if (esDocumentoAdministrativo(file)) {
      alertasMigracion.push({ 
        archivo: file, 
        tipo: 'DOCUMENTO_ADMINISTRATIVO', 
        mensaje: 'Documento legal/administrativo de licitaciones (se omite para no registrar órdenes falsas).' 
      });
      continue;
    }

    let html;
    try {
      const res = await mammoth.convertToHtml({ path: filePath });
      html = res.value;
    } catch (err) {
      alertasMigracion.push({ archivo: file, tipo: 'ERROR_LECTURA', mensaje: err.message });
      continue;
    }

    // El documento se divide en secciones/tablas históricas
    const tableParts = html.split(/<table[^>]*>/i);
    const totalTablas = tableParts.length - 1;

    if (totalTablas === 0) {
      const esInforme = /INFORME|PERITAJE|DIAGN[OÓ]STICO/i.test(file);
      alertasMigracion.push({ 
        archivo: file, 
        tipo: esInforme ? 'INFORME_TECNICO' : 'SIN_TABLAS', 
        mensaje: esInforme ? 'Documento narrativo (Informe Técnico sin tabla de costos).' : 'No se encontraron tablas de órdenes en el archivo.' 
      });
      continue;
    }

    // Datos por defecto del documento (a partir del nombre del archivo y carpeta contenedora)
    const nombreBase = path.basename(file, '.docx');
    const carpetaPadre = path.basename(path.dirname(filePath));
    const esCarpetaEmpresa = carpetaPadre && !['migracion_word', 'archivos', 'word', 'documentos'].includes(carpetaPadre.toLowerCase());

    let clienteDoc = nombreBase.replace(/Auto.*|Camioneta.*|Ambulancia.*|Moto.*|[A-Z0-9]{3}[-\s]?[A-Z0-9]{3}.*/i, '').trim();
    if (!clienteDoc || clienteDoc.length < 3) {
      clienteDoc = esCarpetaEmpresa ? carpetaPadre : nombreBase;
    }
    let vehiculoDoc = 'Vehículo general';
    let placaDoc = extraerPlaca('', file);

    for (let i = 1; i <= totalTablas; i++) {
      const preHtml = tableParts[i - 1];
      const tableContent = tableParts[i].split(/<\/table>/i)[0];

      // Encabezados de esta orden
      const senorMatch = preHtml.match(/(?:SEÑOR(?:A|ITA|ES)?|CLIENTE|SRA\.?)\s*:\s*([^<\r\n]+)/i);
      const vehiculoMatch = preHtml.match(/(?:VEHICULO|VEHÍCULO|UNIDAD)\s*:\s*([^<\r\n]+)/i);
      const placaMatch = preHtml.match(/(?:PLACA)\s*:\s*([^<\r\n]+)/i);
      const fechaMatch = preHtml.match(/(?:FECHA(?:\s+DE)?(?:\s+INGRESO)?|FECHA)\s*:\s*([^<\r\n]+)/i);
      const kmMatch = preHtml.match(/(?:KM|KILOMETRAJE)\s*:\s*([^<\r\n]+)/i);
      const trabajoMatch = preHtml.match(/(?:TRABAJO|MECANICO|MECÁNICO)\s*:\s*([^<\r\n]+)/i);

      if (senorMatch && cleanCell(senorMatch[1])) clienteDoc = cleanCell(senorMatch[1]);
      if (vehiculoMatch && cleanCell(vehiculoMatch[1])) vehiculoDoc = cleanCell(vehiculoMatch[1]);
      let fechaDePlaca = null;
      if (placaMatch && cleanCell(placaMatch[1])) {
        const rawPlaca = cleanCell(placaMatch[1]);
        if (/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/.test(rawPlaca)) {
          fechaDePlaca = rawPlaca;
        } else {
          const pNorm = normalizarPlaca(rawPlaca);
          if (pNorm && pNorm.length >= 5 && pNorm !== 'SIN-PLACA' && (/\d/.test(pNorm) || pNorm.startsWith('MAQ-'))) {
            placaDoc = pNorm;
          }
        }
      }

      const fechaRawTexto = fechaMatch ? fechaMatch[1] : (fechaDePlaca || '');
      const { fechaIngreso, fechaSalida, textoOriginal: fechaOriginal } = normalizarFecha(fechaRawTexto);
      const { kmActual, kmSiguiente, textoOriginal: kmOriginal } = normalizarKm(kmMatch ? kmMatch[1] : '');
      const mecanicoRaw = trabajoMatch ? cleanCell(trabajoMatch[1]) : 'Taller General';

      if (mecanicoRaw && mecanicoRaw !== 'Taller General') {
        mecanicoRaw.split(/–|-|\/|,|&/).forEach(m => {
          const mNorm = normalizarMecanico(m);
          if (mNorm && mNorm.length > 2 && !/KM|TRABAJO/i.test(mNorm)) listaMecanicos.add(mNorm);
        });
      }

      // Normalizar Cliente
      const { nombre: clienteNorm, tipoDoc: tipoDocNorm, key: keyCliente } = normalizarCliente(clienteDoc);
      if (!mapaClientes.has(keyCliente)) {
        mapaClientes.set(keyCliente, {
          nombre: clienteNorm,
          tipoDoc: tipoDocNorm,
          numDoc: `TEMP-${String(mapaClientes.size + 1).padStart(4, '0')}`,
          telefono: 'Por actualizar',
          archivoOrigen: file,
          totalGastado: 0,
          totalVisitas: 0,
          placas: new Set()
        });
      }
      const clienteData = mapaClientes.get(keyCliente);

      // Normalizar Vehículo
      if (!mapaVehiculos.has(placaDoc)) {
        let tipoVeh = 'Sedan';
        if (/CAMIONETA|PICKUP|HILUX|SAVEIRO|T8/i.test(vehiculoDoc)) tipoVeh = 'Camioneta';
        else if (/AMBULANCIA/i.test(vehiculoDoc)) tipoVeh = 'Ambulancia';
        else if (/GENERADOR|MAQUINARIA|MOTOR|TRACTOR|MONTACARGA|RETROEXCAV|SOLDADORA/i.test(vehiculoDoc) || placaDoc.startsWith('MAQ-')) tipoVeh = 'Maquinaria';
        else if (/MOTO/i.test(vehiculoDoc)) tipoVeh = 'Moto';

        mapaVehiculos.set(placaDoc, {
          placa: placaDoc,
          marcaModelo: vehiculoDoc,
          tipoVehiculo: tipoVeh,
          clienteNombre: clienteData.nombre,
          kmActual: kmActual || 0,
          totalServicios: 0
        });
      }
      const vehiculoData = mapaVehiculos.get(placaDoc);

      // Extraer Proforma (si aplica)
      const proformaMatch = preHtml.match(/PROFORMA\s*N[°º\-]*\s*([0-9A-Z]+)/i);
      const tipoDocumento = proformaMatch ? 'PROFORMA' : 'ORDEN_SERVICIO';
      const numProforma = proformaMatch ? proformaMatch[1] : null;

      // Extraer Estado de Pago y Recomendaciones desde el contenido post-tabla
      const postHtml = tableParts[i].split(/<\/table>/i)[1] || '';
      const postText = cleanCell(postHtml);
      const matchCancelado = (tableContent + ' ' + postText).match(/CANCELAD[OA]\s*(?:\(([^)]+)\)|([0-9\-/.]+))?/i);
      const matchPendiente = (tableContent + ' ' + postText).match(/PENDIENTE(?:\s+DE\s+PAGO)?/i);
      let estadoPago = 'FINALIZADO';
      let fechaPago = null;
      if (matchCancelado) {
        estadoPago = 'PAGADO';
        fechaPago = matchCancelado[1] || matchCancelado[2] || null;
      } else if (matchPendiente) {
        estadoPago = 'PENDIENTE';
      }

      let recomendacionProxima = null;
      const matchRec = postHtml.match(/(?:PR[OÓ]XIMO MANTENIMIENTO|RECOMENDACIONES|OBSERVACIONES)\s*:?\s*([\s\S]*?)(?:(?:SEÑOR|VEHICULO|PLACA|PROFORMA|FECHA)\s*:|TOTAL S\/|CANCELADO|HASTA ACA|$)/i);
      if (matchRec && matchRec[1]) {
        const lines = matchRec[1].replace(/<[^>]+>/g, '\n').split('\n').map(s => s.trim())
          .filter(s => s.length > 2 && !/CANCELADO|A CUENTA|SALDO|HASTA ACA|DE AQU[ÍI]/i.test(s));
        if (lines.length > 0) {
          recomendacionProxima = lines.join(' • ');
        }
      }

      // Procesar filas de la tabla (Ítems de la orden)
      const trs = tableContent.split(/<tr[^>]*>/i).slice(1);
      const itemsOrden = [];
      let seccionActual = 'PRODUCTO'; // PRODUCTO o SERVICIO
      let totalDeclaradoEnDoc = null;
      let colMap = { cant: 0, desc: 1, unit: -1, tot: 2 }; // Default 3 cols

      trs.forEach((tr, trIdx) => {
        // Preservar celdas vacías para no desfasar el índice de columnas
        const rawCells = tr.split(/<\/td>/i);
        if (rawCells.length > 1) rawCells.pop();
        const cells = rawCells.map(cleanCell);
        if (cells.every(c => c.length === 0)) return;

        const filaTexto = cells.join(' ').toUpperCase();

        // 1. Detectar cabecera de columnas en fila 0 o 1
        if (filaTexto.includes('CANT') && (filaTexto.includes('DESC') || filaTexto.includes('DETALLE'))) {
          colMap.cant = cells.findIndex(c => /CANT/i.test(c));
          colMap.desc = cells.findIndex(c => /DESC|DETALLE/i.test(c));
          colMap.unit = cells.findIndex(c => /UNIT|P\.UNIT/i.test(c));
          colMap.tot = cells.findIndex(c => /TOT|IMPORTE/i.test(c));
          if (colMap.tot === -1) colMap.tot = cells.length - 1;
          return;
        }

        // 2. Detectar cambio de sección (Servicio Mecánico, Scanner, Rectificadora)
        if (/SERVICIO|RECTIFICADORA|MANO DE OBRA|SCANNER|SCANNEO|TORNO/i.test(filaTexto)) {
          seccionActual = 'SERVICIO';
          if (cells.length >= 2 && !filaTexto.startsWith('SERVICIO') && !filaTexto.startsWith('RECTIFICADORA')) {
            // Fila de servicio directo
          } else {
            return;
          }
        }

        // 3. Detectar pie de totales
        if (/TOTAL S\/|TOTAL S\/\.|TOTAL:|TOTAL\b|CANCELADO|A CUENTA|SALDO/i.test(filaTexto)) {
          if (/TOTAL S\/|TOTAL S\/\.|TOTAL\b/i.test(filaTexto) && !/A CUENTA|SALDO/i.test(filaTexto)) {
            for (let c = cells.length - 1; c >= 0; c--) {
              const m = parsearMonto(cells[c]);
              if (m > 0) {
                totalDeclaradoEnDoc = m;
                break;
              }
            }
            if (!totalDeclaradoEnDoc) {
              totalDeclaradoEnDoc = parsearMonto(filaTexto);
            }
          }
          return;
        }

        // 4. Extraer ítem con asignación segura de columnas
        let cantStr = colMap.cant !== -1 && cells[colMap.cant] ? cells[colMap.cant] : '';
        let descStr = colMap.desc !== -1 && cells[colMap.desc] ? cells[colMap.desc] : (cells[0] || '');
        let totStr = colMap.tot !== -1 && cells[colMap.tot] ? cells[colMap.tot] : cells[cells.length - 1];
        let unitStr = colMap.unit !== -1 && cells[colMap.unit] ? cells[colMap.unit] : '';

        // Si descStr es solo un número o precio, buscar la celda con texto
        if (!descStr || /^[0-9.,\sS\/–-]+$/.test(descStr)) {
          const textCell = cells.find(c => c.length > 2 && !/^[0-9.,\sS\/–-]+$/.test(c));
          if (textCell) {
            descStr = textCell;
          } else {
            return; // Fila sin descripción válida
          }
        }

        // Omitir cabeceras o filas no informativas
        if (descStr.length < 2 || descStr === '-' || /^(?:CANT|DESCRIPCI|TOTAL|DETALLE)/i.test(descStr)) return;

        // Omitir meros títulos de sección tipo "SERVICIO MECANICO", "SERVICIO DE TORNO" sin importe
        if (/^[-–\s]*(?:SERVICIO\s*(?:MEC[AÁ]NICO|EL[EÉ]CTRICO|DE\s*TORNO|TORNO|DE\s*SCANNER|SCANNER)?|MANO\s*DE\s*OBRA|RECTIFICADORA)$/i.test(descStr.trim())) {
          seccionActual = 'SERVICIO';
          return;
        }

        // Omitir notas de pago al pie de tabla (ej. "Cancelo en efectivo", "Plineo", "A cuenta")
        if (/(?:cancel[oó]|cancelad[oa]|cancelaci[oó]n|canelo|plineo|yape|plin|a cuenta|saldo|efectivo|visa|transferencia|abono)/i.test(descStr)) {
          estadoPago = 'PAGADO';
          if (!fechaPago) {
            const mFP = descStr.match(/(\d{1,2}[-/. ]\d{1,2}[-/. ]\d{2,4})/);
            if (mFP) fechaPago = mFP[1];
          }
          return;
        }

        // Omitir filas que sean metadatos vehiculares en tablas resumen o carátulas de licitación
        if (/\b(?:placa de rodaje|n[°º]?\s*motor|n[°º]?\s*chasis|marca\s*:|modelo\s*:)\b/i.test(descStr)) {
          return;
        }

        // Determinar cantidad
        let cantidad = 1;
        if (cantStr && cantStr !== '-') {
          cantidad = parseFloat(cantStr.replace(',', '.')) || 1;
        } else {
          const mCantDesc = descStr.match(/\b0?(\d{1,2})\s+(?:amortiguador|terminal|juego|rotula|galon|filtro|llanta|tubo|faro|guardapolvo|abrazadera)/i);
          if (mCantDesc) cantidad = parseInt(mCantDesc[1], 10);
        }

        const total = parsearMonto(totStr);
        let unitario = parsearMonto(unitStr);
        if (unitario === 0 && cantidad > 0 && total > 0) {
          unitario = Number((total / cantidad).toFixed(2));
        }

        const esServicio = seccionActual === 'SERVICIO' || 
          /\b(?:mantenimiento|alineamiento|alinear|balanceo|balancear|cambio|cambiar|reparaci|reparar|scanner|escaneo|scanneo|instalaci|instalar|engrase|engrasar|limpieza|limpiar|rectificad|rectificar|bajada|bajar|desmontar|desmontaje|montar|montaje|lavad|lavar|pulverizar|pulverizado|regulaci|regular|revisi|revisar|inspecci|inspeccionar|ajuste|ajustar|calibraci|calibrar|purgar|purgado|soldar|soldadura|evaluaci|evaluar|diagn[oó]stic|chequeo|chequear|prueba|probar|sincroniz|poner a punto|colocar a punto)\b/i.test(descStr) ||
          /^(?:colocar|poner|por servicio|mano de obra|torno)\b/i.test(descStr);

        const itemObj = {
          tipo: esServicio ? 'servicio' : 'repuesto',
          descripcion: descStr,
          cantidad: cantidad,
          precioUnitario: unitario,
          total: total
        };

        itemsOrden.push(itemObj);
      });

      // Si la tabla no contiene ningún ítem real (o era carátula de licitación), omitirla
      if (itemsOrden.length === 0) {
        continue;
      }

      // Calcular suma de la orden
      const sumaCalculada = Number(itemsOrden.reduce((acc, it) => acc + it.total, 0).toFixed(2));
      const montoOrden = totalDeclaradoEnDoc || sumaCalculada;

      // Clave de unicidad de la orden para evitar duplicar visitas si el vehículo existe en dos carpetas
      const primerDesc = (itemsOrden[0]?.descripcion || '').substring(0, 30).toLowerCase().trim();
      const ordenKey = `${placaDoc}_${fechaIngreso || 'sin_fecha'}_${montoOrden}_${primerDesc}`;
      if (setOrdenesDetectadas.has(ordenKey)) {
        continue;
      }
      setOrdenesDetectadas.add(ordenKey);

      clienteData.totalVisitas++;
      clienteData.placas.add(placaDoc);
      vehiculoData.totalServicios++;
      if (kmActual && kmActual > (vehiculoData.kmActual || 0)) {
        vehiculoData.kmActual = kmActual;
      }

      montoTotalHistorico += montoOrden;
      clienteData.totalGastado += montoOrden;

      // Acumular ítems en catálogos preliminares
      itemsOrden.forEach(it => {
        totalItemsExtraidos++;
        const keyCatalogo = it.descripcion.toLowerCase().replace(/\s+/g, ' ');
        if (it.tipo === 'servicio') {
          if (!catalogoServicios.has(keyCatalogo)) {
            catalogoServicios.set(keyCatalogo, { nombre: it.descripcion, conteo: 0, precios: [] });
          }
          const servData = catalogoServicios.get(keyCatalogo);
          servData.conteo++;
          if (it.total > 0) servData.precios.push(it.total);
        } else {
          if (!catalogoRepuestos.has(keyCatalogo)) {
            catalogoRepuestos.set(keyCatalogo, { nombre: it.descripcion, conteo: 0, unidadesTotales: 0, precios: [] });
          }
          const repData = catalogoRepuestos.get(keyCatalogo);
          repData.conteo++;
          repData.unidadesTotales += it.cantidad;
          if (it.precioUnitario > 0) repData.precios.push(it.precioUnitario);
        }
      });

      const ordenObj = {
        idVirtual: listaOrdenes.length + 1,
        archivoOrigen: file,
        cliente: clienteData.nombre,
        vehiculo: vehiculoDoc,
        placa: placaDoc,
        tipoDocumento: tipoDocumento,
        numProforma: numProforma,
        estadoPago: estadoPago,
        fechaPago: fechaPago,
        recomendacionProxima: recomendacionProxima,
        fechaIngreso: fechaIngreso,
        fechaSalida: fechaSalida,
        fechaOriginal: fechaOriginal,
        kilometraje: kmActual,
        mecanico: mecanicoRaw,
        fallaReportada: itemsOrden.filter(i => i.tipo === 'servicio').map(i => i.descripcion).join(', ') || 'Mantenimiento preventivo / correctivo',
        totalEstimado: montoOrden,
        itemsCount: itemsOrden.length,
        items: itemsOrden
      };

      listaOrdenes.push(ordenObj);
    }
  }

  // ─── CONSOLIDACIÓN CANÓNICA DE REPUESTOS Y SERVICIOS ───────
  function normalizarNombreRepuestoCanónico(raw) {
    if (!raw) return null;
    let s = raw.trim();

    // Descartar metadatos vehiculares (placas, números de motor o chasis)
    if (/\b(?:placa de rodaje|n[°º]?\s*motor|n[°º]?\s*chasis|n[°º]?\s*serie|marca\s*:|modelo\s*:)\b/i.test(s)) {
      return null;
    }

    // Descartar servicios, acciones de taller o frases de mano de obra
    if (/^(?:servicio|mano de obra|afinamiento|alineamiento|balanceo|limpieza|lavado|engrase|escaneo|scanner|scanneo|torno|rectificad|rectificar|bajada|bajar|reparaci|reparar|mantenimiento|desmontaje|desmontar|montaje|montar|regulaci|regular|revisi|revisar|diagn[oó]stico|instalaci|instalar|chequeo|chequear|inspecci|inspeccionar|ajuste|ajustar|calibraci|calibrar|prueba|probar|evaluaci|evaluar|sincroniz|purgar|purgado|soldar|soldadura|poner|colocar|pulverizar|pulverizado)\b/i.test(s)) {
      return null;
    }
    if (/^(?:por|para|se realiz[oó]|cambio|cambiar|seg[uú]n|cancelado|pendiente|mano|mano de)\b/i.test(s)) {
      return null;
    }
    // Descartar notas de pago o saldos
    if (/^(?:cancel[oó]|cancelad[oa]|cancelaci[oó]n|canelo|plineo|yape|plin|a cuenta|saldo|efectivo|visa|transferencia|abono)\b/i.test(s) || /cancel[oó]\s+en\s+efectivo/i.test(s)) {
      return null;
    }

    // Limpiar prefijos de cantidades o envases (04 galones de, 1 libra de, etc.)
    s = s.replace(/^0?\d{1,2}\s*(?:galones?|gal[oó]n(?:es)?|litros?|libras?|juegos?|frascos?|tarros?|baldes?|latas?|unidades?|piezas?|pares?|paquetes?)\s*(?:de\s*)?/i, '');
    s = s.replace(/^(?:gal[oó]n(?:es)?|galones?|litros?|libras?|juegos?|frascos?|tarros?|baldes?|latas?|unidades?|piezas?|pares?)\s*(?:de\s*)?/i, '');
    s = s.replace(/^(?:es\s+de|es|de|del|para)\s+/i, '');
    s = s.replace(/^0?\d{1,2}\s+/i, '');

    // Limpiar sufijos redundantes
    s = s.replace(/\s+(?:para motor|de motor|para veh[ií]culo|original|del veh[ií]culo|nuevo|nuevos)$/i, '');
    s = s.replace(/\s*\([^)]*\)$/, '');
    s = s.replace(/\s+/g, ' ').trim();
    if (s.length < 3) return null;

    const lower = s.toLowerCase();

    // Familias canónicas
    if (/^aceite\s+castrol\s+(?:crb\s+plus\s+)?15w40/i.test(lower)) return 'Aceite Castrol 15W40';
    if (/^aceite\s+castrol\s+(?:gtx\s+)?20w50/i.test(lower)) return 'Aceite Castrol 20W50';
    if (/^aceite\s+mobil\s+(?:delvac\s+)?15w40/i.test(lower)) return 'Aceite Mobil 15W40';
    if (/^aceite\s+mobil\s+20w50/i.test(lower)) return 'Aceite Mobil 20W50';
    if (/^aceite\s+amalie\s+20w50/i.test(lower)) return 'Aceite Amalie 20W50';
    if (/^aceite\s+amalie\s+15w40/i.test(lower)) return 'Aceite Amalie 15W40';
    if (/^aceite\s+shell\s+(?:rimula\s+)?15w40/i.test(lower)) return 'Aceite Shell 15W40';
    if (/^aceite\s+taller\s+vargas|^aceite\s+vargas/i.test(lower)) return 'Aceite Taller Vargas 20W50';

    if (/^filtro\s*(?:de)?\s*aceite\s*toyota/i.test(lower)) return 'Filtro de Aceite Toyota';
    if (/^filtro\s*(?:de)?\s*aceite\s*nissan/i.test(lower)) return 'Filtro de Aceite Nissan';
    if (/^filtro\s*(?:de)?\s*aceite\s*hyundai/i.test(lower)) return 'Filtro de Aceite Hyundai';
    if (/^filtro\s*(?:de)?\s*aceite/i.test(lower)) return 'Filtro de Aceite Estándar';

    if (/^filtro\s*(?:de)?\s*aire\s*toyota/i.test(lower)) return 'Filtro de Aire Toyota';
    if (/^filtro\s*(?:de)?\s*aire\s*nissan/i.test(lower)) return 'Filtro de Aire Nissan';
    if (/^filtro\s*(?:de)?\s*aire\s*acondicionado|^filtro\s*(?:de)?\s*cabina/i.test(lower)) return 'Filtro de Cabina / Aire Acondicionado';
    if (/^filtro\s*(?:de)?\s*aire/i.test(lower)) return 'Filtro de Aire Estándar';

    if (/^filtro\s*(?:de)?\s*(?:combustible|petr[oó]leo|gasolina)\s*toyota/i.test(lower)) return 'Filtro de Combustible Toyota';
    if (/^filtro\s*(?:de)?\s*(?:combustible|petr[oó]leo|gasolina)/i.test(lower)) return 'Filtro de Combustible Estándar';

    if (/^pastillas?\s*(?:de)?\s*frenos?\s*delanter/i.test(lower)) return 'Pastillas de Freno Delanteras';
    if (/^pastillas?\s*(?:de)?\s*frenos?\s*posterior/i.test(lower)) return 'Pastillas de Freno Posteriores';
    if (/^pastillas?\s*(?:de)?\s*frenos?/i.test(lower)) return 'Juego de Pastillas de Freno';
    if (/^zapatas?\s*(?:de)?\s*frenos?/i.test(lower)) return 'Juego de Zapatas de Freno';
    if (/^l[ií]quidos?\s*(?:de)?\s*frenos?/i.test(lower)) return 'Líquido de Frenos DOT 4';
    if (/^arandela\s*(?:para|de)\s*tap[oó]n/i.test(lower)) return 'Arandela de Tapón de Cárter';
    if (/^refrigerante/i.test(lower)) return 'Refrigerante 50/50';
    if (/^grasa/i.test(lower)) return 'Grasa Multiuso EP-2';
    if (/^spray\s*abro|^abro\s*spray/i.test(lower)) return 'Spray Limpiador Abro';
    if (/^aditivo/i.test(lower)) return 'Aditivo Limpiador de Inyectores';
    if (/^hidrolina/i.test(lower)) return 'Fluido de Dirección Hidrolina ATF';
    if (/^material\s*de\s*limpieza/i.test(lower)) return 'Insumos de Limpieza de Taller';
    if (/^precintos/i.test(lower)) return 'Precintos de Seguridad Plásticos';

    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Agrupación canónica de repuestos
  const mapaRepuestosCanonicos = new Map();
  catalogoRepuestos.forEach(r => {
    const nombreCan = normalizarNombreRepuestoCanónico(r.nombre);
    if (!nombreCan) return;
    const k = nombreCan.toLowerCase();
    if (!mapaRepuestosCanonicos.has(k)) {
      mapaRepuestosCanonicos.set(k, {
        nombre: nombreCan,
        conteo: 0,
        unidadesTotales: 0,
        precios: []
      });
    }
    const c = mapaRepuestosCanonicos.get(k);
    c.conteo += r.conteo;
    c.unidadesTotales += r.unidadesTotales;
    if (r.precios && r.precios.length > 0) {
      c.precios.push(...r.precios);
    }
  });

  // Lista canónica de repuestos frecuentes (mínimo 2 usos históricos para catálogo de inventario)
  const listaRepuestosConsolidada = Array.from(mapaRepuestosCanonicos.values())
    .filter(r => r.conteo >= 2)
    .map(r => {
      const avg = r.precios.length > 0 ? (r.precios.reduce((a, b) => a + b, 0) / r.precios.length) : 0;
      return {
        nombre: r.nombre,
        frecuenciaUso: r.conteo,
        unidadesEstimadas: r.unidadesTotales,
        precioPromedio: Number(avg.toFixed(2))
      };
    }).sort((a, b) => b.frecuenciaUso - a.frecuenciaUso);

  // Lista canónica de servicios frecuentes (mínimo 2 usos históricos)
  const listaServiciosConsolidada = Array.from(catalogoServicios.values())
    .filter(s => s.conteo >= 2 && !/TOTAL|CANCELADO/i.test(s.nombre))
    .map(s => {
      const avg = s.precios.length > 0 ? (s.precios.reduce((a, b) => a + b, 0) / s.precios.length) : 0;
      return {
        nombre: s.nombre,
        frecuenciaUso: s.conteo,
        precioPromedio: Number(avg.toFixed(2))
      };
    }).sort((a, b) => b.frecuenciaUso - a.frecuenciaUso);

  const datasetFinal = {
    resumen: {
      archivosProcesados: filesPaths.length,
      clientesUnicos: mapaClientes.size,
      vehiculosUnicos: mapaVehiculos.size,
      ordenesHistoricas: listaOrdenes.length,
      totalItemsExtraidos: totalItemsExtraidos,
      repuestosUnicos: listaRepuestosConsolidada.length,
      serviciosUnicos: listaServiciosConsolidada.length,
      montoTotalAcumulado: Number(montoTotalHistorico.toFixed(2)),
      mecanicosDetectados: Array.from(listaMecanicos)
    },
    clientes: Array.from(mapaClientes.values()).map(c => ({
      ...c,
      placas: Array.from(c.placas),
      totalGastado: Number(c.totalGastado.toFixed(2))
    })),
    vehiculos: Array.from(mapaVehiculos.values()),
    ordenes: listaOrdenes,
    catalogoRepuestosTop: listaRepuestosConsolidada,
    catalogoServiciosTop: listaServiciosConsolidada,
    alertas: alertasMigracion
  };

  // 1. Guardar JSON
  fs.writeFileSync(ARCHIVO_JSON, JSON.stringify(datasetFinal, null, 2), 'utf-8');
  console.log(`\n💾 Dataset estructurado guardado exitosamente en:\n   ${ARCHIVO_JSON}`);

  // 2. Generar Reporte Visual HTML
  const htmlContent = generarReporteHtml(datasetFinal);
  fs.writeFileSync(ARCHIVO_HTML, htmlContent, 'utf-8');
  console.log(`🌐 Reporte visual interactivo generado en:\n   ${ARCHIVO_HTML}`);

  console.log('\n================================================================');
  console.log('✅ SIMULACIÓN COMPLETADA EXITOSAMENTE');
  console.log(`   - Clientes detectados : ${datasetFinal.resumen.clientesUnicos}`);
  console.log(`   - Vehículos detectados: ${datasetFinal.resumen.vehiculosUnicos}`);
  console.log(`   - Órdenes de servicio : ${datasetFinal.resumen.ordenesHistoricas}`);
  console.log(`   - Monto consolidado   : S/ ${datasetFinal.resumen.montoTotalAcumulado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`);
  console.log('================================================================\n');
}

function generarReporteHtml(data) {
  const r = data.resumen;
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simulación de Migración Word — Taller Vargas</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
    .tab-active { border-bottom: 3px solid #2563eb; color: #1d4ed8; font-weight: 700; }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 p-4 sm:p-8">
  <div class="max-w-7xl mx-auto space-y-6">

    <!-- CABECERA -->
    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800">PASO 1 • SIMULACIÓN DRY-RUN</span>
          <span class="text-xs text-slate-400 font-medium">Modo Seguro: Sin alterar la base de datos</span>
        </div>
        <h1 class="text-2xl font-black text-slate-900 tracking-tight">TALLER AUTOMOTRIZ VARGAS — REPORTE DE MIGRACIÓN HISTÓRICA</h1>
        <p class="text-sm text-slate-500 mt-0.5">Auditoría, trazabilidad vehicular y desglose de fichas en formato Word (.docx)</p>
      </div>
      <div class="text-right">
        <span class="text-xs text-slate-400 block font-mono">Dataset extraído</span>
        <span class="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 inline-block font-mono mt-1">simulacion_datos.json</span>
      </div>
    </div>

    <!-- TARJETAS KPIS -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Archivos</div>
        <div class="text-2xl font-black text-slate-900 mt-1">${r.archivosProcesados}</div>
        <div class="text-[11px] text-emerald-600 font-semibold mt-0.5">100% auditados</div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Clientes</div>
        <div class="text-2xl font-black text-blue-600 mt-1">${r.clientesUnicos}</div>
        <div class="text-[11px] text-slate-500 mt-0.5">Unificados (RUC / DNI)</div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Vehículos</div>
        <div class="text-2xl font-black text-indigo-600 mt-1">${r.vehiculosUnicos}</div>
        <div class="text-[11px] text-slate-500 mt-0.5">Con ficha clínica</div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Órdenes</div>
        <div class="text-2xl font-black text-amber-600 mt-1">${r.ordenesHistoricas}</div>
        <div class="text-[11px] text-amber-700 font-semibold mt-0.5">Proformas y servicios</div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Ítems</div>
        <div class="text-2xl font-black text-purple-600 mt-1">${r.totalItemsExtraidos}</div>
        <div class="text-[11px] text-slate-500 mt-0.5">Piezas y mano obra</div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-sm">
        <div class="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Sumado</div>
        <div class="text-xl font-black text-emerald-700 mt-1 font-mono">S/ ${r.montoTotalAcumulado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</div>
        <div class="text-[11px] text-emerald-800 font-semibold mt-0.5">Histórico valorizado</div>
      </div>
    </div>

    <!-- PESTAÑAS -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="flex border-b border-slate-200 px-6 pt-4 gap-6 text-sm font-medium overflow-x-auto">
        <button onclick="cambiarPestana('ordenes', this)" class="tab-btn pb-3 tab-active">Órdenes Históricas (${data.ordenes.length})</button>
        <button onclick="cambiarPestana('clientes', this)" class="tab-btn pb-3 text-slate-500 hover:text-slate-800">Clientes (${data.clientes.length})</button>
        <button onclick="cambiarPestana('vehiculos', this)" class="tab-btn pb-3 text-slate-500 hover:text-slate-800">Vehículos / Historial Clínico (${data.vehiculos.length})</button>
        <button onclick="cambiarPestana('repuestos', this)" class="tab-btn pb-3 text-slate-500 hover:text-slate-800">Catálogo Repuestos (${data.catalogoRepuestosTop.length})</button>
        <button onclick="cambiarPestana('servicios', this)" class="tab-btn pb-3 text-slate-500 hover:text-slate-800">Catálogo Servicios (${data.catalogoServiciosTop.length})</button>
      </div>

      <!-- TABLA 1: ÓRDENES HISTÓRICAS -->
      <div id="tab-ordenes" class="tab-content p-6 space-y-4">
        <div class="flex flex-col sm:flex-row justify-between gap-3">
          <input type="text" id="filtro-ordenes" onkeyup="filtrarOrdenes()" placeholder="Buscar por cliente, placa, mecánico o proforma..." class="px-4 py-2 border border-slate-300 rounded-lg text-sm w-full sm:w-96 focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <span class="text-xs text-slate-500 self-center">Haz clic en <strong>Ver Detalle</strong> para ver la orden completa con cada repuesto y precio</span>
        </div>
        <div class="overflow-x-auto border border-slate-200 rounded-xl">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-100 text-slate-700 uppercase tracking-wider font-bold">
              <tr>
                <th class="p-3">#</th>
                <th class="p-3">Doc / Origen</th>
                <th class="p-3">Fecha</th>
                <th class="p-3">Cliente</th>
                <th class="p-3">Vehículo / Placa</th>
                <th class="p-3">KM</th>
                <th class="p-3">Mecánico</th>
                <th class="p-3">Estado</th>
                <th class="p-3 text-right">Monto</th>
                <th class="p-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody id="tbody-ordenes" class="divide-y divide-slate-100 font-medium">
              ${data.ordenes.map(o => `
                <tr class="hover:bg-slate-50 transition cursor-pointer" onclick="verDetalleOrden(${o.idVirtual})">
                  <td class="p-3 font-mono text-slate-400">#${o.idVirtual}</td>
                  <td class="p-3 whitespace-nowrap">
                    ${o.tipoDocumento === 'PROFORMA' ? `<span class="px-2 py-0.5 rounded font-black text-[10px] bg-indigo-100 text-indigo-800">PROFORMA ${o.numProforma ? '#' + o.numProforma : ''}</span>` : `<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-700">ORDEN</span>`}
                  </td>
                  <td class="p-3 font-mono text-slate-700 whitespace-nowrap">${o.fechaIngreso || o.fechaOriginal}</td>
                  <td class="p-3 font-bold text-slate-900">${o.cliente}</td>
                  <td class="p-3">
                    <span class="font-bold text-blue-700 font-mono">${o.placa}</span>
                    <span class="text-slate-500 block text-[11px]">${o.vehiculo}</span>
                  </td>
                  <td class="p-3 font-mono text-slate-600">${o.kilometraje ? o.kilometraje.toLocaleString() + ' km' : '-'}</td>
                  <td class="p-3 text-slate-700">${o.mecanico}</td>
                  <td class="p-3 whitespace-nowrap">
                    ${o.estadoPago === 'PAGADO' ? `<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">PAGADO</span>` : o.estadoPago === 'PENDIENTE' ? `<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-rose-100 text-rose-800">PENDIENTE</span>` : `<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-600">FINALIZADO</span>`}
                    ${o.recomendacionProxima ? `<span class="ml-1 text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded" title="${o.recomendacionProxima}">⚠️ Recomendación</span>` : ''}
                  </td>
                  <td class="p-3 text-right font-mono font-bold text-emerald-700">S/ ${o.totalEstimado.toFixed(2)}</td>
                  <td class="p-3 text-center" onclick="event.stopPropagation()">
                    <button onclick="verDetalleOrden(${o.idVirtual})" class="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg font-bold transition">👁️ Ver Detalle</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- TABLA 2: CLIENTES -->
      <div id="tab-clientes" class="tab-content p-6 hidden">
        <div class="overflow-x-auto border border-slate-200 rounded-xl">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-100 text-slate-700 uppercase tracking-wider font-bold">
              <tr>
                <th class="p-3">Cliente / Razón Social</th>
                <th class="p-3">Tipo Doc</th>
                <th class="p-3">Doc Asignado</th>
                <th class="p-3">Teléfono</th>
                <th class="p-3">Vehículos Asociados</th>
                <th class="p-3 text-center">Visitas</th>
                <th class="p-3 text-right">Total Invertido</th>
                <th class="p-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium">
              ${data.clientes.map(c => `
                <tr class="hover:bg-slate-50 transition">
                  <td class="p-3 font-bold text-slate-900 text-sm">${c.nombre}</td>
                  <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${c.tipoDoc === 'RUC' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}">${c.tipoDoc}</span></td>
                  <td class="p-3 font-mono text-slate-500">${c.numDoc}</td>
                  <td class="p-3 text-slate-600">${c.telefono}</td>
                  <td class="p-3"><span class="font-mono text-indigo-700 font-bold">${c.placas.join(', ')}</span></td>
                  <td class="p-3 text-center font-bold text-amber-700">${c.totalVisitas}</td>
                  <td class="p-3 text-right font-mono font-bold text-emerald-700">S/ ${c.totalGastado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                  <td class="p-3 text-center">
                    <button onclick="filtrarPorCliente('${c.nombre}')" class="px-2.5 py-1 text-xs bg-slate-100 text-slate-700 hover:bg-slate-700 hover:text-white rounded-lg font-bold transition">🔍 Ver Órdenes</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- TABLA 3: VEHÍCULOS (CON BOTÓN DE HISTORIAL CLÍNICO) -->
      <div id="tab-vehiculos" class="tab-content p-6 hidden">
        <p class="text-xs text-slate-500 mb-3">Haz clic en <strong>Ver Historial Clínico</strong> de cualquier vehículo para abrir su línea de tiempo completa con todos los servicios realizados.</p>
        <div class="overflow-x-auto border border-slate-200 rounded-xl">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-100 text-slate-700 uppercase tracking-wider font-bold">
              <tr>
                <th class="p-3">Placa / Código</th>
                <th class="p-3">Marca / Modelo</th>
                <th class="p-3">Tipo</th>
                <th class="p-3">Propietario</th>
                <th class="p-3">Último KM Registrado</th>
                <th class="p-3 text-center">Total Órdenes</th>
                <th class="p-3 text-center">Historial Clínico</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium">
              ${data.vehiculos.map(v => `
                <tr class="hover:bg-slate-50 transition">
                  <td class="p-3 font-mono font-black text-blue-700 text-sm">${v.placa}</td>
                  <td class="p-3 font-bold text-slate-900">${v.marcaModelo}</td>
                  <td class="p-3"><span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">${v.tipoVehiculo}</span></td>
                  <td class="p-3 text-slate-700">${v.clienteNombre}</td>
                  <td class="p-3 font-mono text-slate-600 font-bold">${v.kmActual > 0 ? v.kmActual.toLocaleString() + ' km' : '-'}</td>
                  <td class="p-3 text-center font-bold text-amber-700">${v.totalServicios}</td>
                  <td class="p-3 text-center">
                    <button onclick="verHistorialVehiculo('${v.placa}')" class="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg font-bold transition flex items-center gap-1 mx-auto">
                      📋 Ver Historial Clínico (${v.totalServicios})
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- TABLA 4: REPUESTOS -->
      <div id="tab-repuestos" class="tab-content p-6 hidden">
        <p class="text-xs text-slate-500 mb-3">Piezas e insumos extraídos de los Word, listos para sembrar el catálogo inicial de Almacén.</p>
        <div class="overflow-x-auto border border-slate-200 rounded-xl">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-100 text-slate-700 uppercase tracking-wider font-bold">
              <tr>
                <th class="p-3">Descripción del Repuesto</th>
                <th class="p-3 text-center">Frecuencia de Uso</th>
                <th class="p-3 text-center">Unidades Totales Usadas</th>
                <th class="p-3 text-right">Precio Promedio</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium">
              ${data.catalogoRepuestosTop.slice(0, 60).map(r => `
                <tr class="hover:bg-slate-50 transition">
                  <td class="p-3 font-bold text-slate-800">${r.nombre}</td>
                  <td class="p-3 text-center"><span class="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded">${r.frecuenciaUso} veces</span></td>
                  <td class="p-3 text-center font-mono">${r.unidadesEstimadas}</td>
                  <td class="p-3 text-right font-mono font-bold text-emerald-700">S/ ${r.precioPromedio.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- TABLA 5: SERVICIOS -->
      <div id="tab-servicios" class="tab-content p-6 hidden">
        <p class="text-xs text-slate-500 mb-3">Servicios mecánicos y diagnósticos frecuentes para el tarifario del taller (sin precios en la descripción).</p>
        <div class="overflow-x-auto border border-slate-200 rounded-xl">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-100 text-slate-700 uppercase tracking-wider font-bold">
              <tr>
                <th class="p-3">Servicio Mecánico / Diagnóstico</th>
                <th class="p-3 text-center">Frecuencia</th>
                <th class="p-3 text-right">Costo Promedio</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium">
              ${data.catalogoServiciosTop.slice(0, 60).map(s => `
                <tr class="hover:bg-slate-50 transition">
                  <td class="p-3 font-bold text-slate-800">${s.nombre}</td>
                  <td class="p-3 text-center"><span class="bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded">${s.frecuenciaUso} veces</span></td>
                  <td class="p-3 text-right font-mono font-bold text-emerald-700">S/ ${s.precioPromedio.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>

  </div>

  <!-- MODAL 1: DETALLE COMPLETO DE ORDEN / PROFORMA -->
  <div id="modal-orden" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
      <div class="p-6 border-b border-slate-100 flex justify-between items-start">
        <div>
          <div class="flex items-center gap-2 mb-1" id="m-doc-badges"></div>
          <h2 class="text-xl font-black text-slate-900" id="m-doc-titulo">Detalle de la Orden</h2>
          <p class="text-xs text-slate-500" id="m-doc-subtitulo"></p>
        </div>
        <button onclick="cerrarModalOrden()" class="text-slate-400 hover:text-slate-700 text-2xl font-bold p-1">&times;</button>
      </div>

      <div class="p-6 space-y-5">
        <!-- DATOS PRINCIPALES -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl text-xs">
          <div>
            <span class="text-slate-400 block font-semibold">Cliente:</span>
            <strong class="text-slate-900 text-sm" id="m-cliente"></strong>
          </div>
          <div>
            <span class="text-slate-400 block font-semibold">Vehículo / Placa:</span>
            <strong class="text-blue-700 font-mono text-sm" id="m-placa"></strong>
            <span class="text-slate-500 block text-[11px]" id="m-vehiculo"></span>
          </div>
          <div>
            <span class="text-slate-400 block font-semibold">Fecha Ingreso:</span>
            <strong class="text-slate-800 font-mono" id="m-fecha"></strong>
          </div>
          <div>
            <span class="text-slate-400 block font-semibold">Kilometraje:</span>
            <strong class="text-slate-800 font-mono" id="m-km"></strong>
          </div>
        </div>

        <!-- ALERTA DE RECOMENDACIONES -->
        <div id="m-rec-box" class="hidden p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <div class="flex items-center gap-2 font-bold mb-1">
            <span class="text-base">⚠️</span> Recomendación / Próximo Mantenimiento Sugerido:
          </div>
          <p id="m-rec-texto" class="font-medium pl-6"></p>
        </div>

        <!-- TABLA DE DESGLOSE -->
        <div>
          <h3 class="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Desglose de Repuestos e Insumos</h3>
          <div class="border border-slate-200 rounded-xl overflow-hidden mb-4">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-100 text-slate-700 font-bold">
                <tr>
                  <th class="p-2.5 text-center w-12">Cant.</th>
                  <th class="p-2.5">Descripción del Repuesto / Pieza</th>
                  <th class="p-2.5 text-right w-24">P. Unit</th>
                  <th class="p-2.5 text-right w-24">Total</th>
                </tr>
              </thead>
              <tbody id="m-tbody-repuestos" class="divide-y divide-slate-100 font-medium"></tbody>
            </table>
          </div>

          <h3 class="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Servicios Mecánicos y Diagnósticos</h3>
          <div class="border border-slate-200 rounded-xl overflow-hidden">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-100 text-slate-700 font-bold">
                <tr>
                  <th class="p-2.5">Descripción del Servicio / Mano de Obra</th>
                  <th class="p-2.5 text-right w-28">Importe</th>
                </tr>
              </thead>
              <tbody id="m-tbody-servicios" class="divide-y divide-slate-100 font-medium"></tbody>
            </table>
          </div>
        </div>

        <!-- TOTALES Y ARCHIVO -->
        <div class="flex flex-col sm:flex-row justify-between items-center pt-3 border-t border-slate-200 gap-3">
          <div class="text-xs text-slate-400 font-mono">
            Origen: <span id="m-archivo"></span> • Mecánico: <strong class="text-slate-700" id="m-mecanico"></strong>
          </div>
          <div class="text-right">
            <span class="text-xs text-slate-400 block font-semibold uppercase">Total Liquidado</span>
            <span class="text-2xl font-black text-emerald-700 font-mono" id="m-total"></span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL 2: HISTORIAL CLÍNICO COMPLETO DEL VEHÍCULO -->
  <div id="modal-vehiculo" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
      <div class="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/70 rounded-t-2xl">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800">EXPEDIENTE CLÍNICO VEHICULAR</span>
            <span class="font-mono text-xs text-slate-500 font-bold" id="mv-tipo"></span>
          </div>
          <h2 class="text-2xl font-black text-slate-900 flex items-center gap-3">
            <span class="text-blue-700 font-mono" id="mv-placa"></span>
            <span class="text-slate-400 font-normal text-lg">•</span>
            <span class="text-slate-700 text-lg font-bold" id="mv-modelo"></span>
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">Propietario registrado: <strong class="text-slate-800" id="mv-dueno"></strong></p>
        </div>
        <button onclick="cerrarModalVehiculo()" class="text-slate-400 hover:text-slate-700 text-2xl font-bold p-1">&times;</button>
      </div>

      <div class="p-6 space-y-6">
        <!-- ESTADÍSTICAS DEL VEHÍCULO -->
        <div class="grid grid-cols-3 gap-3">
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
            <span class="text-[11px] font-bold text-slate-400 uppercase">Órdenes Realizadas</span>
            <div class="text-2xl font-black text-amber-600 mt-1" id="mv-total-ordenes"></div>
          </div>
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
            <span class="text-[11px] font-bold text-slate-400 uppercase">Último Kilometraje</span>
            <div class="text-2xl font-black text-slate-800 font-mono mt-1" id="mv-ultimo-km"></div>
          </div>
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
            <span class="text-[11px] font-bold text-slate-400 uppercase">Inversión Acumulada</span>
            <div class="text-2xl font-black text-emerald-700 font-mono mt-1" id="mv-total-gastado"></div>
          </div>
        </div>

        <!-- LÍNEA DE TIEMPO DE VISITAS -->
        <div>
          <h3 class="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">Línea de Tiempo de Mantenimientos e Intervenciones</h3>
          <div id="mv-timeline" class="space-y-4"></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const DATA = ${JSON.stringify(data)};

    function cambiarPestana(id, btn) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.tab-btn').forEach(el => {
        el.className = 'tab-btn pb-3 text-slate-500 hover:text-slate-800';
      });
      document.getElementById('tab-' + id).classList.remove('hidden');
      btn.className = 'tab-btn pb-3 tab-active';
    }

    function filtrarOrdenes() {
      const q = document.getElementById('filtro-ordenes').value.toLowerCase();
      document.querySelectorAll('#tbody-ordenes tr').forEach(tr => {
        const text = tr.innerText.toLowerCase();
        tr.style.display = text.includes(q) ? '' : 'none';
      });
    }

    function filtrarPorCliente(nombre) {
      document.querySelectorAll('.tab-btn')[0].click();
      document.getElementById('filtro-ordenes').value = nombre;
      filtrarOrdenes();
    }

    function verDetalleOrden(id) {
      const o = DATA.ordenes.find(x => x.idVirtual === id);
      if (!o) return;

      document.getElementById('m-doc-badges').innerHTML =
        (o.tipoDocumento === 'PROFORMA' ? '<span class=\"px-2 py-0.5 rounded font-black text-xs bg-indigo-100 text-indigo-800\">PROFORMA ' + (o.numProforma ? '#' + o.numProforma : '') + '</span>' : '<span class=\"px-2 py-0.5 rounded font-bold text-xs bg-slate-100 text-slate-700\">ORDEN DE TRABAJO</span>') +
        (o.estadoPago === 'PAGADO' ? '<span class=\"px-2 py-0.5 rounded font-bold text-xs bg-emerald-100 text-emerald-800\">PAGADO ' + (o.fechaPago ? '(' + o.fechaPago + ')' : '') + '</span>' : o.estadoPago === 'PENDIENTE' ? '<span class=\"px-2 py-0.5 rounded font-bold text-xs bg-rose-100 text-rose-800\">PENDIENTE DE PAGO</span>' : '<span class=\"px-2 py-0.5 rounded font-bold text-xs bg-slate-100 text-slate-700\">FINALIZADO</span>');

      document.getElementById('m-doc-titulo').innerText = 'Orden de Servicio #' + o.idVirtual;
      document.getElementById('m-doc-subtitulo').innerText = o.archivoOrigen;
      document.getElementById('m-cliente').innerText = o.cliente;
      document.getElementById('m-placa').innerText = o.placa;
      document.getElementById('m-vehiculo').innerText = o.vehiculo;
      document.getElementById('m-fecha').innerText = o.fechaIngreso || o.fechaOriginal;
      document.getElementById('m-km').innerText = o.kilometraje ? o.kilometraje.toLocaleString() + ' km' : 'No registrado';
      document.getElementById('m-archivo').innerText = o.archivoOrigen;
      document.getElementById('m-mecanico').innerText = o.mecanico;
      document.getElementById('m-total').innerText = 'S/ ' + o.totalEstimado.toFixed(2);

      // Recomendación próxima
      const recBox = document.getElementById('m-rec-box');
      if (o.recomendacionProxima) {
        recBox.classList.remove('hidden');
        document.getElementById('m-rec-texto').innerText = o.recomendacionProxima;
      } else {
        recBox.classList.add('hidden');
      }

      // Repuestos
      const repuestos = o.items.filter(it => it.tipo === 'repuesto');
      document.getElementById('m-tbody-repuestos').innerHTML = repuestos.length === 0
        ? '<tr><td colspan=\"4\" class=\"p-3 text-center text-slate-400\">No se detallaron repuestos materiales en esta orden</td></tr>'
        : repuestos.map(it => '<tr class=\"hover:bg-slate-50\"><td class=\"p-2.5 text-center font-mono font-bold\">' + it.cantidad + '</td><td class=\"p-2.5 font-bold text-slate-800\">' + it.descripcion + '</td><td class=\"p-2.5 text-right font-mono text-slate-500\">S/ ' + it.precioUnitario.toFixed(2) + '</td><td class=\"p-2.5 text-right font-mono font-bold text-slate-800\">S/ ' + it.total.toFixed(2) + '</td></tr>').join('');

      // Servicios
      const servicios = o.items.filter(it => it.tipo === 'servicio');
      document.getElementById('m-tbody-servicios').innerHTML = servicios.length === 0
        ? '<tr><td colspan=\"2\" class=\"p-3 text-center text-slate-400\">Sin servicios mecánicos desglosados</td></tr>'
        : servicios.map(it => '<tr class=\"hover:bg-slate-50\"><td class=\"p-2.5 font-bold text-slate-800\">' + it.descripcion + '</td><td class=\"p-2.5 text-right font-mono font-bold text-emerald-700\">S/ ' + it.total.toFixed(2) + '</td></tr>').join('');

      document.getElementById('modal-orden').classList.remove('hidden');
    }

    function cerrarModalOrden() {
      document.getElementById('modal-orden').classList.add('hidden');
    }

    function verHistorialVehiculo(placa) {
      const v = DATA.vehiculos.find(x => x.placa === placa);
      if (!v) return;

      const ordenesVeh = DATA.ordenes.filter(x => x.placa === placa).sort((a, b) => {
        return (b.fechaIngreso || '').localeCompare(a.fechaIngreso || '');
      });

      const totalGastado = ordenesVeh.reduce((acc, o) => acc + o.totalEstimado, 0);

      document.getElementById('mv-tipo').innerText = v.tipoVehiculo.toUpperCase();
      document.getElementById('mv-placa').innerText = v.placa;
      document.getElementById('mv-modelo').innerText = v.marcaModelo;
      document.getElementById('mv-dueno').innerText = v.clienteNombre;
      document.getElementById('mv-total-ordenes').innerText = ordenesVeh.length + ' visitas';
      document.getElementById('mv-ultimo-km').innerText = v.kmActual > 0 ? v.kmActual.toLocaleString() + ' km' : 'Sin KM';
      document.getElementById('mv-total-gastado').innerText = 'S/ ' + totalGastado.toLocaleString('es-PE', { minimumFractionDigits: 2 });

      document.getElementById('mv-timeline').innerHTML = ordenesVeh.map(function(o, idx) {
        var nVisita = ordenesVeh.length - idx;
        var proformaHtml = o.tipoDocumento === 'PROFORMA' ? '<span class="text-[10px] font-black bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">PROFORMA ' + (o.numProforma || '') + '</span>' : '';
        var pagoHtml = o.estadoPago === 'PAGADO' ? '<span class="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">PAGADO</span>' : '';
        var recHtml = o.recomendacionProxima ? '<div class="text-xs bg-amber-50 text-amber-900 p-2 rounded-lg border border-amber-200 flex items-start gap-1.5 font-medium"><span>⚠️</span><div><strong>Recomendación para próxima orden:</strong> ' + o.recomendacionProxima + '</div></div>' : '';

        return '<div class="border border-slate-200 p-4 rounded-xl hover:border-blue-300 transition bg-white shadow-sm space-y-2">' +
          '<div class="flex flex-col sm:flex-row justify-between sm:items-center gap-1 border-b border-slate-100 pb-2">' +
            '<div class="flex items-center gap-2">' +
              '<span class="font-mono font-black text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">Visita #' + nVisita + '</span>' +
              '<strong class="text-sm text-slate-900 font-mono">' + (o.fechaIngreso || o.fechaOriginal) + '</strong>' +
              proformaHtml + pagoHtml +
            '</div>' +
            '<div class="text-right">' +
              '<span class="text-sm font-black font-mono text-emerald-700">S/ ' + o.totalEstimado.toFixed(2) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="text-xs text-slate-600">' +
            '<strong>Mecánico:</strong> ' + o.mecanico + ' • <strong>KM:</strong> ' + (o.kilometraje ? o.kilometraje.toLocaleString() + ' km' : 'No registrado') +
          '</div>' +
          '<div class="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg">' +
            '<strong class="text-slate-900 block mb-1">Trabajos & Diagnóstico:</strong>' +
            o.fallaReportada + ' <span class="text-blue-600 font-bold font-mono">(' + o.itemsCount + ' ítems)</span>' +
          '</div>' +
          recHtml +
          '<div class="text-right pt-1">' +
            '<button onclick="cerrarModalVehiculo(); verDetalleOrden(' + o.idVirtual + ')" class="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline">' +
              'Ver desglose completo de ítems &rarr;' +
            '</button>' +
          '</div>' +
        '</div>';
      }).join('');

      document.getElementById('modal-vehiculo').classList.remove('hidden');
    }

    function cerrarModalVehiculo() {
      document.getElementById('modal-vehiculo').classList.add('hidden');
    }

    // Cerrar modales con escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        cerrarModalOrden();
        cerrarModalVehiculo();
      }
    });
  </script>
</body>
</html>
`;
}

ejecutarSimulacion().catch(console.error);
