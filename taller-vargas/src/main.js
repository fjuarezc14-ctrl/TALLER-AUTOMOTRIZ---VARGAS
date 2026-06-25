import { navigate } from './router.js';
import { getAlertasStock } from './api.js';
import { createIcons, icons } from 'lucide';

// ── Inicialización ────────────────────────────────────────
async function init() {
  // Ruta inicial según URL actual
  const path = window.location.pathname;
  await navigate(path);

  // Cargar alertas de stock para el badge
  await refreshStockAlerts();

  // Refrescar alertas cada 60s
  setInterval(refreshStockAlerts, 60_000);
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

init().catch(console.error);
