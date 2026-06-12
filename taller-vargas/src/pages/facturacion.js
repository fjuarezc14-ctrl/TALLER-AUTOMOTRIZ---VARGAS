import {
  getCobros, getStatsCobros, registrarCobro, dividirCobro, getOrden
} from '../api.js';

let containerElement = null;
let cobrosList = [];
let statsData = {};

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
    const m = c.metodo_pago || 'Efectivo';
    byMethod[m] = (byMethod[m] || 0) + parseFloat(c.monto_total);
  });
  const totalPagado = Object.values(byMethod).reduce((a, b) => a + b, 0) || 1;
  const metodoPct = Object.entries(byMethod).map(([k, v]) => ({
    label: k, valor: v, pct: Math.round((v / totalPagado) * 100)
  })).sort((a, b) => b.pct - a.pct);

  return { porCobrar, ingresos, igv, cobrados, metodoPct };
}

// ── RENDER PRINCIPAL ─────────────────────────────────────────

function renderPage() {
  const root = document.getElementById('fact-root');
  if (!root) return;
  const { porCobrar, ingresos, igv, cobrados, metodoPct } = calcMetrics();
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
      #modal-factura-electronica { overflow-y: auto; }
      #modal-cobro-rapido .modal-body { overflow-y: auto; max-height: calc(100vh - 200px); }
      @media print {
        body * { visibility:hidden !important; }
        #modal-factura-electronica, #modal-factura-electronica * { visibility:visible !important; }
        #modal-factura-electronica { position:fixed;inset:0;z-index:9999;background:#fff;overflow:auto; }
        #modal-factura-electronica .no-print { display:none !important; }
        #modal-factura-electronica .factura-doc { box-shadow:none;border:none;max-width:100%;border-radius:0; }
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
      <input type="text" id="search-cobros" placeholder="🔍 Buscar por orden, cliente o placa..." class="form-input" style="width:300px;font-size:12px;" />
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

    <!-- Tabla -->
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
            ${renderTableRows(cobrosList)}
          </tbody>
        </table>
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
            <span class="modal-title">Registrar Cobro Interno</span>
          </div>
          <button class="modal-close" id="btn-close-cobro-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form id="form-cobro-rapido">
          <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;">
            <input type="hidden" id="cobro-rapido-id" />
            <input type="hidden" id="cobro-rapido-total" />

            <div style="background:var(--slate-9);padding:16px;border-radius:var(--radius-md);border:1px solid var(--slate-8);text-align:center;">
              <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Total a Cobrar</p>
              <p id="cobro-rapido-monto" style="font-size:30px;font-weight:900;color:var(--dark);font-family:monospace;margin-top:4px;"></p>
              <p id="cobro-rapido-cliente" style="font-size:12px;color:var(--slate-5);margin-top:4px;"></p>
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
                <option value="Nota de Venta">Nota de Venta (Control Interno)</option>
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
                  <div class="form-group"><label class="form-label">Comprobante</label><select id="div-comp-1" class="form-select" style="background:#fff;"><option value="Factura">Factura</option><option value="Boleta">Boleta</option></select></div>
                </div>
              </div>
              <div style="background:var(--white);border:1px solid var(--slate-8);padding:12px;border-radius:var(--radius-md);">
                <p style="font-size:10px;font-weight:800;color:var(--slate-5);text-transform:uppercase;margin-bottom:8px;">Empresa 2 / Co-pagador</p>
                <div class="grid grid-cols-2 gap-3 mb-2">
                  <div class="form-group"><label class="form-label">RUC / DNI</label><input type="text" id="div-doc-2" class="form-input font-mono" placeholder="20512345678" /></div>
                  <div class="form-group"><label class="form-label">Razón Social</label><input type="text" id="div-nombre-2" class="form-input" placeholder="Distribuidora Sol S.A." /></div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="form-group"><label class="form-label">Monto (S/)</label><input type="number" id="div-monto-2" step="0.01" min="0" class="form-input text-right font-mono font-bold" /></div>
                  <div class="form-group"><label class="form-label">Comprobante</label><select id="div-comp-2" class="form-select"><option value="Factura">Factura</option><option value="Boleta">Boleta</option></select></div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" id="btn-close-cobro-cancel">Cancelar</button>
            <button type="submit" class="btn-primary">Confirmar Pago</button>
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
              <span style="font-size:14px;font-weight:800;color:white;display:block;">Portal de Pago del Cliente</span>
              <span style="font-size:10px;color:rgba(255,255,255,0.55);">Taller Automotriz Vargas · Simulación auto-liquidada</span>
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
              <p style="font-size:13px;font-weight:900;color:var(--dark);margin-top:2px;">Taller Automotriz Vargas</p>
              <p style="font-size:11px;color:var(--slate-5);">RUC: 20123456789</p>
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
            <button class="btn-success" id="btn-imprimir-factura" style="font-size:12px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
              Imprimir
            </button>
            <button class="btn-ghost modal-close" id="btn-close-factura-x" style="font-size:12px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              Cerrar
            </button>
          </div>
        </div>
        <!-- Documento A4 -->
        <div id="factura-doc-content" style="background:#fff;border-radius:8px;box-shadow:var(--shadow-lg);">
          <!-- Cargado por JS al abrir -->
        </div>
      </div>
    </div>
  `;

  // ── Eventos
  document.getElementById('search-cobros').addEventListener('input', filtrarCobros);

  // Botones de cierre
  document.getElementById('btn-close-cobro-x').addEventListener('click', () => cerrarModal('modal-cobro-rapido'));
  document.getElementById('btn-close-cobro-cancel').addEventListener('click', () => cerrarModal('modal-cobro-rapido'));
  document.getElementById('btn-close-portal-x').addEventListener('click', () => cerrarModal('modal-portal-pago'));
  document.getElementById('btn-close-portal-cancel').addEventListener('click', () => cerrarModal('modal-portal-pago'));
  document.getElementById('btn-close-factura-x').addEventListener('click', () => cerrarModal('modal-factura-electronica'));

  document.getElementById('form-cobro-rapido').addEventListener('submit', procesarCobroRapido);
  document.getElementById('chk-dividir').addEventListener('change', toggleDividido);

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
  document.getElementById('btn-imprimir-factura').addEventListener('click', () => window.print());
  document.getElementById('btn-descargar-xml').addEventListener('click', descargarXML);

  // Tabla delegada
  document.getElementById('tabla-cobros-body').addEventListener('click', (e) => {
    const rapido = e.target.closest('.btn-cobro-rapido');
    const portal  = e.target.closest('.btn-abrir-portal');
    const factura = e.target.closest('.btn-ver-factura');
    if (rapido) abrirCobroRapido(rapido.dataset.id);
    else if (portal) {
      const cId = portal.dataset.id;
      const c = cobrosList.find(item => item.id == cId);
      if (c) {
        const payUrl = `https://taller-vargas.pe/pagos/OT-${String(c.orden_numero).padStart(4,'0')}`;
        navigator.clipboard.writeText(`Estimado(a) ${c.cliente_nombre}, puede pagar su orden de servicio ingresando a su portal de pagos aquí: ${payUrl}`).then(() => {
          const toast = document.createElement('div');
          toast.style.position = 'fixed';
          toast.style.bottom = '24px';
          toast.style.right = '24px';
          toast.style.background = 'var(--dark)';
          toast.style.color = '#fff';
          toast.style.padding = '12px 20px';
          toast.style.borderRadius = '8px';
          toast.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.3)';
          toast.style.zIndex = '9999';
          toast.style.fontSize = '12px';
          toast.style.fontWeight = '700';
          toast.style.display = 'flex';
          toast.style.alignItems = 'center';
          toast.style.gap = '8px';
          toast.style.border = '1px solid var(--brand)';
          toast.innerHTML = `<span>🔗 ¡Enlace de pago copiado al portapapeles!</span>`;
          document.body.appendChild(toast);
          setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s ease';
            setTimeout(() => toast.remove(), 500);
          }, 3000);
        });
      }
      abrirPortalPago(cId);
    }
    else if (factura) abrirFactura(factura.dataset.id);
  });

  // Inicializar tab del portal
  renderPortalTab('yape');
}

// ── TABLA ────────────────────────────────────────────────

function renderTableRows(cobros) {
  if (cobros.length === 0) {
    return `<tr><td colspan="9" class="td-empty">No se encontraron comprobantes</td></tr>`;
  }

  return cobros.map(c => {
    const isPaid = c.estado === 'Cancelado' || c.estado === 'Dividido';
    const total  = parseFloat(c.monto_total);
    const igv    = total * 0.18 / 1.18; // descontar IGV incluido
    const sub    = total - igv;
    const tipo   = c.tipo_comprobante;
    const numDoc = tipo === 'Factura'
      ? `F001-${String(c.id + 1000).padStart(4,'0')}`
      : tipo === 'Boleta'
        ? `B001-${String(c.id + 1000).padStart(4,'0')}`
        : `NV-${String(c.id + 1000).padStart(4,'0')}`;

    const dateStr = c.fecha_emision
      ? new Date(c.fecha_emision + 'T12:00:00').toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' })
      : '—';

    let badge = '';
    if (c.estado === 'Cancelado') badge = `<span class="badge badge-emerald">✓ Cancelado</span>`;
    else if (c.estado === 'Dividido') badge = `<span class="badge badge-purple">÷ Dividido</span>`;
    else badge = `<span class="badge badge-amber" style="animation:pulse-badge 1.5s ease-in-out infinite alternate;">⏳ Pendiente</span>`;

    let actions = '';
    if (!isPaid) {
      actions = `
        <div class="flex justify-end gap-1">
          <button class="btn-icon btn-abrir-portal" data-id="${c.id}" title="Portal de Pago Cliente" style="color:#7c3aed;font-size:10px;display:flex;align-items:center;gap:3px;padding:5px 8px;border-radius:6px;background:#faf5ff;border:1px solid #e9d5ff;">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            Link
          </button>
          <button class="btn-success btn-cobro-rapido" data-id="${c.id}" style="font-size:11px;padding:5px 10px;">Cobrar</button>
        </div>`;
    } else {
      actions = `
        <button class="btn-icon btn-ver-factura" data-id="${c.id}" title="Ver Comprobante" style="color:var(--brand);font-size:10px;display:flex;align-items:center;gap:3px;padding:5px 10px;border-radius:6px;background:#eff6ff;border:1px solid #bfdbfe;">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Ver Comprobante
        </button>`;
    }

    return `
      <tr class="cobro-row">
        <td>
          <span style="font-family:monospace;font-weight:800;color:${isPaid?'var(--dark)':'var(--slate-5)'};font-size:11px;">${isPaid ? numDoc : '— PENDIENTE —'}</span>
          ${tipo ? `<div style="font-size:9px;color:var(--slate-5);text-transform:uppercase;margin-top:1px;">${tipo}</div>` : ''}
        </td>
        <td>
          <span style="font-family:monospace;font-size:11px;font-weight:800;color:var(--brand);">OT-${String(c.orden_numero).padStart(4,'0')}</span>
          <div style="font-size:10px;color:var(--slate-5);">${c.placa || '—'}</div>
        </td>
        <td>
          <strong style="display:block;font-size:12px;">${c.cliente_nombre || '—'}</strong>
          <span style="font-size:10px;color:var(--slate-5);font-family:monospace;">${c.tipo_doc}: ${c.num_doc}</span>
        </td>
        <td style="font-size:11px;color:var(--slate-5);">${dateStr}</td>
        <td class="text-right font-mono" style="font-size:11px;color:var(--slate-5);">S/ ${sub.toFixed(2)}</td>
        <td class="text-right font-mono" style="font-size:11px;color:#7c3aed;">S/ ${igv.toFixed(2)}</td>
        <td class="text-right font-mono font-bold" style="font-size:13px;">S/ ${total.toFixed(2)}</td>
        <td class="text-center">${badge}</td>
        <td class="text-right">${actions}</td>
      </tr>`;
  }).join('');
}

// ── FILTRO ───────────────────────────────────────────────

function filtrarCobros() {
  const q = document.getElementById('search-cobros').value.toLowerCase().trim();
  const f = cobrosList.filter(c =>
    c.cliente_nombre?.toLowerCase().includes(q) ||
    c.placa?.toLowerCase().includes(q) ||
    String(c.id).includes(q) ||
    String(c.orden_numero).includes(q)
  );
  document.getElementById('tabla-cobros-body').innerHTML = renderTableRows(f);
}

// ── MODAL COBRO RÁPIDO ────────────────────────────────────

function abrirCobroRapido(id) {
  const c = cobrosList.find(item => item.id == id);
  if (!c) return;
  document.getElementById('cobro-rapido-id').value = c.id;
  document.getElementById('cobro-rapido-total').value = c.monto_total;
  document.getElementById('cobro-rapido-monto').textContent = `S/ ${parseFloat(c.monto_total).toFixed(2)}`;
  document.getElementById('cobro-rapido-cliente').textContent = `${c.cliente_nombre} | ${c.tipo_doc}: ${c.num_doc}`;
  const half = (parseFloat(c.monto_total) / 2).toFixed(2);
  document.getElementById('div-monto-1').value = half;
  document.getElementById('div-monto-2').value = half;
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
  try {
    if (!chk) {
      const tipo_comprobante = document.getElementById('cobro-rapido-comprobante').value;
      await registrarCobro(id, { metodo_pago, tipo_comprobante });
    } else {
      const total = parseFloat(document.getElementById('cobro-rapido-total').value);
      const m1 = parseFloat(document.getElementById('div-monto-1').value) || 0;
      const m2 = parseFloat(document.getElementById('div-monto-2').value) || 0;
      if (Math.abs((m1 + m2) - total) > 0.05) {
        alert(`Los montos no coinciden con el total (S/ ${total.toFixed(2)}).`); return;
      }
      await dividirCobro(id, {
        metodo_pago,
        tipo_comprobante: document.getElementById('div-comp-1').value,
        pagador2_nombre:  document.getElementById('div-nombre-2').value,
        pagador2_doc:     document.getElementById('div-doc-2').value,
        monto_pagador1: m1, monto_pagador2: m2,
        comprobante2:   document.getElementById('div-comp-2').value,
      });
    }
    cerrarModal('modal-cobro-rapido');
    await cargarDatos();
  } catch (err) { alert(err.message); }
}

// ── PORTAL DE PAGO CLIENTE ────────────────────────────────

let portalCobroId = null;
let portalTab = 'yape';

function abrirPortalPago(id) {
  const c = cobrosList.find(item => item.id == id);
  if (!c) return;
  portalCobroId = id;
  portalTab = 'yape';
  document.getElementById('portal-monto').textContent = `S/ ${parseFloat(c.monto_total).toFixed(2)}`;
  document.getElementById('portal-cliente').textContent = `Para: ${c.cliente_nombre}`;
  // Resetear tabs
  document.querySelectorAll('.portal-tab').forEach((t, i) => {
    t.classList.remove('active');
    t.style.color = 'var(--slate-5)';
    t.style.borderBottomColor = 'transparent';
    if (i === 0) { t.classList.add('active'); t.style.color = 'var(--dark)'; t.style.borderBottomColor = 'var(--brand)'; }
  });
  renderPortalTab('yape');
  document.getElementById('modal-portal-pago').classList.add('active');
}

function renderPortalTab(tab) {
  portalTab = tab;
  const content = document.getElementById('portal-content');
  if (tab === 'yape') {
    content.innerHTML = `
      <div style="text-align:center;">
        <p style="font-size:12px;color:var(--slate-5);margin-bottom:16px;font-weight:600;">Escanea el código QR con Yape o Plin</p>
        ${renderQRSimulado()}
        <p style="font-size:11px;font-weight:800;color:var(--dark);margin-top:12px;">Taller Automotriz Vargas</p>
        <p style="font-size:10px;color:var(--slate-5);margin-bottom:16px;">Celular Yape: <strong>987 654 321</strong></p>
        <button class="btn-primary w-full" id="btn-simular-escaneo" style="justify-content:center;font-size:13px;margin-top:4px;">
          📱 Simular Escaneo de QR
        </button>
      </div>`;
    document.getElementById('btn-simular-escaneo').addEventListener('click', () => {
      const btn = document.getElementById('btn-simular-escaneo');
      btn.innerHTML = '⏳ Procesando pago...';
      btn.disabled = true;
      setTimeout(() => {
        btn.innerHTML = '✅ ¡Pago verificado por Yape!';
        btn.style.background = '#059669';
        document.getElementById('btn-portal-confirmar').textContent = '✅ Confirmar y Liquidar';
      }, 2000);
    });
  } else {
    content.innerHTML = `
      <p style="font-size:12px;color:var(--slate-5);margin-bottom:16px;text-align:center;font-weight:600;">Transferencia a cualquiera de estas cuentas del taller</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${[
          { banco:'BCP',      color:'#003087', cci:'002-100-123456789-01', cuenta:'123-456789' },
          { banco:'BBVA',     color:'#004481', cci:'011-100-234567890-90', cuenta:'234-567890' },
          { banco:'Interbank', color:'#048236', cci:'003-100-345678901-80', cuenta:'345-678901' },
        ].map(b => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--white);border:1px solid var(--slate-8);border-radius:var(--radius-md);border-left:4px solid ${b.color};">
            <div>
              <p style="font-size:12px;font-weight:900;color:${b.color};">${b.banco}</p>
              <p style="font-size:11px;font-family:monospace;color:var(--slate-5);">Cta: ${b.cuenta}</p>
              <p style="font-size:10px;font-family:monospace;color:var(--slate-5);">CCI: ${b.cci}</p>
            </div>
            <button onclick="navigator.clipboard.writeText('${b.cci}').then(()=>{this.textContent='✅';setTimeout(()=>this.textContent='Copiar CCI',1500)})" style="font-size:11px;font-weight:700;color:${b.color};background:transparent;border:1px solid ${b.color};padding:5px 10px;border-radius:6px;cursor:pointer;">Copiar CCI</button>
          </div>`).join('')}
      </div>
      <div style="margin-top:14px;background:#fef3c7;border:1px solid #fde68a;border-radius:var(--radius-sm);padding:10px 12px;">
        <p style="font-size:11px;color:#92400e;font-weight:700;">⚠️ Tras realizar la transferencia, comunícate con el taller para confirmar el comprobante de pago.</p>
      </div>`;
  }
}

async function confirmarPagoPortal() {
  const id = portalCobroId;
  if (!id) return;
  const metodoMap = { yape:'Yape/Plin', banco:'Transferencia' };
  try {
    await registrarCobro(id, {
      metodo_pago: metodoMap[portalTab] || 'Transferencia',
      tipo_comprobante: 'Boleta'
    });
    cerrarModal('modal-portal-pago');
    await cargarDatos();
  } catch (err) { alert(err.message); }
}

// ── FACTURA ELECTRÓNICA ────────────────────────────────────

async function abrirFactura(id) {
  const c = cobrosList.find(item => item.id == id);
  if (!c) return;

  const doc = document.getElementById('factura-doc-content');
  doc.innerHTML = `<div style="padding:40px;text-align:center;color:var(--slate-5);font-size:13px;">Cargando ítems de la orden...</div>`;
  document.getElementById('modal-factura-electronica').classList.add('active');

  let items = [];
  try {
    const orden = await getOrden(c.orden_id);
    items = orden.items || [];
  } catch (_) { items = []; }

  const total  = parseFloat(c.monto_total);
  const igv    = parseFloat((total * 0.18 / 1.18).toFixed(2));
  const sub    = parseFloat((total - igv).toFixed(2));
  const tipo   = c.tipo_comprobante || 'Boleta';
  const serie  = tipo === 'Factura'  ? 'F001' : tipo === 'Boleta' ? 'B001' : 'NV01';
  const numDoc = `${serie}-${String(c.id + 1000).padStart(4,'0')}`;
  const fechaEmision = c.fecha_emision
    ? new Date(c.fecha_emision + 'T12:00:00').toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric' })
    : new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric' });
  const fechaCobro = c.fecha_cobro
    ? new Date(c.fecha_cobro + 'T12:00:00').toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric' })
    : '—';
  const hashSimulado = `SHA256:${btoa(numDoc + c.cliente_nombre + total).replace(/=/g,'').slice(0,40).toUpperCase()}`;

  doc.innerHTML = `
    <div class="factura-doc">
      <!-- Cabecera -->
      <div style="display:grid;grid-template-columns:1fr 220px;gap:24px;margin-bottom:24px;align-items:flex-start;">
        <div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <div>
              <h2 style="font-size:18px;font-weight:900;color:#1e293b;margin:0;">Taller Automotriz Vargas</h2>
              <p style="font-size:12px;color:#64748b;margin:0;">Servicios Mecánicos · Mantenimiento y Reparación</p>
            </div>
          </div>
          <p style="font-size:11px;color:#64748b;line-height:1.6;margin:0;">
            RUC: <strong>20123456789</strong><br/>
            Dirección: Av. Industrial 145, Ate Vitarte, Lima - Perú<br/>
            Teléfono: (01) 234-5678 · WhatsApp: 987 654 321<br/>
            Email: taller.vargas@email.com
          </p>
        </div>
        <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
          <div style="display:inline-block;background:${tipo==='Factura'?'#1e293b':tipo==='Boleta'?'#1d4ed8':'#64748b'};color:white;font-size:10px;font-weight:800;padding:3px 10px;border-radius:99px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
            ${tipo} (Control Interno)
          </div>
          <p style="font-size:22px;font-weight:900;color:#1e293b;font-family:monospace;letter-spacing:1px;margin:4px 0;">${numDoc}</p>
          <div style="border-top:1px dashed #e2e8f0;margin-top:10px;padding-top:10px;">
            <p style="font-size:10px;color:#64748b;margin:2px 0;">Emisión: <strong>${fechaEmision}</strong></p>
            ${c.fecha_cobro ? `<p style="font-size:10px;color:#64748b;margin:2px 0;">Cobrado: <strong>${fechaCobro}</strong></p>` : ''}
          </div>
        </div>
      </div>

      <!-- Estado SUNAT / Comprobante Interno -->
      <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:8px 14px;display:flex;align-items:center;gap:8px;margin-bottom:20px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#475569" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span style="font-size:11px;font-weight:800;color:#475569;">📄 COMPROBANTE DE CONTROL INTERNO</span>
        <span style="font-size:10px;color:#64748b;margin-left:auto;font-family:monospace;">${hashSimulado}</span>
      </div>

      <!-- Datos del cliente / receptor -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
        <p style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Datos del ${tipo === 'Factura' ? 'Adquirente' : 'Cliente'}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;">
          <div><span style="color:#64748b;">Razón Social:</span> <strong>${c.cliente_nombre || '—'}</strong></div>
          <div><span style="color:#64748b;">${c.tipo_doc}:</span> <strong style="font-family:monospace;">${c.num_doc || '—'}</strong></div>
          <div><span style="color:#64748b;">Orden de Servicio:</span> <strong style="font-family:monospace;">OS-${String(c.orden_numero).padStart(4,'0')}</strong></div>
          <div><span style="color:#64748b;">Vehículo:</span> <strong>${c.placa || '—'}</strong></div>
        </div>
      </div>

      <!-- Tabla de ítems -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:0;font-size:12px;">
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
          ${items.length > 0 ? items.map((it, idx) => `
            <tr style="background:${idx%2===0?'#fff':'#f8fafc'};border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px 10px;text-align:center;font-weight:800;font-family:monospace;">${it.cantidad}</td>
              <td style="padding:8px 10px;">
                <strong style="display:block;">${it.descripcion}</strong>
                ${it.repuesto_cod ? `<span style="font-size:10px;color:#64748b;font-family:monospace;">[${it.repuesto_cod}]</span>` : ''}
              </td>
              <td style="padding:8px 10px;text-align:center;">
                <span style="font-size:9px;font-weight:700;text-transform:uppercase;padding:2px 6px;border-radius:99px;${it.tipo==='almacen'?'background:#eff6ff;color:#1d4ed8;':'background:#f0fdf4;color:#15803d;'}">${it.tipo==='almacen'?'Repuesto':'M. Obra'}</span>
              </td>
              <td style="padding:8px 10px;text-align:right;font-family:monospace;">S/ ${parseFloat(it.precio_unitario||0).toFixed(2)}</td>
              <td style="padding:8px 10px;text-align:right;font-family:monospace;font-weight:700;">S/ ${(parseFloat(it.precio_unitario||0)*parseInt(it.cantidad||1)).toFixed(2)}</td>
            </tr>`).join('') : `
            <tr>
              <td colspan="5" style="padding:16px;text-align:center;color:#64748b;font-style:italic;font-size:12px;">
                Servicios de mantenimiento y reparación automotriz · Ver detalle en orden de trabajo
              </td>
            </tr>`}
        </tbody>
      </table>

      <!-- Totales -->
      <div style="display:flex;justify-content:flex-end;margin-top:0;border-top:2px solid #1e293b;">
        <div style="width:260px;">
          <div style="display:flex;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #e2e8f0;">
            <span style="font-size:12px;color:#64748b;">Op. Gravadas (Subtotal)</span>
            <span style="font-family:monospace;font-weight:700;">S/ ${sub.toFixed(2)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #e2e8f0;">
            <span style="font-size:12px;color:#7c3aed;font-weight:700;">IGV (18%)</span>
            <span style="font-family:monospace;font-weight:700;color:#7c3aed;">S/ ${igv.toFixed(2)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:12px 10px;background:#1e293b;border-radius:0 0 4px 4px;">
            <span style="font-size:14px;font-weight:900;color:#fff;">TOTAL A PAGAR</span>
            <span style="font-family:monospace;font-size:16px;font-weight:900;color:#34d399;">S/ ${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <!-- Método de pago y QR -->
      <div style="display:grid;grid-template-columns:1fr auto;gap:20px;margin-top:20px;padding-top:16px;border-top:1px dashed #e2e8f0;align-items:center;">
        <div>
          <p style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Forma de Pago</p>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:13px;font-weight:800;color:#1e293b;">${c.metodo_pago || '—'}</span>
            <span style="font-size:11px;color:#64748b;">·</span>
            <span style="font-size:11px;color:#64748b;">Comprobante: ${c.tipo_comprobante || '—'}</span>
          </div>
          <p style="font-size:11px;color:#64748b;margin-top:8px;line-height:1.5;">
            "Documento de control interno emitido por<br/>
            TALLER AUTOMOTRIZ VARGAS con RUC 20123456789"
          </p>
        </div>
        <div style="text-align:center;">
          ${renderQRSimuladoPequeno()}
          <p style="font-size:9px;color:#64748b;margin-top:4px;">Validación Interna</p>
        </div>
      </div>
    </div>
  `;
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

// ── XML SIMULADO ──────────────────────────────────────────

function descargarXML() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>SUNAT-SIMULADO</cbc:ID>
  <cbc:IssueDate>${new Date().toISOString().split('T')[0]}</cbc:IssueDate>
  <cbc:InvoiceTypeCode listID="0101">01</cbc:InvoiceTypeCode>
  <cbc:Note>TALLER AUTOMOTRIZ VARGAS RUC 20123456789</cbc:Note>
  <!-- Archivo generado por simulación local - No tiene validez tributaria oficial -->
</Invoice>`;

  const blob = new Blob([xml], { type: 'application/xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `comprobante-simulado.xml`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── HELPERS ───────────────────────────────────────────────

function cerrarModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}

export function destroy() {}
