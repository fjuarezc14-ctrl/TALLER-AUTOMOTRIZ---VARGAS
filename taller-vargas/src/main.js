import { navigate } from './router.js';
import { getAlertasStock, getOrdenes, logout, buscarGlobal } from './api.js';
import { debounce } from './utils.js';
import { createIcons, icons } from 'lucide';
import { store } from './store.js';

// Helper global para verificar si el usuario logueado es Administrador
window.isAdminAuthorized = () => {
  const userStr = localStorage.getItem('vargas_user');
  if (!userStr) return false;
  try {
    const user = JSON.parse(userStr);
    return user && user.rol === 'administrador';
  } catch (_) {
    return false;
  }
};

// ── Inicialización ────────────────────────────────────────
async function init() {
  // Actualizar UI de usuario autenticado
  updateUserSidebar();

  // Ruta inicial según URL actual
  const path = window.location.pathname;
  await navigate(path);

  // Cargar alertas de stock para el badge
  await refreshStockAlerts();

  // Refrescar alertas cada 60s
  setInterval(refreshStockAlerts, 60_000);

  // Inicializar buscador global predictivo
  initGlobalSearch();
}

// ── Actualizar sidebar con datos del usuario logueado ─────
function updateUserSidebar() {
  const userStr = localStorage.getItem('vargas_user');
  if (!userStr) {
    const avatarEl   = document.getElementById('sidebar-avatar');
    const usernameEl = document.getElementById('sidebar-username');
    const userroleEl = document.getElementById('sidebar-userrole');
    if (avatarEl)   avatarEl.textContent   = 'US';
    if (usernameEl) usernameEl.textContent = 'Usuario';
    if (userroleEl) userroleEl.textContent = 'Taller Vargas';
    return;
  }
  try {
    const user = JSON.parse(userStr);
    const avatarEl   = document.getElementById('sidebar-avatar');
    const usernameEl = document.getElementById('sidebar-username');
    const userroleEl = document.getElementById('sidebar-userrole');
    if (avatarEl)   avatarEl.textContent   = (user.username || 'U').slice(0, 2).toUpperCase();
    if (usernameEl) usernameEl.textContent = user.username || 'Usuario';
    const isOperario = user.rol === 'operario';
    if (userroleEl) userroleEl.textContent = isOperario ? 'Operario / Taller' : 'Administrador';

    // Ocultar botón de Dashboard para operarios (inician y trabajan en su portal de taller)
    const dashBtn = document.querySelector('button[data-route="/"]');
    if (dashBtn) {
      dashBtn.style.display = isOperario ? 'none' : '';
    }

    // Ocultar botón de facturación para operarios
    const facBtn = document.querySelector('button[data-route="/facturacion"]');
    if (facBtn) {
      facBtn.style.display = isOperario ? 'none' : '';
    }

    // Ocultar botón de usuarios para operarios
    const usrBtn = document.getElementById('sidebar-btn-usuarios');
    if (usrBtn) {
      usrBtn.style.display = isOperario ? 'none' : '';
    }

    // Para operarios, asegurar que el grupo de Taller siempre esté desplegado
    if (isOperario) {
      const groupTaller = document.getElementById('group-taller');
      if (groupTaller && !groupTaller.classList.contains('open')) {
        groupTaller.classList.add('open');
        const hdr = groupTaller.previousElementSibling;
        if (hdr) hdr.classList.add('open');
      }
    }
  } catch (_) {}
}
window.updateUserSidebar = updateUserSidebar;

// ── Cerrar sesión ─────────────────────────────────────────
window.doLogout = function() {
  if (!confirm('¿Deseas cerrar sesión?')) return;
  logout();
  navigate('/login');
};

// ── Alertas de stock globales ─────────────────────────────
window.refreshStockAlerts = refreshStockAlerts;
async function refreshStockAlerts() {
  try {
    const alertas = await getAlertasStock();
    const badge   = document.getElementById('bell-badge');
    const sideAlert = document.getElementById('sidebar-stock-alert');
    const sideCount = document.getElementById('sidebar-alert-count');

    if (alertas.length > 0) {
      if (badge)    { badge.textContent = alertas.length; badge.classList.remove('hidden'); }
      if (sideAlert) sideAlert.classList.remove('hidden');
      if (sideCount) sideCount.textContent = `${alertas.length} producto(s) bajo mínimo`;
    } else {
      if (badge)    badge.classList.add('hidden');
      if (sideAlert) sideAlert.classList.add('hidden');
    }
  } catch (_) {
    // Backend puede no estar disponible aún
  }
}

// ── Sidebar móvil ─────────────────────────────────────────
window.toggleSidebar = function() {
  const sidebar  = document.getElementById('sidebar-menu');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.toggle('sidebar-open');
  if (backdrop) backdrop.classList.toggle('hidden');
};

// Exponer función de toggle de submenú en el sidebar
window.toggleSubmenu = function(id, btnEl) {
  const submenu = document.getElementById(id);
  if (submenu) {
    const isOpen = submenu.classList.contains('open');
    if (isOpen) {
      submenu.classList.remove('open');
      if (btnEl) btnEl.classList.remove('open');
    } else {
      submenu.classList.add('open');
      if (btnEl) btnEl.classList.add('open');
    }
  }
};

// ── Sistema Global de Toast Notifications ─────────────────
window.showToast = function(message, type = 'success') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = 'position:fixed; top:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:10px; pointer-events:none;';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.style.cssText = `background:${bgColor}; color:white; padding:12px 18px; border-radius:10px; font-weight:600; font-size:13px; box-shadow:0 10px 25px rgba(0,0,0,0.2); display:flex; align-items:center; gap:10px; pointer-events:auto; transition:all 0.3s ease; font-family:Inter, sans-serif;`;
  toast.innerHTML = `<span style="font-weight:900; background:rgba(255,255,255,0.2); width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px;">${icon}</span> <span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

// ── Impresión de Ticket Térmico 80mm ────────────────────────
window.imprimirTicketTermico = function(cobro) {
  if (!cobro) return;
  
  // Abrir ventana emergente perfectamente centrada en la pantalla
  const w = 440;
  const h = 760;
  const left = Math.max(0, Math.round((window.screen.availWidth - w) / 2));
  const top = Math.max(0, Math.round((window.screen.availHeight - h) / 2));
  const printWindow = window.open('', '_blank', `width=${w},height=${h},top=${top},left=${left},scrollbars=yes,resizable=yes`);
  if (!printWindow) return alert('Por favor permite las ventanas emergentes en tu navegador para imprimir tickets.');
  
  const totalOriginal = parseFloat(cobro.monto_total || 0);
  const totalNeto = parseFloat(cobro.monto_neto !== null && cobro.monto_neto !== undefined ? cobro.monto_neto : totalOriginal);
  const hasAjuste = totalOriginal !== totalNeto;

  const items = Array.isArray(cobro.items) && cobro.items.length > 0 ? cobro.items : [];
  const itemsHTML = items.map(i => {
    const cant = parseFloat(i.cantidad) || 1;
    const pu = parseFloat(i.precio_unitario) || 0;
    const sub = parseFloat(i.subtotal || (cant * pu));
    const desc = (i.descripcion || 'Servicio Mecánico').toUpperCase();
    return `
      <tr>
        <td style="text-align:left;padding:3px 2px;word-break:break-word;vertical-align:top;">${desc}</td>
        <td style="text-align:center;padding:3px 2px;vertical-align:top;">${cant}</td>
        <td style="text-align:right;padding:3px 2px;vertical-align:top;white-space:nowrap;">S/ ${sub.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const now = new Date();
  const fechaStr = now.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaStr = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Ticket ${cobro.comprobante_numero || 'TICKET'}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        * {
          box-sizing: border-box;
          font-family: 'Courier New', Courier, monospace !important;
          color: #000000 !important;
          font-weight: 700 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          width: 74mm;
          max-width: 74mm;
          margin: 0 auto;
          padding: 8px 4px;
          background: #ffffff;
          font-size: 12px;
          line-height: 1.35;
          color: #000000 !important;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .border-dashed { border-bottom: 1.5px dashed #000000; margin: 6px 0; }
        .border-double { border-bottom: 2.5px solid #000000; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
        table th, table td { padding: 3px 0; }
        .no-print {
          background: #f1f5f9;
          border-bottom: 2px solid #000000;
          padding: 10px;
          margin: -8px -4px 14px -4px;
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        .no-print button {
          font-family: system-ui, -apple-system, sans-serif !important;
          font-size: 12px;
          font-weight: 700 !important;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-prn { background: #000000; color: #ffffff !important; border: 2px solid #000000; }
        .btn-cls { background: #ffffff; color: #000000 !important; border: 2px solid #000000; }
        @media print {
          .no-print { display: none !important; }
          html, body {
            width: 74mm !important;
            max-width: 74mm !important;
            margin: 0 auto !important;
            padding: 2mm 0 !important;
          }
        }
      </style>
      <script>
        window.onafterprint = function() {
          window.close();
        };
        window.onload = function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 350);
        };
      </script>
    </head>
    <body>
      <div class="no-print">
        <button class="btn-prn" onclick="window.print()">🖨️ IMPRIMIR TICKET</button>
        <button class="btn-cls" onclick="window.close()">✕ CERRAR</button>
      </div>

      <div class="text-center">
        <div style="font-size:13.5px;letter-spacing:-0.2px;line-height:1.2;">INVERSIONES Y SERVICIOS VARGAS E.I.R.L.</div>
        <div style="font-size:12px;margin:2px 0;">RUC: 20608226066</div>
        <div style="font-size:11px;margin:2px 0;">JR. REYNA FARGE N° 648 - CAJAMARCA</div>
        <div style="font-size:11px;margin:2px 0;">TEL: 931 163 369 · 976 864 137</div>
        <div class="border-double"></div>
        <div style="font-size:13px;margin:3px 0;">${(cobro.tipo_comprobante || 'RECIBO').toUpperCase()}: ${cobro.comprobante_numero || 'RI-0001'}</div>
        <div style="font-size:11px;margin:2px 0;">FECHA: ${fechaStr}   HORA: ${horaStr}</div>
        <div class="border-dashed"></div>
      </div>

      <div class="text-left" style="font-size:11.5px;line-height:1.45;">
        <div>CLIENTE: ${(cobro.cliente_nombre || 'CLIENTE GENERAL').toUpperCase()}</div>
        ${cobro.num_doc ? `<div>${(cobro.tipo_doc || 'DOC').toUpperCase()}: ${cobro.num_doc}</div>` : ''}
        ${cobro.placa ? `<div>VEHÍCULO/PLACA: ${cobro.placa.toUpperCase()}</div>` : ''}
        ${cobro.orden_numero ? `<div>ORDEN SERVICIO: OT-${String(cobro.orden_numero).padStart(4,'0')}</div>` : ''}
      </div>

      <div class="border-dashed"></div>
      <table>
        <thead>
          <tr style="border-bottom:1.5px solid #000000;">
            <th style="text-align:left;font-size:11px;">DESCRIPCIÓN</th>
            <th style="text-align:center;font-size:11px;width:35px;">CANT</th>
            <th style="text-align:right;font-size:11px;width:60px;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML || '<tr><td colspan="3" style="text-align:center;padding:6px 0;">SERVICIOS DE REPARACIÓN Y MANTENIMIENTO</td></tr>'}
        </tbody>
      </table>
      <div class="border-dashed"></div>

      ${hasAjuste ? `
      <div style="font-size:11.5px;line-height:1.45;">
        <div style="display:flex;justify-content:space-between;">
          <span>SUBTOTAL ESTIMADO:</span>
          <span>S/ ${totalOriginal.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>${cobro.descuento_tipo && cobro.descuento_tipo.startsWith('Cargo') ? 'RECARGO ADICIONAL:' : 'DESCUENTO APLICADO:'}</span>
          <span>S/ ${parseFloat(cobro.descuento_realizado || 0).toFixed(2)}</span>
        </div>
      </div>
      <div class="border-dashed"></div>
      ` : ''}

      <div style="font-size:14px;display:flex;justify-content:space-between;margin:5px 0;">
        <span>TOTAL A PAGAR:</span>
        <span>S/ ${totalNeto.toFixed(2)}</span>
      </div>

      <div style="font-size:11.5px;margin-top:6px;line-height:1.45;">
        <div>FORMA DE PAGO: ${(cobro.metodo_pago || 'EFECTIVO').toUpperCase()}</div>
        <div>ESTADO: CANCELADO / PAGADO</div>
      </div>

      <div class="border-double"></div>
      <div class="text-center" style="font-size:11px;margin-top:6px;line-height:1.4;">
        <div>¡GRACIAS POR SU PREFERENCIA!</div>
        <div style="font-size:10px;margin-top:2px;">CONSERVE ESTE TICKET COMO CONSTANCIA</div>
        <div style="font-size:9.5px;margin-top:3px;">TALLER AUTOMOTRIZ VARGAS · CAJAMARCA</div>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
};

// Cerrar ventanas emergentes (modales) al presionar la tecla Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // 1. Modales estándar con clase .modal-overlay
    const activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) {
      const closeBtn = activeModal.querySelector('.modal-close');
      if (closeBtn) {
        closeBtn.click();
        return;
      }

      const cancelBtn = activeModal.querySelector('button[id*="cancel"], button[id*="close"]');
      if (cancelBtn) {
        cancelBtn.click();
        return;
      }

      activeModal.classList.remove('active');
      return;
    }

    // 2. Modales de operaciones con clase .ops-modal-overlay
    const activeOpsModal = document.querySelector('.ops-modal-overlay');
    if (activeOpsModal) {
      const cancelBtn = activeOpsModal.querySelector('button[id*="cancel"]');
      if (cancelBtn) {
        cancelBtn.click();
        return;
      }
      
      const modales = document.getElementById('ops-modales');
      if (modales) modales.innerHTML = '';
    }
  }
});

// Redefinir window.alert globalmente para mostrar notificaciones Toast autodesvanecibles
window.alert = function(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:380px;width:calc(100% - 48px);';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  
  let type = 'info';
  let icon = 'ℹ️';
  let cleanMessage = message;

  // Clasificar tipo según contenido
  if (message.includes('✅') || message.toLowerCase().includes('éxito') || message.toLowerCase().includes('correctamente') || message.toLowerCase().includes('confirmada')) {
    type = 'success';
    icon = '🟢';
    cleanMessage = message.replace('✅', '').trim();
  } else if (message.includes('❌') || message.includes('⚠️') || message.toLowerCase().includes('error') || message.toLowerCase().includes('fallo') || message.toLowerCase().includes('no puedes') || message.toLowerCase().includes('no hay')) {
    type = 'error';
    icon = '🔴';
    cleanMessage = message.replace('❌', '').replace('⚠️', '').trim();
  } else if (message.includes('🔄') || message.includes('💾')) {
    type = 'success';
    icon = '🟢';
    cleanMessage = message.replace('🔄', '').replace('💾', '').trim();
  }

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-message">${cleanMessage}</div>
  `;
  
  toast.classList.add(type);
  container.appendChild(toast);

  // Desvanecer automáticamente tras 3.5 segundos
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
      if (container.childElementCount === 0) {
        container.remove();
      }
    });
  }, 3500);
};

// ── Buscador Global Predictivo Multientidad (Fase 4) ────────────────────
let selectedSearchIndex = -1;
let currentSearchSeq = 0;

function initGlobalSearch() {
  const searchInput = document.getElementById('global-search-input');
  const resultsContainer = document.getElementById('global-search-results');
  
  if (!searchInput || !resultsContainer) return;
  
  const ejecutarBusqueda = async () => {
    const query = searchInput.value.trim().toUpperCase();
    if (!query || query.length < 2) {
      resultsContainer.classList.add('hidden');
      resultsContainer.innerHTML = '';
      return;
    }

    const thisSeq = ++currentSearchSeq;
    resultsContainer.innerHTML = `
      <div style="padding:12px 14px;font-size:12px;color:var(--slate-5);display:flex;align-items:center;gap:8px;">
        <div class="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        Buscando "${query}"...
      </div>`;
    resultsContainer.classList.remove('hidden');

    try {
      const data = await buscarGlobal(query);
      if (thisSeq !== currentSearchSeq) return;

      const vehMatches = (data.vehiculos || []).map(v => ({
        tipo: 'vehiculo',
        badge: '🚗 VEHÍCULO',
        badgeColor: 'var(--brand)',
        titulo: `${v.placa} · ${v.marca_modelo || ''}`,
        subtitulo: `👤 ${v.cliente_nombre || 'Sin cliente asignado'}${v.anio ? ' · ' + v.anio : ''}`,
        actionUrl: `/vehiculos?abrir=${v.id}`,
        id: v.id
      }));

      const cliMatches = (data.clientes || []).map(c => ({
        tipo: 'cliente',
        badge: '👤 CLIENTE',
        badgeColor: '#2563eb',
        titulo: c.nombre,
        subtitulo: `${c.tipo_doc || 'DOC'}: ${c.num_doc || '—'} · 📞 ${c.telefono || '—'}`,
        actionUrl: `/clientes?abrir=${c.id}`,
        id: c.id
      }));

      const ordMatches = (data.ordenes || []).map(o => ({
        tipo: 'orden',
        badge: `📋 ORDEN #${o.id}`,
        badgeColor: '#10b981',
        titulo: `OS-${o.id} · ${o.placa || 'Sin placa'}`,
        subtitulo: `${o.cliente || '—'} · Estado: ${o.estado || '—'}${o.total_estimado ? ' · S/ ' + parseFloat(o.total_estimado).toFixed(2) : ''}`,
        actionUrl: `/ordenes?abrir=${o.id}`,
        id: o.id
      }));

      const allMatches = [...vehMatches, ...cliMatches, ...ordMatches];

      if (allMatches.length === 0) {
        resultsContainer.innerHTML = `<div style="padding:12px 14px;font-size:11px;color:var(--slate-5);text-align:center;">⚠️ Sin coincidencias para "<strong>${query}</strong>"</div>`;
        resultsContainer.classList.remove('hidden');
        selectedSearchIndex = -1;
        return;
      }

      selectedSearchIndex = -1;
      resultsContainer.innerHTML = allMatches.map((m, index) => `
        <div class="search-result-item" data-url="${m.actionUrl}" data-index="${index}" style="padding:9px 12px;border-bottom:1px solid var(--slate-8);cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background 0.1s;background:var(--white);">
          <div style="min-width:0;flex:1;padding-right:8px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
              <span style="font-size:9px;font-weight:800;padding:1px 6px;border-radius:4px;background:var(--slate-9);color:${m.badgeColor};border:1px solid var(--slate-8);letter-spacing:0.5px;">${m.badge}</span>
              <span style="font-size:12px;font-weight:700;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.titulo}</span>
            </div>
            <div style="font-size:11px;color:var(--slate-5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${m.subtitulo}
            </div>
          </div>
          <div style="font-size:11px;color:var(--slate-4);flex-shrink:0;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>
          </div>
        </div>
      `).join('');
      resultsContainer.classList.remove('hidden');

      resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const url = item.dataset.url;
          navigate(url);
          searchInput.value = '';
          resultsContainer.classList.add('hidden');
        });

        item.addEventListener('mouseenter', () => {
          highlightSearchItem(parseInt(item.dataset.index, 10));
        });
      });
    } catch (err) {
      if (thisSeq !== currentSearchSeq) return;
      resultsContainer.innerHTML = `<div style="padding:12px 14px;font-size:11px;color:#ef4444;text-align:center;">Error al buscar: ${err.message}</div>`;
      resultsContainer.classList.remove('hidden');
    }
  };

  searchInput.addEventListener('input', debounce(ejecutarBusqueda, 180));
  
  searchInput.addEventListener('keydown', (e) => {
    const items = resultsContainer.querySelectorAll('.search-result-item');
    if (resultsContainer.classList.contains('hidden') || items.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedSearchIndex = (selectedSearchIndex + 1) % items.length;
      highlightSearchItem(selectedSearchIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedSearchIndex = (selectedSearchIndex - 1 + items.length) % items.length;
      highlightSearchItem(selectedSearchIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSearchIndex >= 0 && selectedSearchIndex < items.length) {
        items[selectedSearchIndex].click();
      }
    } else if (e.key === 'Escape') {
      resultsContainer.classList.add('hidden');
      searchInput.blur();
    }
  });
  
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
      resultsContainer.classList.add('hidden');
    }
  });
  
  function highlightSearchItem(index) {
    selectedSearchIndex = index;
    const items = resultsContainer.querySelectorAll('.search-result-item');
    items.forEach((item, idx) => {
      const isSelected = idx === index;
      item.style.background = isSelected ? 'var(--slate-9)' : 'var(--white)';
      if (isSelected) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }
}


init().catch(console.error);
