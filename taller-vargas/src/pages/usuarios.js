// ============================================================
// Módulo de Gestión de Personal y Usuarios - Taller Vargas ERP
// Control integral de cuentas de acceso, roles y cargas de trabajo
// ============================================================

import * as api from '../api.js';
import { store } from '../store.js';

let allUsers = [];
let allMecanicos = [];
let editingUserId = null;

export async function init(container) {
  container.innerHTML = `
    <div class="p-6 flex flex-col gap-6 h-full overflow-y-auto" style="max-width:1400px; margin:0 auto;">
      
      <!-- Encabezado de la Sección -->
      <div class="flex items-center justify-between" style="flex-wrap:wrap; gap:12px;">
        <div>
          <h2 class="text-xl font-bold" style="color:var(--dark); text-transform:uppercase; letter-spacing:-0.5px;">
            Personal y Usuarios del Taller
          </h2>
          <p class="text-xs text-slate-500 mt-1">
            Administración del equipo técnico, perfiles de acceso y balanceo de carga de trabajo en bahías.
          </p>
        </div>
        <button id="btn-nuevo-usuario" class="btn-primary flex items-center gap-2" style="background:var(--brand); color:var(--dark); font-weight:800; border:none; padding:10px 18px; border-radius:var(--radius-md); cursor:pointer; font-size:13px; box-shadow:var(--shadow-sm);">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Nuevo Trabajador
        </button>
      </div>

      <!-- Tarjetas de Resumen / KPIs de Personal -->
      <div id="kpis-personal-container" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px;">
        <!-- Se llena con JS -->
      </div>

      <!-- Tabla de Personal y Usuarios -->
      <div class="card" style="background:var(--white); border:1px solid var(--slate-8); border-radius:var(--radius-md); box-shadow:var(--shadow-sm); overflow:hidden;">
        <div style="padding:14px 20px; border-bottom:1px solid var(--slate-8); background:var(--slate-9); display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; font-weight:800; color:var(--dark); text-transform:uppercase; letter-spacing:0.5px;">
            Directorio del Equipo Técnico y Administrativo
          </span>
          <span id="txt-total-registros" style="font-size:11px; font-weight:700; color:var(--slate-5);">
            Cargando equipo...
          </span>
        </div>
        <div style="overflow-x:auto;">
          <table class="w-full text-xs text-left" style="border-collapse:collapse; min-width:750px;">
            <thead>
              <tr style="background:var(--white); border-bottom:1px solid var(--slate-8); color:var(--slate-5); font-weight:700;">
                <th class="p-4" style="width:28%;">Nombre / Usuario</th>
                <th class="p-4" style="width:20%;">Rol / Función</th>
                <th class="p-4" style="width:24%;">Carga de Trabajo en Taller</th>
                <th class="p-4" style="width:14%;">Fecha Alta</th>
                <th class="p-4 text-right" style="width:14%;">Acciones</th>
              </tr>
            </thead>
            <tbody id="tabla-usuarios-body">
              <tr>
                <td colspan="5" class="p-8 text-center text-slate-400">
                  <div style="display:inline-block; width:24px; height:24px; border:3px solid #10b981; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div>
                  <p style="margin-top:8px; font-weight:600;">Cargando personal y métricas...</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- Modal Nuevo / Editar Trabajador -->
    <div id="modal-usuario" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1100; align-items:center; justify-content:center;">
      <div class="modal modal-md" style="background:var(--white); border-radius:var(--radius-lg); box-shadow:var(--shadow-xl); width:100%; max-width:440px; overflow:hidden; border:1px solid var(--slate-7);">
        
        <div class="modal-header" style="padding:16px 20px; border-bottom:1px solid var(--slate-8); display:flex; align-items:center; justify-content:space-between; background:var(--slate-9);">
          <div class="flex items-center gap-2">
            <span style="font-size:18px;">👤</span>
            <span class="modal-title font-bold text-sm" id="modal-usr-titulo" style="color:var(--dark);">Registrar Nuevo Trabajador</span>
          </div>
          <button class="modal-close" id="btn-close-modal-x" style="background:none; border:none; cursor:pointer; color:var(--slate-5);">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <form id="form-usuario">
          <div class="modal-body" style="padding:20px; display:flex; flex-direction:column; gap:14px;">
            
            <div class="form-group" style="display:flex; flex-direction:column; gap:5px; margin:0;">
              <label class="form-label font-bold text-xs" style="color:var(--slate-4);">Nombre Completo *</label>
              <input type="text" id="usr-nombre-completo" class="form-input" required placeholder="Ej: Carlos Mendoza / Ana Vargas" style="border:1px solid var(--slate-8); border-radius:var(--radius-sm); padding:8px 12px; font-size:12px; outline:none;" />
              <p style="font-size:10px; color:var(--slate-5); margin:0;">Es el nombre visible en órdenes, peritajes y Kanban.</p>
            </div>

            <div class="form-group" style="display:flex; flex-direction:column; gap:5px; margin:0;">
              <label class="form-label font-bold text-xs" style="color:var(--slate-4);">Nombre de Usuario para Login *</label>
              <input type="text" id="usr-username" class="form-input" required placeholder="Ej: cmendoza" style="border:1px solid var(--slate-8); border-radius:var(--radius-sm); padding:8px 12px; font-size:12px; outline:none;" autocomplete="username" />
            </div>

            <div class="form-group" style="display:flex; flex-direction:column; gap:5px; margin:0;">
              <label class="form-label font-bold text-xs" style="color:var(--slate-4);">Rol / Puesto en el Taller *</label>
              <select id="usr-rol" class="form-select" required style="border:1px solid var(--slate-8); border-radius:var(--radius-sm); padding:8px 12px; font-size:12px; background:var(--white); outline:none;">
                <option value="operario">🛠️ Operario / Mecánico (Inicio directo en Taller / Diagnósticos)</option>
                <option value="administrador">👑 Administrador (Acceso Total, Finanzas y Cobros)</option>
              </select>
            </div>

            <div class="form-group" style="display:flex; flex-direction:column; gap:5px; margin:0;">
              <label class="form-label font-bold text-xs" id="lbl-password" style="color:var(--slate-4);">Contraseña de Acceso *</label>
              <input type="password" id="usr-password" class="form-input" required placeholder="••••••••" style="border:1px solid var(--slate-8); border-radius:var(--radius-sm); padding:8px 12px; font-size:12px; outline:none;" autocomplete="new-password" />
              <p class="text-slate-400 font-medium" id="lbl-password-help" style="font-size:10px; margin:0; display:none;">Dejar en blanco para conservar la contraseña actual.</p>
            </div>

          </div>

          <div class="modal-footer" style="background:var(--slate-9); padding:14px 20px; border-top:1px solid var(--slate-8); display:flex; gap:10px; justify-content:flex-end;">
            <button type="button" class="btn-ghost" id="btn-close-modal-cancel" style="border:1px solid var(--slate-7); background:var(--white); color:var(--slate-5); padding:8px 16px; border-radius:var(--radius-sm); font-size:12px; font-weight:600; cursor:pointer;">Cancelar</button>
            <button type="submit" id="btn-submit-personal" class="btn-primary" style="background:var(--brand); color:var(--dark); padding:8px 18px; border-radius:var(--radius-sm); font-size:12px; font-weight:800; border:none; cursor:pointer;">
              💾 Guardar Personal
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  setupEvents();
  await loadUsers();
}

async function loadUsers() {
  const tbody = document.getElementById('tabla-usuarios-body');
  try {
    const res = await api.getUsuarios();
    allUsers = Array.isArray(res) ? res : (res.usuarios || []);
    allMecanicos = res.mecanicos || [];
    renderKPIs();
    renderUsers();
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="p-6 text-center text-red-500 font-bold">Error al cargar personal: ${err.message}</td>
        </tr>
      `;
    }
  }
}

function renderKPIs() {
  const kpisContainer = document.getElementById('kpis-personal-container');
  if (!kpisContainer) return;

  const totalTrabajadores = allUsers.length;
  const operarios = allUsers.filter(u => u.rol === 'operario');
  const totalOperarios = operarios.length;
  
  // Autos activos asignados
  const totalAutosAsignados = operarios.reduce((acc, u) => acc + (parseInt(u.ordenes_activas) || 0), 0);
  const operariosLibres = operarios.filter(u => (parseInt(u.ordenes_activas) || 0) === 0).length;

  kpisContainer.innerHTML = `
    <div style="background:var(--white); border:1px solid var(--slate-8); border-radius:var(--radius-md); padding:14px 18px; box-shadow:var(--shadow-sm); display:flex; align-items:center; gap:14px;">
      <div style="width:40px; height:40px; border-radius:8px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; font-size:18px;">
        👥
      </div>
      <div>
        <div style="font-size:11px; font-weight:700; color:var(--slate-5); text-transform:uppercase;">Total Personal</div>
        <div style="font-size:20px; font-weight:900; color:var(--dark); line-height:1.2;">${totalTrabajadores}</div>
        <div style="font-size:10px; color:var(--slate-4);">${totalOperarios} en taller / ${totalTrabajadores - totalOperarios} administración</div>
      </div>
    </div>

    <div style="background:var(--white); border:1px solid var(--slate-8); border-radius:var(--radius-md); padding:14px 18px; box-shadow:var(--shadow-sm); display:flex; align-items:center; gap:14px;">
      <div style="width:40px; height:40px; border-radius:8px; background:#f0fdf4; color:#16a34a; display:flex; align-items:center; justify-content:center; font-size:18px;">
        🛠️
      </div>
      <div>
        <div style="font-size:11px; font-weight:700; color:var(--slate-5); text-transform:uppercase;">Mecánicos Operativos</div>
        <div style="font-size:20px; font-weight:900; color:#16a34a; line-height:1.2;">${totalOperarios}</div>
        <div style="font-size:10px; color:var(--slate-4);">Listos para recibir órdenes</div>
      </div>
    </div>

    <div style="background:var(--white); border:1px solid var(--slate-8); border-radius:var(--radius-md); padding:14px 18px; box-shadow:var(--shadow-sm); display:flex; align-items:center; gap:14px;">
      <div style="width:40px; height:40px; border-radius:8px; background:#fef3c7; color:#d97706; display:flex; align-items:center; justify-content:center; font-size:18px;">
        🚗
      </div>
      <div>
        <div style="font-size:11px; font-weight:700; color:var(--slate-5); text-transform:uppercase;">Carga Total en Taller</div>
        <div style="font-size:20px; font-weight:900; color:#b45309; line-height:1.2;">${totalAutosAsignados} autos</div>
        <div style="font-size:10px; color:var(--slate-4);">distribuidos en bahías activas</div>
      </div>
    </div>

    <div style="background:var(--white); border:1px solid var(--slate-8); border-radius:var(--radius-md); padding:14px 18px; box-shadow:var(--shadow-sm); display:flex; align-items:center; gap:14px;">
      <div style="width:40px; height:40px; border-radius:8px; background:${operariosLibres > 0 ? '#ecfdf5' : '#fef2f2'}; color:${operariosLibres > 0 ? '#059669' : '#dc2626'}; display:flex; align-items:center; justify-content:center; font-size:18px;">
        ${operariosLibres > 0 ? '🟢' : '🟡'}
      </div>
      <div>
        <div style="font-size:11px; font-weight:700; color:var(--slate-5); text-transform:uppercase;">Mecánicos Disponibles</div>
        <div style="font-size:20px; font-weight:900; color:${operariosLibres > 0 ? '#059669' : '#b45309'}; line-height:1.2;">
          ${operariosLibres} libres
        </div>
        <div style="font-size:10px; color:var(--slate-4);">sin autos asignados actualmente</div>
      </div>
    </div>
  `;
}

function renderUsers() {
  const tbody = document.getElementById('tabla-usuarios-body');
  const txtTotal = document.getElementById('txt-total-registros');
  if (!tbody) return;

  if (txtTotal) {
    txtTotal.textContent = `${allUsers.length} miembro(s) registrado(s)`;
  }

  if (allUsers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="p-6 text-center text-slate-400 font-medium">No hay trabajadores registrados en este momento.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = allUsers.map(user => {
    const fecha = user.created_at ? new Date(user.created_at).toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) : '—';

    const isOperario = user.rol === 'operario';

    const rolBadge = user.rol === 'administrador' 
      ? `<span style="background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; padding:3px 8px; border-radius:4px; font-weight:700; font-size:11px; display:inline-flex; align-items:center; gap:4px;">👑 Administrador</span>` 
      : `<span style="background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; padding:3px 8px; border-radius:4px; font-weight:700; font-size:11px; display:inline-flex; align-items:center; gap:4px;">🛠️ Mecánico / Operario</span>`;

    // Carga de trabajo
    const activas = parseInt(user.ordenes_activas) || 0;
    const completadas = parseInt(user.ordenes_completadas) || 0;

    let cargaHtml = '—';
    if (isOperario) {
      if (activas === 0) {
        cargaHtml = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; padding:2px 8px; border-radius:12px; font-weight:800; font-size:11px;">
              🟢 Libre (0 autos)
            </span>
            <span style="color:var(--slate-4); font-size:10px;">${completadas} completados</span>
          </div>
        `;
      } else if (activas <= 2) {
        cargaHtml = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="background:#fefce8; color:#854d0e; border:1px solid #fef08a; padding:2px 8px; border-radius:12px; font-weight:800; font-size:11px;">
              🟡 Normal (${activas} autos)
            </span>
            <span style="color:var(--slate-4); font-size:10px;">${completadas} completados</span>
          </div>
        `;
      } else {
        cargaHtml = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="background:#fef2f2; color:#991b1b; border:1px solid #fecaca; padding:2px 8px; border-radius:12px; font-weight:800; font-size:11px;">
              🔴 Carga Alta (${activas} autos)
            </span>
            <span style="color:var(--slate-4); font-size:10px;">${completadas} completados</span>
          </div>
        `;
      }
    }

    const nombreCompleto = user.nombre_completo || user.username;

    return `
      <tr style="border-bottom:1px solid var(--slate-8); background:var(--white); transition:background 0.15s;">
        <td class="p-4">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:34px; height:34px; border-radius:8px; background:${isOperario ? '#f0fdf4' : '#eff6ff'}; color:${isOperario ? '#166534' : '#1e40af'}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px;">
              ${(nombreCompleto.slice(0, 2)).toUpperCase()}
            </div>
            <div>
              <div style="font-weight:800; color:var(--dark); font-size:13px;">${escapeHtml(nombreCompleto)}</div>
              <div style="font-size:11px; color:var(--slate-4); font-family:monospace;">@${escapeHtml(user.username)}</div>
            </div>
          </div>
        </td>
        <td class="p-4">${rolBadge}</td>
        <td class="p-4">${cargaHtml}</td>
        <td class="p-4 text-slate-400 font-medium">${fecha}</td>
        <td class="p-4 text-right">
          <div style="display:inline-flex; gap:6px;">
            <button onclick="window.editUser(${user.id})" class="btn-ghost" title="Editar datos" style="padding:6px 10px; border:1px solid var(--slate-7); border-radius:var(--radius-sm); background:var(--white); cursor:pointer; color:var(--slate-4); font-size:11px; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              Editar
            </button>
            <button onclick="window.deleteUser(${user.id}, '${escapeHtml(user.username)}')" class="btn-ghost" title="Eliminar trabajador" style="padding:6px 8px; border:1px solid #fecaca; border-radius:var(--radius-sm); background:#fff5f5; cursor:pointer; color:#ef4444; font-size:11px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function setupEvents() {
  const modal = document.getElementById('modal-usuario');
  const btnNuevo = document.getElementById('btn-nuevo-usuario');
  const btnCloseX = document.getElementById('btn-close-modal-x');
  const btnCloseCancel = document.getElementById('btn-close-modal-cancel');
  const form = document.getElementById('form-usuario');
  const submitBtn = document.getElementById('btn-submit-personal');

  const openModal = (title, editId = null) => {
    editingUserId = editId;
    document.getElementById('modal-usr-titulo').textContent = title;
    
    const pwdInput = document.getElementById('usr-password');
    const pwdHelp = document.getElementById('lbl-password-help');
    
    if (editId) {
      const user = allUsers.find(u => u.id === editId);
      document.getElementById('usr-nombre-completo').value = user.nombre_completo || user.username;
      document.getElementById('usr-username').value = user.username;
      document.getElementById('usr-rol').value = user.rol;
      pwdInput.required = false;
      pwdInput.placeholder = '••••••••';
      pwdHelp.style.display = 'block';
    } else {
      document.getElementById('usr-nombre-completo').value = '';
      document.getElementById('usr-username').value = '';
      document.getElementById('usr-rol').value = 'operario';
      pwdInput.required = true;
      pwdInput.placeholder = '••••••••';
      pwdHelp.style.display = 'none';
    }
    
    modal.style.display = 'flex';
    document.getElementById('usr-nombre-completo').focus();
  };

  const closeModal = () => {
    modal.style.display = 'none';
    form.reset();
  };

  btnNuevo?.addEventListener('click', () => openModal('Registrar Nuevo Trabajador'));
  btnCloseX?.addEventListener('click', closeModal);
  btnCloseCancel?.addEventListener('click', closeModal);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre_completo = document.getElementById('usr-nombre-completo').value.trim();
    const username = document.getElementById('usr-username').value.trim();
    const rol = document.getElementById('usr-rol').value;
    const password = document.getElementById('usr-password').value;

    if (!nombre_completo) {
      alert('Por favor, ingresa el nombre completo del trabajador.');
      return;
    }
    if (!username) {
      alert('Por favor, ingresa un nombre de usuario para el login.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Guardando...';
    }

    try {
      if (editingUserId) {
        await api.updateUsuario(editingUserId, { username, rol, password, nombre_completo });
        alert('✅ Datos del trabajador actualizados correctamente.');
      } else {
        await api.createUsuario({ username, password, rol, nombre_completo });
        alert('✅ Trabajador registrado y sincronizado exitosamente.');
      }
      
      store.invalidate('mecanicos');
      closeModal();
      await loadUsers();
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '💾 Guardar Personal';
      }
    }
  });

  // Funciones expuestas para botones de la tabla
  window.editUser = (id) => {
    openModal('Editar Trabajador', id);
  };

  window.deleteUser = async (id, name) => {
    const userStr = localStorage.getItem('vargas_user');
    const currentUser = userStr ? JSON.parse(userStr) : null;
    
    if (currentUser && currentUser.id === id) {
      alert('❌ No puedes eliminar tu propia cuenta activa de administrador.');
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas retirar del sistema al trabajador "${name}"? Si es mecánico, quedará desactivado de las asignaciones de taller.`)) {
      return;
    }

    try {
      await api.deleteUsuario(id);
      store.invalidate('mecanicos');
      alert('✅ Trabajador retirado correctamente.');
      await loadUsers();
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
