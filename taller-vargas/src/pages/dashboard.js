import { getDashboard } from '../api.js';

export async function init(container) {
  container.innerHTML = `
    <style>
      /* ── Estilos Premium Especiales para el Dashboard ── */
      .dash-container {
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding-bottom: 40px;
        animation: fadeIn 0.4s ease-out;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* Grid de KPIs */
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
      }

      /* Tarjetas de Métricas con Degradados */
      .metric-card {
        position: relative;
        background: var(--white);
        border-radius: var(--radius-lg);
        border: 1px solid var(--slate-8);
        padding: 20px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        box-shadow: var(--shadow-sm);
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s;
      }

      .metric-card:hover {
        transform: translateY(-4px);
        box-shadow: var(--shadow-md);
      }

      .metric-card::after {
        content: '';
        position: absolute;
        top: 0; right: 0; width: 150px; height: 150px;
        background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%);
        border-radius: 50%;
        transform: translate(30%, -30%);
        pointer-events: none;
      }

      /* Variantes de Color */
      .metric-card.cobros {
        border-left: 5px solid var(--brand);
      }
      .metric-card.eficiencia {
        border-left: 5px solid #8b5cf6;
      }
      .metric-card.ticket {
        border-left: 5px solid #3b82f6;
      }
      .metric-card.activos {
        border-left: 5px solid #f59e0b;
      }
      .metric-card.clientes {
        border-left: 5px solid #ec4899;
      }
      .metric-card.pendientes {
        border-left: 5px solid #ef4444;
      }

      .metric-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .metric-title {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--slate-5);
      }

      .metric-icon-wrap {
        width: 38px;
        height: 38px;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
      }

      .cobros .metric-icon-wrap { background: #ecfdf5; color: var(--brand); }
      .eficiencia .metric-icon-wrap { background: #f5f3ff; color: #8b5cf6; }
      .ticket .metric-icon-wrap { background: #eff6ff; color: #3b82f6; }
      .activos .metric-icon-wrap { background: #fffbeb; color: #d97706; }
      .clientes .metric-icon-wrap { background: #fdf2f8; color: #ec4899; }
      .pendientes .metric-icon-wrap { background: #fef2f2; color: #ef4444; }

      .metric-body {
        margin-top: auto;
      }

      .metric-value {
        font-size: 28px;
        font-weight: 900;
        color: var(--dark);
        line-height: 1.1;
        letter-spacing: -0.5px;
      }

      .metric-subtext {
        font-size: 11px;
        color: var(--slate-5);
        margin-top: 4px;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      /* Gráficos SVG Interactivos */
      .chart-container {
        position: relative;
        background: var(--dark);
        color: var(--white);
        border-radius: var(--radius-lg);
        padding: 24px;
        box-shadow: var(--shadow-lg);
        border: 1px solid var(--dark-3);
      }

      .chart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 12px;
      }

      .chart-legend {
        display: flex;
        gap: 16px;
        font-size: 12px;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .legend-color {
        width: 10px;
        height: 10px;
        border-radius: 3px;
      }

      /* Grid Intermedio */
      .dashboard-grid-2 {
        display: grid;
        grid-template-columns: 2fr 1.2fr;
        gap: 20px;
      }

      @media (max-width: 1024px) {
        .dashboard-grid-2 {
          grid-template-columns: 1fr;
        }
      }

      /* Secciones Internas */
      .top-servicios-list {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-top: 10px;
      }

      .top-servicio-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .top-servicio-info {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        font-weight: 600;
        color: var(--dark-2);
      }

      .progress-bg {
        width: 100%;
        height: 8px;
        background: var(--slate-9);
        border-radius: 99px;
        overflow: hidden;
      }

      .progress-bar {
        height: 100%;
        border-radius: 99px;
        transition: width 1s ease-out;
      }

      /* Mecánicos */
      .mecanicos-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 10px;
      }

      .mecanico-card-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: var(--slate-9);
        border-radius: var(--radius-md);
        border: 1px solid var(--slate-8);
        transition: transform 0.2s;
      }

      .mecanico-card-item:hover {
        transform: translateX(4px);
        background: #f8fafc;
      }

      .mecanico-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .pulse-badge {
        width: 8px;
        height: 8px;
        background: var(--brand);
        border-radius: 50%;
        display: inline-block;
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
        animation: pulseGreen 2s infinite;
      }

      .pulse-badge.inactive {
        background: var(--slate-6);
        animation: none;
        box-shadow: none;
      }

      @keyframes pulseGreen {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
      }

      /* Float Tooltip */
      .chart-tooltip {
        position: absolute;
        background: rgba(15, 23, 42, 0.95);
        color: var(--white);
        border: 1px solid var(--dark-3);
        border-radius: var(--radius-sm);
        padding: 8px 12px;
        font-size: 11px;
        pointer-events: none;
        box-shadow: var(--shadow-lg);
        display: none;
        z-index: 100;
        backdrop-filter: blur(4px);
      }

      /* ── Mini Charts Section ───────────────────────────── */
      .mini-charts-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      @media (max-width: 860px) {
        .mini-charts-row { grid-template-columns: 1fr; }
      }

      .mini-chart-card {
        background: var(--white);
        border: 1px solid var(--slate-8);
        border-radius: var(--radius-lg);
        padding: 20px 24px;
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .mini-chart-title {
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--slate-4);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .donut-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 20px;
        font-size: 12px;
      }

      .donut-legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--slate-4);
      }

      .donut-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .gauge-labels {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--slate-5);
        font-weight: 600;
        padding: 0 4px;
        margin-top: -8px;
      }
    </style>

    <div class="dash-container" id="dashboard-root">
      ${renderSkeleton()}
    </div>
  `;

  const root = document.getElementById('dashboard-root');

  try {
    const data = await getDashboard();
    root.innerHTML = renderDashboard(data);
    
    // Iniciar Animación de Números
    animateDashboardStats(data.stats);
    
    // Iniciar interactividad del Gráfico SVG
    setupChartInteractivity(data.tendencia_mensual);

    // Animar mini-gráficos
    animateDonutSegments();
    animateGaugeArc(data.stats.eficiencia_operativa);
  } catch (err) {
    root.innerHTML = renderError(err.message);
  }
}

function renderSkeleton() {
  return `
    <div class="flex items-center justify-between mb-2">
      <div style="height:32px; width:220px; background:var(--slate-8); border-radius:var(--radius-sm);"></div>
      <div style="height:38px; width:140px; background:var(--slate-8); border-radius:var(--radius-md);"></div>
    </div>
    <div class="kpi-grid">
      ${Array(6).fill(`
        <div style="height:120px; background:var(--white); border-radius:var(--radius-lg); border:1px solid var(--slate-8); padding:20px; display:flex; flex-direction:column; justify-content:space-between;">
          <div style="display:flex; justify-content:between; align-items:center;">
            <div style="height:12px; width:80px; background:var(--slate-9); border-radius:4px;"></div>
            <div style="height:30px; width:30px; background:var(--slate-9); border-radius:8px;"></div>
          </div>
          <div style="height:24px; width:120px; background:var(--slate-9); border-radius:6px;"></div>
        </div>
      `).join('')}
    </div>
    <div style="height:280px; background:var(--white); border-radius:var(--radius-lg); border:1px solid var(--slate-8);"></div>
  `;
}

function renderError(msg) {
  return `
    <div class="card" style="max-width:480px; margin:40px auto;">
      <div class="card-body text-center" style="padding:48px 24px;">
        <div style="font-size:40px; margin-bottom:12px;">⚠️</div>
        <p style="font-weight:800; color:var(--dark); margin-bottom:8px;">No se pudo conectar al servidor</p>
        <p style="font-size:13px; color:var(--slate-5); margin-bottom:20px;">${msg}</p>
        <button class="btn-primary" onclick="location.reload()">Reintentar</button>
      </div>
    </div>`;
}

function renderDashboard(data) {
  const { stats, alertas_stock, ordenes_recientes, mecanicos_stats, top_servicios, tendencia_mensual } = data;
  const date = new Date().toLocaleDateString('es-PE', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  // 1. Calcular total vehículos activos
  const vehiculosActivos = stats.en_proceso + stats.diagnostico + stats.esperando;

  // 2. Formateador de Estados
  const estadoBadge = (estado) => {
    const map = {
      'En Proceso':          'badge-blue',
      'Diagnostico':         'badge-amber',
      'Esperando Repuestos': 'badge-purple',
      'Finalizado':          'badge-emerald',
      'No realizó el servicio': 'badge-slate',
    };
    return `<span class="badge ${map[estado] || 'badge-slate'}">${estado}</span>`;
  };

  // 3. Generación del Gráfico SVG
  const svgChart = generateSVGChart(tendencia_mensual);

  return `
    <!-- Header -->
    <div class="flex items-center justify-between" style="flex-wrap:wrap; gap:16px;">
      <div>
        <h1 style="font-size:24px; font-weight:900; color:var(--dark); text-transform:uppercase; letter-spacing:-.5px; display:flex; align-items:center; gap:8px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="var(--brand)" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
          Dashboard Vargas ERP
        </h1>
        <p style="font-size:13px; color:var(--slate-5); margin-top:2px;">Centro de control y analítica comercial • <strong>${date}</strong></p>
      </div>
      <button class="btn-primary" onclick="navigate('/ordenes')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="margin-right:6px;"><path d="M12 5v14M5 12h14"/></svg>
        Nueva Orden
      </button>
    </div>

    <!-- KPIs Grid -->
    <div class="kpi-grid">
      <!-- Cobrado Mes -->
      <div class="metric-card cobros">
        <div class="metric-header">
          <span class="metric-title">Ingresos Cobrados</span>
          <div class="metric-icon-wrap">S/</div>
        </div>
        <div class="metric-body">
          <p class="metric-value" id="kpi-cobros">S/ 0.00</p>
          <p class="metric-subtext">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            Mes actual (Facturado & Pagado)
          </p>
        </div>
      </div>

      <!-- Eficiencia Operativa -->
      <div class="metric-card eficiencia">
        <div class="metric-header">
          <span class="metric-title">Eficiencia Operativa</span>
          <div class="metric-icon-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
        </div>
        <div class="metric-body">
          <p class="metric-value" id="kpi-eficiencia">0%</p>
          <p class="metric-subtext">Órdenes Finalizadas del total mensual</p>
        </div>
      </div>

      <!-- Ticket Promedio -->
      <div class="metric-card ticket">
        <div class="metric-header">
          <span class="metric-title">Ticket Promedio</span>
          <div class="metric-icon-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="metric-body">
          <p class="metric-value" id="kpi-ticket">S/ 0.00</p>
          <p class="metric-subtext">Valor promedio por servicio listo</p>
        </div>
      </div>

      <!-- Vehículos Activos -->
      <div class="metric-card activos">
        <div class="metric-header">
          <span class="metric-title">Autos en Servicio</span>
          <div class="metric-icon-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
          </div>
        </div>
        <div class="metric-body">
          <p class="metric-value" id="kpi-activos">0</p>
          <p class="metric-subtext">Proceso: ${stats.en_proceso} • Diag: ${stats.diagnostico} • Rep: ${stats.esperando}</p>
        </div>
      </div>

      <!-- Clientes Nuevos -->
      <div class="metric-card clientes">
        <div class="metric-header">
          <span class="metric-title">Clientes Nuevos</span>
          <div class="metric-icon-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>
          </div>
        </div>
        <div class="metric-body">
          <p class="metric-value" id="kpi-clientes">0</p>
          <p class="metric-subtext">Registrados en el mes actual</p>
        </div>
      </div>

      <!-- Pendiente por Cobrar -->
      <div class="metric-card pendientes">
        <div class="metric-header">
          <span class="metric-title">Cuentas por Cobrar</span>
          <div class="metric-icon-wrap">!</div>
        </div>
        <div class="metric-body">
          <p class="metric-value" id="kpi-pendientes">S/ 0.00</p>
          <p class="metric-subtext">Monto total de cobros pendientes</p>
        </div>
      </div>
    </div>

    <!-- Mini Charts Row: Donut + Gauge -->
    <div class="mini-charts-row">

      <!-- Donut: Distribución de Órdenes -->
      <div class="mini-chart-card">
        <div class="mini-chart-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
          Distribución de Órdenes del Mes
        </div>
        <div style="display:flex; align-items:center; gap:24px; flex-wrap:wrap;">
          <div style="flex-shrink:0;">
            ${generateDonutChart(stats)}
          </div>
          <div class="donut-legend">
            <div class="donut-legend-item">
              <div class="donut-dot" style="background:#3b82f6;"></div>
              <div>
                <div style="font-weight:800; font-size:13px; color:var(--dark);">${stats.en_proceso}</div>
                <div>En Proceso</div>
              </div>
            </div>
            <div class="donut-legend-item">
              <div class="donut-dot" style="background:#f59e0b;"></div>
              <div>
                <div style="font-weight:800; font-size:13px; color:var(--dark);">${stats.diagnostico}</div>
                <div>Diagnóstico</div>
              </div>
            </div>
            <div class="donut-legend-item">
              <div class="donut-dot" style="background:#8b5cf6;"></div>
              <div>
                <div style="font-weight:800; font-size:13px; color:var(--dark);">${stats.esperando}</div>
                <div>Esp. Repuestos</div>
              </div>
            </div>
            <div class="donut-legend-item">
              <div class="donut-dot" style="background:#10b981;"></div>
              <div>
                <div style="font-weight:800; font-size:13px; color:var(--dark);">${stats.finalizado}</div>
                <div>Finalizados</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Gauge: Eficiencia Operativa -->
      <div class="mini-chart-card">
        <div class="mini-chart-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z"/><path d="M12 6v6l4 2"/></svg>
          Velocímetro de Eficiencia Operativa
        </div>
        <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
          ${generateGaugeChart(stats.eficiencia_operativa)}
          <div class="gauge-labels" style="width:190px;">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
          <div style="text-align:center;">
            <p style="font-size:28px; font-weight:900; color:var(--dark); letter-spacing:-1px; line-height:1;">${stats.eficiencia_operativa.toFixed(0)}<span style="font-size:16px; font-weight:600; color:var(--slate-5);">%</span></p>
            <p style="font-size:11px; color:var(--slate-5); margin-top:4px;">Órdenes finalizadas este mes</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tendencia de Ingresos -->
    <div class="chart-container">
      <div class="chart-header">
        <div>
          <h3 style="font-size:16px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Tendencia y Desempeño Comercial</h3>
          <p style="font-size:11px; color:var(--slate-6); margin-top:2px;">Últimos 6 meses de facturación finalizada vs volumen de órdenes</p>
        </div>
        <div class="chart-legend">
          <div class="legend-item">
            <div class="legend-color" style="background:#10b981;"></div>
            <span>Ingresos (S/)</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background:#3b82f6;"></div>
            <span>Órdenes listadas</span>
          </div>
        </div>
      </div>
      <div style="width:100%; overflow-x:auto;">
        ${svgChart}
      </div>
      <!-- Floating Tooltip para Gráfico -->
      <div class="chart-tooltip" id="svg-chart-tooltip"></div>
    </div>

    <!-- Grid Intermedio -->
    <div class="dashboard-grid-2">
      <!-- Top Servicios -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Servicios Más Solicitados</span>
          <span class="badge badge-emerald">Ranking de Ventas</span>
        </div>
        <div class="card-body" style="padding: 16px 20px 24px;">
          <div class="top-servicios-list">
            ${top_servicios.length ? top_servicios.map((s, idx) => {
              const maxFreq = top_servicios[0]?.cantidad || 1;
              const pct = (s.cantidad / maxFreq) * 100;
              const colores = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];
              const col = colores[idx % colores.length];
              return `
                <div class="top-servicio-row">
                  <div class="top-servicio-info">
                    <span style="font-weight:700; color:var(--dark);">${s.descripcion}</span>
                    <span style="color:var(--slate-4);">${s.cantidad} veces <span style="font-weight:normal; color:var(--slate-5);">(${pct.toFixed(0)}%)</span></span>
                  </div>
                  <div class="progress-bg">
                    <div class="progress-bar" style="width: 0%; background: ${col};" data-pct="${pct}"></div>
                  </div>
                  <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--slate-5); margin-top:2px;">
                    <span>Servicio Automotriz</span>
                    <span style="font-weight:bold;">S/ ${parseFloat(s.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              `;
            }).join('') : `<div class="td-empty" style="padding:40px;">Sin datos de consumo de repuestos/servicios todavía.</div>`}
          </div>
        </div>
      </div>

      <!-- Carga de Mecánicos -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Carga de Mecánicos</span>
          <button class="btn-ghost" style="font-size:12px; padding:4px 8px;" onclick="navigate('/operaciones')">Ver Taller →</button>
        </div>
        <div class="card-body" style="padding:16px;">
          <div class="mecanicos-container">
            ${mecanicos_stats.length ? mecanicos_stats.map(m => {
              const totalMecJobs = parseInt(m.ordenes_activas) + parseInt(m.ordenes_completadas);
              const contribPct = totalMecJobs > 0 ? (parseInt(m.ordenes_activas) / totalMecJobs) * 100 : 0;
              return `
                <div class="mecanico-card-item">
                  <div class="mecanico-info">
                    <span style="font-weight:800; font-size:13px; color:var(--dark); display:flex; align-items:center; gap:6px;">
                      <span class="pulse-badge ${m.activo ? '' : 'inactive'}"></span>
                      ${m.nombre}
                    </span>
                    <span style="font-size:11px; color:var(--slate-5);">${m.activo ? 'Disponible para asignación' : 'Fuera de servicio'}</span>
                  </div>
                  <div class="text-right">
                    <span class="badge ${parseInt(m.ordenes_activas) > 2 ? 'badge-amber' : 'badge-blue'}" style="font-weight:800; font-size:11px;">
                      ${m.ordenes_activas} activas
                    </span>
                    <p style="font-size:10px; color:var(--slate-5); margin-top:4px;">${m.ordenes_completadas} completadas</p>
                  </div>
                </div>
              `;
            }).join('') : `<div class="td-empty" style="padding:40px;">No hay mecánicos registrados.</div>`}
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Grid -->
    <div class="grid gap-6" style="grid-template-columns: 2fr 1fr; margin-top:8px;">
      <!-- Órdenes Recientes -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Últimas Órdenes Recibidas</span>
          <button class="btn-ghost" style="font-size:12px; padding:5px 10px;" onclick="navigate('/ordenes')">Ver todas →</button>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Vehículo</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th class="text-right">Costo Est.</th>
              </tr>
            </thead>
            <tbody>
              ${ordenes_recientes.length ? ordenes_recientes.map(o => `
                <tr style="cursor:pointer;" onclick="navigate('/ordenes')">
                  <td><span class="placa-badge">${o.placa || '—'}</span></td>
                  <td style="font-weight:700; color:var(--dark);">${o.vehiculo || '—'}</td>
                  <td style="color:var(--slate-5); font-style:italic;">${o.cliente || '—'}</td>
                  <td>${estadoBadge(o.estado)}</td>
                  <td class="text-right font-bold font-mono">S/ ${parseFloat(o.total_estimado||0).toFixed(2)}</td>
                </tr>`).join('') 
              : `<tr><td colspan="5" class="td-empty">No hay órdenes registradas</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Alertas de Almacén -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Alertas Críticas de Stock</span>
          <button class="btn-ghost" style="font-size:12px; padding:5px 10px;" onclick="navigate('/almacen')">Ver almacén →</button>
        </div>
        <div class="card-body" style="padding:16px;">
          ${alertas_stock.length === 0
            ? `<div style="text-align:center; padding:32px 16px; color:var(--slate-5);">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 8px; color:var(--brand); display:block;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <p style="font-weight:800; font-size:13px; color:var(--dark);">Inventario Óptimo</p>
                <p style="font-size:11px; margin-top:2px;">No se registran productos por debajo del stock mínimo</p>
              </div>`
            : alertas_stock.map(a => `
              <div style="display:flex; align-items:center; gap:12px; padding:10px; border-radius:12px; margin-bottom:8px; background:${a.stock === 0 ? '#fef2f2' : '#fffbeb'}; border:1px solid ${a.stock === 0 ? '#fecaca' : '#fde68a'};">
                <div style="width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; background:${a.stock === 0 ? '#fee2e2' : '#fef3c7'}; color:${a.stock === 0 ? '#dc2626' : '#b45309'};">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                </div>
                <div style="flex:1;">
                  <p style="font-size:12px; font-weight:800; text-transform:uppercase; color:${a.stock === 0 ? '#7f1d1d' : '#78350f'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:160px;">${a.descripcion}</p>
                  <p style="font-size:11px; color:${a.stock === 0 ? '#dc2626' : '#d97706'}; font-weight:600;">Quedan ${a.stock} de ${a.stock_min} mín.</p>
                </div>
                <span class="badge ${a.stock === 0 ? 'badge-danger' : 'badge-amber'}" style="font-size:10px; font-weight:800;">
                  ${a.stock === 0 ? 'AGOTADO' : 'BAJO'}
                </span>
              </div>`).join('')}
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// DONUT CHART SVG — Distribución de estados de órdenes
// ─────────────────────────────────────────────────────────────
function generateDonutChart(stats) {
  const total = stats.en_proceso + stats.diagnostico + stats.esperando + stats.finalizado;

  // Si no hay datos, mostrar círculo vacío
  if (total === 0) {
    return `
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r="48" fill="none" stroke="#e2e8f0" stroke-width="14"/>
        <text x="65" y="70" text-anchor="middle" font-size="13" font-weight="700" fill="#94a3b8">Sin datos</text>
      </svg>
    `;
  }

  const segments = [
    { value: stats.en_proceso,   color: '#3b82f6', id: 'donut-proceso'   },
    { value: stats.diagnostico,  color: '#f59e0b', id: 'donut-diag'      },
    { value: stats.esperando,    color: '#8b5cf6', id: 'donut-espera'    },
    { value: stats.finalizado,   color: '#10b981', id: 'donut-final'     },
  ];

  const cx = 65, cy = 65, r = 48;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  // Start at top (rotate -90deg = starts from 12 o'clock)
  const startAngle = -Math.PI / 2;

  let circlesHTML = '';
  segments.forEach(seg => {
    const pct = seg.value / total;
    const arc = pct * circumference;
    // Build stroke-dasharray
    circlesHTML += `
      <circle
        id="${seg.id}"
        cx="${cx}" cy="${cy}" r="${r}"
        fill="none"
        stroke="${seg.color}"
        stroke-width="14"
        stroke-dasharray="0 ${circumference}"
        data-arc="${arc}"
        data-total="${circumference}"
        data-offset="${offset}"
        stroke-linecap="butt"
        style="transition: stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1), stroke-dashoffset 0s; transform-origin: ${cx}px ${cy}px; transform: rotate(-90deg);"
      />
    `;
    offset += arc;
  });

  return `
    <svg width="130" height="130" viewBox="0 0 130 130" style="overflow:visible;">
      <!-- Track -->
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="14"/>
      <!-- Segments (initially invisible, animated via JS) -->
      ${circlesHTML}
      <!-- Center Label -->
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="22" font-weight="900" fill="#0f172a">${total}</text>
      <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="9" font-weight="700" fill="#94a3b8" letter-spacing="1">ÓRDENES</text>
    </svg>
  `;
}

// ─────────────────────────────────────────────────────────────
// GAUGE CHART SVG — Velocímetro semicircular de eficiencia
// ─────────────────────────────────────────────────────────────
function generateGaugeChart(eficiencia) {
  const cx = 100, cy = 90;
  const r = 70;
  const strokeWidth = 14;
  const pct = Math.min(Math.max(eficiencia / 100, 0), 1);

  // Semicircle arc length (180°)
  const arcLength = Math.PI * r;

  // Color based on efficiency level
  let color = '#ef4444'; // red
  if (eficiencia >= 50) color = '#f59e0b'; // amber
  if (eficiencia >= 75) color = '#10b981'; // green

  // Background arc path (half circle, left to right)
  const bgArc = `M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`;

  // Needle angle: maps 0%→-90deg, 100%→+90deg from vertical
  const needleAngleDeg = -90 + pct * 180;
  const needleRad = (needleAngleDeg * Math.PI) / 180;
  const needleLen = r - 10;
  const nx = cx + needleLen * Math.cos(needleRad);
  const ny = cy + needleLen * Math.sin(needleRad);

  return `
    <svg width="200" height="100" viewBox="0 0 200 100" style="overflow: visible;">
      <defs>
        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stop-color="#ef4444"/>
          <stop offset="50%"  stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#10b981"/>
        </linearGradient>
      </defs>

      <!-- Background track -->
      <path d="${bgArc}" fill="none" stroke="#f1f5f9" stroke-width="${strokeWidth}" stroke-linecap="round"/>

      <!-- Gradient arc (full, for visual only) -->
      <path d="${bgArc}" fill="none" stroke="url(#gaugeGradient)" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="0.2"/>

      <!-- Active arc (animated via JS) -->
      <path
        id="gauge-active-arc"
        d="${bgArc}"
        fill="none"
        stroke="${color}"
        stroke-width="${strokeWidth}"
        stroke-linecap="round"
        stroke-dasharray="0 ${arcLength}"
        data-target="${(pct * arcLength).toFixed(2)}"
        data-length="${arcLength.toFixed(2)}"
        style="transition: stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1);"
      />

      <!-- Needle -->
      <line
        id="gauge-needle"
        x1="${cx}" y1="${cy}"
        x2="${cx}" y2="${cy - needleLen}"
        stroke="#0f172a"
        stroke-width="2.5"
        stroke-linecap="round"
        data-angle="${needleAngleDeg}"
        style="transform-origin: ${cx}px ${cy}px; transform: rotate(-90deg); transition: transform 1s cubic-bezier(0.4,0,0.2,1);"
      />

      <!-- Center pivot -->
      <circle cx="${cx}" cy="${cy}" r="5" fill="#0f172a"/>
    </svg>
  `;
}

// ─────────────────────────────────────────────────────────────
// ANIMACIONES — Donut Segments
// ─────────────────────────────────────────────────────────────
function animateDonutSegments() {
  const ids = ['donut-proceso', 'donut-diag', 'donut-espera', 'donut-final'];
  let cumulativeOffset = 0;

  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;

    const arc = parseFloat(el.getAttribute('data-arc') || 0);
    const total = parseFloat(el.getAttribute('data-total') || 1);
    const segOffset = cumulativeOffset;

    // Apply dashoffset so this segment starts where the previous ended
    el.style.strokeDashoffset = -segOffset;

    setTimeout(() => {
      el.style.strokeDasharray = `${arc} ${total - arc}`;
    }, 80 + i * 60);

    cumulativeOffset += arc;
  });
}

// ─────────────────────────────────────────────────────────────
// ANIMACIONES — Gauge Arc + Needle
// ─────────────────────────────────────────────────────────────
function animateGaugeArc(eficiencia) {
  const arc = document.getElementById('gauge-active-arc');
  const needle = document.getElementById('gauge-needle');

  if (arc) {
    const target = parseFloat(arc.getAttribute('data-target') || 0);
    const length = parseFloat(arc.getAttribute('data-length') || 1);
    setTimeout(() => {
      arc.style.strokeDasharray = `${target} ${length - target}`;
    }, 120);
  }

  if (needle) {
    const pct = Math.min(Math.max(eficiencia / 100, 0), 1);
    const angleDeg = -90 + pct * 180;
    setTimeout(() => {
      needle.style.transform = `rotate(${angleDeg}deg)`;
    }, 120);
  }
}

function generateSVGChart(tendencia) {
  if (!tendencia || tendencia.length === 0) {
    return `
      <div style="height:180px; display:flex; align-items:center; justify-content:center; color:var(--slate-5);">
        Falta información de ventas mensuales para mostrar la tendencia.
      </div>
    `;
  }

  const mesesNombres = {
    '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR', '05': 'MAY', '06': 'JUN',
    '07': 'JUL', '08': 'AGO', '09': 'SEP', '10': 'OCT', '11': 'NOV', '12': 'DIC'
  };

  const trendParsed = tendencia.map(t => {
    const parts = t.mes.split('-');
    const m = parts[1] || '01';
    return {
      label: `${mesesNombres[m] || 'ENE'}`,
      ingresos: parseFloat(t.ingresos || 0),
      ordenes: parseInt(t.ordenes || 0)
    };
  });

  const maxIngresos = Math.max(...trendParsed.map(t => t.ingresos), 1000);
  const maxOrdenes = Math.max(...trendParsed.map(t => t.ordenes), 5);

  const width = 600;
  const height = 200;
  const paddingLeft = 50;
  const paddingRight = 40;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const numMonths = trendParsed.length;
  const stepX = chartWidth / (numMonths - 1 || 1);

  // Generar barras para ingresos y línea para órdenes
  let barsHTML = '';
  let linePoints = [];
  let gridsHTML = '';
  let labelsHTML = '';
  let hotspotHTML = '';

  // Grid Horizontal
  for (let i = 0; i <= 4; i++) {
    const yVal = paddingTop + (chartHeight / 4) * i;
    const valueRepresented = (maxIngresos * (1 - i / 4)).toLocaleString('es-PE', { maximumFractionDigits: 0 });
    gridsHTML += `
      <line x1="${paddingLeft}" y1="${yVal}" x2="${width - paddingRight}" y2="${yVal}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4,4" />
      <text x="${paddingLeft - 8}" y="${yVal + 4}" fill="rgba(255,255,255,0.4)" font-size="8" text-anchor="end">S/ ${valueRepresented}</text>
    `;
  }

  trendParsed.forEach((t, i) => {
    const x = paddingLeft + i * stepX;
    
    // Altura barra ingresos
    const barHeight = (t.ingresos / maxIngresos) * chartHeight;
    const barY = paddingTop + chartHeight - barHeight;
    const barWidth = 18;

    barsHTML += `
      <rect x="${x - barWidth/2}" y="${barY}" width="${barWidth}" height="${barHeight}" fill="url(#revGradient)" rx="4" />
    `;

    // Punto de la línea de órdenes
    const lineY = paddingTop + chartHeight - (t.ordenes / maxOrdenes) * chartHeight;
    linePoints.push(`${x},${lineY}`);

    // Etiquetas X
    labelsHTML += `
      <text x="${x}" y="${height - 10}" fill="rgba(255,255,255,0.6)" font-size="10" font-weight="700" text-anchor="middle">${t.label}</text>
    `;

    // Hotspot interactivo invisible
    hotspotHTML += `
      <rect x="${x - stepX/2 || paddingLeft}" y="${paddingTop}" width="${stepX}" height="${chartHeight}" fill="transparent" 
        class="chart-hotspot" data-index="${i}" style="cursor:pointer;" />
    `;
  });

  const polylinePoints = linePoints.join(' ');

  return `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="min-width: 500px; display: block; overflow: visible;">
      <defs>
        <!-- Degradado para Barras de Ingresos -->
        <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="1" />
          <stop offset="100%" stop-color="#059669" stop-opacity="0.2" />
        </linearGradient>
        <!-- Degradado para la Línea de Órdenes -->
        <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.4" />
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0" />
        </linearGradient>
      </defs>

      <!-- Líneas de rejilla -->
      ${gridsHTML}

      <!-- Barras de ingresos -->
      ${barsHTML}

      <!-- Área bajo la línea de órdenes -->
      <polygon points="${paddingLeft},${paddingTop + chartHeight} ${polylinePoints} ${paddingLeft + (numMonths-1)*stepX},${paddingTop + chartHeight}" fill="url(#lineGlow)" />

      <!-- Línea de órdenes -->
      <polyline points="${polylinePoints}" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Puntos de la línea -->
      ${linePoints.map((pt, i) => `
        <circle cx="${pt.split(',')[0]}" cy="${pt.split(',')[1]}" r="4" fill="#ffffff" stroke="#3b82f6" stroke-width="2.5" />
      `).join('')}

      <!-- Etiquetas del eje X -->
      ${labelsHTML}

      <!-- Hotspots invisibles para interacciones -->
      ${hotspotHTML}
    </svg>
  `;
}

function animateDashboardStats(stats) {
  // Animación del número de cobros del mes
  animateValue("kpi-cobros", 0, stats.cobrados_mes, 800, "S/ ", "", 2);
  
  // Animación de eficiencia operativa
  animateValue("kpi-eficiencia", 0, stats.eficiencia_operativa, 800, "", "%", 0);
  
  // Animación de ticket promedio
  animateValue("kpi-ticket", 0, stats.ticket_promedio, 800, "S/ ", "", 2);

  // Animación de vehículos activos
  const totalActivos = stats.en_proceso + stats.diagnostico + stats.esperando;
  animateValue("kpi-activos", 0, totalActivos, 600, "", "", 0);

  // Animación de nuevos clientes
  animateValue("kpi-clientes", 0, stats.clientes_nuevos_mes, 600, "", "", 0);

  // Animación de cuentas por cobrar
  animateValue("kpi-pendientes", 0, stats.pendientes_total, 800, "S/ ", "", 2);

  // Animación de barras de progreso de servicios
  setTimeout(() => {
    document.querySelectorAll('.progress-bar').forEach(el => {
      const pct = el.getAttribute('data-pct');
      el.style.width = pct + '%';
    });
  }, 100);
}

function animateValue(id, start, end, duration, prefix = '', suffix = '', decimals = 0) {
  const obj = document.getElementById(id);
  if (!obj) return;
  
  if (end === 0) {
    obj.innerHTML = prefix + (0).toFixed(decimals) + suffix;
    return;
  }

  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const val = progress * (end - start) + start;
    obj.innerHTML = prefix + val.toLocaleString('es-PE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }) + suffix;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

function setupChartInteractivity(tendencia) {
  const hotspots = document.querySelectorAll('.chart-hotspot');
  const tooltip = document.getElementById('svg-chart-tooltip');
  const chartContainer = document.querySelector('.chart-container');

  if (!hotspots.length || !tooltip || !chartContainer) return;

  const mesesNombresCompletos = {
    '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril', '05': 'Mayo', '06': 'Junio',
    '07': 'Julio', '08': 'Agosto', '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
  };

  hotspots.forEach(el => {
    el.addEventListener('mouseenter', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'));
      const data = tendencia[idx];
      if (!data) return;

      const parts = data.mes.split('-');
      const mesNombre = mesesNombresCompletos[parts[1]] || 'Enero';
      const anio = parts[0] || '';

      tooltip.innerHTML = `
        <div style="font-weight:900; margin-bottom:4px; text-transform:uppercase; color:var(--brand);">${mesNombre} ${anio}</div>
        <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:2px;">
          <span style="color:var(--slate-6);">Ingresos:</span>
          <span style="font-weight:bold; color:var(--white);">S/ ${parseFloat(data.ingresos || 0).toLocaleString('es-PE', {minimumFractionDigits:2})}</span>
        </div>
        <div style="display:flex; justify-content:space-between; gap:12px;">
          <span style="color:var(--slate-6);">Órdenes:</span>
          <span style="font-weight:bold; color:#3b82f6;">${data.ordenes} servicios</span>
        </div>
      `;
      tooltip.style.display = 'block';
    });

    el.addEventListener('mousemove', (e) => {
      const rect = chartContainer.getBoundingClientRect();
      const x = e.clientX - rect.left + 15;
      const y = e.clientY - rect.top - 70;
      
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
    });

    el.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}

export function destroy() {
  // Limpieza de event listeners si fuera necesario
}

