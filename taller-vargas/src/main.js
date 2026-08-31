import { navigate } from './router.js';
import { getAlertasStock, getVehiculos, getClientes, getOrdenes, logout } from './api.js';
import { debounce } from './utils.js';
import { createIcons, icons } from 'lucide';

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
    if (userroleEl) userroleEl.textContent = user.rol === 'administrador' ? 'Administrador' : 'Operario';

    // Ocultar botón de facturación para operarios
    const facBtn = document.querySelector('button[data-route="/facturacion"]');
    if (facBtn) {
      facBtn.style.display = user.rol === 'administrador' ? '' : 'none';
    }

    // Ocultar botón de usuarios para operarios
    const usrBtn = document.getElementById('sidebar-btn-usuarios');
    if (usrBtn) {
      usrBtn.style.display = user.rol === 'administrador' ? '' : 'none';
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
  sidebar.classList.toggle('sidebar-open');
  backdrop.classList.toggle('hidden');
};

// Exponer función de toggle de submenú en el sidebar
window.toggleSubmenu = function(id, btnEl) {
  const submenu = document.getElementById(id);
  if (submenu) {
    const isOpen = submenu.classList.contains('open');
    if (isOpen) {
      submenu.classList.remove('open');
      btnEl.classList.remove('open');
    } else {
      submenu.classList.add('open');
      btnEl.classList.add('open');
    }
  }
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
let globalSearchCache = {
  vehiculos: [],
  clientes: [],
  ordenes: [],
  lastFetch: 0
};
let selectedSearchIndex = -1;

async function fetchGlobalSearchData() {
  const now = Date.now();
  if (globalSearchCache.lastFetch && (now - globalSearchCache.lastFetch < 20000)) return;
  try {
    const [v, c, o] = await Promise.all([
      getVehiculos().catch(() => []),
      getClientes().catch(() => []),
      getOrdenes().catch(() => [])
    ]);
    globalSearchCache = {
      vehiculos: v || [],
      clientes: c || [],
      ordenes: o || [],
      lastFetch: now
    };
  } catch (e) {
    console.error('Error al precargar datos para buscador global:', e);
  }
}

function initGlobalSearch() {
  const searchInput = document.getElementById('global-search-input');
  const resultsContainer = document.getElementById('global-search-results');
  
  if (!searchInput || !resultsContainer) return;
  
  searchInput.addEventListener('focus', fetchGlobalSearchData);
  
  const ejecutarBusqueda = () => {
    const query = searchInput.value.trim().toUpperCase();
    if (!query) {
      resultsContainer.classList.add('hidden');
      resultsContainer.innerHTML = '';
      return;
    }
    
    // 1. Coincidencias en Vehículos
    const vehMatches = (globalSearchCache.vehiculos || []).filter(v => 
      (v.placa && v.placa.toUpperCase().includes(query)) ||
      (v.marca_modelo && v.marca_modelo.toUpperCase().includes(query)) ||
      (v.vin && v.vin.toUpperCase().includes(query)) ||
      (v.cliente_nombre && v.cliente_nombre.toUpperCase().includes(query))
    ).slice(0, 4).map(v => ({
      tipo: 'vehiculo',
      badge: '🚗 VEHÍCULO',
      badgeColor: 'var(--brand)',
      titulo: `${v.placa} · ${v.marca_modelo || ''}`,
      subtitulo: `👤 ${v.cliente_nombre || 'Sin cliente asignado'}${v.anio ? ' · ' + v.anio : ''}`,
      actionUrl: `/vehiculos?abrir=${v.id}`,
      id: v.id
    }));

    // 2. Coincidencias en Clientes
    const cliMatches = (globalSearchCache.clientes || []).filter(c => 
      (c.nombre && c.nombre.toUpperCase().includes(query)) ||
      (c.num_doc && c.num_doc.toUpperCase().includes(query)) ||
      (c.telefono && c.telefono.includes(query)) ||
      (c.correo && c.correo.toUpperCase().includes(query))
    ).slice(0, 4).map(c => ({
      tipo: 'cliente',
      badge: '👤 CLIENTE',
      badgeColor: '#2563eb',
      titulo: c.nombre,
      subtitulo: `${c.tipo_doc || 'DOC'}: ${c.num_doc || '—'} · 📞 ${c.telefono || '—'}`,
      actionUrl: `/clientes?abrir=${c.id}`,
      id: c.id
    }));

    // 3. Coincidencias en Órdenes de Servicio
    const ordMatches = (globalSearchCache.ordenes || []).filter(o => 
      o.id.toString().includes(query.replace('OS-', '').replace('OS', '')) ||
      (o.placa && o.placa.toUpperCase().includes(query)) ||
      (o.cliente && o.cliente.toUpperCase().includes(query)) ||
      (o.falla_reportada && o.falla_reportada.toUpperCase().includes(query))
    ).slice(0, 4).map(o => ({
      tipo: 'orden',
      badge: `📋 ORDEN #${o.id}`,
      badgeColor: '#10b981',
      titulo: `OS-${o.id} · ${o.placa || 'Sin placa'}`,
      subtitulo: `${o.cliente || '—'} · Estado: ${o.estado || '—'}${o.total_estimado ? ' · S/ ' + parseFloat(o.total_estimado).toFixed(2) : ''}`,
      actionUrl: `/ordenes?abrir=${o.id}`,
      id: o.id
    }));

    const allMatches = [...vehMatches, ...cliMatches, ...ordMatches].slice(0, 9);
    
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
  };

  searchInput.addEventListener('input', debounce(ejecutarBusqueda, 200));
  
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
