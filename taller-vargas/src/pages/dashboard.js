import { getDashboard } from '../api.js';

export async function init(container) {
  container.innerHTML = `<div class="fade-in" id="dashboard-root"></div>`;
  const root = document.getElementById('dashboard-root');

  // Render skeleton mientras carga
  root.innerHTML = renderSkeleton();

  try {
    const data = await getDashboard();
    root.innerHTML = renderDashboard(data);
  } catch (err) {
    root.innerHTML = renderError(err.message);
  }
}

function renderSkeleton() {
  return `
    <div class="mb-6">
      <div style="height:28px;width:220px;background:var(--slate-8);border-radius:8px;margin-bottom:8px"></div>
      <div style="height:16px;width:300px;background:var(--slate-9);border-radius:6px"></div>
    </div>
    <div class="grid grid-cols-4 gap-4 mb-6">
      ${Array(4).fill('<div style="height:120px;background:var(--white);border-radius:20px;border:1px solid var(--slate-8)"></div>').join('')}
    </div>`;
}

function renderError(msg) {
  return `
    <div class="card" style="max-width:480px;margin:40px auto;">
      <div class="card-body text-center" style="padding:48px 24px;">
        <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
        <p style="font-weight:800;color:var(--dark);margin-bottom:8px;">No se pudo conectar al servidor</p>
        <p style="font-size:13px;color:var(--slate-5);margin-bottom:20px;">${msg}</p>
        <button class="btn-primary" onclick="location.reload()">Reintentar</button>
      </div>
    </div>`;
}

function renderDashboard({ stats, alertas_stock, ordenes_recientes }) {
  const date = new Date().toLocaleDateString('es-PE', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  const estadoBadge = (estado) => {
    const map = {
      'En Proceso':          'badge-blue',
      'Diagnóstico':         'badge-amber',
      'Esperando Repuestos': 'badge-purple',
      'Finalizado':          'badge-emerald',
      'No realizó el servicio': 'badge-slate',
    };
    return `<span class="badge ${map[estado] || 'badge-slate'}">${estado}</span>`;
  };

  return `
    <!-- Header -->
    <div class="flex items-center justify-between mb-6" style="flex-wrap:wrap;gap:16px;">
      <div>
        <h1 style="font-size:22px;font-weight:900;color:var(--dark);text-transform:uppercase;letter-spacing:-.5px;">Estado del Taller</h1>
        <p style="font-size:13px;color:var(--slate-5);margin-top:2px;">Resumen operativo al <strong>${date}</strong></p>
      </div>
      <button class="btn-primary" onclick="navigate('/ordenes')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
        Nueva Orden
      </button>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-4 gap-4 mb-6" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));">
      
      <div class="stat-card">
        <div class="flex items-center justify-between mb-3">
          <div style="padding:10px;background:#eff6ff;border-radius:12px;color:#1d4ed8;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <span class="badge badge-blue">ACTIVOS</span>
        </div>
        <p style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--slate-5);margin-bottom:4px;">En Proceso</p>
        <p style="font-size:32px;font-weight:900;color:var(--dark);line-height:1;">${stats.en_proceso} <span style="font-size:16px;font-weight:500;color:var(--slate-6);">Autos</span></p>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between mb-3">
          <div style="padding:10px;background:#fef3c7;border-radius:12px;color:#b45309;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <span class="badge badge-amber">PENDIENTES</span>
        </div>
        <p style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--slate-5);margin-bottom:4px;">Por Diagnosticar</p>
        <p style="font-size:32px;font-weight:900;color:var(--dark);line-height:1;">${String(stats.diagnostico).padStart(2,'0')} <span style="font-size:16px;font-weight:500;color:var(--slate-6);">Espera</span></p>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between mb-3">
          <div style="padding:10px;background:#d1fae5;border-radius:12px;color:#065f46;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <span class="badge badge-emerald">LISTOS</span>
        </div>
        <p style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--slate-5);margin-bottom:4px;">Para Entrega</p>
        <p style="font-size:32px;font-weight:900;color:var(--dark);line-height:1;">${String(stats.finalizado).padStart(2,'0')} <span style="font-size:16px;font-weight:500;color:var(--slate-6);">Completos</span></p>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between mb-3">
          <div style="padding:10px;background:var(--dark);border-radius:12px;color:var(--brand);">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </div>
          <span class="badge badge-slate">MES ACTUAL</span>
        </div>
        <p style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--slate-5);margin-bottom:4px;">Ingresos Estimados</p>
        <p style="font-size:28px;font-weight:900;color:var(--dark);line-height:1;font-family:'Courier New',monospace;">S/ ${stats.ingresos_mes.toLocaleString('es-PE',{minimumFractionDigits:2})}</p>
      </div>
    </div>

    <!-- Bottom Grid -->
    <div class="grid gap-6" style="grid-template-columns: 2fr 1fr;">

      <!-- Órdenes Recientes -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Órdenes Recientes</span>
          <button class="btn-ghost" style="font-size:12px;padding:5px 10px;" onclick="navigate('/ordenes')">Ver todas →</button>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead><tr>
              <th>Placa</th>
              <th>Vehículo</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th class="text-right">Costo Est.</th>
            </tr></thead>
            <tbody>
              ${ordenes_recientes.length ? ordenes_recientes.map(o => `
                <tr>
                  <td><span class="placa-badge">${o.placa || '—'}</span></td>
                  <td style="font-weight:700;color:var(--dark);">${o.vehiculo || '—'}</td>
                  <td style="color:var(--slate-5);font-style:italic;">${o.cliente || '—'}</td>
                  <td>${estadoBadge(o.estado)}</td>
                  <td class="text-right font-bold font-mono">S/ ${parseFloat(o.total_estimado||0).toFixed(2)}</td>
                </tr>`).join('') 
              : `<tr><td colspan="5" class="td-empty">No hay órdenes registradas</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Alertas de Stock -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Alertas de Stock</span>
          <button class="btn-ghost" style="font-size:12px;padding:5px 10px;" onclick="navigate('/almacen')">Ver almacén →</button>
        </div>
        <div class="card-body" style="padding:16px;">
          ${alertas_stock.length === 0
            ? `<div style="text-align:center;padding:24px;color:var(--slate-5);">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 8px;color:var(--brand);display:block;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <p style="font-weight:700;font-size:13px;">Todo el stock está en orden</p>
              </div>`
            : alertas_stock.map(a => `
              <div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:12px;margin-bottom:8px;background:${a.stock === 0 ? '#fef2f2' : '#fffbeb'};border:1px solid ${a.stock === 0 ? '#fecaca' : '#fde68a'};">
                <div style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:${a.stock === 0 ? '#fee2e2' : '#fef3c7'};color:${a.stock === 0 ? '#dc2626' : '#b45309'};">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                </div>
                <div>
                  <p style="font-size:12px;font-weight:800;text-transform:uppercase;color:${a.stock === 0 ? '#7f1d1d' : '#78350f'};">${a.descripcion.substring(0,30)}${a.descripcion.length>30?'...':''}</p>
                  <p style="font-size:11px;color:${a.stock === 0 ? '#dc2626' : '#d97706'};">Quedan ${a.stock} unidades (mín: ${a.stock_min})</p>
                </div>
              </div>`).join('')}
        </div>
      </div>
    </div>
  `;
}
