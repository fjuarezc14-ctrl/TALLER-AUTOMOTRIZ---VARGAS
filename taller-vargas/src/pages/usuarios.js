// ============================================================
// Módulo de Usuarios - Taller Vargas ERP
// Permite listar, agregar, editar y eliminar usuarios
// ============================================================

import * as api from '../api.js';

let allUsers = [];
let editingUserId = null;

export async function init(container) {
  container.innerHTML = `
    <div class="p-6 flex flex-col gap-6 h-full overflow-y-auto">
      
      <!-- Encabezado de la Sección -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold" style="color:var(--dark);">Gestión de Usuarios</h2>
          <p class="text-xs text-slate-500 mt-1">Crea, edita y administra las cuentas y permisos del personal del taller</p>
        </div>
        <button id="btn-nuevo-usuario" class="btn-primary flex items-center gap-2" style="background:var(--brand);color:var(--dark);font-weight:800;border:none;padding:10px 16px;border-radius:var(--radius-md);cursor:pointer;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Nuevo Usuario
        </button>
      </div>

      <!-- Tabla de Usuarios -->
      <div class="card" style="background:var(--white);border:1px solid var(--slate-8);border-radius:var(--radius-md);box-shadow:var(--shadow-sm);overflow:hidden;">
        <table class="w-full text-xs text-left" style="border-collapse:collapse;">
          <thead>
            <tr style="background:var(--slate-9);border-bottom:1px solid var(--slate-8);color:var(--slate-5);font-weight:700;">
              <th class="p-4">Usuario</th>
              <th class="p-4">Rol</th>
              <th class="p-4">Fecha de Creación</th>
              <th class="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="tabla-usuarios-body">
            <tr>
              <td colspan="4" class="p-4 text-center text-slate-400">Cargando usuarios...</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>

    <!-- Modal Nuevo / Editar Usuario -->
    <div id="modal-usuario" class="modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);z-index:100;align-items:center;justify-content:center;">
      <div class="modal modal-sm" style="background:var(--white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:380px;overflow:hidden;animation:modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
        
        <div class="modal-header" style="padding:16px 20px;border-bottom:1px solid var(--slate-8);display:flex;align-items:center;justify-content:between;">
          <div class="flex items-center gap-3">
            <span class="modal-title font-bold text-sm" id="modal-usr-titulo" style="color:var(--dark);">Nuevo Usuario</span>
          </div>
          <button class="modal-close" id="btn-close-modal-x" style="background:none;border:none;cursor:pointer;color:var(--slate-5);">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <form id="form-usuario">
          <div class="modal-body" style="padding:20px;display:flex;flex-direction:column;gap:16px;">
            
            <div class="form-group" style="display:flex;flex-direction:column;gap:6px;">
              <label class="form-label font-bold text-xs" style="color:var(--slate-4);">Nombre de Usuario</label>
              <input type="text" id="usr-username" class="form-input" required placeholder="Ej: dueñavargas" style="border:1px solid var(--slate-8);border-radius:var(--radius-sm);padding:8px 12px;font-size:12px;outline:none;" />
            </div>

            <div class="form-group" style="display:flex;flex-direction:column;gap:6px;">
              <label class="form-label font-bold text-xs" style="color:var(--slate-4);">Rol / Permisos</label>
              <select id="usr-rol" class="form-select" required style="border:1px solid var(--slate-8);border-radius:var(--radius-sm);padding:8px 12px;font-size:12px;background:var(--white);outline:none;">
                <option value="operario">Operario (Taller/Recepción)</option>
                <option value="administrador">Administrador (Acceso Total)</option>
              </select>
            </div>

            <div class="form-group" style="display:flex;flex-direction:column;gap:6px;">
              <label class="form-label font-bold text-xs" id="lbl-password" style="color:var(--slate-4);">Contraseña</label>
              <input type="password" id="usr-password" class="form-input" required placeholder="••••••••" style="border:1px solid var(--slate-8);border-radius:var(--radius-sm);padding:8px 12px;font-size:12px;outline:none;" />
              <p class="text-slate-400 font-medium" id="lbl-password-help" style="font-size:10px;margin-top:2px;display:none;">Deja en blanco para no modificar la contraseña actual.</p>
            </div>

          </div>

          <div class="modal-footer" style="background:var(--slate-9);padding:14px 20px;border-top:1px solid var(--slate-8);display:flex;gap:10px;justify-content:flex-end;">
            <button type="button" class="btn-ghost" id="btn-close-modal-cancel" style="border:1px solid var(--slate-7);background:var(--white);color:var(--slate-5);padding:8px 16px;border-radius:var(--radius-sm);font-size:11px;font-weight:600;cursor:pointer;">Cancelar</button>
            <button type="submit" class="btn-primary" style="background:var(--brand);color:var(--dark);padding:8px 16px;border-radius:var(--radius-sm);font-size:11px;font-weight:800;border:none;cursor:pointer;">Guardar Usuario</button>
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
    const data = await api.getUsuarios();
    allUsers = data;
    renderUsers();
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="p-4 text-center text-red-500 font-bold">Error al cargar usuarios: ${err.message}</td>
      </tr>
    `;
  }
}

function renderUsers() {
  const tbody = document.getElementById('tabla-usuarios-body');
  if (allUsers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="p-4 text-center text-slate-400">No hay usuarios registrados</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = allUsers.map(user => {
    // Formatear fecha
    const fecha = user.created_at ? new Date(user.created_at).toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : '---';

    const rolBadge = user.rol === 'administrador' 
      ? `<span style="background:var(--brand-light);color:var(--brand-dark);padding:2px 8px;border-radius:var(--radius-sm);font-weight:700;">Administrador</span>` 
      : `<span style="background:var(--slate-8);color:var(--slate-4);padding:2px 8px;border-radius:var(--radius-sm);font-weight:600;">Operario</span>`;

    return `
      <tr style="border-bottom:1px solid var(--slate-8);background:var(--white);">
        <td class="p-4 font-bold" style="color:var(--dark);">${escapeHtml(user.username)}</td>
        <td class="p-4">${rolBadge}</td>
        <td class="p-4 text-slate-400">${fecha}</td>
        <td class="p-4 text-right">
          <div style="display:inline-flex;gap:6px;">
            <button onclick="window.editUser(${user.id})" class="btn-ghost" title="Editar" style="padding:6px;border:1px solid var(--slate-8);border-radius:var(--radius-sm);background:none;cursor:pointer;color:var(--slate-4);">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button onclick="window.deleteUser(${user.id}, '${escapeHtml(user.username)}')" class="btn-ghost" title="Eliminar" style="padding:6px;border:1px solid var(--slate-8);border-radius:var(--radius-sm);background:none;cursor:pointer;color:#ef4444;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
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

  const openModal = (title, editId = null) => {
    editingUserId = editId;
    document.getElementById('modal-usr-titulo').textContent = title;
    
    const pwdInput = document.getElementById('usr-password');
    const pwdHelp = document.getElementById('lbl-password-help');
    
    if (editId) {
      const user = allUsers.find(u => u.id === editId);
      document.getElementById('usr-username').value = user.username;
      document.getElementById('usr-rol').value = user.rol;
      pwdInput.required = false;
      pwdInput.placeholder = 'Dejar vacío';
      pwdHelp.style.display = 'block';
    } else {
      document.getElementById('usr-username').value = '';
      document.getElementById('usr-rol').value = 'operario';
      pwdInput.required = true;
      pwdInput.placeholder = '••••••••';
      pwdHelp.style.display = 'none';
    }
    
    modal.style.display = 'flex';
    document.getElementById('usr-username').focus();
  };

  const closeModal = () => {
    modal.style.display = 'none';
    form.reset();
  };

  btnNuevo.addEventListener('click', () => openModal('Nuevo Usuario'));
  btnCloseX.addEventListener('click', closeModal);
  btnCloseCancel.addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('usr-username').value.trim();
    const rol = document.getElementById('usr-rol').value;
    const password = document.getElementById('usr-password').value;

    try {
      if (editingUserId) {
        // Actualizar usuario
        await api.updateUsuario(editingUserId, { username, rol, password });
        alert('✅ Usuario actualizado correctamente.');
      } else {
        // Crear usuario
        await api.createUsuario({ username, password, rol });
        alert('✅ Usuario creado correctamente.');
      }
      closeModal();
      await loadUsers();
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  });

  // Exponer funciones globales para los botones de la tabla
  window.editUser = (id) => {
    openModal('Editar Usuario', id);
  };

  window.deleteUser = async (id, name) => {
    const userStr = localStorage.getItem('vargas_user');
    const currentUser = userStr ? JSON.parse(userStr) : null;
    
    if (currentUser && currentUser.id === id) {
      alert('❌ No puedes eliminar tu propio usuario activo.');
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${name}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      await api.deleteUsuario(id);
      alert('✅ Usuario eliminado correctamente.');
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
