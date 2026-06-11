import {
  getClientes, getClienteHistorial, getClientesCrmStats,
  createCliente, updateCliente, patchClienteNotas, deleteCliente
} from '../api.js';

// ─── Estado del módulo ────────────────────────────────────────
let containerElement = null;
let clientesList     = [];
let crmStats         = {};
let filtroActivo     = 'todos';
let clienteSelId     = null;
let historialCache   = {};

// ─── Segmentación ─────────────────────────────────────────────
function segmento(c) {
  const servicios = parseInt(c.total_servicios) || 0;
  const gastado   = parseFloat(c.total_gastado)  || 0;
  const ultima    = c.ultima_visita_taller ? new Date(c.ultima_visita_taller) : null;
  const diasInact = ultima ? Math.floor((Date.now() - ultima.getTime()) / 86400000) : 999;

  if (servicios === 0 && gastado === 0) return 'inactivo';
  if (servicios > 3 || gastado > 1500)  return 'vip';
  if (diasInact > 90)                   return 'inactivo';
  if (servicios >= 2)                   return 'frecuente';
  if (servicios === 1)                  return 'nuevo';
  return 'inactivo';
}

const SEG_LABEL = { vip: 'VIP', frecuente: 'Frecuente', nuevo: 'Nuevo', inactivo: 'Inactivo' };
const SEG_COLOR = {
  vip:      '#f59e0b',
  frecuente:'#6366f1',
  nuevo:    '#10b981',
  inactivo: '#64748b',
};

// ─── Alertas predictivas de mantenimiento ─────────────────────
const ALERTAS_CFG = [
  { key: 'km_ultimo_aceite',       label: 'Aceite',       umbral: 5000,  icon: '🛢️' },
  { key: 'km_ultimo_filtros',      label: 'Filtros',      umbral: 10000, icon: '🔧' },
  { key: 'km_ultimo_frenos',       label: 'Frenos',       umbral: 20000, icon: '🛑' },
  { key: 'km_ultimo_bujias',       label: 'Bujías',       umbral: 30000, icon: '⚡' },
  { key: 'km_ultimo_refrigerante', label: 'Refrigerante', umbral: 40000, icon: '💧' },
  { key: 'km_ultimo_distribucion', label: 'Distribución', umbral: 60000, icon: '⚙️' },
];

function calcAlertas(v) {
  const kmActual = parseInt(v.km_actual) || 0;
  return ALERTAS_CFG.map(cfg => {
    const kmSvc = parseInt(v[cfg.key]) || 0;
    const diff  = kmActual - kmSvc;
    const pct   = kmSvc > 0 ? Math.min(diff / cfg.umbral, 1) : -1;
    let estado  = 'ok';
    if (pct < 0)      estado = 'sin-datos';
    else if (pct >= 1) estado = 'critico';
    else if (pct >= 0.8) estado = 'alerta';
    return { ...cfg, diff, pct, estado };
  });
}

// ─── Inicialización ───────────────────────────────────────────
export async function init(container) {
  containerElement = container;
  historialCache   = {};
  clienteSelId     = null;
  filtroActivo     = 'todos';

  container.innerHTML = `<div class="fade-in" id="crm-root" style="height:100%;display:flex;flex-direction:column;"></div>`;
  const root = document.getElementById('crm-root');
  root.innerHTML = renderSkeleton();

  try {
    [clientesList, crmStats] = await Promise.all([getClientes(), getClientesCrmStats().catch(() => ({}))]);
    renderCRM();
  } catch (err) {
    root.innerHTML = renderError(err.message);
  }
}

// ─── Skeleton ─────────────────────────────────────────────────
function renderSkeleton() {
  return `
    <div style="display:flex;flex-direction:column;gap:16px;padding:0;">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
        ${[0,1,2,3].map(()=>`<div style="height:92px;background:var(--slate-9);border-radius:16px;animation:pulse 1.5s infinite;"></div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:340px 1fr;gap:16px;height:calc(100vh - 260px);">
        <div style="height:100%;background:var(--slate-9);border-radius:16px;animation:pulse 1.5s infinite;"></div>
        <div style="height:100%;background:var(--slate-9);border-radius:16px;animation:pulse 1.5s infinite;"></div>
      </div>
    </div>`;
}

function renderError(msg) {
  return `
    <div class="card" style="max-width:480px;margin:40px auto;">
      <div class="card-body text-center" style="padding:48px 24px;">
        <div style="font-size:48px;margin-bottom:12px;">⚠️</div>
        <p style="font-weight:800;color:var(--dark);margin-bottom:8px;">Error al cargar CRM</p>
        <p style="font-size:13px;color:var(--slate-5);margin-bottom:20px;">${msg}</p>
        <button class="btn-primary" id="btn-retry-crm">Reintentar</button>
      </div>
    </div>`;
}

// ─── Render principal ─────────────────────────────────────────
function renderCRM() {
  const root = document.getElementById('crm-root');
  const stats = crmStats || {};
  const totalClientes   = parseInt(stats.total_clientes)   || clientesList.length;
  const clientesVip     = parseInt(stats.clientes_vip)     || clientesList.filter(c => segmento(c)==='vip').length;
  const inactivos       = parseInt(stats.clientes_inactivos)|| clientesList.filter(c => segmento(c)==='inactivo').length;
  const cobrosPendientes= parseInt(stats.cobros_pendientes) || 0;

  root.innerHTML = `
    <!-- ─ Cabecera ──────────────────────────────────────────── -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
      <div>
        <h1 style="font-size:22px;font-weight:900;color:var(--dark);letter-spacing:-.5px;text-transform:uppercase;">CRM Clientes</h1>
        <p style="font-size:13px;color:var(--slate-5);margin-top:2px;">Seguimiento 360° · Mantenimiento Predictivo · Fidelización</p>
      </div>
      <button class="btn-primary" id="btn-nuevo-cliente" style="white-space:nowrap;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 4v16m8-8H4"/></svg>
        Nuevo Cliente
      </button>
    </div>

    <!-- ─ KPI Cards ─────────────────────────────────────────── -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px;">
      ${kpiCard('👥','Total Clientes', totalClientes, 'En el directorio','#6366f1','rgba(99,102,241,.12)')}
      ${kpiCard('⭐','Clientes VIP', clientesVip, `${totalClientes>0?Math.round(clientesVip/totalClientes*100):0}% del total`,'#f59e0b','rgba(245,158,11,.12)')}
      ${kpiCard('💤','Inactivos (>90d)', inactivos, 'Requieren reactivación','#ef4444','rgba(239,68,68,.12)')}
      ${kpiCard('💳','Cobros Pendientes', cobrosPendientes, 'Por liquidar','#10b981','rgba(16,185,129,.12)')}
    </div>

    <!-- ─ Split Screen ──────────────────────────────────────── -->
    <div id="crm-split" style="display:grid;grid-template-columns:340px 1fr;gap:16px;flex:1;min-height:0;">

      <!-- Panel Izquierdo: Directorio -->
      <div class="card" style="display:flex;flex-direction:column;overflow:hidden;padding:0;">
        <div style="padding:16px 16px 12px;border-bottom:1px solid var(--slate-9);">
          <div style="position:relative;margin-bottom:10px;">
            <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--slate-5);" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" id="crm-search" placeholder="Buscar cliente, doc, teléfono..." class="form-input" style="padding-left:32px;font-size:13px;" />
          </div>
          <!-- Filtros de segmento -->
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${['todos','vip','frecuente','nuevo','inactivo'].map(f => `
              <button class="crm-filtro-btn ${filtroActivo===f?'active':''}" data-filtro="${f}"
                style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;border:1.5px solid ${f==='todos'?'var(--slate-7)':SEG_COLOR[f]||'var(--slate-7)'};
                background:${filtroActivo===f?(f==='todos'?'var(--slate-7)':SEG_COLOR[f]||'var(--slate-7)'):'transparent'};
                color:${filtroActivo===f?'#fff':(f==='todos'?'var(--slate-5)':SEG_COLOR[f]||'var(--slate-5)')};
                cursor:pointer;transition:all .2s;">
                ${f==='todos'?'Todos':SEG_LABEL[f]}
              </button>`).join('')}
          </div>
        </div>
        <div id="crm-lista" style="flex:1;overflow-y:auto;padding:8px 0;">
          ${renderListaClientes(clientesList)}
        </div>
      </div>

      <!-- Panel Derecho: Ficha 360° -->
      <div id="crm-ficha" class="card" style="overflow-y:auto;padding:32px;">
        ${renderFichaVacia()}
      </div>
    </div>

    <!-- Modal Nuevo/Editar Cliente -->
    ${renderModalCliente()}
  `;

  bindEventsCRM();
}

// ─── KPI Card helper ──────────────────────────────────────────
function kpiCard(icon, label, valor, sub, color, bg) {
  return `
    <div class="stat-card" style="background:${bg};border:1px solid ${color}22;border-radius:16px;padding:18px 20px;display:flex;gap:14px;align-items:center;">
      <div style="width:44px;height:44px;border-radius:12px;background:${color}22;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">${icon}</div>
      <div>
        <div style="font-size:26px;font-weight:900;color:${color};line-height:1;">${valor}</div>
        <div style="font-size:12px;font-weight:700;color:var(--dark);margin-top:2px;">${label}</div>
        <div style="font-size:11px;color:var(--slate-5);margin-top:1px;">${sub}</div>
      </div>
    </div>`;
}

// ─── Lista de clientes (panel izquierdo) ──────────────────────
function renderListaClientes(lista) {
  const filtrados = lista.filter(c => {
    if (filtroActivo !== 'todos' && segmento(c) !== filtroActivo) return false;
    const q = (document.getElementById('crm-search')?.value || '').toLowerCase().trim();
    if (!q) return true;
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.num_doc.toLowerCase().includes(q) ||
      (c.telefono && c.telefono.toLowerCase().includes(q))
    );
  });

  if (filtrados.length === 0) {
    return `<div style="padding:40px 16px;text-align:center;color:var(--slate-5);font-size:13px;">Sin resultados</div>`;
  }

  return filtrados.map(c => {
    const seg   = segmento(c);
    const color = SEG_COLOR[seg];
    const vCount= Array.isArray(c.vehiculos_detalle) ? c.vehiculos_detalle.filter(v=>v&&v.placa).length : 0;
    const isSelected = c.id === clienteSelId;

    return `
      <div class="crm-item ${isSelected?'selected':''}" data-id="${c.id}"
        style="padding:12px 16px;cursor:pointer;border-left:3px solid ${isSelected?color:'transparent'};
        background:${isSelected?`${color}10`:'transparent'};transition:all .18s;border-radius:0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div style="min-width:0;">
            <div style="font-weight:700;color:var(--dark);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.nombre}</div>
            <div style="font-size:11px;color:var(--slate-5);margin-top:1px;font-family:monospace;">${c.tipo_doc} ${c.num_doc}</div>
          </div>
          <span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:12px;white-space:nowrap;
            background:${color}20;color:${color};border:1px solid ${color}40;flex-shrink:0;">
            ${SEG_LABEL[seg]}
          </span>
        </div>
        <div style="display:flex;gap:12px;margin-top:6px;align-items:center;">
          <span style="font-size:11px;color:var(--slate-5);">📞 ${c.telefono}</span>
          ${vCount>0?`<span style="font-size:11px;color:var(--slate-5);">🚗 ${vCount} vehículo${vCount>1?'s':''}</span>`:''}
          <span style="font-size:11px;color:var(--slate-5);margin-left:auto;">S/. ${parseFloat(c.total_gastado||0).toFixed(0)}</span>
        </div>
      </div>`;
  }).join('');
}

// ─── Ficha vacía ──────────────────────────────────────────────
function renderFichaVacia() {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;gap:12px;opacity:.5;">
      <div style="font-size:56px;">👤</div>
      <p style="font-weight:700;color:var(--dark);font-size:15px;">Selecciona un cliente</p>
      <p style="font-size:13px;color:var(--slate-5);">Haz clic en cualquier cliente de la lista para ver su ficha 360°</p>
    </div>`;
}

// ─── Ficha 360° del cliente ───────────────────────────────────
async function renderFicha(cliente) {
  const ficha = document.getElementById('crm-ficha');
  ficha.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:60px;"><div class="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>`;

  let historial = historialCache[cliente.id];
  if (!historial) {
    try {
      historial = await getClienteHistorial(cliente.id);
      historialCache[cliente.id] = historial;
    } catch (_) { historial = []; }
  }

  const seg       = segmento(cliente);
  const segColor  = SEG_COLOR[seg];
  const vehiculos = Array.isArray(cliente.vehiculos_detalle) ? cliente.vehiculos_detalle.filter(v=>v&&v.placa) : [];
  const gastoFmt  = `S/. ${parseFloat(cliente.total_gastado||0).toLocaleString('es-PE', {minimumFractionDigits:2})}`;
  const numServ   = parseInt(cliente.total_servicios) || 0;
  const ultimaV   = cliente.ultima_visita_taller ? new Date(cliente.ultima_visita_taller).toLocaleDateString('es-PE') : 'Sin visitas';
  const ticketProm= numServ > 0 ? `S/. ${(parseFloat(cliente.total_gastado||0)/numServ).toFixed(2)}` : '-';

  ficha.innerHTML = `
    <!-- Encabezado del perfil -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <div style="display:flex;gap:16px;align-items:center;">
        <div style="width:56px;height:56px;border-radius:50%;background:${segColor}22;border:2.5px solid ${segColor};
          display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:${segColor};flex-shrink:0;">
          ${cliente.nombre.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <h2 style="font-size:18px;font-weight:900;color:var(--dark);">${cliente.nombre}</h2>
            <span style="font-size:11px;font-weight:800;padding:3px 10px;border-radius:12px;
              background:${segColor}20;color:${segColor};border:1px solid ${segColor}40;">
              ${SEG_LABEL[seg]}
            </span>
          </div>
          <div style="font-size:12px;color:var(--slate-5);margin-top:3px;display:flex;gap:12px;flex-wrap:wrap;">
            <span>${cliente.tipo_doc} <span class="font-mono" style="font-weight:700;">${cliente.num_doc}</span></span>
            ${cliente.telefono ? `<span>📞 ${cliente.telefono}</span>` : ''}
            ${cliente.correo   ? `<span>✉️ ${cliente.correo}</span>`   : ''}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn-ghost" id="btn-editar-cliente" data-id="${cliente.id}" style="font-size:12px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          Editar
        </button>
        <a href="https://wa.me/51${(cliente.telefono||'').replace(/\D/g,'')}" target="_blank" class="btn-success" style="font-size:12px;text-decoration:none;display:flex;align-items:center;gap:5px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          WhatsApp
        </a>
      </div>
    </div>

    <!-- KPIs personales -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:24px;">
      ${miniKpi('💰','Gasto Total',gastoFmt,'#10b981')}
      ${miniKpi('🔁','Servicios',numServ,'#6366f1')}
      ${miniKpi('📅','Última Visita',ultimaV,'#f59e0b')}
      ${miniKpi('🎯','Ticket Prom.',ticketProm,'#ec4899')}
    </div>

    <!-- Vehículos y Alertas Predictivas -->
    ${vehiculos.length > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:13px;font-weight:800;color:var(--dark);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">
        🚗 Vehículos y Alertas Predictivas
      </div>
      ${vehiculos.map(v => renderVehiculoAlertas(v, cliente)).join('')}
    </div>` : ''}

    <!-- WhatsApp Templates -->
    <div style="margin-bottom:24px;">
      <div style="font-size:13px;font-weight:800;color:var(--dark);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">
        💬 Mensajes Rápidos WhatsApp
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${renderWaTemplates(cliente, vehiculos, historial)}
      </div>
    </div>

    <!-- Notas CRM -->
    <div style="margin-bottom:24px;">
      <div style="font-size:13px;font-weight:800;color:var(--dark);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">
        📝 Notas de Seguimiento
      </div>
      <textarea id="crm-notas-textarea" placeholder="Preferencias del cliente, observaciones comerciales, próxima acción sugerida..."
        style="width:100%;min-height:80px;padding:12px;border-radius:10px;border:1.5px solid var(--slate-8);
        background:var(--slate-10);color:var(--dark);font-size:13px;line-height:1.6;resize:vertical;
        font-family:inherit;box-sizing:border-box;transition:border-color .2s;"
        onfocus="this.style.borderColor='var(--brand)'" onblur="this.style.borderColor='var(--slate-8)'">${cliente.notas || ''}</textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:8px;">
        <button class="btn-primary" id="btn-guardar-nota" data-id="${cliente.id}" style="font-size:12px;padding:7px 18px;">
          💾 Guardar Nota
        </button>
      </div>
    </div>

    <!-- Historial de Órdenes -->
    <div>
      <div style="font-size:13px;font-weight:800;color:var(--dark);text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px;">
        📋 Historial de Servicios (${historial.length})
      </div>
      ${historial.length === 0
        ? `<div style="text-align:center;padding:32px;color:var(--slate-5);font-size:13px;">Sin servicios registrados para este cliente.</div>`
        : renderTimeline(historial)
      }
    </div>
  `;

  // Bind ficha events
  document.getElementById('btn-editar-cliente')?.addEventListener('click', () => abrirModalCliente(cliente.id));
  document.getElementById('btn-guardar-nota')?.addEventListener('click', () => guardarNota(cliente.id));
  ficha.querySelectorAll('.btn-wa-template').forEach(btn => {
    btn.addEventListener('click', () => {
      const texto   = btn.dataset.texto;
      const tel     = (cliente.telefono || '').replace(/\D/g, '');
      const encoded = encodeURIComponent(texto);
      window.open(`https://wa.me/51${tel}?text=${encoded}`, '_blank');
    });
  });
}

// ─── Mini KPI ─────────────────────────────────────────────────
function miniKpi(icon, label, val, color) {
  return `
    <div style="background:${color}10;border:1px solid ${color}25;border-radius:12px;padding:12px 14px;">
      <div style="font-size:18px;">${icon}</div>
      <div style="font-size:17px;font-weight:900;color:${color};margin-top:4px;line-height:1;">${val}</div>
      <div style="font-size:11px;color:var(--slate-5);margin-top:3px;">${label}</div>
    </div>`;
}

// ─── Vehículo + Semáforo predictivo ───────────────────────────
function renderVehiculoAlertas(v, cliente) {
  const alertas = calcAlertas(v);
  const tieneAlerta = alertas.some(a => a.estado === 'critico' || a.estado === 'alerta');

  const alertaColors = { critico:'#ef4444', alerta:'#f59e0b', ok:'#10b981', 'sin-datos':'#64748b' };

  return `
    <div style="border:1px solid var(--slate-8);border-radius:12px;padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <div>
          <span class="placa-badge" style="font-size:12px;margin-right:8px;">${v.placa}</span>
          <span style="font-size:13px;color:var(--dark);font-weight:600;">${v.marca_modelo||''}</span>
          ${v.anio ? `<span style="font-size:11px;color:var(--slate-5);margin-left:6px;">${v.anio}</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${v.km_actual ? `<span style="font-size:11px;color:var(--slate-5);">⊙ ${parseInt(v.km_actual).toLocaleString()} km</span>` : ''}
          ${tieneAlerta ? `<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px;background:#ef444420;color:#ef4444;border:1px solid #ef444440;">⚠️ Mantenimiento</span>` : ''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;">
        ${alertas.map(a => `
          <div style="text-align:center;background:${alertaColors[a.estado]}10;border:1px solid ${alertaColors[a.estado]}30;border-radius:8px;padding:8px 6px;">
            <div style="font-size:16px;">${a.icon}</div>
            <div style="font-size:10px;font-weight:700;color:var(--dark);margin-top:2px;">${a.label}</div>
            <div style="font-size:10px;color:${alertaColors[a.estado]};font-weight:700;margin-top:2px;">
              ${a.estado === 'sin-datos' ? 'Sin datos' : a.estado === 'critico' ? '⛔ Vencido' : a.estado === 'alerta' ? '⚠️ Pronto' : '✅ OK'}
            </div>
            ${a.estado !== 'sin-datos' && v.km_actual ? `<div style="font-size:9px;color:var(--slate-5);margin-top:1px;">+${a.diff.toLocaleString()} km</div>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
}

// ─── Plantillas WhatsApp ──────────────────────────────────────
function renderWaTemplates(cliente, vehiculos, historial) {
  const nombre  = cliente.nombre.split(' ')[0];
  const placa   = vehiculos[0]?.placa   || 'su vehículo';
  const modelo  = vehiculos[0]?.marca_modelo || '';
  const ultimaOS= historial[0];
  const monto   = ultimaOS ? `S/. ${parseFloat(ultimaOS.total_estimado||0).toFixed(2)}` : '';
  
  // Detectar qué necesita mantenimiento
  const alertas = vehiculos[0] ? calcAlertas(vehiculos[0]).filter(a=>a.estado==='critico'||a.estado==='alerta') : [];
  const svcPend = alertas.length > 0 ? alertas.map(a=>a.label).join(', ') : 'mantenimiento preventivo';

  const templates = [
    {
      icon: '🚗',
      label: 'Vehículo Listo',
      texto: `Estimado/a ${nombre}, le saludamos del *Taller Automotriz Vargas*. Su vehículo *${modelo} (${placa})* se encuentra listo para su entrega. Detalle: *${monto}*. Puede pasar a recogерlo en horario de atención. ¡Gracias por su preferencia!`
    },
    {
      icon: '🔔',
      label: 'Recordatorio Mantenimiento',
      texto: `Hola ${nombre}, le saludamos del *Taller Automotriz Vargas*. Notamos que su vehículo *${placa}* está próximo a requerir: *${svcPend}*. ¿Le gustaría agendar una cita esta semana? Contáctenos y le brindamos el mejor servicio. 🛠️`
    },
    {
      icon: '⭐',
      label: 'Seguimiento Post-Servicio',
      texto: `Estimado/a ${nombre}, hace unos días retiró su vehículo *${placa}* de nuestro taller. Esperamos que todo marche perfectamente. Su satisfacción es lo más importante para nosotros. ¡Gracias por confiar en *Taller Automotriz Vargas*!`
    }
  ];

  return templates.map(t => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid var(--slate-8);border-radius:10px;background:var(--slate-10);">
      <span style="font-size:20px;flex-shrink:0;">${t.icon}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:700;color:var(--dark);">${t.label}</div>
        <div style="font-size:11px;color:var(--slate-5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.texto.substring(0,80)}...</div>
      </div>
      <button class="btn-success btn-wa-template" data-texto="${encodeHtmlAttr(t.texto)}"
        style="font-size:11px;padding:6px 12px;flex-shrink:0;white-space:nowrap;">
        Enviar
      </button>
    </div>`).join('');
}

function encodeHtmlAttr(str) {
  return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Timeline historial ───────────────────────────────────────
function renderTimeline(historial) {
  const estadoColor = {
    'Finalizado':           '#10b981',
    'En Proceso':           '#6366f1',
    'Diagnostico':          '#f59e0b',
    'Esperando Repuestos':  '#ef4444',
    'Entregado':            '#059669',
  };

  return `
    <div style="position:relative;padding-left:24px;">
      <div style="position:absolute;left:7px;top:0;bottom:0;width:2px;background:var(--slate-8);border-radius:2px;"></div>
      ${historial.map((os, i) => {
        const color = estadoColor[os.estado] || '#64748b';
        const fecha = new Date(os.fecha_ingreso).toLocaleDateString('es-PE', {day:'2-digit',month:'short',year:'numeric'});
        const items = Array.isArray(os.items) ? os.items : [];
        return `
          <div style="position:relative;margin-bottom:${i<historial.length-1?'20px':'0'};padding-left:20px;">
            <div style="position:absolute;left:-17px;top:4px;width:12px;height:12px;border-radius:50%;background:${color};border:2px solid var(--white);box-shadow:0 0 0 2px ${color}40;"></div>
            <div style="background:var(--slate-10);border:1px solid var(--slate-8);border-radius:10px;padding:12px 14px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
                <div>
                  <span style="font-size:12px;font-weight:700;color:var(--dark);">OS-${String(os.id).padStart(4,'0')}</span>
                  ${os.placa ? `<span class="placa-badge" style="font-size:10px;padding:1px 6px;margin-left:6px;">${os.placa}</span>` : ''}
                  ${os.mecanico ? `<span style="font-size:11px;color:var(--slate-5);margin-left:6px;">· ${os.mecanico}</span>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:${color}20;color:${color};border:1px solid ${color}40;">${os.estado}</span>
                  <span style="font-size:11px;color:var(--slate-5);">${fecha}</span>
                </div>
              </div>
              ${os.falla_reportada ? `<div style="font-size:12px;color:var(--slate-4);margin-bottom:4px;font-style:italic;">"${os.falla_reportada}"</div>` : ''}
              ${os.kilometraje ? `<div style="font-size:11px;color:var(--slate-5);margin-bottom:4px;">⊙ ${os.kilometraje}</div>` : ''}
              ${items.length > 0 ? `
                <div style="margin-top:6px;border-top:1px solid var(--slate-8);padding-top:6px;display:flex;flex-wrap:wrap;gap:4px;">
                  ${items.slice(0,3).map(it=>`<span style="font-size:10px;padding:2px 6px;border-radius:6px;background:var(--slate-9);color:var(--slate-4);">${it.descripcion?.substring(0,30)}</span>`).join('')}
                  ${items.length>3?`<span style="font-size:10px;padding:2px 6px;border-radius:6px;background:var(--slate-9);color:var(--slate-5);">+${items.length-3} más</span>`:''}
                </div>` : ''}
              <div style="text-align:right;margin-top:8px;font-size:14px;font-weight:800;color:${parseFloat(os.total_estimado)>0?'#10b981':'var(--slate-5)'};">
                ${parseFloat(os.total_estimado)>0 ? `S/. ${parseFloat(os.total_estimado).toLocaleString('es-PE',{minimumFractionDigits:2})}` : 'S/. 0.00'}
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// ─── Modal Nuevo / Editar Cliente ─────────────────────────────
function renderModalCliente() {
  return `
    <div id="modal-cliente" class="modal-overlay">
      <div class="modal modal-md">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="modal-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <span class="modal-title" id="modal-cli-titulo">Nuevo Cliente</span>
          </div>
          <button class="modal-close" id="btn-close-modal-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form id="form-cliente">
          <div class="modal-body" style="display:flex;flex-direction:column;gap:16px;">
            <input type="hidden" id="cliente-id" />

            <div class="form-section-title">Identificación</div>
            <div class="grid grid-cols-3 gap-3">
              <div class="form-group">
                <label class="form-label">Tipo Doc</label>
                <select id="cli-tipo-doc" class="form-select" required>
                  <option value="DNI">DNI</option>
                  <option value="RUC">RUC</option>
                  <option value="CE">C.E.</option>
                  <option value="PAS">Pasaporte</option>
                </select>
              </div>
              <div class="form-group col-span-2">
                <label class="form-label">Número Documento</label>
                <input type="text" id="cli-num-doc" class="form-input font-mono" required placeholder="Ej: 12345678" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Nombre Completo / Razón Social</label>
              <input type="text" id="cli-nombre" class="form-input" required placeholder="Ej: Transportes Vargas S.A.C." />
            </div>

            <div class="form-section-title" style="margin-top:4px;">Datos de Contacto</div>
            <div class="grid grid-cols-2 gap-3">
              <div class="form-group">
                <label class="form-label">Teléfono / WhatsApp</label>
                <input type="text" id="cli-telefono" class="form-input" required placeholder="Ej: 987654321" />
              </div>
              <div class="form-group">
                <label class="form-label">Correo (Opcional)</label>
                <input type="email" id="cli-correo" class="form-input" placeholder="ejemplo@correo.com" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Dirección (Opcional)</label>
              <input type="text" id="cli-direccion" class="form-input" placeholder="Av. Principal 123" />
            </div>

            <div class="form-group">
              <label class="form-label">Notas CRM (Opcional)</label>
              <textarea id="cli-notas" class="form-input" rows="2" placeholder="Preferencias, observaciones comerciales..."
                style="resize:vertical;font-family:inherit;"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" id="btn-close-modal-cancel">Cancelar</button>
            <button type="submit" class="btn-primary" id="btn-save-cliente">Guardar Cliente</button>
          </div>
        </form>
      </div>
    </div>`;
}

// ─── Event Bindings ───────────────────────────────────────────
function bindEventsCRM() {
  // Search
  document.getElementById('crm-search')?.addEventListener('input', () => {
    document.getElementById('crm-lista').innerHTML = renderListaClientes(clientesList);
    bindListaItems();
  });

  // Filtros de segmento
  document.querySelectorAll('.crm-filtro-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroActivo = btn.dataset.filtro;
      document.querySelectorAll('.crm-filtro-btn').forEach(b => {
        const f = b.dataset.filtro;
        const c = f === 'todos' ? 'var(--slate-7)' : SEG_COLOR[f] || 'var(--slate-7)';
        b.classList.toggle('active', b.dataset.filtro === filtroActivo);
        b.style.background = b.dataset.filtro === filtroActivo ? c : 'transparent';
        b.style.color      = b.dataset.filtro === filtroActivo ? '#fff' : c;
      });
      document.getElementById('crm-lista').innerHTML = renderListaClientes(clientesList);
      bindListaItems();
    });
  });

  // Nuevo cliente
  document.getElementById('btn-nuevo-cliente')?.addEventListener('click', () => abrirModalCliente());

  // Modal close
  document.getElementById('btn-close-modal-x')?.addEventListener('click', cerrarModal);
  document.getElementById('btn-close-modal-cancel')?.addEventListener('click', cerrarModal);
  document.getElementById('modal-cliente')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-cliente')) cerrarModal();
  });

  // Form submit
  document.getElementById('form-cliente')?.addEventListener('submit', guardarCliente);

  bindListaItems();
}

function bindListaItems() {
  document.querySelectorAll('.crm-item').forEach(el => {
    el.addEventListener('click', async () => {
      const id = parseInt(el.dataset.id);
      clienteSelId = id;
      // Re-renderizar lista para marcar selección
      document.getElementById('crm-lista').innerHTML = renderListaClientes(clientesList);
      bindListaItems();
      const cliente = clientesList.find(c => c.id === id);
      if (cliente) await renderFicha(cliente);
    });
  });
}

// ─── CRUD ─────────────────────────────────────────────────────
function abrirModalCliente(id = null) {
  const modal = document.getElementById('modal-cliente');
  document.getElementById('form-cliente').reset();

  if (id) {
    const c = clientesList.find(x => x.id == id);
    if (!c) return;
    document.getElementById('cliente-id').value    = c.id;
    document.getElementById('cli-tipo-doc').value  = c.tipo_doc;
    document.getElementById('cli-num-doc').value   = c.num_doc;
    document.getElementById('cli-nombre').value    = c.nombre;
    document.getElementById('cli-telefono').value  = c.telefono;
    document.getElementById('cli-correo').value    = c.correo    || '';
    document.getElementById('cli-direccion').value = c.direccion || '';
    document.getElementById('cli-notas').value     = c.notas     || '';
    document.getElementById('modal-cli-titulo').textContent = 'Editar Cliente';
    document.getElementById('btn-save-cliente').textContent = 'Actualizar Datos';
  } else {
    document.getElementById('cliente-id').value = '';
    document.getElementById('modal-cli-titulo').textContent = 'Nuevo Cliente';
    document.getElementById('btn-save-cliente').textContent = 'Guardar Cliente';
  }
  modal.classList.add('active');
}

function cerrarModal() {
  document.getElementById('modal-cliente')?.classList.remove('active');
}

async function guardarCliente(e) {
  e.preventDefault();
  const id  = document.getElementById('cliente-id').value;
  const btn = document.getElementById('btn-save-cliente');
  const data = {
    tipo_doc:  document.getElementById('cli-tipo-doc').value,
    num_doc:   document.getElementById('cli-num-doc').value.trim(),
    nombre:    document.getElementById('cli-nombre').value.trim(),
    telefono:  document.getElementById('cli-telefono').value.trim(),
    correo:    document.getElementById('cli-correo').value.trim()    || null,
    direccion: document.getElementById('cli-direccion').value.trim() || null,
    notas:     document.getElementById('cli-notas').value.trim()     || null,
  };

  btn.disabled    = true;
  btn.textContent = 'Guardando...';
  try {
    let saved;
    if (id) {
      saved = await updateCliente(id, data);
    } else {
      saved = await createCliente(data);
    }
    cerrarModal();
    // Refrescar lista
    clientesList = await getClientes();
    historialCache = {};
    document.getElementById('crm-lista').innerHTML = renderListaClientes(clientesList);
    bindListaItems();
    // Si editamos el cliente seleccionado, refrescar ficha
    if (clienteSelId && (id == clienteSelId || saved?.id == clienteSelId)) {
      const updatedCli = clientesList.find(c => c.id == (id || saved?.id));
      if (updatedCli) { clienteSelId = updatedCli.id; await renderFicha(updatedCli); }
    }
  } catch (err) {
    btn.disabled    = false;
    btn.textContent = id ? 'Actualizar Datos' : 'Guardar Cliente';
    const msg = document.createElement('p');
    msg.style.cssText = 'color:#ef4444;font-size:12px;margin:8px 16px 0;font-weight:600;';
    msg.textContent   = err.message;
    document.querySelector('#form-cliente .modal-footer')?.before(msg);
    setTimeout(() => msg.remove(), 4000);
  }
}

async function guardarNota(clienteId) {
  const btn   = document.getElementById('btn-guardar-nota');
  const texto = document.getElementById('crm-notas-textarea').value.trim() || null;
  btn.disabled    = true;
  btn.textContent = '⏳ Guardando...';
  try {
    await patchClienteNotas(clienteId, texto);
    // Actualizar localmente
    const idx = clientesList.findIndex(c => c.id == clienteId);
    if (idx >= 0) clientesList[idx].notas = texto;
    btn.textContent = '✅ Guardado';
    btn.style.background = '#10b981';
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = '💾 Guardar Nota';
      btn.style.background = '';
    }, 2000);
  } catch (err) {
    btn.disabled    = false;
    btn.textContent = '💾 Guardar Nota';
    alert('Error al guardar: ' + err.message);
  }
}

// ─── Destroy ──────────────────────────────────────────────────
export function destroy() {
  clientesList   = [];
  historialCache = {};
  clienteSelId   = null;
}
