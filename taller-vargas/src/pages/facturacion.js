import {
  getCobros, getStatsCobros, registrarCobro, dividirCobro, getOrden, exportarCobrosCSV,
  crearVentaRapida, getAlmacen
} from '../api.js';
import { safeFormatDate, debounce, escapeHtml } from '../utils.js';


let containerElement = null;
let cobrosList = [];
let statsData = {};

let currentCobro = null;
let activePagadorIndex = 1;
let currentItems = [];
let productosVentaRapida = [];
let itemsVentaRapida = [];

// ─── Paginación y Filtros ─────────────────────────────────────
let currentPage = 1;
const itemsPerPage = 15;

function getFechaHoyPeru() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()); // Retorna "YYYY-MM-DD"
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

function getFechaCobroStr(c) {
  if (c.fecha_cobro_str) return c.fecha_cobro_str;
  if (c.fecha_cobro) {
    if (typeof c.fecha_cobro === 'string') {
      return c.fecha_cobro.split('T')[0];
    }
    return new Date(c.fecha_cobro).toISOString().slice(0, 10);
  }
  if (c.updated_at) {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date(c.updated_at));
    } catch (_) {
      return new Date(c.updated_at).toISOString().slice(0, 10);
    }
  }
  return '';
}

function normalizarMetodo(metodo) {
  const m = (metodo || '').toLowerCase();
  if (m.includes('yape') || m.includes('plin') || m.includes('billetera')) return 'Yape/Plin';
  if (m.includes('tarjeta')) return 'Tarjeta';
  if (m.includes('transf') || m.includes('banc')) return 'Transferencia';
  return 'Efectivo';
}

function getFilteredCobros() {
  const q = (document.getElementById('search-cobros')?.value || '').toLowerCase().trim();
  if (!q) return cobrosList;
  return cobrosList.filter(c =>
    c.cliente_nombre?.toLowerCase().includes(q) ||
    c.placa?.toLowerCase().includes(q) ||
    c.concepto?.toLowerCase().includes(q) ||
    String(c.id).includes(q) ||
    (c.orden_numero && String(c.orden_numero).includes(q)) ||
    c.comprobante_numero?.toLowerCase().includes(q) ||
    c.comprobante2_numero?.toLowerCase().includes(q)
  );
}

function getPageCobros(lista) {
  const total = lista.length;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  const start = (currentPage - 1) * itemsPerPage;
  return lista.slice(start, start + itemsPerPage);
}

function renderPaginationBar(lista) {
  const total = lista.length;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  if (total === 0) return '';
  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, total);

  return `
    <div class="pagination-bar" style="display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-top:1px solid var(--slate-8);background:var(--slate-9);font-size:12px;flex-wrap:wrap;gap:10px;">
      <span style="color:var(--slate-5);">
        Mostrando <strong style="color:var(--dark);">${start}</strong> a <strong style="color:var(--dark);">${end}</strong> de <strong style="color:var(--dark);">${total}</strong> comprobantes
      </span>
      <div style="display:flex;align-items:center;gap:8px;">
        <button type="button" class="btn-ghost" id="btn-page-prev" ${currentPage <= 1 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : 'style="cursor:pointer;"'}>
          ⬅️ Anterior
        </button>
        <span style="font-weight:800;color:var(--dark);padding:4px 8px;background:var(--white);border:1px solid var(--slate-8);border-radius:6px;font-size:11px;">
          Página ${currentPage} de ${totalPages}
        </span>
        <button type="button" class="btn-ghost" id="btn-page-next" ${currentPage >= totalPages ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : 'style="cursor:pointer;"'}>
          Siguiente ➡️
        </button>
      </div>
    </div>
  `;
}

// ─── Contadores correlativos simulados (en memoria) ───────────
let contBoleta = 1001;
let contFactura = 1001;

export async function init(container) {
  containerElement = container;
  container.innerHTML = `<div class="fade-in" id="fact-root"></div>`;
  const root = document.getElementById('fact-root');
  root.innerHTML = renderSkeleton();
  try {
    await cargarDatos();
  } catch (err) {
    root.innerHTML = renderError(err.message);
  }
}

async function cargarDatos() {
  const [cobros, stats] = await Promise.all([getCobros(), getStatsCobros()]);
  cobrosList = cobros;
  statsData = stats;
  renderPage();
}

function renderSkeleton() {
  return `<div class="grid grid-cols-4 gap-4 mb-6">
    ${Array(4).fill(`<div style="height:90px;background:var(--white);border-radius:var(--radius-md);border:1px solid var(--slate-8);"></div>`).join('')}
  </div>
  <div style="height:300px;background:var(--white);border-radius:var(--radius-md);border:1px solid var(--slate-8);"></div>`;
}

function renderError(msg) {
  return `<div style="max-width:480px;margin:60px auto;background:var(--white);border-radius:var(--radius-lg);padding:40px;text-align:center;box-shadow:var(--shadow-md);border:1px solid var(--slate-8);">
    <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
    <p style="font-weight:900;color:var(--dark);margin-bottom:8px;font-size:16px;">Error al cargar facturación</p>
    <p style="font-size:12px;font-family:monospace;color:var(--slate-5);background:var(--slate-9);padding:8px;border-radius:6px;">${msg}</p>
    <button class="btn-primary" onclick="location.reload()" style="margin-top:20px;">Reintentar</button>
  </div>`;
}

// ── MÉTRICAS CALCULADAS ─────────────────────────────────────

function calcMetrics() {
  const porCobrar  = parseFloat(statsData.por_cobrar  || 0);
  const ingresos   = parseFloat(statsData.ingresos    || 0);
  const igv        = ingresos * 0.18;
  const cobrados   = cobrosList.filter(c => c.estado === 'Cancelado' || c.estado === 'Dividido').length;

  // Distribución por método de pago (sólo cobros pagados)
  const pagados = cobrosList.filter(c => c.estado !== 'Pendiente');
  const byMethod = {};
  pagados.forEach(c => {
    const m = normalizarMetodo(c.metodo_pago);
    const monto = parseFloat(c.monto_neto !== null && c.monto_neto !== undefined ? c.monto_neto : c.monto_total);
    byMethod[m] = (byMethod[m] || 0) + monto;
  });
  const totalPagado = Object.values(byMethod).reduce((a, b) => a + b, 0) || 1;
  const metodoPct = Object.entries(byMethod).map(([k, v]) => ({
    label: k, valor: v, pct: Math.round((v / totalPagado) * 100)
  })).sort((a, b) => b.pct - a.pct);

  // Arqueo de Caja (Hoy en Lima)
  const todayStr = getFechaHoyPeru();
  let totalHoy = 0;
  const hoyMetodos = {
    'Efectivo': 0,
    'Tarjeta': 0,
    'Yape/Plin': 0,
    'Transferencia': 0
  };

  cobrosList.forEach(c => {
    if (c.estado === 'Cancelado' || c.estado === 'Dividido') {
      const cDateStr = getFechaCobroStr(c);
      if (cDateStr === todayStr) {
        const m = normalizarMetodo(c.metodo_pago);
        const total = parseFloat(c.monto_neto !== null && c.monto_neto !== undefined ? c.monto_neto : c.monto_total);
        totalHoy += total;
        hoyMetodos[m] = (hoyMetodos[m] || 0) + total;
      }
    }
  });

  return { porCobrar, ingresos, igv, cobrados, metodoPct, totalHoy, hoyMetodos };
}

// ── RENDER PRINCIPAL ─────────────────────────────────────────

function renderPage() {
  const root = document.getElementById('fact-root');
  if (!root) return;
  const { porCobrar, ingresos, igv, cobrados, metodoPct, totalHoy, hoyMetodos } = calcMetrics();
  const pendientes = cobrosList.filter(c => c.estado === 'Pendiente').length;

  const METODO_COLORS = {
    'Efectivo':        { bg: '#d1fae5', fg: '#065f46' },
    'Tarjeta':         { bg: '#dbeafe', fg: '#1e40af' },
    'Yape/Plin':       { bg: '#f3e8ff', fg: '#6b21a8' },
    'Transferencia':   { bg: '#fef3c7', fg: '#92400e' },
  };

  root.innerHTML = `
    <!-- Estilos locales -->
    <style>
      #fact-root .kpi-card {
        background:var(--white);border:1px solid var(--slate-8);border-radius:var(--radius-md);
        padding:18px 20px;display:flex;align-items:center;gap:16px;
        box-shadow:var(--shadow-sm);transition:transform .15s;
      }
      #fact-root .kpi-card:hover { transform:translateY(-2px); }
      #fact-root .kpi-icon {
        width:48px;height:48px;border-radius:14px;display:flex;align-items:center;
        justify-content:center;flex-shrink:0;
      }
      #fact-root .method-bar-bg {
        height:6px;background:var(--slate-8);border-radius:99px;overflow:hidden;flex:1;
      }
      #fact-root .method-bar-fill { height:100%;border-radius:99px;transition:width .6s ease; }
      #fact-root .cobro-row:hover { background:#f8fafc; }
      .vr-search-item:hover, .vr-search-item.active { background: #ecfdf5 !important; }

      /* Tarjeta 3D */
      #fact-root .card-3d-scene { perspective: 800px; width:320px; margin:0 auto 4px; }
      #fact-root .card-3d { width:100%;aspect-ratio:1.586;position:relative;transform-style:preserve-3d;transition:transform .6s cubic-bezier(.4,0,.2,1); }
      #fact-root .card-3d.flipped { transform:rotateY(180deg); }
      #fact-root .card-face, #fact-root .card-back {
        position:absolute;inset:0;border-radius:16px;backface-visibility:hidden;
        padding:20px 24px;color:#fff;display:flex;flex-direction:column;
      }
      #fact-root .card-face {
        background:linear-gradient(135deg,#1e293b 0%,#334155 50%,#0f172a 100%);
        box-shadow:0 20px 40px rgba(0,0,0,0.35);
      }
      #fact-root .card-back {
        background:linear-gradient(135deg,#374151,#1f2937);
        transform:rotateY(180deg);
        justify-content:flex-end;
      }
      #fact-root .card-chip {
        width:42px;height:32px;background:linear-gradient(135deg,#d4af37,#f0c040);
        border-radius:6px;margin-bottom:16px;
      }
      #fact-root .card-number {
        font-family:monospace;font-size:17px;letter-spacing:3px;font-weight:700;
        flex:1;display:flex;align-items:center;
      }
      #fact-root .card-mag-stripe {
        height:40px;background:#1c1c1c;margin:0 -24px;margin-bottom:8px;
      }
      #fact-root .card-cvv-box {
        background:#fff;color:#111;border-radius:4px;padding:4px 12px;
        font-family:monospace;font-size:14px;letter-spacing:4px;align-self:flex-end;width:60px;text-align:center;
      }

      /* Comprobante imprimible */
      #modal-factura-electronica .factura-doc {
        max-width:720px;margin:0 auto;background:#fff;padding:40px;
        border-radius:8px;border:1px solid #e2e8f0;font-family:'Inter',system-ui;
        font-size:13px;color:#1e293b;
      }
      #modal-factura-electronica {
        align-items: flex-start;
        overflow-y: auto;
        padding: 40px 16px;
      }
      #modal-cobro-rapido .modal {
        max-width: 620px;
        width: 100%;
      }
      #modal-cobro-rapido .modal-body {
        overflow-y: auto !important;
        max-height: calc(90vh - 140px) !important;
      }
      #modal-cobro-rapido .modal-body > * {
        flex-shrink: 0 !important;
      }
      @media print {
        body > *:not(#print-area) { display: none !important; }
        #print-area { display: block !important; position: absolute; left: 0; top: 0; width: 100%; }
        #print-area, #print-area * { visibility: visible !important; }
        #print-area .factura-doc { box-shadow:none;border:none;max-width:100%;border-radius:0;padding:20px; }
        .no-print { display: none !important; }
      }
    </style>

    <!-- Header -->
    <div class="flex justify-between items-start mb-6" style="flex-wrap:wrap;gap:16px;">
      <div class="flex items-center gap-3">
        <div style="width:40px;height:40px;background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.2);">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
        </div>
        <div>
          <h1 style="font-size:22px;font-weight:900;color:var(--dark);letter-spacing:-.5px;line-height:1;">Facturación Electrónica</h1>
          <p style="font-size:12px;color:var(--slate-5);margin-top:1px;">Cobros, comprobantes SUNAT y cierre administrativo del taller</p>
        </div>
      </div>
      <div class="flex gap-2" style="flex-wrap:wrap;">
        <button id="btn-venta-rapida" class="btn-primary flex items-center gap-2" style="font-size:12px;padding:8px 14px;height:38px;background:#10b981;border-color:#059669;font-weight:800;box-shadow:0 2px 6px rgba(16,185,129,0.3);">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 4v16m8-8H4"/></svg>
          Venta Rápida
        </button>
        <button id="btn-ver-cuentas-qr" class="btn-secondary flex items-center gap-2" style="font-size:12px;padding:8px 12px;height:38px;color:#7c3aed;border-color:#d8b4fe;background:#faf5ff;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect width="14" height="20" x="5" y="2" rx="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>
          📱 Cuentas y QR Yape/Plin
        </button>
        <button id="btn-exportar-cobros" class="btn-secondary flex items-center gap-2" style="font-size:12px;padding:8px 12px;height:38px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar Cobros (CSV)
        </button>
        <input type="text" id="search-cobros" placeholder="🔍 Buscar por orden, cliente o placa..." class="form-input" style="width:280px;font-size:12px;" />
      </div>
    </div>

    <!-- KPI Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-bottom:20px;">
      <div class="kpi-card">
        <div class="kpi-icon" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#15803d" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        </div>
        <div>
          <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;">Ingresos del Mes</p>
          <p style="font-size:20px;font-weight:900;color:#15803d;line-height:1.1;margin-top:2px;font-family:monospace;">S/ ${ingresos.toLocaleString('es-PE',{minimumFractionDigits:2})}</p>
          <p style="font-size:10px;color:var(--slate-5);">${cobrados} transacción${cobrados!==1?'es':''} exitosa${cobrados!==1?'s':''}</p>
        </div>
      </div>
      <div class="kpi-card" style="${pendientes>0?'border-color:#fde68a;':''}">
        <div class="kpi-icon" style="background:${pendientes>0?'linear-gradient(135deg,#fffbeb,#fef3c7)':'linear-gradient(135deg,#f8fafc,#f1f5f9)'};">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="${pendientes>0?'#b45309':'var(--slate-5)'}" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div>
          <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;">Por Cobrar</p>
          <p style="font-size:20px;font-weight:900;color:${pendientes>0?'#b45309':'var(--dark)'};line-height:1.1;margin-top:2px;font-family:monospace;">S/ ${porCobrar.toLocaleString('es-PE',{minimumFractionDigits:2})}</p>
          <p style="font-size:10px;color:var(--slate-5);">${pendientes} cobro${pendientes!==1?'s':''} pendiente${pendientes!==1?'s':''}</p>
        </div>
      </div>
      <div class="kpi-card" style="border-color:#c084fc;">
        <div class="kpi-icon" style="background:linear-gradient(135deg,#faf5ff,#ede9fe);">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </div>
        <div>
          <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;">IGV 18% (Est.)</p>
          <p style="font-size:20px;font-weight:900;color:#7c3aed;line-height:1.1;margin-top:2px;font-family:monospace;">S/ ${igv.toLocaleString('es-PE',{minimumFractionDigits:2})}</p>
          <p style="font-size:10px;color:var(--slate-5);">Base imponible declarable</p>
        </div>
      </div>
      <div class="kpi-card" style="border-color:#bfdbfe;">
        <div class="kpi-icon" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#1d4ed8" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
        </div>
        <div>
          <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;">Transacciones</p>
          <p style="font-size:20px;font-weight:900;color:#1d4ed8;line-height:1.1;margin-top:2px;">${cobrosList.length}</p>
          <p style="font-size:10px;color:var(--slate-5);">registros en el sistema</p>
        </div>
      </div>
    </div>

    <!-- Arqueo de Caja Diario -->
    <div class="card" style="padding:16px 20px;margin-bottom:20px;border-left:4px solid var(--emerald-500);background:var(--slate-9);">
      <div class="flex justify-between items-center" style="flex-wrap:wrap;gap:12px;width:100%;">
        <div class="flex items-center gap-3">
          <div style="font-size:20px;">💰</div>
          <div>
            <h3 style="font-size:13px;font-weight:900;color:var(--dark);margin:0;">Arqueo de Caja (Cierre de Hoy)</h3>
            <p style="font-size:11px;color:var(--slate-5);margin:0;">Consolidado diario de cobros exitosos (Pagados / Divididos)</p>
          </div>
        </div>
        <div class="flex gap-3" style="flex-wrap:wrap;font-family:monospace;font-size:11px;font-weight:700;">
          <div style="background:var(--white);padding:6px 10px;border-radius:6px;border:1px solid var(--slate-8);display:flex;gap:4px;">
            <span style="color:var(--slate-5);">Efectivo:</span> <span style="color:var(--dark);">S/ ${hoyMetodos['Efectivo'].toFixed(2)}</span>
          </div>
          <div style="background:var(--white);padding:6px 10px;border-radius:6px;border:1px solid var(--slate-8);display:flex;gap:4px;">
            <span style="color:var(--slate-5);">Yape/Plin:</span> <span style="color:var(--dark);">S/ ${hoyMetodos['Yape/Plin'].toFixed(2)}</span>
          </div>
          <div style="background:var(--white);padding:6px 10px;border-radius:6px;border:1px solid var(--slate-8);display:flex;gap:4px;">
            <span style="color:var(--slate-5);">Tarjeta:</span> <span style="color:var(--dark);">S/ ${hoyMetodos['Tarjeta'].toFixed(2)}</span>
          </div>
          <div style="background:var(--white);padding:6px 10px;border-radius:6px;border:1px solid var(--slate-8);display:flex;gap:4px;">
            <span style="color:var(--slate-5);">Transferencia:</span> <span style="color:var(--dark);">S/ ${hoyMetodos['Transferencia'].toFixed(2)}</span>
          </div>
          <div style="background:var(--emerald-500);color:white;padding:6px 12px;border-radius:6px;box-shadow:var(--shadow-sm);display:flex;gap:6px;">
            <span>TOTAL HOY:</span> <span>S/ ${totalHoy.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Medios de Pago widget (si hay data) -->
    ${metodoPct.length > 0 ? `
    <div class="card" style="padding:16px 20px;margin-bottom:20px;">
      <p style="font-size:11px;font-weight:800;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Distribución de Ingresos por Medio de Pago</p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${metodoPct.map(m => {
          const color = METODO_COLORS[m.label] || { bg:'#f1f5f9', fg:'#334155' };
          return `
          <div class="flex items-center gap-3">
            <span style="font-size:11px;font-weight:700;color:var(--dark);width:130px;flex-shrink:0;">${m.label}</span>
            <div class="method-bar-bg">
              <div class="method-bar-fill" style="width:${m.pct}%;background:${color.fg};opacity:0.7;"></div>
            </div>
            <span style="font-size:11px;font-weight:800;color:${color.fg};width:48px;text-align:right;flex-shrink:0;">${m.pct}%</span>
            <span style="font-size:10px;color:var(--slate-5);width:80px;text-align:right;font-family:monospace;flex-shrink:0;">S/ ${m.valor.toFixed(2)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Tabla con Paginación -->
    <div class="card" style="overflow:hidden;">
      <div style="padding:14px 20px;border-bottom:1px solid var(--slate-8);display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;font-weight:800;color:var(--dark);">Comprobantes y Cobros</span>
        <span style="font-size:11px;color:var(--slate-5);">${cobrosList.length} registro${cobrosList.length!==1?'s':''}</span>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table" style="font-size:12px;">
          <thead>
            <tr>
              <th>N° Comprobante</th>
              <th>Ref. Orden</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th class="text-right">Subtotal</th>
              <th class="text-right">IGV 18%</th>
              <th class="text-right">Total</th>
              <th class="text-center">Estado</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="tabla-cobros-body">
            ${renderTableRows(getPageCobros(cobrosList))}
          </tbody>
        </table>
      </div>
      <div id="cobros-pagination-bar">
        ${renderPaginationBar(cobrosList)}
      </div>
    </div>

    <!-- ═══════ MODALES ═══════ -->

    <!-- Modal Cobro Rápido -->
    <div id="modal-cobro-rapido" class="modal-overlay">
      <div class="modal modal-md">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="modal-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            </div>
            <span class="modal-title">Registrar Cobro / Liquidación en Caja</span>
          </div>
          <button class="modal-close" id="btn-close-cobro-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form id="form-cobro-rapido">
          <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;">
            <input type="hidden" id="cobro-rapido-id" />
            <input type="hidden" id="cobro-rapido-total" />
            <input type="hidden" id="cobro-rapido-neto" />

            <div style="background:var(--slate-9);padding:16px;border-radius:var(--radius-md);border:1px solid var(--slate-8);text-align:center;flex-shrink:0;">
              <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Total a Cobrar</p>
              <p id="cobro-rapido-monto" style="font-size:30px;font-weight:900;color:var(--dark);font-family:monospace;margin-top:4px;"></p>
              <p id="cobro-rapido-cliente" style="font-size:12px;color:var(--slate-5);margin-top:4px;"></p>
              <div id="cobro-rapido-nota-box" class="hidden" style="margin-top:10px; background:#fffbeb; border:1.5px solid #fde68a; border-radius:8px; padding:10px 12px; font-size:11px; text-align:left; color:#92400e;">
                <strong style="display:flex; align-items:center; gap:5px; margin-bottom:3px; color:#b45309;">
                  <span>📝</span> <span>Reporte del Técnico / Bahía:</span>
                </strong>
                <span id="cobro-rapido-nota-text" style="line-height:1.4; display:block; white-space:pre-line; color:#78350f;"></span>
              </div>
            </div>

            <!-- Desglose de Servicios y Repuestos -->
            <div id="cobro-rapido-items-container" style="background:var(--white);border:1px solid var(--slate-8);border-radius:var(--radius-md);overflow:hidden;flex-shrink:0;min-height:100px;">
              <div style="padding:9px 14px;background:var(--slate-9);border-bottom:1px solid var(--slate-8);display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:11.5px;font-weight:800;color:var(--dark);text-transform:uppercase;letter-spacing:.5px;">📋 Desglose de Mano de Obra y Repuestos</span>
                <span id="cobro-items-count" style="font-size:10.5px;color:var(--slate-4);font-weight:800;">—</span>
              </div>
              <div id="cobro-rapido-items-list" style="max-height:200px;overflow-y:auto;padding:8px 12px;font-size:11px;">
                <p style="text-align:center;color:var(--slate-5);padding:10px;margin:0;font-weight:600;">⏳ Cargando desglose...</p>
              </div>
            </div>

            <!-- Ajuste de Caja (Descuento o Recargo) -->
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:12px;border-radius:var(--radius-md);display:flex;flex-direction:column;gap:10px;flex-shrink:0;" id="caja-ajuste-wrapper">
              <p style="font-size:10px;font-weight:800;color:#166534;text-transform:uppercase;margin:0;">Ajuste de Caja: Descuento / Recargo (Opcional)</p>
              <div class="grid grid-cols-2 gap-3">
                <div class="form-group">
                  <label class="form-label" style="color:#166534;">Tipo Ajuste</label>
                  <select id="cobro-descuento-tipo" class="form-select" style="background:#fff;">
                    <option value="">Ninguno</option>
                    <option value="Desc_Pct">Descuento (%)</option>
                    <option value="Desc_Monto">Descuento (Monto S/)</option>
                    <option value="Cargo_Pct">Recargo Adicional (%)</option>
                    <option value="Cargo_Monto">Recargo Adicional (Monto S/)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" style="color:#166534;">Valor Ajuste</label>
                  <input type="number" id="cobro-descuento-valor" step="0.01" min="0" class="form-input text-right font-mono" style="background:#fff;" placeholder="0.00" disabled />
                </div>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px dashed #bbf7d0;padding-top:8px;margin-top:4px;">
                <span style="font-size:11px;font-weight:700;color:#166534;">Monto Neto / Final:</span>
                <span id="cobro-neto-display" style="font-size:16px;font-weight:900;color:#166534;font-family:monospace;">S/ 0.00</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Método de Pago</label>
              <select id="cobro-rapido-metodo" class="form-select" required>
                <option value="Efectivo">💵 Efectivo</option>
                <option value="Tarjeta">💳 Tarjeta de Crédito / Débito</option>
                <option value="Yape/Plin">📱 Yape / Plin / Billetera Digital</option>
                <option value="Transferencia">🏦 Transferencia Bancaria</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Tipo de Comprobante</label>
              <select id="cobro-rapido-comprobante" class="form-select" required>
                <option value="Boleta">Boleta de Venta Electrónica</option>
                <option value="Factura">Factura Electrónica</option>
                <option value="Recibo Interno">Recibo Interno (Control de Caja)</option>
              </select>
            </div>

            <!-- Pago dividido -->
            <div class="flex items-center gap-2" style="padding:10px;background:var(--slate-9);border-radius:var(--radius-sm);cursor:pointer;" id="toggle-dividido-wrap">
              <input type="checkbox" id="chk-dividir" style="width:16px;height:16px;cursor:pointer;" />
              <label for="chk-dividir" style="font-size:12px;font-weight:700;color:var(--slate-4);cursor:pointer;">Dividir pago entre dos empresas / responsables</label>
            </div>

            <div id="wrapper-dividido" class="hidden" style="display:flex;flex-direction:column;gap:12px;border-top:1px dashed var(--slate-8);padding-top:12px;">
              <div class="form-section-title">Distribución de Pagadores</div>
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:12px;border-radius:var(--radius-md);">
                <p style="font-size:10px;font-weight:800;color:#166534;text-transform:uppercase;margin-bottom:8px;">Empresa 1 (Cliente principal)</p>
                <div class="grid grid-cols-2 gap-3">
                  <div class="form-group"><label class="form-label">Monto (S/)</label><input type="number" id="div-monto-1" step="0.01" min="0" class="form-input text-right font-mono font-bold" style="background:#fff;" /></div>
                  <div class="form-group"><label class="form-label">Comprobante</label><select id="div-comp-1" class="form-select" style="background:#fff;"><option value="Boleta">Boleta</option><option value="Factura">Factura</option><option value="Recibo Interno">Recibo Interno</option></select></div>
                </div>
              </div>

              <!-- Indicador de balance en tiempo real -->
              <div id="split-balance-bar" style="background:var(--slate-9);border:1px solid var(--slate-8);border-radius:var(--radius-md);padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-size:11px;font-weight:700;color:var(--slate-5);">Suma actual:</span>
                  <span id="split-suma" style="font-size:13px;font-weight:900;font-family:monospace;color:var(--dark);">S/ 0.00</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-size:11px;font-weight:700;color:var(--slate-5);">Restante:</span>
                  <span id="split-restante" style="font-size:13px;font-weight:900;font-family:monospace;color:#64748b;">S/ 0.00</span>
                </div>
                <span id="split-estado-icon" style="font-size:16px;">&#9898;</span>
              </div>

              <div style="background:var(--white);border:1px solid var(--slate-8);padding:12px;border-radius:var(--radius-md);">
                <p style="font-size:10px;font-weight:800;color:var(--slate-5);text-transform:uppercase;margin-bottom:8px;">Empresa 2 / Co-pagador</p>
                <div class="grid grid-cols-2 gap-3 mb-2">
                  <div class="form-group"><label class="form-label">RUC / DNI</label><input type="text" id="div-doc-2" class="form-input font-mono" placeholder="20512345678" /></div>
                  <div class="form-group"><label class="form-label">Razón Social</label><input type="text" id="div-nombre-2" class="form-input" placeholder="Distribuidora Sol S.A." /></div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="form-group"><label class="form-label">Monto (S/)</label><input type="number" id="div-monto-2" step="0.01" min="0" class="form-input text-right font-mono font-bold" /></div>
                  <div class="form-group"><label class="form-label">Comprobante</label><select id="div-comp-2" class="form-select"><option value="Boleta">Boleta</option><option value="Factura">Factura</option><option value="Recibo Interno">Recibo Interno</option></select></div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" id="btn-close-cobro-cancel">Cancelar</button>
            <button type="submit" class="btn-primary" style="font-weight:800;">💳 Confirmar Pago y Liquidar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Portal de Pago Cliente -->
    <div id="modal-portal-pago" class="modal-overlay">
      <div class="modal modal-lg" style="max-width:580px;">
        <div class="modal-header" style="background:linear-gradient(135deg,#1e293b,#0f172a);border-radius:var(--radius-lg) var(--radius-lg) 0 0;">
          <div class="flex items-center gap-3">
            <div style="width:36px;height:36px;background:rgba(255,255,255,0.12);border-radius:10px;display:flex;align-items:center;justify-content:center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><path d="M12 2a10 10 0 110 20A10 10 0 0112 2z"/><path d="M12 8v4l3 3"/></svg>
            </div>
            <div>
              <span style="font-size:14px;font-weight:800;color:white;display:block;">📱 Medios de Pago: QR Yape/Plin y Cuentas Bancarias</span>
              <span style="font-size:10px;color:rgba(255,255,255,0.7);">Inversiones y Servicios Vargas E.I.R.L. · RUC 20608226066</span>
            </div>
          </div>
          <button class="modal-close" id="btn-close-portal-x" style="color:rgba(255,255,255,0.6);">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="modal-body" style="padding:0;">
          <!-- Info resumen -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid var(--slate-8);">
            <div style="padding:14px 20px;border-right:1px solid var(--slate-8);">
              <p style="font-size:10px;color:var(--slate-5);font-weight:700;text-transform:uppercase;">Empresa / Taller</p>
              <p style="font-size:13px;font-weight:900;color:var(--dark);margin-top:2px;">Inversiones y Servicios Vargas E.I.R.L.</p>
              <p style="font-size:11px;color:var(--slate-5);">RUC: 20608226066</p>
            </div>
            <div style="padding:14px 20px;text-align:right;">
              <p style="font-size:10px;color:var(--slate-5);font-weight:700;text-transform:uppercase;">Total a Pagar</p>
              <p id="portal-monto" style="font-size:24px;font-weight:900;color:#1e293b;font-family:monospace;margin-top:2px;"></p>
              <p id="portal-cliente" style="font-size:10px;color:var(--slate-5);"></p>
            </div>
          </div>

          <!-- Tabs de métodos de pago -->
          <div style="background:var(--slate-9);padding:4px 20px 0;">
            <div style="display:flex;gap:0;" id="portal-tab-wrap">
              <button class="portal-tab active" data-tab="yape" style="flex:1;padding:10px 0;border:none;background:transparent;cursor:pointer;font-size:12px;font-weight:700;color:var(--dark);border-bottom:2px solid var(--brand);">📱 Yape / Plin</button>
              <button class="portal-tab" data-tab="banco" style="flex:1;padding:10px 0;border:none;background:transparent;cursor:pointer;font-size:12px;font-weight:700;color:var(--slate-5);border-bottom:2px solid transparent;">🏦 Transferencia Bancaria</button>
            </div>
          </div>

          <div id="portal-content" style="padding:24px 20px;min-height:280px;">
            <!-- Cargado por JS -->
          </div>

          <div style="padding:0 20px 20px;display:flex;gap:10px;" id="portal-footer">
            <button class="btn-ghost" id="btn-close-portal-cancel" style="flex:1;justify-content:center;">Cancelar</button>
            <button class="btn-primary" id="btn-portal-confirmar" style="flex:2;justify-content:center;font-size:13px;">
              ✅ Confirmar Pago
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Factura Electrónica -->
    <div id="modal-factura-electronica" class="modal-overlay" style="padding:20px;">
      <div style="max-width:760px;width:100%;margin:0 auto;">
        <!-- Barra de acciones -->
        <div class="no-print flex justify-between items-center mb-4" style="flex-wrap:wrap;gap:10px;">
          <div>
            <span style="font-size:13px;font-weight:800;color:var(--dark);">Comprobante de Pago</span>
            <p style="font-size:11px;color:var(--slate-5);">Documento de Control Interno sin validez tributaria</p>
          </div>
          <div class="flex gap-2">
            <button class="btn-ghost" id="btn-descargar-xml" style="font-size:12px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Descargar XML
            </button>
            <button class="btn-success" id="btn-enviar-whatsapp" style="font-size:12px;background:#22c55e;color:white;border-color:#22c55e;">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2" style="margin-right:4px;"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
              Enviar WhatsApp
            </button>
            <button class="btn-success" id="btn-imprimir-factura" style="font-size:12px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
              Imprimir A4
            </button>
            <button class="btn-primary" id="btn-imprimir-ticket" style="font-size:12px;background:#3b82f6;border-color:#3b82f6;color:white;">
              🧾 Ticket 80mm
            </button>
            <button class="btn-ghost modal-close" id="btn-close-factura-x" style="font-size:12px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              Cerrar
            </button>
          </div>
        </div>
        <!-- Selector de Pagador para cobros divididos -->
        <div id="div-pagadores-toggle-bar" class="no-print" style="margin-bottom: 12px; display: none; gap: 8px; background: var(--slate-9); padding: 8px 12px; border-radius: var(--radius-md); border: 1px solid var(--slate-8);">
          <!-- Dynamic buttons -->
        </div>
        <!-- Documento A4 -->
        <div id="factura-doc-content" style="background:#fff;border-radius:8px;box-shadow:var(--shadow-lg);">
          <!-- Cargado por JS al abrir -->
        </div>
      </div>
    </div>

    <!-- Modal Venta Rápida (Mostrador) -->
    <div id="modal-venta-rapida" class="modal-overlay">
      <div class="modal modal-lg" style="max-width:740px;">
        <div class="modal-header" style="background:linear-gradient(135deg,#065f46,#047857);color:#fff;border-radius:var(--radius-lg) var(--radius-lg) 0 0;">
          <div class="flex items-center gap-3">
            <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            </div>
            <div>
              <span style="font-size:15px;font-weight:900;letter-spacing:-0.3px;color:#fff;">Venta Rápida de Mostrador</span>
              <p style="font-size:11px;color:#d1fae5;margin:0;">Venta directa de repuestos y lubricantes sin Orden de Servicio</p>
            </div>
          </div>
          <button type="button" class="modal-close" id="btn-close-vr-x" style="color:rgba(255,255,255,0.8);">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <form id="form-venta-rapida">
          <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;padding:20px;">
            <!-- Datos del Comprador -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:var(--radius-md);padding:14px;">
              <p style="font-size:11px;font-weight:800;color:var(--slate-5);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">1. Datos del Cliente / Comprador</p>
              <div class="grid grid-cols-2 gap-3">
                <div class="form-group" style="margin:0;">
                  <label class="form-label">Cliente / Razón Social *</label>
                  <input type="text" id="vr-cliente-nombre" class="form-input" value="Cliente Mostrador" required placeholder="Ej: Cliente Mostrador, Taller Los Amigos..." />
                </div>
                <div class="form-group" style="margin:0;">
                  <label class="form-label">DNI / RUC (Opcional)</label>
                  <input type="text" id="vr-cliente-doc" class="form-input font-mono" placeholder="Ej: 10458798541 o 20601234567" />
                </div>
              </div>
            </div>

            <!-- Buscador y Selector de Productos -->
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:var(--radius-md);padding:14px;position:relative;">
              <p style="font-size:11px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">2. Buscar Repuesto o Insumo en Almacén</p>
              
              <div style="display:flex;flex-direction:column;gap:10px;">
                <!-- Buscador con resultados flotantes instantáneos -->
                <div style="position:relative;" id="vr-search-box-wrap">
                  <div style="display:flex;align-items:center;position:relative;">
                    <input type="text" id="vr-search-prod" class="form-input" placeholder="🔍 Escribe para buscar repuesto (ej: Aceite, Bujía, Filtro, código...)" autocomplete="off" style="background:#fff;font-size:13px;padding-right:34px;height:42px;font-weight:600;border:1.5px solid #10b981;" />
                    <button type="button" id="btn-vr-clear-prod" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;display:none;padding:4px;border-radius:50%;line-height:1;" title="Limpiar búsqueda">✕</button>
                  </div>
                  <input type="hidden" id="vr-selected-prod-id" value="" />
                  
                  <!-- Dropdown flotante tipo Google/Typeahead -->
                  <div id="vr-search-results" class="hidden" style="position:absolute;left:0;right:0;top:100%;margin-top:4px;background:#fff;border:1.5px solid #10b981;border-radius:8px;box-shadow:0 12px 28px rgba(0,0,0,0.18);max-height:220px;overflow-y:auto;z-index:999;">
                    <!-- Se llena automáticamente con cada tecla -->
                  </div>
                </div>
                
                <div style="display:grid;grid-template-columns:1fr 1fr 1.2fr auto;gap:10px;align-items:end;">
                  <div class="form-group" style="margin:0;">
                    <label class="form-label" style="font-size:11px;color:#166534;">Stock Actual</label>
                    <input type="text" id="vr-stock-disp" class="form-input font-mono font-bold" readonly style="background:#e2e8f0;color:#334155;text-align:center;height:38px;" value="—" />
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label class="form-label" style="font-size:11px;color:#166534;">Cantidad *</label>
                    <input type="number" id="vr-item-cant" min="1" value="1" class="form-input font-mono font-bold text-center" style="background:#fff;height:38px;" />
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label class="form-label" style="font-size:11px;color:#166534;">P. Venta Unit. (S/) *</label>
                    <input type="number" id="vr-item-precio" step="0.01" min="0" class="form-input font-mono font-bold text-right" style="background:#fff;height:38px;" placeholder="0.00" />
                  </div>
                  <button type="button" id="btn-vr-add-item" class="btn-success flex items-center gap-1" style="height:38px;padding:0 16px;background:#059669;border-color:#047857;font-weight:800;font-size:12px;box-shadow:0 2px 6px rgba(5,150,105,0.3);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 4v16m8-8H4"/></svg>
                    + Agregar
                  </button>
                </div>
              </div>
            </div>

            <!-- Lista de ítems agregados -->
            <div style="border:1px solid #e2e8f0;border-radius:var(--radius-md);overflow:hidden;background:#fff;">
              <div style="padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:11px;font-weight:800;color:var(--dark);text-transform:uppercase;">🛒 Productos en el Mostrador</span>
                <span id="vr-items-count" style="font-size:11px;color:var(--slate-5);font-weight:700;">0 ítems</span>
              </div>
              <div style="max-height:160px;overflow-y:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                  <thead>
                    <tr style="background:#f1f5f9;border-bottom:1px solid #e2e8f0;font-size:10px;text-transform:uppercase;color:var(--slate-5);">
                      <th style="padding:6px 10px;text-align:left;">Producto</th>
                      <th style="padding:6px 8px;text-align:center;width:60px;">Cant.</th>
                      <th style="padding:6px 8px;text-align:right;width:80px;">P. Unit</th>
                      <th style="padding:6px 8px;text-align:right;width:90px;">Subtotal</th>
                      <th style="padding:6px 8px;text-align:center;width:40px;"></th>
                    </tr>
                  </thead>
                  <tbody id="vr-items-tbody">
                    <tr><td colspan="5" style="text-align:center;padding:16px;color:var(--slate-5);font-size:11px;">No hay productos agregados a la venta</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Total y Forma de Pago -->
            <div style="background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:var(--radius-md);padding:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px dashed #cbd5e1;padding-bottom:10px;">
                <span style="font-size:13px;font-weight:800;color:var(--dark);">TOTAL A COBRAR:</span>
                <span id="vr-total-display" style="font-size:24px;font-weight:900;color:#047857;font-family:monospace;">S/ 0.00</span>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="form-group" style="margin:0;">
                  <label class="form-label">Método de Pago *</label>
                  <select id="vr-metodo-pago" class="form-select" required>
                    <option value="Efectivo">💵 Efectivo</option>
                    <option value="Yape/Plin">📱 Yape / Plin</option>
                    <option value="Tarjeta">💳 Tarjeta de Crédito / Débito</option>
                    <option value="Transferencia">🏦 Transferencia Bancaria</option>
                  </select>
                </div>
                <div class="form-group" style="margin:0;">
                  <label class="form-label">Comprobante *</label>
                  <select id="vr-tipo-comprobante" class="form-select" required>
                    <option value="Recibo Interno">Recibo Interno (Control de Caja)</option>
                    <option value="Boleta">Boleta de Venta</option>
                    <option value="Factura">Factura</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer" style="padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
            <button type="button" class="btn-ghost" id="btn-close-vr-cancel">Cancelar</button>
            <button type="submit" id="btn-submit-venta-rapida" class="btn-success flex items-center gap-2" style="font-weight:900;padding:8px 18px;background:#059669;border-color:#047857;font-size:13px;">
              💳 Cobrar y Entregar Producto
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // ── Eventos
  document.getElementById('search-cobros').addEventListener('input', debounce(filtrarCobros, 300));

  document.getElementById('btn-exportar-cobros').addEventListener('click', async () => {
    try {
      const csvText = await exportarCobrosCSV();
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `reporte_cobros_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Error al exportar cobros: ' + err.message);
    }
  });

  // Botones de cierre
  document.getElementById('btn-close-cobro-x').addEventListener('click', () => cerrarModal('modal-cobro-rapido'));
  document.getElementById('btn-close-cobro-cancel').addEventListener('click', () => cerrarModal('modal-cobro-rapido'));
  document.getElementById('btn-close-portal-x').addEventListener('click', () => cerrarModal('modal-portal-pago'));
  document.getElementById('btn-close-portal-cancel').addEventListener('click', () => cerrarModal('modal-portal-pago'));
  document.getElementById('btn-close-factura-x').addEventListener('click', () => cerrarModal('modal-factura-electronica'));
  document.getElementById('btn-close-vr-x')?.addEventListener('click', cerrarModalVentaRapida);
  document.getElementById('btn-close-vr-cancel')?.addEventListener('click', cerrarModalVentaRapida);

  // Venta Rápida Eventos
  document.getElementById('btn-venta-rapida')?.addEventListener('click', abrirModalVentaRapida);
  document.getElementById('btn-vr-add-item')?.addEventListener('click', agregarItemVentaRapida);
  document.getElementById('btn-vr-clear-prod')?.addEventListener('click', limpiarSeleccionProductoVR);

  const vrSearchInput = document.getElementById('vr-search-prod');
  const vrResultsBox = document.getElementById('vr-search-results');

  vrSearchInput?.addEventListener('input', (e) => {
    const val = e.target.value;
    const clearBtn = document.getElementById('btn-vr-clear-prod');
    if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
    
    // Si cambia el texto escrito, invalidamos el producto previo seleccionado
    const idEl = document.getElementById('vr-selected-prod-id');
    if (idEl) idEl.value = '';
    
    const matches = buscarProductosVR(val);
    mostrarResultadosVR(matches);
  });

  vrSearchInput?.addEventListener('focus', (e) => {
    const matches = buscarProductosVR(e.target.value);
    mostrarResultadosVR(matches);
  });

  vrSearchInput?.addEventListener('keydown', (e) => {
    const items = vrResultsBox?.querySelectorAll('.vr-search-item');
    if (!items || items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      vrActiveResultIdx = (vrActiveResultIdx + 1) % items.length;
      updateActiveResultItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      vrActiveResultIdx = (vrActiveResultIdx - 1 + items.length) % items.length;
      updateActiveResultItem(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const targetIdx = vrActiveResultIdx >= 0 ? vrActiveResultIdx : 0;
      const targetItem = items[targetIdx];
      if (targetItem) {
        const prodId = parseInt(targetItem.dataset.id, 10);
        const prod = productosVentaRapida.find(p => p.id === prodId);
        if (prod) seleccionarProductoVR(prod);
      }
    } else if (e.key === 'Escape') {
      vrResultsBox?.classList.add('hidden');
    }
  });

  vrResultsBox?.addEventListener('click', (e) => {
    const item = e.target.closest('.vr-search-item');
    if (item) {
      const prodId = parseInt(item.dataset.id, 10);
      const prod = productosVentaRapida.find(p => p.id === prodId);
      if (prod) seleccionarProductoVR(prod);
    }
  });

  // Enter rápido en Cantidad y Precio para agregar al mostrador
  document.getElementById('vr-item-cant')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarItemVentaRapida();
    }
  });
  document.getElementById('vr-item-precio')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarItemVentaRapida();
    }
  });

  // Ocultar resultados al hacer clic fuera del buscador
  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('vr-search-box-wrap');
    if (wrap && !wrap.contains(e.target)) {
      document.getElementById('vr-search-results')?.classList.add('hidden');
    }
  });

  document.getElementById('vr-items-tbody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-vr-del');
    if (btn) {
      eliminarItemVentaRapida(parseInt(btn.dataset.idx, 10));
    }
  });
  document.getElementById('form-venta-rapida')?.addEventListener('submit', procesarVentaRapida);

  document.getElementById('form-cobro-rapido').addEventListener('submit', procesarCobroRapido);
  document.getElementById('chk-dividir').addEventListener('change', toggleDividido);

  // Lógica de Descuento (Fase 2)
  const descTipoEl = document.getElementById('cobro-descuento-tipo');
  const descValorEl = document.getElementById('cobro-descuento-valor');

  function calcularDescuento() {
    const totalOriginal = parseFloat(document.getElementById('cobro-rapido-total').value) || 0;
    const tipo = descTipoEl.value;
    let valor = parseFloat(descValorEl.value) || 0;

    if (!tipo) {
      descValorEl.value = '';
      descValorEl.disabled = true;
      document.getElementById('cobro-rapido-neto').value = '';
      document.getElementById('cobro-neto-display').textContent = `S/ ${totalOriginal.toFixed(2)}`;
      document.getElementById('cobro-rapido-monto').innerHTML = `S/ ${totalOriginal.toFixed(2)}`;
    } else {
      descValorEl.disabled = false;
      if (valor < 0) {
        valor = 0;
        descValorEl.value = 0;
      }
      
      let descRealizado = 0;
      let neto = totalOriginal;
      if (tipo === 'Desc_Pct') {
        if (valor > 100) {
          valor = 100;
          descValorEl.value = 100;
        }
        descRealizado = parseFloat((totalOriginal * (valor / 100)).toFixed(2));
        neto = parseFloat((totalOriginal - descRealizado).toFixed(2));
      } else if (tipo === 'Desc_Monto') {
        if (valor > totalOriginal) {
          valor = totalOriginal;
          descValorEl.value = totalOriginal.toFixed(2);
        }
        descRealizado = valor;
        neto = parseFloat((totalOriginal - descRealizado).toFixed(2));
      } else if (tipo === 'Cargo_Pct') {
        if (valor > 1000) {
          valor = 1000;
          descValorEl.value = 1000;
        }
        descRealizado = parseFloat((totalOriginal * (valor / 100)).toFixed(2));
        neto = parseFloat((totalOriginal + descRealizado).toFixed(2));
      } else if (tipo === 'Cargo_Monto') {
        descRealizado = valor;
        neto = parseFloat((totalOriginal + descRealizado).toFixed(2));
      }

      document.getElementById('cobro-rapido-neto').value = neto;
      document.getElementById('cobro-neto-display').textContent = `S/ ${neto.toFixed(2)}`;
      
      const isSurcharge = tipo.startsWith('Cargo');
      const actionColor = isSurcharge ? '#1d4ed8' : '#b45309';

      document.getElementById('cobro-rapido-monto').innerHTML = `
        <span style="text-decoration:line-through;font-size:18px;color:var(--slate-5);margin-right:8px;">S/ ${totalOriginal.toFixed(2)}</span>
        <span style="color:${actionColor};font-weight:bold;">S/ ${neto.toFixed(2)}</span>
      `;
    }

    // Si el pago es dividido, recalcular la división sobre el neto!
    if (document.getElementById('chk-dividir').checked) {
      actualizarBalanceDividido(1);
    }
  }

  descTipoEl.addEventListener('change', calcularDescuento);
  descValorEl.addEventListener('input', calcularDescuento);

  // Auto-cálculo de montos en pago dividido
  function actualizarBalanceDividido(campoModificado) {
    const netoVal = document.getElementById('cobro-rapido-neto').value;
    const total = netoVal !== "" ? parseFloat(netoVal) : (parseFloat(document.getElementById('cobro-rapido-total').value) || 0);
    const m1El  = document.getElementById('div-monto-1');
    const m2El  = document.getElementById('div-monto-2');
    const suma  = document.getElementById('split-suma');
    const rest  = document.getElementById('split-restante');
    const icon  = document.getElementById('split-estado-icon');
    const bar   = document.getElementById('split-balance-bar');

    if (campoModificado === 1) {
      const v1 = parseFloat(m1El.value) || 0;
      const v2 = Math.max(0, parseFloat((total - v1).toFixed(2)));
      m2El.value = v2;
    } else {
      const v2 = parseFloat(m2El.value) || 0;
      const v1 = Math.max(0, parseFloat((total - v2).toFixed(2)));
      m1El.value = v1;
    }

    const sumActual  = (parseFloat(m1El.value) || 0) + (parseFloat(m2El.value) || 0);
    const restante   = total - sumActual;
    const cuadra     = Math.abs(restante) < 0.05;

    suma.textContent = `S/ ${sumActual.toFixed(2)}`;
    rest.textContent = cuadra ? '✅ Cuadrado' : `S/ ${Math.abs(restante).toFixed(2)} ${restante > 0 ? 'falta' : 'excede'}`;
    rest.style.color = cuadra ? '#16a34a' : '#dc2626';
    icon.textContent = cuadra ? '✅' : '⚠️';
    bar.style.borderColor  = cuadra ? '#bbf7d0' : '#fecaca';
    bar.style.background   = cuadra ? '#f0fdf4'  : '#fef2f2';
  }

  document.getElementById('div-monto-1').addEventListener('input', () => actualizarBalanceDividido(1));
  document.getElementById('div-monto-2').addEventListener('input', () => actualizarBalanceDividido(2));

  // Tabs del portal
  document.getElementById('portal-tab-wrap').addEventListener('click', (e) => {
    const tab = e.target.closest('.portal-tab');
    if (!tab) return;
    document.querySelectorAll('.portal-tab').forEach(t => {
      t.classList.remove('active');
      t.style.color = 'var(--slate-5)';
      t.style.borderBottomColor = 'transparent';
    });
    tab.classList.add('active');
    tab.style.color = 'var(--dark)';
    tab.style.borderBottomColor = 'var(--brand)';
    renderPortalTab(tab.dataset.tab);
  });

  document.getElementById('btn-portal-confirmar').addEventListener('click', confirmarPagoPortal);
  document.getElementById('btn-imprimir-factura').addEventListener('click', () => {
    const printArea = document.getElementById('print-area');
    const docContent = document.getElementById('factura-doc-content');
    if (printArea && docContent) {
      printArea.innerHTML = `<div class="factura-doc">${docContent.innerHTML}</div>`;
      const onAfter = () => {
        printArea.innerHTML = '';
        window.removeEventListener('afterprint', onAfter);
      };
      window.addEventListener('afterprint', onAfter);
      setTimeout(() => {
        window.print();
        setTimeout(() => { printArea.innerHTML = ''; }, 2500);
      }, 150);
    } else {
      window.print();
    }
  });
  document.getElementById('btn-descargar-xml').addEventListener('click', descargarXML);
  const btnTicket = document.getElementById('btn-imprimir-ticket');
  if (btnTicket) {
    btnTicket.addEventListener('click', () => {
      if (currentCobro) {
        window.imprimirTicketTermico({ ...currentCobro, items: currentItems });
      }
    });
  }
  document.getElementById('btn-enviar-whatsapp').addEventListener('click', enviarComprobantePorWhatsApp);
  document.getElementById('btn-ver-cuentas-qr')?.addEventListener('click', () => abrirPortalPago(null));
  attachPaginationEvents();

function enviarComprobantePorWhatsApp() {
  if (!currentCobro) return;
  const c = currentCobro;
  const idx = activePagadorIndex;

  const compTipo = idx === 1 ? (c.tipo_comprobante || 'Boleta') : (c.comprobante2 || 'Boleta');
  const compNumero = idx === 1 ? (c.comprobante_numero || '—') : (c.comprobante2_numero || '—');
  const receptorNombre = idx === 1 ? (c.cliente_nombre || '—') : (c.pagador2_nombre || '—');

  let telefono = '';
  if (idx === 1 && c.cliente_telefono) {
    telefono = String(c.cliente_telefono).replace(/[^0-9]/g, '');
  }

  const envApiUrl = import.meta.env.VITE_API_URL;
  // Si la API URL no está definida, es relativa o es localhost, usamos el origen actual (dominio de producción)
  // ya que Nginx actúa como proxy reverso para la carpeta /uploads/ en el mismo dominio.
  const baseUrl = (envApiUrl && !envApiUrl.includes('localhost')) ? envApiUrl : window.location.origin;
  const urlPdf = `${baseUrl}/uploads/${compNumero}.pdf`;

  const mensaje = `Hola ${receptorNombre}, adjuntamos su comprobante ${compTipo} N° ${compNumero} de Inversiones y Servicios Vargas E.I.R.L. Descargue aquí el PDF oficial: ${urlPdf}`;
  const mensajeEncoded = encodeURIComponent(mensaje);

  let waUrl = '';
  if (telefono && (telefono.length === 9 || telefono.length === 11)) {
    const telCode = telefono.length === 9 ? `51${telefono}` : telefono;
    waUrl = `https://wa.me/${telCode}?text=${mensajeEncoded}`;
  } else {
    waUrl = `https://wa.me/?text=${mensajeEncoded}`;
  }

  window.open(waUrl, '_blank');
}

  // Tabla delegada
  document.getElementById('tabla-cobros-body').addEventListener('click', (e) => {
    const rapido = e.target.closest('.btn-cobro-rapido');
    const portal  = e.target.closest('.btn-abrir-portal');
    const factura = e.target.closest('.btn-ver-factura');
    const ticketDirecto = e.target.closest('.btn-ticket-directo');
    if (rapido) abrirCobroRapido(rapido.dataset.id);
    else if (portal) abrirPortalPago(portal.dataset.id);
    else if (factura) abrirFactura(factura.dataset.id);
    else if (ticketDirecto) {
      const c = cobrosList.find(item => item.id == ticketDirecto.dataset.id);
      if (c) {
        if (c.orden_id) {
          getOrden(c.orden_id).then(ord => {
            window.imprimirTicketTermico({ ...c, items: ord.items || [] });
          }).catch(() => {
            window.imprimirTicketTermico({ ...c, items: [] });
          });
        } else {
          let items = [];
          try {
            items = typeof c.detalle_items === 'string' ? JSON.parse(c.detalle_items) : (c.detalle_items || []);
          } catch(e) {}
          window.imprimirTicketTermico({ ...c, items });
        }
      }
    }
  });

  // Inicializar tab del portal
  renderPortalTab('yape');

  // Procesar auto-cobro si viene desde Órdenes o Kanban con ?cobrar=ID
  const urlParams = new URLSearchParams(window.location.search);
  const paramCobrar = urlParams.get('cobrar');
  if (paramCobrar) {
    const cTarget = cobrosList.find(c => String(c.orden_id) === String(paramCobrar) || String(c.id) === String(paramCobrar));
    if (cTarget) {
      if (cTarget.estado === 'Pendiente') {
        setTimeout(() => abrirCobroRapido(cTarget.id), 150);
      } else {
        alert(`ℹ️ La orden #${paramCobrar} ya fue cobrada y liquidada (${cTarget.estado}).`);
      }
    }
  }
}


// ── TABLA ────────────────────────────────────────────────

function renderTableRows(cobros) {
  if (cobros.length === 0) {
    return `<tr><td colspan="9" class="td-empty">No se encontraron comprobantes</td></tr>`;
  }

  return cobros.map(c => {
    const isPaid = c.estado === 'Cancelado' || c.estado === 'Dividido';
    const totalOriginal = parseFloat(c.monto_total);
    const totalNeto = c.monto_neto !== null && c.monto_neto !== undefined ? parseFloat(c.monto_neto) : totalOriginal;
    
    const igvNeto = totalNeto * 0.18 / 1.18; // descuento/IGV sobre neto
    const subNeto = totalNeto - igvNeto;
    const tipo = c.tipo_comprobante;

    let numDocHtml = '— PENDIENTE —';
    if (isPaid) {
      if (c.es_dividido) {
        numDocHtml = `
          <div style="font-family:monospace;font-weight:800;color:var(--dark);font-size:11px;line-height:1.2;">
            ${c.comprobante_numero || '—'} <span style="font-weight:normal;color:var(--slate-5);font-size:9px;">(${c.tipo_comprobante || '—'})</span>
          </div>
          <div style="font-family:monospace;font-weight:800;color:var(--dark);font-size:11px;line-height:1.2;margin-top:4px;border-top:1px dashed var(--slate-8);padding-top:2px;">
            ${c.comprobante2_numero || '—'} <span style="font-weight:normal;color:var(--slate-5);font-size:9px;">(${c.comprobante2 || '—'})</span>
          </div>
        `;
      } else {
        numDocHtml = `
          <span style="font-family:monospace;font-weight:800;color:var(--dark);font-size:11px;">${c.comprobante_numero || '—'}</span>
          <div style="font-size:9px;color:var(--slate-5);text-transform:uppercase;margin-top:1px;">${tipo || '—'}</div>
        `;
      }
    }

    const dateStr = safeFormatDate(c.fecha_emision, { day:'2-digit', month:'short', year:'numeric' });

    let badge = '';
    if (c.estado === 'Cancelado') badge = `<span class="badge badge-emerald">✓ Pagado</span>`;
    else if (c.estado === 'Dividido') badge = `<span class="badge badge-purple">÷ Pagado (Dividido)</span>`;
    else badge = `<span class="badge badge-amber" style="animation:pulse-badge 1.5s ease-in-out infinite alternate;">⏳ Pendiente</span>`;

    let actions = '';
    if (!isPaid) {
      actions = `
        <div class="flex justify-end gap-2 items-center">
          <button class="btn-icon btn-abrir-portal" data-id="${c.id}" title="Ver QR y Cuentas Bancarias" style="color:#7c3aed;font-size:11px;font-weight:700;display:flex;align-items:center;gap:4px;padding:6px 10px;border-radius:6px;background:#faf5ff;border:1px solid #e9d5ff;cursor:pointer;">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect width="14" height="20" x="5" y="2" rx="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>
            📱 QR / Cuentas
          </button>
          <button class="btn-success btn-cobro-rapido" data-id="${c.id}" style="font-size:12px;padding:6px 14px;font-weight:700;display:flex;align-items:center;gap:4px;box-shadow:0 2px 6px rgba(16,185,129,0.3);cursor:pointer;">
            💳 Cobrar
          </button>
        </div>`;
    } else {
      actions = `
        <div class="flex justify-end gap-2 items-center">
          <button class="btn-icon btn-ticket-directo" data-id="${c.id}" title="Imprimir Ticket Térmico 80mm" style="color:#0f172a;font-size:11px;font-weight:700;display:flex;align-items:center;gap:4px;padding:6px 10px;border-radius:6px;background:#f1f5f9;border:1px solid #cbd5e1;cursor:pointer;">
            🧾 Ticket
          </button>
          <button class="btn-icon btn-ver-factura" data-id="${c.id}" title="Ver Comprobante A4 / Opciones" style="color:var(--brand);font-size:11px;font-weight:700;display:flex;align-items:center;gap:4px;padding:6px 11px;border-radius:6px;background:#eff6ff;border:1px solid #bfdbfe;cursor:pointer;">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Ver Doc.
          </button>
        </div>`;
    }

    let totalHtml = '';
    if (c.monto_neto !== null && c.monto_neto !== undefined && parseFloat(c.monto_neto) !== totalOriginal) {
      const descVal = parseFloat(c.descuento_valor);
      const descRealizado = parseFloat(c.descuento_realizado || 0);
      const isSurcharge = c.descuento_tipo && c.descuento_tipo.startsWith('Cargo');
      const actionSymbol = isSurcharge ? '+' : '-';
      const actionColor = isSurcharge ? '#1d4ed8' : '#b45309';
      const actionText = isSurcharge ? 'Cargo' : 'Desc.';
      const descLabel = c.descuento_tipo && c.descuento_tipo.includes('Pct') ? `${descVal}%` : `S/ ${descVal.toFixed(2)}`;
      
      totalHtml = `
        <span style="text-decoration:line-through;font-size:10px;color:var(--slate-5);display:block;font-weight:normal;">S/ ${totalOriginal.toFixed(2)}</span>
        <span style="color:${actionColor};font-weight:bold;">S/ ${totalNeto.toFixed(2)}</span>
        <div style="font-size:9px;color:${actionColor};font-weight:700;margin-top:2px;">${actionText} ${descLabel} (${actionSymbol}S/ ${descRealizado.toFixed(2)})</div>
      `;
    } else {
      totalHtml = `<span class="font-bold">S/ ${totalNeto.toFixed(2)}</span>`;
    }

    return `
      <tr class="cobro-row">
        <td>
          ${numDocHtml}
        </td>
        <td>
          ${c.orden_numero ? `
            <span style="font-family:monospace;font-size:11px;font-weight:800;color:var(--brand);">OT-${String(c.orden_numero).padStart(4,'0')}</span>
            <div style="font-size:10px;color:var(--slate-5);">${escapeHtml(c.placa || '—')}</div>
          ` : `
            <span class="badge" style="background:#ecfdf5;color:#047857;font-weight:800;font-size:10px;display:inline-flex;align-items:center;gap:3px;">🛒 VENTA DIRECTA</span>
            <div style="font-size:10px;color:var(--slate-5);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(c.concepto || 'Venta de Mostrador')}">${escapeHtml(c.concepto || 'Venta de Mostrador')}</div>
          `}
        </td>
        <td>
          <strong style="display:block;font-size:12px;">${escapeHtml(c.cliente_nombre || 'Cliente Mostrador')}</strong>
          <span style="font-size:10px;color:var(--slate-5);font-family:monospace;">${escapeHtml(c.tipo_doc || 'DOC')}: ${escapeHtml(c.num_doc || '—')}</span>
        </td>
        <td style="font-size:11px;color:var(--slate-5);">${dateStr}</td>
        <td class="text-right font-mono" style="font-size:11px;color:var(--slate-5);">S/ ${subNeto.toFixed(2)}</td>
        <td class="text-right font-mono" style="font-size:11px;color:#7c3aed;">S/ ${igvNeto.toFixed(2)}</td>
        <td class="text-right font-mono" style="font-size:13px;">${totalHtml}</td>
        <td class="text-center">${badge}</td>
        <td class="text-right">${actions}</td>
      </tr>`;
  }).join('');
}

// ── FILTRO Y PAGINACIÓN ──────────────────────────────────

function filtrarCobros() {
  currentPage = 1;
  updateTableAndPagination();
}

function updateTableAndPagination() {
  const filtered = getFilteredCobros();
  const pageItems = getPageCobros(filtered);
  const tbody = document.getElementById('tabla-cobros-body');
  if (tbody) tbody.innerHTML = renderTableRows(pageItems);
  const pagBar = document.getElementById('cobros-pagination-bar');
  if (pagBar) pagBar.innerHTML = renderPaginationBar(filtered);
  attachPaginationEvents();
}

function attachPaginationEvents() {
  document.getElementById('btn-page-prev')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      updateTableAndPagination();
    }
  });
  document.getElementById('btn-page-next')?.addEventListener('click', () => {
    const filtered = getFilteredCobros();
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      updateTableAndPagination();
    }
  });
}

// ── MODAL COBRO RÁPIDO ────────────────────────────────────

function abrirCobroRapido(id) {
  const c = cobrosList.find(item => item.id == id);
  if (!c) return;
  document.getElementById('cobro-rapido-id').value = c.id;
  document.getElementById('cobro-rapido-total').value = c.monto_total;
  document.getElementById('cobro-rapido-neto').value = '';
  document.getElementById('cobro-rapido-monto').textContent = `S/ ${parseFloat(c.monto_total).toFixed(2)}`;
  document.getElementById('cobro-rapido-cliente').textContent = `${c.cliente_nombre} | ${c.tipo_doc}: ${c.num_doc}`;

  // Reset y carga de desglose de ítems
  const itemsContainer = document.getElementById('cobro-rapido-items-list');
  const itemsCountEl = document.getElementById('cobro-items-count');
  if (itemsContainer) itemsContainer.innerHTML = '<p style="text-align:center;color:var(--slate-5);padding:10px;margin:0;font-weight:600;">⏳ Cargando desglose de la orden...</p>';
  if (itemsCountEl) itemsCountEl.textContent = '...';

  // Mostrar nota técnica / reporte del mecánico si existe
  const notaBox = document.getElementById('cobro-rapido-nota-box');
  const notaText = document.getElementById('cobro-rapido-nota-text');
  if (notaBox && notaText) {
    if (c.nota_interna && c.nota_interna.trim()) {
      notaText.textContent = c.nota_interna;
      notaBox.classList.remove('hidden');
    } else {
      notaBox.classList.add('hidden');
    }
  }

  // Cargar desglose de la orden vía getOrden
  if (c.orden_id) {
    getOrden(c.orden_id).then(ord => {
      const items = ord.items || [];
      if (itemsCountEl) itemsCountEl.textContent = `${items.length} ítem${items.length !== 1 ? 's' : ''}`;
      if (items.length === 0) {
        if (itemsContainer) itemsContainer.innerHTML = '<p style="text-align:center;color:var(--slate-5);padding:12px;margin:0;font-weight:600;">Sin desglose de ítems registrado en la orden</p>';
      } else {
        if (itemsContainer) {
          itemsContainer.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
              <thead>
                <tr style="border-bottom:1.5px solid var(--slate-7);color:var(--slate-4);font-size:10px;text-align:left;background:#f8fafc;">
                  <th style="padding:6px 6px;">Concepto / Ítem</th>
                  <th style="text-align:center;padding:6px 6px;width:80px;">Tipo</th>
                  <th style="text-align:center;padding:6px 6px;width:45px;">Cant</th>
                  <th style="text-align:right;padding:6px 6px;width:80px;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(it => {
                  const isAlmacen = it.tipo === 'almacen';
                  const isLabor = it.tipo === 'mano_obra';
                  const tag = isLabor ? '🔧 M. Obra' : isAlmacen ? '📦 Almacén' : '🛒 Externo';
                  const tagBg = isLabor ? '#f0fdf4' : isAlmacen ? '#eff6ff' : '#fffbeb';
                  const tagColor = isLabor ? '#166534' : isAlmacen ? '#1e40af' : '#b45309';
                  const sub = parseFloat(it.subtotal || (it.cantidad * it.precio_unitario) || 0);
                  return `
                    <tr style="border-bottom:1px dashed var(--slate-8);">
                      <td style="padding:6px 6px;font-weight:600;color:var(--dark);">
                        ${it.descripcion}
                        ${it.repuesto_cod ? `<span style="font-size:9.5px;color:var(--slate-5);font-family:monospace;margin-left:3px;">[${it.repuesto_cod}]</span>` : ''}
                      </td>
                      <td style="text-align:center;padding:6px 6px;">
                        <span style="font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:4px;background:${tagBg};color:${tagColor};white-space:nowrap;">${tag}</span>
                      </td>
                      <td style="text-align:center;padding:6px 6px;font-family:monospace;font-weight:700;">${it.cantidad}</td>
                      <td style="text-align:right;padding:6px 6px;font-family:monospace;font-weight:800;color:var(--dark);white-space:nowrap;">S/ ${sub.toFixed(2)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `;
        }
      }

      // Check note from mechanic
      const notaMec = ord.nota_mecanico || ord.nota_interna || c.nota_interna;
      if (notaMec && notaMec.trim() && notaBox && notaText) {
        notaText.textContent = notaMec;
        notaBox.classList.remove('hidden');
      }
    }).catch(err => {
      console.error("Error al cargar orden para cobro:", err);
      if (itemsContainer) itemsContainer.innerHTML = '<p style="text-align:center;color:var(--slate-5);padding:10px;margin:0;">No se pudo cargar el desglose</p>';
      if (itemsCountEl) itemsCountEl.textContent = '—';
    });
  } else {
    if (itemsContainer) itemsContainer.innerHTML = '<p style="text-align:center;color:var(--slate-5);padding:10px;margin:0;">Cobro directo sin orden de servicio asociada</p>';
    if (itemsCountEl) itemsCountEl.textContent = '0 ítems';
  }
  document.getElementById('cobro-descuento-tipo').value = '';
  const descValInput = document.getElementById('cobro-descuento-valor');
  descValInput.value = '';
  descValInput.disabled = true;
  document.getElementById('cobro-neto-display').textContent = `S/ ${parseFloat(c.monto_total).toFixed(2)}`;

  // Inicializar mitad y reset del balance visual
  const total = parseFloat(c.monto_total) || 0;
  const half  = (total / 2).toFixed(2);
  document.getElementById('div-monto-1').value = half;
  document.getElementById('div-monto-2').value = half;

  // Refrescar barra de balance inicial
  const suma  = (parseFloat(half) * 2);
  const cuadra = Math.abs(suma - total) < 0.05;
  const sumaEl = document.getElementById('split-suma');
  const restEl = document.getElementById('split-restante');
  const icon   = document.getElementById('split-estado-icon');
  const bar    = document.getElementById('split-balance-bar');
  if (sumaEl) sumaEl.textContent = `S/ ${suma.toFixed(2)}`;
  if (restEl) { restEl.textContent = cuadra ? '✅ Cuadrado' : `S/ ${Math.abs(total - suma).toFixed(2)} falta`; restEl.style.color = cuadra ? '#16a34a' : '#dc2626'; }
  if (icon)   icon.textContent = cuadra ? '✅' : '⚠️';
  if (bar)    { bar.style.borderColor = cuadra ? '#bbf7d0' : '#fecaca'; bar.style.background = cuadra ? '#f0fdf4' : '#fef2f2'; }

  document.getElementById('chk-dividir').checked = false;
  document.getElementById('wrapper-dividido').classList.add('hidden');
  document.getElementById('modal-cobro-rapido').classList.add('active');
}


function toggleDividido() {
  const chk = document.getElementById('chk-dividir').checked;
  const wrap = document.getElementById('wrapper-dividido');
  if (chk) { wrap.classList.remove('hidden'); wrap.style.display = 'flex'; }
  else { wrap.classList.add('hidden'); }
}

async function procesarCobroRapido(e) {
  e.preventDefault();
  const id = document.getElementById('cobro-rapido-id').value;
  const chk = document.getElementById('chk-dividir').checked;
  const metodo_pago = document.getElementById('cobro-rapido-metodo').value;

  // Lógica de cálculo de ajuste para persistencia
  const descTipo = document.getElementById('cobro-descuento-tipo').value;
  const descVal = parseFloat(document.getElementById('cobro-descuento-valor').value) || 0;
  const totalOriginal = parseFloat(document.getElementById('cobro-rapido-total').value) || 0;
  
  let descRealizado = 0;
  let montoNeto = totalOriginal;
  if (descTipo && descVal > 0) {
    if (descTipo === 'Desc_Pct') {
      descRealizado = parseFloat((totalOriginal * (descVal / 100)).toFixed(2));
      montoNeto = parseFloat((totalOriginal - descRealizado).toFixed(2));
    } else if (descTipo === 'Desc_Monto') {
      descRealizado = Math.min(totalOriginal, descVal);
      montoNeto = parseFloat((totalOriginal - descRealizado).toFixed(2));
    } else if (descTipo === 'Cargo_Pct') {
      descRealizado = parseFloat((totalOriginal * (descVal / 100)).toFixed(2));
      montoNeto = parseFloat((totalOriginal + descRealizado).toFixed(2));
    } else if (descTipo === 'Cargo_Monto') {
      descRealizado = descVal;
      montoNeto = parseFloat((totalOriginal + descRealizado).toFixed(2));
    }
  }

  try {
    let cobroGuardado;
    if (!chk) {
      const tipo_comprobante = document.getElementById('cobro-rapido-comprobante').value;
      cobroGuardado = await registrarCobro(id, { 
        metodo_pago, 
        tipo_comprobante,
        descuento_tipo: descTipo || null,
        descuento_valor: descVal,
        descuento_realizado: descRealizado,
        monto_neto: montoNeto
      });
    } else {
      const m1 = parseFloat(document.getElementById('div-monto-1').value) || 0;
      const m2 = parseFloat(document.getElementById('div-monto-2').value) || 0;
      if (Math.abs((m1 + m2) - montoNeto) > 0.05) {
        alert(`Los montos no coinciden con el total neto (S/ ${montoNeto.toFixed(2)}).`); return;
      }
      cobroGuardado = await dividirCobro(id, {
        metodo_pago,
        tipo_comprobante: document.getElementById('div-comp-1').value,
        pagador2_nombre:  document.getElementById('div-nombre-2').value,
        pagador2_doc:     document.getElementById('div-doc-2').value,
        monto_pagador1: m1, 
        monto_pagador2: m2,
        comprobante2:   document.getElementById('div-comp-2').value,
        descuento_tipo: descTipo || null,
        descuento_valor: descVal,
        descuento_realizado: descRealizado,
        monto_neto: montoNeto
      });
    }
    cerrarModal('modal-cobro-rapido');
    await cargarDatos();
    if (window.showToast) window.showToast('Pago registrado exitosamente', 'success');

    // Trigger PDF/XML generation in the background
    if (cobroGuardado && cobroGuardado.orden_id) {
      (async () => {
        try {
          const orden = await getOrden(cobroGuardado.orden_id);
          const items = orden.items || [];
          await guardarComprobantesEnArchivos(cobroGuardado, items, orden);
        } catch (bgErr) {
          console.error("[Caja] Error en generación de comprobantes en background:", bgErr);
        }
      })();
    }
  } catch (err) { alert(err.message); }
}

// ── PORTAL DE PAGO CLIENTE ────────────────────────────────

let portalCobroId = null;
let portalTab = 'yape';

function abrirPortalPago(id) {
  portalCobroId = id ? parseInt(id, 10) : null;
  portalTab = 'yape';
  
  const c = portalCobroId ? cobrosList.find(item => item.id == portalCobroId) : null;
  const portalMontoEl = document.getElementById('portal-monto');
  const portalClienteEl = document.getElementById('portal-cliente');
  const portalFooterBtn = document.getElementById('btn-portal-confirmar');

  if (c) {
    const total = parseFloat(c.monto_neto !== null && c.monto_neto !== undefined ? c.monto_neto : c.monto_total);
    if (portalMontoEl) portalMontoEl.textContent = `S/ ${total.toFixed(2)}`;
    if (portalClienteEl) portalClienteEl.textContent = `Orden OT-${String(c.orden_numero).padStart(4,'0')} · ${c.cliente_nombre}`;
    if (portalFooterBtn) {
      portalFooterBtn.style.display = 'flex';
      portalFooterBtn.textContent = '✅ Confirmar Pago y Liquidar';
    }
  } else {
    if (portalMontoEl) portalMontoEl.textContent = 'Consulta General';
    if (portalClienteEl) portalClienteEl.textContent = 'Cuentas oficiales para recepción de pagos';
    if (portalFooterBtn) portalFooterBtn.style.display = 'none';
  }

  // Resetear tabs
  document.querySelectorAll('.portal-tab').forEach((t, i) => {
    t.classList.remove('active');
    t.style.color = 'var(--slate-5)';
    t.style.borderBottomColor = 'transparent';
    if (i === 0) { 
      t.classList.add('active'); 
      t.style.color = 'var(--dark)'; 
      t.style.borderBottomColor = 'var(--brand)'; 
    }
  });
  renderPortalTab('yape');
  document.getElementById('modal-portal-pago')?.classList.add('active');
}

function renderPortalTab(tab) {
  portalTab = tab;
  const content = document.getElementById('portal-content');
  if (!content) return;

  const c = portalCobroId ? cobrosList.find(item => item.id == portalCobroId) : null;
  const total = c ? parseFloat(c.monto_neto !== null && c.monto_neto !== undefined ? c.monto_neto : c.monto_total).toFixed(2) : '';

  if (tab === 'yape') {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=YAPE_VARGAS_931163369${total ? '_S_' + total : ''}`;
    content.innerHTML = `
      <div style="text-align:center;">
        <div style="display:inline-flex;align-items:center;gap:6px;background:#f3e8ff;padding:4px 12px;border-radius:99px;margin-bottom:12px;">
          <span style="font-size:12px;">📱</span>
          <span style="font-size:11px;font-weight:800;color:#6b21a8;">Billeteras Digitales: Yape & Plin</span>
        </div>
        <p style="font-size:12px;color:var(--slate-5);margin:0 0 12px;font-weight:600;">Escanea el código QR desde tu app Yape o Plin</p>
        
        <div style="display:inline-block;padding:12px;background:#fff;border:3px solid #e9d5ff;border-radius:16px;box-shadow:var(--shadow-md);margin-bottom:12px;">
          <img src="${qrUrl}" alt="QR Yape Plin Taller Vargas" style="width:160px;height:160px;display:block;" />
        </div>

        <h3 style="font-size:13px;font-weight:900;color:var(--dark);margin:0;">Inversiones y Servicios Vargas E.I.R.L.</h3>
        <p style="font-size:11px;color:var(--slate-5);margin:2px 0 12px;">RUC: 20608226066</p>

        <div style="background:#faf5ff;border:1.5px solid #d8b4fe;border-radius:10px;padding:12px;max-width:340px;margin:0 auto 16px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="text-align:left;">
            <p style="font-size:10px;color:#7c3aed;font-weight:800;text-transform:uppercase;margin:0;">Número de Celular Yape / Plin</p>
            <p style="font-size:17px;font-weight:900;font-family:monospace;color:#581c87;margin:2px 0 0;">931 163 369</p>
          </div>
          <button type="button" class="btn-secondary" onclick="navigator.clipboard.writeText('931163369').then(()=>{this.textContent='✅ ¡Copiado!';setTimeout(()=>this.textContent='📋 Copiar',1500)})" style="font-size:11px;font-weight:700;padding:6px 12px;color:#6b21a8;border-color:#c084fc;background:#fff;cursor:pointer;">
            📋 Copiar
          </button>
        </div>

        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          <button type="button" class="btn-success" id="btn-wa-yape" style="font-size:12px;display:inline-flex;align-items:center;gap:6px;background:#22c55e;border-color:#22c55e;color:#fff;cursor:pointer;padding:8px 16px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
            📲 Enviar Yape por WhatsApp
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-wa-yape')?.addEventListener('click', () => {
      const msg = `*TALLER AUTOMOTRIZ VARGAS*\n*Inversiones y Servicios Vargas E.I.R.L.*\n\n📱 *Pago vía Yape o Plin:*\n• *Número:* 931 163 369\n• *Titular:* Inversiones y Servicios Vargas E.I.R.L.\n${total ? `• *Monto a pagar:* S/ ${total}\n` : ''}\nPor favor remítanos la captura o constancia de su pago por este medio. ¡Muchas gracias!`;
      const tel = c && c.cliente_telefono ? String(c.cliente_telefono).replace(/[^0-9]/g, '') : '';
      const waUrl = tel ? `https://wa.me/51${tel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank');
    });

  } else {
    // Banco Tab
    content.innerHTML = `
      <p style="font-size:12px;color:var(--slate-5);margin-bottom:14px;text-align:center;font-weight:600;">Cuentas bancarias oficiales de Inversiones y Servicios Vargas E.I.R.L.</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${[
          { banco:'BCP (Banco de Crédito)', color:'#003087', cci:'002-245-002678910012-34', cuenta:'245-2678910-0-12', tipo:'Cta. Corriente Soles' },
          { banco:'BBVA Perú',              color:'#004481', cci:'011-285-000100045678-75', cuenta:'0011-0285-0100045678', tipo:'Cta. Corriente Soles' },
          { banco:'Interbank',              color:'#048236', cci:'003-898-003001234567-41', cuenta:'898-3001234567', tipo:'Cta. Empresarial Soles' },
          { banco:'Banco de la Nación',     color:'#8B0000', cci:'018-000-000000123456-02', cuenta:'00-000-123456', tipo:'Cta. Corriente Soles' },
        ].map(b => `
          <div style="padding:12px 14px;background:var(--white);border:1px solid var(--slate-8);border-radius:var(--radius-md);border-left:4px solid ${b.color};">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
              <div>
                <span style="font-size:12px;font-weight:900;color:${b.color};">${b.banco}</span>
                <span style="font-size:10px;color:var(--slate-5);margin-left:6px;">(${b.tipo})</span>
              </div>
              <span style="font-size:9px;background:var(--slate-9);color:var(--slate-4);padding:2px 6px;border-radius:4px;font-weight:700;">RUC: 20608226066</span>
            </div>
            
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;background:#f8fafc;padding:4px 8px;border-radius:6px;">
              <span style="font-size:11px;font-family:monospace;color:var(--dark);"><strong>Cta:</strong> ${b.cuenta}</span>
              <button onclick="navigator.clipboard.writeText('${b.cuenta}').then(()=>{this.textContent='✅';setTimeout(()=>this.textContent='Copiar Cta',1500)})" style="font-size:10px;font-weight:700;color:${b.color};background:#fff;border:1px solid ${b.color};padding:3px 8px;border-radius:4px;cursor:pointer;">Copiar Cta</button>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:4px 8px;border-radius:6px;">
              <span style="font-size:10px;font-family:monospace;color:var(--slate-5);"><strong>CCI:</strong> ${b.cci}</span>
              <button onclick="navigator.clipboard.writeText('${b.cci}').then(()=>{this.textContent='✅';setTimeout(()=>this.textContent='Copiar CCI',1500)})" style="font-size:10px;font-weight:700;color:${b.color};background:#fff;border:1px solid ${b.color};padding:3px 8px;border-radius:4px;cursor:pointer;">Copiar CCI</button>
            </div>
          </div>`).join('')}
      </div>

      <div style="margin-top:14px;display:flex;justify-content:center;">
        <button type="button" class="btn-success" id="btn-wa-bancos" style="font-size:12px;display:inline-flex;align-items:center;gap:6px;background:#22c55e;border-color:#22c55e;color:#fff;width:100%;justify-content:center;padding:10px;cursor:pointer;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
          📲 Enviar Cuentas Bancarias por WhatsApp
        </button>
      </div>

      <div style="margin-top:10px;background:#fef3c7;border:1px solid #fde68a;border-radius:var(--radius-sm);padding:8px 12px;font-size:11px;color:#92400e;text-align:center;">
        ⚠️ Tras efectuar la transferencia, envíenos el comprobante para liquidar su orden.
      </div>
    `;

    document.getElementById('btn-wa-bancos')?.addEventListener('click', () => {
      const msg = `*TALLER AUTOMOTRIZ VARGAS*\n*Inversiones y Servicios Vargas E.I.R.L.*\n*RUC:* 20608226066\n${total ? `*Monto a Pagar:* S/ ${total}\n\n` : '\n'}🏦 *Cuentas Bancarias Oficiales (Soles):*\n\n• *BCP:*\nCta: 245-2678910-0-12\nCCI: 002-245-002678910012-34\n\n• *BBVA:*\nCta: 0011-0285-0100045678\nCCI: 011-285-000100045678-75\n\n• *Interbank:*\nCta: 898-3001234567\nCCI: 003-898-003001234567-41\n\n• *Banco de la Nación:*\nCta: 00-000-123456\nCCI: 018-000-000000123456-02\n\nPor favor envíenos la constancia de su depósito para liquidar la entrega de su vehículo.`;
      const tel = c && c.cliente_telefono ? String(c.cliente_telefono).replace(/[^0-9]/g, '') : '';
      const waUrl = tel ? `https://wa.me/51${tel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank');
    });
  }
}

async function confirmarPagoPortal() {
  const id = portalCobroId;
  if (!id) return;
  const metodoMap = { yape:'Yape/Plin', banco:'Transferencia' };
  try {
    const cobroGuardado = await registrarCobro(id, {
      metodo_pago: metodoMap[portalTab] || 'Transferencia',
      tipo_comprobante: 'Boleta'
    });
    cerrarModal('modal-portal-pago');
    await cargarDatos();

    // Trigger PDF/XML generation in the background
    if (cobroGuardado && cobroGuardado.orden_id) {
      (async () => {
        try {
          const orden = await getOrden(cobroGuardado.orden_id);
          const items = orden.items || [];
          await guardarComprobantesEnArchivos(cobroGuardado, items, orden);
        } catch (bgErr) {
          console.error("[Caja] Error en generación de comprobantes en background:", bgErr);
        }
      })();
    }
  } catch (err) { alert(err.message); }
}

// ── FACTURA ELECTRÓNICA ────────────────────────────────────

function obtenerFacturaHtmlContent(c, pagadorIndex, items) {
  // Total calculations
  const totalOriginal = parseFloat(c.monto_total);
  const hasAjuste = c.monto_neto !== null && c.monto_neto !== undefined && parseFloat(c.monto_neto) !== totalOriginal;
  const totalNeto = hasAjuste ? parseFloat(c.monto_neto) : totalOriginal;

  let prop = 1;
  let totalP = totalNeto;
  let originalP = totalOriginal;
  let descP = c.descuento_realizado ? parseFloat(c.descuento_realizado) : 0;

  if (c.es_dividido) {
    totalP = pagadorIndex === 1 ? parseFloat(c.monto_pagador1 || 0) : parseFloat(c.monto_pagador2 || 0);
    prop = totalNeto > 0 ? (totalP / totalNeto) : 0.5;
    originalP = totalOriginal * prop;
    descP = (c.descuento_realizado ? parseFloat(c.descuento_realizado) : 0) * prop;
  }

  const igvP = totalP * 0.18 / 1.18;
  const subP = totalP - igvP;

  const isSurcharge = c.descuento_tipo && c.descuento_tipo.startsWith('Cargo');

  // Alternativa A: si hay recargo, repartirlo entre los ítems de mano de obra para el render
  // (el total cobrado ya es correcto; solo se redistribuye visualmente en la boleta)
  let surchargeToAbsorb = isSurcharge ? descP : 0;
  const laborItems = items.filter(it => it.tipo !== 'almacen');
  const laborCount = laborItems.length;

  // Receptor details
  const receptorNombre = pagadorIndex === 1 ? (c.cliente_nombre || '—') : (c.pagador2_nombre || '—');
  const docType2 = c.pagador2_doc && c.pagador2_doc.trim().length === 11 ? 'RUC' : 'DNI';
  const receptorDocType = pagadorIndex === 1 ? (c.tipo_doc || 'DNI') : docType2;
  const receptorDocNum = pagadorIndex === 1 ? (c.num_doc || '—') : (c.pagador2_doc || '—');
  
  const tipo = pagadorIndex === 1 ? (c.tipo_comprobante || 'Boleta') : (c.comprobante2 || 'Boleta');
  const compNumero = pagadorIndex === 1 ? (c.comprobante_numero || '—') : (c.comprobante2_numero || '—');

  const fechaEmision = safeFormatDate(c.fecha_emision || new Date(), { day:'2-digit', month:'long', year:'numeric' });
  const fechaCobro = c.fecha_cobro ? safeFormatDate(c.fecha_cobro, { day:'2-digit', month:'long', year:'numeric' }) : '—';
  const hashSimulado = `SHA256:${btoa(compNumero + receptorNombre + totalP).replace(/=/g,'').slice(0,40).toUpperCase()}`;

  const isReciboInterno = tipo === 'Recibo Interno';

  return `
    <div class="factura-doc">
      <!-- Cabecera -->
      <div class="factura-header-layout" style="display:grid;grid-template-columns:1.5fr 1fr;gap:20px;margin-bottom:24px;">
        <div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <div>
              <h2 style="font-size:18px;font-weight:900;color:#1e293b;margin:0;">Inversiones y Servicios Vargas E.I.R.L.</h2>
              <p style="font-size:12px;color:#64748b;margin:0;">Servicios Mecánicos · Mantenimiento y Reparación</p>
            </div>
          </div>
          <p style="font-size:11px;color:#64748b;line-height:1.6;margin:0;">
            RUC: <strong>20608226066</strong><br/>
            Dirección: Jr. Reyna Farge N° 648 - Cajamarca<br/>
            Teléfono: 931 163 369 | WhatsApp: 976 864 137<br/>
            Email: inversionesyserviciosvargas@gmail.com
          </p>
        </div>
        <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
          <div style="display:inline-block;background:${isReciboInterno ? '#ea580c' : tipo === 'Factura' ? '#1e293b' : '#1d4ed8'};color:white;font-size:10px;font-weight:800;padding:3px 10px;border-radius:99px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
            ${isReciboInterno ? 'Recibo Interno' : tipo} ${isReciboInterno ? '(Control de Caja)' : '(Control Interno)'}
          </div>
          <p style="font-size:22px;font-weight:900;color:#1e293b;font-family:monospace;letter-spacing:1px;margin:4px 0;">${compNumero}</p>
          <div style="border-top:1px dashed #e2e8f0;margin-top:10px;padding-top:10px;">
            <p style="font-size:10px;color:#64748b;margin:2px 0;">Emisión: <strong>${fechaEmision}</strong></p>
            ${c.fecha_cobro ? `<p style="font-size:10px;color:#64748b;margin:2px 0;">Cobrado: <strong>${fechaCobro}</strong></p>` : ''}
          </div>
        </div>
      </div>

      <!-- Estado SUNAT / Comprobante Interno -->
      <div style="background:${isReciboInterno ? '#fff7ed' : '#f1f5f9'};border:1px solid ${isReciboInterno ? '#fed7aa' : '#cbd5e1'};border-radius:8px;padding:8px 14px;display:flex;align-items:center;gap:8px;margin-bottom:20px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="${isReciboInterno ? '#c2410c' : '#475569'}" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span style="font-size:11px;font-weight:800;color:${isReciboInterno ? '#c2410c' : '#475569'};">
          ${isReciboInterno ? '📝 RECIBO INTERNO DE CONTROL DE CAJA' : '📄 COMPROBANTE DE CONTROL INTERNO'}
        </span>
        <span style="font-size:10px;color:${isReciboInterno ? '#ea580c' : '#64748b'};margin-left:auto;font-family:monospace;">
          ${isReciboInterno ? 'Caja General - Taller Vargas' : hashSimulado}
        </span>
      </div>

      <!-- Datos del cliente / receptor -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
        <p style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Datos del ${tipo === 'Factura' ? 'Adquirente' : 'Cliente'}</p>
        <div class="factura-details-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;">
          <div><span style="color:#64748b;">Razón Social / Nombre:</span> <strong style="color:var(--dark);">${receptorNombre}</strong></div>
          <div><span style="color:#64748b;">${receptorDocType}:</span> <strong style="font-family:monospace;color:var(--dark);">${receptorDocNum}</strong></div>
          <div><span style="color:#64748b;">Orden de Servicio:</span> <strong style="font-family:monospace;font-weight:700;color:var(--brand);">${c.orden_numero || c.orden_id ? `OS-${String(c.orden_numero || c.orden_id).padStart(4,'0')}` : 'VENTA DIRECTA'}</strong></div>
          <div><span style="color:#64748b;">Vehículo:</span> <strong style="color:var(--dark);">${c.placa || 'VENTA DIRECTA'}</strong></div>
        </div>
      </div>

      <!-- Tabla de ítems -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px;">
        <thead>
          <tr style="background:#1e293b;color:#fff;">
            <th style="padding:8px 10px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.5px;width:50px;">Cant.</th>
            <th style="padding:8px 10px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.5px;">Descripción del Servicio / Repuesto</th>
            <th style="padding:8px 10px;text-align:center;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.5px;width:70px;">Tipo</th>
            <th style="padding:8px 10px;text-align:right;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.5px;width:90px;">P. Unit.</th>
            <th style="padding:8px 10px;text-align:right;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.5px;width:90px;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${items.length > 0 ? items.map((it, idx) => {
            const priceP = parseFloat(it.precio_unitario || 0) * prop;
            // Alternativa A: si hay recargo, sumarlo proporcionalmente a los ítems de mano de obra
            let adjustedPrice = priceP;
            if (isSurcharge && surchargeToAbsorb > 0 && it.tipo !== 'almacen') {
              const surchargePerLabor = parseFloat((surchargeToAbsorb / Math.max(laborCount, 1)).toFixed(2));
              adjustedPrice = priceP + surchargePerLabor;
            }
            const subtotalP = adjustedPrice * parseInt(it.cantidad || 1);
            return `
            <tr style="background:${idx%2===0?'#fff':'#f8fafc'};border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px 10px;text-align:center;font-weight:800;font-family:monospace;">${it.cantidad}</td>
              <td style="padding:8px 10px;">
                <strong style="display:block;">${it.descripcion}</strong>
                ${it.repuesto_cod ? `<span style="font-size:10px;color:#64748b;font-family:monospace;">[${it.repuesto_cod}]</span>` : ''}
              </td>
              <td style="padding:8px 10px;text-align:center;">
                <span style="font-size:9px;font-weight:700;text-transform:uppercase;padding:2px 6px;border-radius:99px;${it.tipo==='almacen'?'background:#eff6ff;color:#1d4ed8;':'background:#f0fdf4;color:#15803d;'}">${it.tipo==='almacen'?'Repuesto':'M. Obra'}</span>
              </td>
              <td style="padding:8px 10px;text-align:right;font-family:monospace;">S/ ${adjustedPrice.toFixed(2)}</td>
              <td style="padding:8px 10px;text-align:right;font-family:monospace;font-weight:700;">S/ ${subtotalP.toFixed(2)}</td>
            </tr>`;
          }).join('') : `
            <tr>
              <td colspan="5" style="padding:16px;text-align:center;color:#64748b;font-style:italic;font-size:12px;">
                Servicios de mantenimiento y reparación automotriz · Ver detalle en orden de trabajo
              </td>
            </tr>`}
        </tbody>
      </table>

      <!-- Totales -->
      <div style="display:flex;justify-content:flex-end;margin-top:0;border-top:2px solid #1e293b;padding-top:10px;margin-bottom:24px;">
        <div style="width:280px;">
          ${(hasAjuste && !isSurcharge) ? `
          <div style="display:flex;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #e2e8f0;">
            <span style="font-size:12px;color:#64748b;">Subtotal Original</span>
            <span style="font-family:monospace;font-weight:700;">S/ ${(originalP - (originalP * 0.18 / 1.18)).toFixed(2)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#b45309;">
            <span style="font-size:12px;font-weight:700;">Descuento Aplicado</span>
            <span style="font-family:monospace;font-weight:700;">-S/ ${descP.toFixed(2)}</span>
          </div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #e2e8f0;">
            <span style="font-size:12px;color:#64748b;">Op. Gravadas (Neto)</span>
            <span style="font-family:monospace;font-weight:700;">S/ ${subP.toFixed(2)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #e2e8f0;">
            <span style="font-size:12px;color:#7c3aed;font-weight:700;">IGV (18%)</span>
            <span style="font-family:monospace;font-weight:700;color:#7c3aed;">S/ ${igvP.toFixed(2)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:12px 10px;background:#1e293b;border-radius:0 0 4px 4px;">
            <span style="font-size:14px;font-weight:900;color:#fff;">TOTAL A PAGAR</span>
            <span style="font-family:monospace;font-size:16px;font-weight:900;color:#34d399;">S/ ${totalP.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <!-- Método de pago y QR -->
      <div class="factura-footer-layout" style="display:grid;grid-template-columns:1fr auto;gap:20px;border-top:1px dashed #cbd5e1;padding-top:16px;">
        <div>
          <p style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Forma de Pago</p>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:13px;font-weight:800;color:#1e293b;">${c.metodo_pago || '—'}</span>
            <span style="font-size:11px;color:#64748b;">·</span>
            <span style="font-size:11px;color:#64748b;">Comprobante: ${tipo || '—'}</span>
          </div>
          <p style="font-size:11px;color:#64748b;margin-top:8px;line-height:1.5;">
            "Documento de control interno emitido por<br/>
            INVERSIONES Y SERVICIOS VARGAS E.I.R.L. con RUC 20608226066"
          </p>
        </div>
        <div style="text-align:center;">
          ${renderQRReal(c, pagadorIndex, 75)}
          <p style="font-size:9px;color:#64748b;margin-top:4px;">Validación Interna</p>
        </div>
      </div>
    </div>
  `;
}

function renderFacturaDocument(c, pagadorIndex, items) {
  currentCobro = c;
  activePagadorIndex = pagadorIndex;
  currentItems = items;

  const doc = document.getElementById('factura-doc-content');
  const toggleBar = document.getElementById('div-pagadores-toggle-bar');

  // Render toggle bar if divided
  if (c.es_dividido) {
    toggleBar.style.display = 'flex';
    toggleBar.innerHTML = `
      <span style="font-size:11px;font-weight:700;color:var(--slate-4);align-self:center;margin-right:8px;">Ver Comprobante:</span>
      <button class="btn-toggle-pagador btn ${pagadorIndex === 1 ? 'btn-primary' : 'btn-ghost'}" data-index="1" style="font-size:11px;padding:6px 12px;cursor:pointer;">
        1️⃣ ${c.cliente_nombre || 'Principal'} (S/ ${parseFloat(c.monto_pagador1).toFixed(2)})
      </button>
      <button class="btn-toggle-pagador btn ${pagadorIndex === 2 ? 'btn-primary' : 'btn-ghost'}" data-index="2" style="font-size:11px;padding:6px 12px;cursor:pointer;">
        2️⃣ ${c.pagador2_nombre || 'Co-pagador'} (S/ ${parseFloat(c.monto_pagador2).toFixed(2)})
      </button>
    `;
    // Add event listeners
    toggleBar.querySelectorAll('.btn-toggle-pagador').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        renderFacturaDocument(c, idx, items);
      });
    });
  } else {
    toggleBar.style.display = 'none';
  }

  doc.innerHTML = obtenerFacturaHtmlContent(c, pagadorIndex, items);
}

async function abrirFactura(id) {
  const c = cobrosList.find(item => item.id == id);
  if (!c) return;

  const doc = document.getElementById('factura-doc-content');
  doc.innerHTML = `<div style="padding:40px;text-align:center;color:var(--slate-5);font-size:13px;">Cargando ítems...</div>`;
  document.getElementById('modal-factura-electronica').classList.add('active');

  let items = [];
  try {
    if (c.orden_id) {
      const orden = await getOrden(c.orden_id);
      items = orden.items || [];
    } else {
      items = typeof c.detalle_items === 'string' ? JSON.parse(c.detalle_items) : (c.detalle_items || []);
    }
  } catch (_) { items = []; }

  renderFacturaDocument(c, 1, items);
}

// ── QR SIMULADO ───────────────────────────────────────────

function renderQRSimulado() {
  // SVG con patrón visual similar a un QR (decorativo, no funcional)
  const cells = [];
  const SIZE = 13;
  const seed = Math.floor(Date.now() / 1000);
  function pseudoRand(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 0.01) * 43758.5453;
    return n - Math.floor(n) > 0.45;
  }
  // Bordes L-shape (finder patterns)
  const corners = [
    [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[6,6],
    [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,5],[0,4],[0,3],[0,2],[0,1],[1,1],[1,2],
    [1,3],[1,4],[1,5],[5,1],[5,2],[5,3],[5,4],[5,5],[2,2],[2,3],[2,4],[3,2],[3,3],
    [3,4],[4,2],[4,3],[4,4]
  ];
  const cornerSet = new Set(corners.map(([x,y]) => `${x},${y}`));
  const cornerSetBR = new Set(corners.map(([x,y]) => `${x+6},${y+6}`));
  const cornerSetTR = new Set(corners.map(([x,y]) => `${SIZE-7+x},${y}`));

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let filled = pseudoRand(x, y);
      if (cornerSet.has(`${x},${y}`) || cornerSetBR.has(`${x},${y}`) || cornerSetTR.has(`${x},${y}`)) filled = true;
      if (filled) cells.push(`<rect x="${x*16}" y="${y*16}" width="14" height="14" rx="2" fill="#1e293b"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE*16} ${SIZE*16}" style="width:160px;height:160px;border:4px solid #f1f5f9;border-radius:12px;padding:8px;background:#fff;">${cells.join('')}</svg>`;
}

function renderQRSimuladoPequeno() {
  const cells = [];
  const SIZE = 9;
  const seed2 = 42;
  function pr(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed2) * 43758.5453;
    return n - Math.floor(n) > 0.45;
  }
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (pr(x, y)) cells.push(`<rect x="${x*10}" y="${y*10}" width="9" height="9" rx="1" fill="#1e293b"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE*10} ${SIZE*10}" style="width:70px;height:70px;border:2px solid #e2e8f0;border-radius:6px;padding:4px;background:#fff;">${cells.join('')}</svg>`;
}

function renderQRReal(c, pagadorIndex, size = 90) {
  const tipo = pagadorIndex === 1 ? (c.tipo_comprobante || 'Boleta') : (c.comprobante2 || 'Boleta');
  const tipoCode = tipo === 'Factura' ? '01' : tipo === 'Boleta' ? '03' : '00';
  const compNumero = pagadorIndex === 1 ? (c.comprobante_numero || '') : (c.comprobante2_numero || '');
  const parts = compNumero.split('-');
  const serie = parts[0] || '—';
  const numero = parts[1] || '—';

  const totalOriginal = parseFloat(c.monto_total);
  const totalNeto = (c.monto_neto !== null && c.monto_neto !== undefined) ? parseFloat(c.monto_neto) : totalOriginal;
  let totalP = totalNeto;
  if (c.es_dividido) {
    totalP = pagadorIndex === 1 ? parseFloat(c.monto_pagador1 || 0) : parseFloat(c.monto_pagador2 || 0);
  }
  const igvP = totalP * 0.18 / 1.18;

  const dateObj = c.fecha_emision ? new Date(c.fecha_emision) : new Date();
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const fechaFormatted = `${y}-${m}-${d}`;

  const receptorNombre = pagadorIndex === 1 ? (c.cliente_nombre || '—') : (c.pagador2_nombre || '—');
  const docType2 = c.pagador2_doc && c.pagador2_doc.trim().length === 11 ? 'RUC' : 'DNI';
  const receptorDocType = pagadorIndex === 1 ? (c.tipo_doc || 'DNI') : docType2;
  const receptorDocNum = pagadorIndex === 1 ? (c.num_doc || '—') : (c.pagador2_doc || '—');
  const tipoDocCode = receptorDocType === 'RUC' ? '6' : receptorDocType === 'DNI' ? '1' : '0';

  const hashSimulado = btoa(compNumero + receptorNombre + totalP).replace(/=/g,'').slice(0,40).toUpperCase();

  const qrText = `20608226066|${tipoCode}|${serie}|${numero}|${igvP.toFixed(2)}|${totalP.toFixed(2)}|${fechaFormatted}|${tipoDocCode}|${receptorDocNum}|${hashSimulado}|`;
  const encoded = encodeURIComponent(qrText);

  const idFallback = `qr-fallback-${Math.floor(Math.random() * 100000)}`;
  
  window[idFallback] = function() {
    const el = document.getElementById(idFallback);
    if (el) el.outerHTML = renderQRSimuladoPequeno();
  };

  return `<img id="${idFallback}" src="https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}" 
               alt="QR SUNAT" 
               style="width:${size}px;height:${size}px;border:2px solid #e2e8f0;border-radius:6px;padding:4px;background:#fff;" 
               onerror="window['${idFallback}']()" />`;
}

// ── XML SIMULADO UBL 2.1 ──────────────────────────────────

function generarXMLUBL21(c, pagadorIndex, items) {
  const compTipo = pagadorIndex === 1 ? (c.tipo_comprobante || 'Boleta') : (c.comprobante2 || 'Boleta');
  const compNumero = pagadorIndex === 1 ? (c.comprobante_numero || '—') : (c.comprobante2_numero || '—');
  const receptorNombre = pagadorIndex === 1 ? (c.cliente_nombre || '—') : (c.pagador2_nombre || '—');
  const receptorDocType = pagadorIndex === 1 ? (c.tipo_doc || 'DNI') : (c.pagador2_doc && c.pagador2_doc.trim().length === 11 ? 'RUC' : 'DNI');
  const receptorDocNum = pagadorIndex === 1 ? (c.num_doc || '—') : (c.pagador2_doc || '—');

  const totalOriginal = parseFloat(c.monto_total);
  const hasAjuste = c.monto_neto !== null && c.monto_neto !== undefined && parseFloat(c.monto_neto) !== totalOriginal;
  const totalNeto = hasAjuste ? parseFloat(c.monto_neto) : totalOriginal;

  let prop = 1;
  let totalP = totalNeto;
  if (c.es_dividido) {
    totalP = pagadorIndex === 1 ? parseFloat(c.monto_pagador1 || 0) : parseFloat(c.monto_pagador2 || 0);
    prop = totalNeto > 0 ? (totalP / totalNeto) : 0.5;
  }

  const igv = totalP * 0.18 / 1.18;
  const sub = totalP - igv;

  const tipoCodigo = compTipo === 'Factura' ? '01' : compTipo === 'Boleta' ? '03' : '02'; // 02 for internal receipt (Control de caja)
  const schemeID = receptorDocType === 'RUC' ? '6' : '1';

  let xmlItems = '';
  if (items && items.length > 0) {
    xmlItems = items.map((it, itemIdx) => {
      const priceP = parseFloat(it.precio_unitario || 0) * prop;
      const subtotalP = priceP * parseInt(it.cantidad || 1);
      const priceWithoutIgv = priceP / 1.18;
      const subtotalWithoutIgv = subtotalP / 1.18;
      const igvItem = subtotalP - subtotalWithoutIgv;

      return `  <cac:InvoiceLine>
    <cbc:ID>${itemIdx + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="NIU">${it.cantidad}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="PEN">${subtotalWithoutIgv.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="PEN">${priceP.toFixed(2)}</cbc:PriceAmount>
        <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="PEN">${igvItem.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="PEN">${subtotalWithoutIgv.toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="PEN">${igvItem.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>18.00</cbc:Percent>
          <cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>
          <cac:TaxScheme>
            <cbc:ID>1000</cbc:ID>
            <cbc:Name>IGV</cbc:Name>
            <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description><![CDATA[${it.descripcion}]]></cbc:Description>
      <cac:SellersItemIdentification>
        <cbc:ID>${it.repuesto_cod || 'SERV'}</cbc:ID>
      </cac:SellersItemIdentification>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="PEN">${priceWithoutIgv.toFixed(5)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
    }).join('\n');
  } else {
    const subWithoutIgv = sub / 1.18;
    const igvLine = totalP - subWithoutIgv;
    xmlItems = `  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="NIU">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="PEN">${subWithoutIgv.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="PEN">${totalP.toFixed(2)}</cbc:PriceAmount>
        <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="PEN">${igvLine.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="PEN">${subWithoutIgv.toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="PEN">${igvLine.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>18.00</cbc:Percent>
          <cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>
          <cac:TaxScheme>
            <cbc:ID>1000</cbc:ID>
            <cbc:Name>IGV</cbc:Name>
            <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description><![CDATA[Servicios de mantenimiento y reparación automotriz]]></cbc:Description>
      <cac:SellersItemIdentification>
        <cbc:ID>SERV01</cbc:ID>
      </cac:SellersItemIdentification>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="PEN">${subWithoutIgv.toFixed(5)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
  }

  const seedString = `${compNumero}-${receptorDocNum}-${totalP.toFixed(2)}`;
  const digestValue = btoa(seedString).replace(/=/g, '').slice(0, 28) + '=';
  const signatureValue = btoa(seedString + '-signature').replace(/=/g, '').slice(0, 88) + '==';
  
  const mockCertificate = 'MIIGJjCCBA6gAwIBAgIQCgEKd4bV08Q7p7K8n8uCZDANBgkqhkiG9w0BAQsFADCBjDELMAkGA1UEBhMCUEUxEzARBgNVBAoTCkFTSU5FVCBTLkEuMRgwFgYDVQQLEw9DZXJ0aWZpY2Fkb3MgREVNTzEtMCsGA1UEAxMkQ2VydGlmaWNhZG8gRGlnaXRhbCBkZSBQcnVlYmEgQVNJTkVUMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0G2Z7vP...';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
         xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent>
        <sac:AdditionalInformation>
          <sac:AdditionalMonetaryTotal>
            <cbc:ID>1001</cbc:ID>
            <cbc:PayableAmount currencyID="PEN">${sub.toFixed(2)}</cbc:PayableAmount>
          </sac:AdditionalMonetaryTotal>
        </sac:AdditionalInformation>
      </ext:ExtensionContent>
    </ext:UBLExtension>
    <ext:UBLExtension>
      <ext:ExtensionContent>
        <ds:Signature Id="SignVargas">
          <ds:SignedInfo>
            <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
            <ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha256"/>
            <ds:Reference URI="">
              <ds:Transforms>
                <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
              </ds:Transforms>
              <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
              <ds:DigestValue>${digestValue}</ds:DigestValue>
            </ds:Reference>
          </ds:SignedInfo>
          <ds:SignatureValue>${signatureValue}</ds:SignatureValue>
          <ds:KeyInfo>
            <ds:X509Data>
              <ds:X509Certificate>${mockCertificate}</ds:X509Certificate>
            </ds:X509Data>
          </ds:KeyInfo>
        </ds:Signature>
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${compNumero}</cbc:ID>
  <cbc:IssueDate>${c.fecha_emision ? c.fecha_emision.split('T')[0] : new Date().toISOString().split('T')[0]}</cbc:IssueDate>
  <cbc:InvoiceTypeCode listID="0101">${tipoCodigo}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>
  <cac:Signature>
    <cbc:ID>SignVargas</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>20608226066</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name><![CDATA[INVERSIONES Y SERVICIOS VARGAS E.I.R.L.]]></cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#SignVargas</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">20608226066</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name><![CDATA[INVERSIONES Y SERVICIOS VARGAS E.I.R.L.]]></cbc:Name>
      </cac:PartyName>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[INVERSIONES Y SERVICIOS VARGAS E.I.R.L.]]></cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:ID>060101</cbc:ID>
          <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
          <cbc:StreetName><![CDATA[Jr. Reyna Farge N° 648]]></cbc:StreetName>
          <cac:District><![CDATA[Cajamarca]]></cac:District>
          <cac:Province><![CDATA[Cajamarca]]></cac:Province>
          <cac:Region><![CDATA[Cajamarca]]></cac:Region>
          <cac:Country>
            <cbc:IdentificationCode>PE</cbc:IdentificationCode>
          </cac:Country>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${schemeID}">${receptorDocNum}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${receptorNombre}]]></cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="PEN">${igv.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="PEN">${sub.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="PEN">${igv.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>1000</cbc:ID>
          <cbc:Name>IGV</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="PEN">${sub.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="PEN">${totalP.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="PEN">${totalP.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${xmlItems}
</Invoice>`;
}

function descargarXML() {
  if (!currentCobro) return;
  const c = currentCobro;
  const idx = activePagadorIndex;
  const compNumero = idx === 1 ? (c.comprobante_numero || '—') : (c.comprobante2_numero || '—');

  const xml = generarXMLUBL21(c, idx, currentItems || []);

  const blob = new Blob([xml], { type: 'application/xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${compNumero}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}

async function generarPDFComprobante(c, pagadorIndex, items) {
  const compNumero = pagadorIndex === 1 ? (c.comprobante_numero || '—') : (c.comprobante2_numero || '—');
  
  // Crear contenedor temporal fuera de pantalla
  const element = document.createElement('div');
  element.id = 'temp-pdf-render';
  element.style.position = 'absolute';
  element.style.left = '-9999px';
  element.style.top = '-9999px';
  element.style.width = '800px';
  element.style.background = 'white';
  element.style.padding = '30px';
  
  // Generar HTML dentro del contenedor
  element.innerHTML = obtenerFacturaHtmlContent(c, pagadorIndex, items);
  document.body.appendChild(element);
  
  const opt = {
    margin:       [10, 10, 10, 10],
    filename:     `${compNumero}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  try {
    // Generar PDF y obtener data uri string
    const pdfDataUri = await window.html2pdf().set(opt).from(element).outputPdf('datauristring');
    document.body.removeChild(element);
    
    // Extraer base64
    const base64 = pdfDataUri.split(',')[1];
    return base64;
  } catch (err) {
    console.error("Error al generar PDF con html2pdf:", err);
    if (document.getElementById('temp-pdf-render')) {
      document.body.removeChild(element);
    }
    return null;
  }
}

async function guardarComprobantesEnArchivos(cobro, items, orden) {
  const cliId = orden?.cliente_id || cobro.cliente_id || null;
  const vehId = orden?.vehiculo_id || null;

  async function subirArchivo({ titulo, filename, tipo, content, isXml, notas, clienteId }) {
    let fileData = '';
    if (isXml) {
      fileData = btoa(unescape(encodeURIComponent(content)));
    } else {
      fileData = content;
    }
    
    try {
      await createArchivo({
        titulo,
        filename,
        tipo,
        size_mb: isXml ? parseFloat((content.length / (1024 * 1024)).toFixed(4)) : 0.15,
        area: 'Facturación',
        subido_por: 'Sistema (Caja)',
        cliente_id: clienteId,
        vehiculo_id: vehId,
        notas,
        fileData
      });
      console.log(`[ERP] Archivo ${filename} subido correctamente.`);
    } catch (err) {
      console.error(`[ERP] Error al subir archivo ${filename}:`, err);
    }
  }

  if (!cobro.es_dividido) {
    const compTipo = cobro.tipo_comprobante || 'Boleta';
    const compNumero = cobro.comprobante_numero || `COM-${cobro.id}`;

    // 1. Generar y subir XML
    const xml = generarXMLUBL21(cobro, 1, items);
    await subirArchivo({
      titulo: `XML ${compTipo} ${compNumero}`,
      filename: `${compNumero}.xml`,
      tipo: 'xml',
      content: xml,
      isXml: true,
      notas: `XML UBL 2.1 firmado emitido automáticamente para el comprobante ${compNumero}.`,
      clienteId: cliId
    });

    // 2. Generar y subir PDF
    const pdfBase64 = await generarPDFComprobante(cobro, 1, items);
    if (pdfBase64) {
      await subirArchivo({
        titulo: `PDF ${compTipo} ${compNumero}`,
        filename: `${compNumero}.pdf`,
        tipo: 'pdf',
        content: pdfBase64,
        isXml: false,
        notas: `PDF de comprobante oficial emitido automáticamente para la OS-${String(cobro.orden_id).padStart(4, '0')}.`,
        clienteId: cliId
      });
    }
  } else {
    // Pagador 1 (Principal)
    const compTipo1 = cobro.tipo_comprobante || 'Boleta';
    const compNumero1 = cobro.comprobante_numero || `COM1-${cobro.id}`;

    const xml1 = generarXMLUBL21(cobro, 1, items);
    await subirArchivo({
      titulo: `XML ${compTipo1} ${compNumero1} (P1)`,
      filename: `${compNumero1}.xml`,
      tipo: 'xml',
      content: xml1,
      isXml: true,
      notas: `XML UBL 2.1 proporcional (P1) emitido para ${cobro.cliente_nombre || 'Cliente principal'} por S/ ${parseFloat(cobro.monto_pagador1).toFixed(2)}.`,
      clienteId: cliId
    });

    const pdfBase64_1 = await generarPDFComprobante(cobro, 1, items);
    if (pdfBase64_1) {
      await subirArchivo({
        titulo: `PDF ${compTipo1} ${compNumero1} (P1)`,
        filename: `${compNumero1}.pdf`,
        tipo: 'pdf',
        content: pdfBase64_1,
        isXml: false,
        notas: `PDF proporcional (P1) emitido para ${cobro.cliente_nombre || 'Cliente principal'} por S/ ${parseFloat(cobro.monto_pagador1).toFixed(2)}.`,
        clienteId: cliId
      });
    }

    // Pagador 2 (Co-pagador)
    const compTipo2 = cobro.comprobante2 || 'Boleta';
    const compNumero2 = cobro.comprobante2_numero || `COM2-${cobro.id}`;

    const xml2 = generarXMLUBL21(cobro, 2, items);
    await subirArchivo({
      titulo: `XML ${compTipo2} ${compNumero2} (P2)`,
      filename: `${compNumero2}.xml`,
      tipo: 'xml',
      content: xml2,
      isXml: true,
      notas: `XML UBL 2.1 proporcional (P2) emitido para co-pagador ${cobro.pagador2_nombre || 'Externo'} por S/ ${parseFloat(cobro.monto_pagador2).toFixed(2)}.`,
      clienteId: null
    });

    const pdfBase64_2 = await generarPDFComprobante(cobro, 2, items);
    if (pdfBase64_2) {
      await subirArchivo({
        titulo: `PDF ${compTipo2} ${compNumero2} (P2)`,
        filename: `${compNumero2}.pdf`,
        tipo: 'pdf',
        content: pdfBase64_2,
        isXml: false,
        notas: `PDF proporcional (P2) emitido para co-pagador ${cobro.pagador2_nombre || 'Externo'} por S/ ${parseFloat(cobro.monto_pagador2).toFixed(2)}.`,
        clienteId: null
      });
    }
  }
}

// ── HELPERS ───────────────────────────────────────────────

function cerrarModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}

// ── VENTA RÁPIDA (MOSTRADOR) ──────────────────────────────

let vrActiveResultIdx = -1;

function buscarProductosVR(q) {
  const term = (q || '').toLowerCase().trim();
  const conStock = productosVentaRapida.filter(p => (parseInt(p.stock, 10) || 0) > 0);
  
  if (!term) {
    return conStock.slice(0, 10);
  }

  return conStock.filter(p =>
    (p.descripcion || '').toLowerCase().includes(term) ||
    (p.codigo || '').toLowerCase().includes(term) ||
    (p.categoria || '').toLowerCase().includes(term)
  ).slice(0, 15);
}

function mostrarResultadosVR(lista) {
  const box = document.getElementById('vr-search-results');
  if (!box) return;
  vrActiveResultIdx = -1;

  if (!lista || lista.length === 0) {
    box.innerHTML = `
      <div style="padding:14px;text-align:center;color:var(--slate-5);font-size:12px;">
        <span>🔍 No se encontraron repuestos con stock para esa búsqueda</span>
      </div>`;
    box.classList.remove('hidden');
    return;
  }

  box.innerHTML = lista.map((p, idx) => `
    <div class="vr-search-item" data-id="${p.id}" data-idx="${idx}" style="padding:10px 14px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:background .15s;">
      <div style="display:flex;flex-direction:column;gap:2px;overflow:hidden;padding-right:12px;">
        <span style="font-size:13px;font-weight:700;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.descripcion)}</span>
        <div style="display:flex;gap:6px;font-size:11px;align-items:center;">
          <span style="font-family:monospace;background:#f1f5f9;padding:1px 6px;border-radius:4px;color:#334155;font-weight:700;">Cód: ${escapeHtml(p.codigo || 'S/C')}</span>
          ${p.categoria ? `<span style="background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:4px;font-weight:600;">${escapeHtml(p.categoria)}</span>` : ''}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <span style="font-size:13px;font-weight:900;color:#047857;font-family:monospace;display:block;">S/ ${parseFloat(p.precio_venta || 0).toFixed(2)}</span>
        <span class="badge" style="background:#dcfce7;color:#15803d;font-size:10px;font-weight:800;padding:2px 6px;margin-top:2px;display:inline-block;">Stock: ${p.stock} u.</span>
      </div>
    </div>
  `).join('');

  box.classList.remove('hidden');
}

function updateActiveResultItem(items) {
  items.forEach((it, i) => {
    if (i === vrActiveResultIdx) {
      it.classList.add('active');
      it.style.background = '#ecfdf5';
      it.scrollIntoView({ block: 'nearest' });
    } else {
      it.classList.remove('active');
      it.style.background = '';
    }
  });
}

function seleccionarProductoVR(prod) {
  if (!prod) return;
  const searchEl = document.getElementById('vr-search-prod');
  const idEl = document.getElementById('vr-selected-prod-id');
  const stockEl = document.getElementById('vr-stock-disp');
  const cantEl = document.getElementById('vr-item-cant');
  const precioEl = document.getElementById('vr-item-precio');
  const clearBtn = document.getElementById('btn-vr-clear-prod');
  const resultsEl = document.getElementById('vr-search-results');

  if (idEl) idEl.value = prod.id;
  if (searchEl) searchEl.value = `[${prod.codigo || 'S/C'}] ${prod.descripcion}`;
  if (stockEl) stockEl.value = `${prod.stock} u.`;
  if (precioEl) precioEl.value = parseFloat(prod.precio_venta || 0).toFixed(2);
  if (cantEl) {
    cantEl.max = prod.stock;
    cantEl.value = '1';
    cantEl.focus();
    cantEl.select();
  }
  if (clearBtn) clearBtn.style.display = 'block';
  if (resultsEl) {
    resultsEl.classList.add('hidden');
    resultsEl.innerHTML = '';
  }
}

function limpiarSeleccionProductoVR() {
  const searchEl = document.getElementById('vr-search-prod');
  const idEl = document.getElementById('vr-selected-prod-id');
  const stockEl = document.getElementById('vr-stock-disp');
  const cantEl = document.getElementById('vr-item-cant');
  const precioEl = document.getElementById('vr-item-precio');
  const clearBtn = document.getElementById('btn-vr-clear-prod');
  const resultsEl = document.getElementById('vr-search-results');

  if (searchEl) {
    searchEl.value = '';
    searchEl.focus();
  }
  if (idEl) idEl.value = '';
  if (stockEl) stockEl.value = '—';
  if (cantEl) cantEl.value = '1';
  if (precioEl) precioEl.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  if (resultsEl) {
    resultsEl.classList.add('hidden');
    resultsEl.innerHTML = '';
  }
}

async function abrirModalVentaRapida() {
  itemsVentaRapida = [];
  const elNombre = document.getElementById('vr-cliente-nombre');
  const elDoc = document.getElementById('vr-cliente-doc');
  const elMetodo = document.getElementById('vr-metodo-pago');
  const elComp = document.getElementById('vr-tipo-comprobante');

  if (elNombre) elNombre.value = 'Cliente Mostrador';
  if (elDoc) elDoc.value = '';
  if (elMetodo) elMetodo.value = 'Efectivo';
  if (elComp) elComp.value = 'Recibo Interno';

  limpiarSeleccionProductoVR();
  renderItemsVentaRapida();

  try {
    const prods = await getAlmacen();
    productosVentaRapida = Array.isArray(prods) ? prods : [];
  } catch (err) {
    console.error('Error al cargar almacén para venta rápida:', err);
    alert('Error al cargar los repuestos de almacén: ' + err.message);
  }

  document.getElementById('modal-venta-rapida')?.classList.add('active');
  setTimeout(() => {
    document.getElementById('vr-search-prod')?.focus();
  }, 100);
}

function cerrarModalVentaRapida() {
  document.getElementById('modal-venta-rapida')?.classList.remove('active');
  document.getElementById('vr-search-results')?.classList.add('hidden');
}

function agregarItemVentaRapida() {
  const prodId = parseInt(document.getElementById('vr-selected-prod-id')?.value, 10);
  if (!prodId) {
    alert('Por favor busca y selecciona un repuesto o insumo del catálogo.');
    document.getElementById('vr-search-prod')?.focus();
    return;
  }

  const prod = productosVentaRapida.find(p => p.id === prodId);
  if (!prod) {
    alert('El producto seleccionado ya no se encuentra en la lista.');
    return;
  }

  const stock = parseInt(prod.stock, 10) || 0;
  const cant = parseInt(document.getElementById('vr-item-cant')?.value, 10) || 0;
  const precio = parseFloat(document.getElementById('vr-item-precio')?.value);

  if (cant <= 0) {
    alert('La cantidad debe ser al menos 1 unidad.');
    return;
  }
  if (isNaN(precio) || precio < 0) {
    alert('Ingresa un precio de venta unitario válido.');
    return;
  }

  const existente = itemsVentaRapida.find(it => it.repuesto_id === prodId);
  const cantTotal = (existente ? existente.cantidad : 0) + cant;
  if (cantTotal > stock) {
    alert(`Stock insuficiente: Disponible ${stock} unidades, intentarías vender ${cantTotal} unidades.`);
    return;
  }

  if (existente) {
    existente.cantidad += cant;
    existente.precio_unitario = precio;
    existente.subtotal = existente.cantidad * precio;
  } else {
    itemsVentaRapida.push({
      repuesto_id: prodId,
      codigo: prod.codigo || 'S/C',
      descripcion: prod.descripcion,
      cantidad: cant,
      precio_unitario: precio,
      subtotal: cant * precio
    });
  }

  limpiarSeleccionProductoVR();
  renderItemsVentaRapida();
  document.getElementById('vr-search-prod')?.focus();
}

function eliminarItemVentaRapida(index) {
  if (index >= 0 && index < itemsVentaRapida.length) {
    itemsVentaRapida.splice(index, 1);
    renderItemsVentaRapida();
  }
}

function renderItemsVentaRapida() {
  const tbody = document.getElementById('vr-items-tbody');
  const countEl = document.getElementById('vr-items-count');
  const totalEl = document.getElementById('vr-total-display');
  if (!tbody) return;

  if (itemsVentaRapida.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--slate-5);font-size:11px;">No hay productos agregados a la venta</td></tr>';
    if (countEl) countEl.textContent = '0 ítems';
    if (totalEl) totalEl.textContent = 'S/ 0.00';
    return;
  }

  let total = 0;
  tbody.innerHTML = itemsVentaRapida.map((it, idx) => {
    total += it.subtotal;
    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:6px 10px;">
          <strong style="color:var(--dark);">${escapeHtml(it.descripcion)}</strong>
          ${it.codigo ? `<div style="font-size:9.5px;color:var(--slate-5);font-family:monospace;">${escapeHtml(it.codigo)}</div>` : ''}
        </td>
        <td style="padding:6px 8px;text-align:center;font-weight:700;font-family:monospace;">${it.cantidad}</td>
        <td style="padding:6px 8px;text-align:right;font-family:monospace;">S/ ${it.precio_unitario.toFixed(2)}</td>
        <td style="padding:6px 8px;text-align:right;font-family:monospace;font-weight:800;color:#047857;">S/ ${it.subtotal.toFixed(2)}</td>
        <td style="padding:6px 8px;text-align:center;">
          <button type="button" class="btn-vr-del" data-idx="${idx}" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:2px 4px;" title="Eliminar ítem">✕</button>
        </td>
      </tr>
    `;
  }).join('');

  if (countEl) countEl.textContent = `${itemsVentaRapida.length} ítem${itemsVentaRapida.length !== 1 ? 's' : ''}`;
  if (totalEl) totalEl.textContent = `S/ ${total.toFixed(2)}`;
}

async function procesarVentaRapida(e) {
  e.preventDefault();
  if (itemsVentaRapida.length === 0) {
    alert('Debes agregar al menos un producto a la venta rápida.');
    return;
  }

  const cliente_nombre = document.getElementById('vr-cliente-nombre')?.value.trim() || 'Cliente Mostrador';
  const cliente_doc = document.getElementById('vr-cliente-doc')?.value.trim() || null;
  const metodo_pago = document.getElementById('vr-metodo-pago')?.value || 'Efectivo';
  const tipo_comprobante = document.getElementById('vr-tipo-comprobante')?.value || 'Recibo Interno';

  const btnSubmit = document.getElementById('btn-submit-venta-rapida');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '⏳ Procesando venta y descontando stock...';
  }

  try {
    const res = await crearVentaRapida({
      cliente_nombre,
      cliente_doc,
      metodo_pago,
      tipo_comprobante,
      items: itemsVentaRapida
    });

    cerrarModalVentaRapida();
    await cargarDatos();

    if (window.showToast) {
      window.showToast('✅ Venta rápida registrada y cobrada exitosamente', 'success');
    }

    const cobroCreado = res.cobro;
    if (cobroCreado) {
      const quiereTicket = confirm('¿Deseas imprimir el Ticket de comprobante ahora?');
      if (quiereTicket && window.imprimirTicketTermico) {
        window.imprimirTicketTermico({
          ...cobroCreado,
          items: cobroCreado.detalle_items || itemsVentaRapida
        });
      }
    }
  } catch (err) {
    console.error('Error al procesar venta rápida:', err);
    alert('Error al registrar venta rápida: ' + err.message);
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '💳 Cobrar y Entregar Producto';
    }
  }
}

// ── TICKET TÉRMICO 80MM ───────────────────────────────────

window.imprimirTicketTermico = function(c) {
  if (!c) return;
  const printArea = document.getElementById('print-area');
  if (!printArea) {
    window.print();
    return;
  }

  let items = c.items || [];
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch (_) { items = []; }
  }

  const total = parseFloat(c.monto_neto !== null && c.monto_neto !== undefined ? c.monto_neto : c.monto_total || 0);
  const igv = total * 0.18 / 1.18;
  const sub = total - igv;

  const compTipo = c.tipo_comprobante || 'Recibo Interno';
  const compNum = c.comprobante_numero || `REC-${c.id}`;
  const clienteNom = c.cliente_nombre || c.cliente_nombre_libre || 'Cliente Mostrador';
  const clienteDoc = c.num_doc || c.cliente_doc_libre || '—';
  const placa = c.placa && c.placa !== 'VENTA DIRECTA' ? c.placa : null;
  const ordenRef = c.orden_numero || c.orden_id ? `OT-${String(c.orden_numero || c.orden_id).padStart(4, '0')}` : 'VENTA DIRECTA';
  const fechaStr = safeFormatDate(c.fecha_cobro || c.fecha_emision || new Date(), { day: '2-digit', month: '2-digit', year: 'numeric' });

  printArea.innerHTML = `
    <div style="width: 78mm; max-width: 78mm; margin: 0 auto; font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.25; color: #000; padding: 4px;">
      <div style="text-align: center; margin-bottom: 8px;">
        <h2 style="font-size: 13px; font-weight: 900; margin: 0; text-transform: uppercase;">INVERSIONES Y SERVICIOS VARGAS E.I.R.L.</h2>
        <p style="font-size: 10px; margin: 2px 0;">RUC: 20608226066</p>
        <p style="font-size: 9px; margin: 1px 0;">Jr. Reyna Farge N° 648 - Cajamarca</p>
        <p style="font-size: 9px; margin: 1px 0;">Tel: 931 163 369 / 976 864 137</p>
        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
        <h3 style="font-size: 12px; font-weight: 900; margin: 2px 0; text-transform: uppercase;">${escapeHtml(compTipo)}</h3>
        <p style="font-size: 12px; font-weight: 800; margin: 1px 0;">${escapeHtml(compNum)}</p>
        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
      </div>

      <div style="font-size: 10.5px; margin-bottom: 8px;">
        <div><strong>Fecha:</strong> ${fechaStr}</div>
        <div><strong>Cliente:</strong> ${escapeHtml(clienteNom)}</div>
        <div><strong>DNI/RUC:</strong> ${escapeHtml(clienteDoc)}</div>
        <div><strong>Ref:</strong> ${escapeHtml(ordenRef)}${placa ? ` | Placa: ${escapeHtml(placa)}` : ''}</div>
      </div>

      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 10px;">
          <span style="width: 15%;">CANT</span>
          <span style="width: 50%;">DESCRIPCIÓN</span>
          <span style="width: 15%; text-align: right;">P.U.</span>
          <span style="width: 20%; text-align: right;">TOTAL</span>
        </div>
      </div>

      <div style="margin-bottom: 8px;">
        ${items.length > 0 ? items.map(it => {
          const cant = it.cantidad || 1;
          const pu = parseFloat(it.precio_unitario || 0);
          const st = cant * pu;
          const desc = it.descripcion || it.nombre || 'Producto / Repuesto';
          return `
            <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 3px;">
              <span style="width: 15%;">${cant}</span>
              <span style="width: 50%; word-break: break-word;">${escapeHtml(desc)}</span>
              <span style="width: 15%; text-align: right;">${pu.toFixed(2)}</span>
              <span style="width: 20%; text-align: right;">${st.toFixed(2)}</span>
            </div>
          `;
        }).join('') : `
          <div style="display: flex; justify-content: space-between; font-size: 10px;">
            <span style="width: 15%;">1</span>
            <span style="width: 50%;">${escapeHtml(c.concepto || 'Venta / Servicio')}</span>
            <span style="width: 15%; text-align: right;">${total.toFixed(2)}</span>
            <span style="width: 20%; text-align: right;">${total.toFixed(2)}</span>
          </div>
        `}
      </div>

      <div style="border-top: 1px dashed #000; padding-top: 6px; margin-bottom: 8px;">
        ${compTipo !== 'Recibo Interno' ? `
          <div style="display: flex; justify-content: space-between; font-size: 10px;">
            <span>Op. Gravada:</span>
            <span>S/ ${sub.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 10px;">
            <span>I.G.V. (18%):</span>
            <span>S/ ${igv.toFixed(2)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 900; margin-top: 2px;">
          <span>TOTAL:</span>
          <span>S/ ${total.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 3px;">
          <span>Medio de Pago:</span>
          <span>${escapeHtml(c.metodo_pago || 'Efectivo')}</span>
        </div>
      </div>

      <div style="border-top: 1px dashed #000; margin-top: 8px; padding-top: 8px; text-align: center; font-size: 9.5px;">
        <p style="margin: 2px 0;">¡Gracias por su preferencia!</p>
        <p style="margin: 2px 0; font-size: 8.5px; color: #555;">Documento de Control Interno</p>
      </div>
    </div>
  `;

  const onAfter = () => {
    printArea.innerHTML = '';
    window.removeEventListener('afterprint', onAfter);
  };
  window.addEventListener('afterprint', onAfter);
  setTimeout(() => {
    window.print();
    setTimeout(() => { printArea.innerHTML = ''; }, 2500);
  }, 150);
};

export function destroy() {}

