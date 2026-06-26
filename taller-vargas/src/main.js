import { navigate } from './router.js';
import { getAlertasStock, verificarAdminPin } from './api.js';
import { createIcons, icons } from 'lucide';

// ── Gestión Global de Sesión de Administración (PIN) ────────
window.isAdminAuthorized = () => sessionStorage.getItem('vargas_admin_authorized') === 'true';

window.setAdminAuthorized = (pin) => {
  sessionStorage.setItem('vargas_admin_authorized', 'true');
  sessionStorage.setItem('vargas_admin_pin', pin);
  window.updateAdminUI();
};

window.clearAdminAuthorized = () => {
  sessionStorage.removeItem('vargas_admin_authorized');
  sessionStorage.removeItem('vargas_admin_pin');
  window.updateAdminUI();
  navigate('/');
};

window.updateAdminUI = function() {
  const isAuth = window.isAdminAuthorized();
  
  // 1. Mostrar/ocultar el enlace de Facturación
  const facturacionBtn = document.querySelector('button[data-route="/facturacion"]');
  if (facturacionBtn) {
    facturacionBtn.style.display = isAuth ? '' : 'none';
  }

  // 2. Actualizar el bloque de usuario
  const userBlock = document.querySelector('.sidebar-user');
  if (userBlock) {
    if (isAuth) {
      userBlock.innerHTML = `
        <div class="flex items-center justify-between w-full" style="gap:10px;">
          <div class="flex items-center gap-3">
            <div class="user-avatar" style="background:var(--brand);color:var(--dark);">D</div>
            <div>
              <p class="user-name" style="font-weight:800;">Administración</p>
              <p class="user-role" style="color:var(--brand);font-weight:700;">Dueña</p>
            </div>
          </div>
          <button onclick="window.clearAdminAuthorized()" class="btn-ghost" title="Bloquear Acceso Financiero" style="padding:4px 8px;font-size:11px;background:#fef2f2;color:#b91c1c;border:1.5px solid #fca5a5;border-radius:6px;cursor:pointer;font-weight:bold;display:flex;align-items:center;">
            🔒 Salir
          </button>
        </div>
      `;
    } else {
      userBlock.innerHTML = `
        <div class="flex items-center justify-between w-full" style="gap:10px;">
          <div class="flex items-center gap-3">
            <div class="user-avatar" style="background:var(--slate-8);color:var(--slate-4);">T</div>
            <div>
              <p class="user-name">Modo Operario</p>
              <p class="user-role">Taller / Recepción</p>
            </div>
          </div>
          <button onclick="window.promptAdminLogin()" class="btn-primary" title="Desbloquear Facturación" style="padding:6px 10px;font-size:11px;background:var(--dark);color:var(--brand);border:1.5px solid var(--brand);border-radius:6px;cursor:pointer;font-weight:bold;display:flex;align-items:center;">
            🔑 PIN
          </button>
        </div>
      `;
    }
  }
};

window.promptAdminLogin = function(onSuccess = null) {
  let modalOverlay = document.getElementById('modal-pin-auth');
  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'modal-pin-auth';
    modalOverlay.className = 'modal-overlay';
    modalOverlay.innerHTML = `
      <div class="modal modal-sm" style="max-width:360px;">
        <div class="modal-header" style="background:var(--dark);border-bottom:1.5px solid var(--slate-8);">
          <div class="flex items-center gap-2">
            <span style="font-size:16px;">🔑</span>
            <span class="modal-title" style="color:var(--white);font-weight:800;">Control de Acceso</span>
          </div>
          <button class="modal-close" id="btn-close-pin-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form id="form-pin-auth">
          <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;padding:24px 20px;">
            <p style="font-size:12px;color:var(--slate-4);text-align:center;margin:0;">Esta sección requiere la Clave de Administración para visualizar datos contables y cobros.</p>
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="text-align:center;display:block;margin-bottom:6px;">Ingresa el PIN de la Dueña</label>
              <input type="password" id="input-pin-auth" class="form-input text-center font-bold font-mono" maxlength="8" placeholder="••••" required autofocus style="font-size:24px;letter-spacing:6px;width:100%;height:44px;" />
            </div>
            <p id="msg-pin-error" style="color:#ef4444;font-size:11px;font-weight:bold;text-align:center;display:none;margin:0;">⚠️ PIN incorrecto. Reintente.</p>
          </div>
          <div class="modal-footer" style="background:var(--slate-9);padding:12px 20px;display:flex;gap:10px;justify-content:flex-end;">
            <button type="button" class="btn-ghost" id="btn-close-pin-cancel" style="padding:6px 14px;font-size:12px;">Cancelar</button>
            <button type="submit" class="btn-primary" id="btn-submit-pin" style="padding:6px 14px;font-size:12px;background:var(--brand);color:var(--dark);font-weight:800;">Ingresar</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modalOverlay);
    
    const cerrar = () => {
      modalOverlay.classList.remove('active');
      document.getElementById('input-pin-auth').value = '';
      document.getElementById('msg-pin-error').style.display = 'none';
    };
    document.getElementById('btn-close-pin-x').addEventListener('click', cerrar);
    document.getElementById('btn-close-pin-cancel').addEventListener('click', cerrar);
    
    document.getElementById('form-pin-auth').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = document.getElementById('input-pin-auth').value;
      const errorMsg = document.getElementById('msg-pin-error');
      const submitBtn = document.getElementById('btn-submit-pin');
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verificando...';
      errorMsg.style.display = 'none';
      
      try {
        await verificarAdminPin(pin);
        
        window.setAdminAuthorized(pin);
        cerrar();
        alert('✅ Acceso administrativo concedido.');
        if (onSuccess) onSuccess();
      } catch (err) {
        errorMsg.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Ingresar';
        document.getElementById('input-pin-auth').value = '';
        document.getElementById('input-pin-auth').focus();
      }
    });
  }
  
  modalOverlay.classList.add('active');
  document.getElementById('input-pin-auth').focus();
};

// ── Inicialización ────────────────────────────────────────
async function init() {
  // Ruta inicial según URL actual
  const path = window.location.pathname;
  await navigate(path);

  // Cargar alertas de stock para el badge
  await refreshStockAlerts();

  // Refrescar alertas cada 60s
  setInterval(refreshStockAlerts, 60_000);

  // Inicializar UI de administrador
  window.updateAdminUI();
}

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

// ── Modo Oscuro ───────────────────────────────────────────
function applyTheme(theme) {
  const root  = document.documentElement;
  const icon  = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');
  const pill  = document.getElementById('theme-pill');
  const dot   = document.getElementById('theme-pill-dot');

  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
    if (icon)  icon.textContent  = '☀️';
    if (label) label.textContent = 'Modo Claro';
    if (pill)  pill.classList.add('active');
    if (dot)   dot.classList.add('active');
  } else {
    root.removeAttribute('data-theme');
    if (icon)  icon.textContent  = '🌙';
    if (label) label.textContent = 'Modo Oscuro';
    if (pill)  pill.classList.remove('active');
    if (dot)   dot.classList.remove('active');
  }
}

window.toggleTheme = function() {
  const current = localStorage.getItem('vg-theme') || 'light';
  const next    = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('vg-theme', next);
  applyTheme(next);
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

// Aplicar tema guardado al cargar
applyTheme(localStorage.getItem('vg-theme') || 'light');

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

init().catch(console.error);
