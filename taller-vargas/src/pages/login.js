// ============================================================
// Módulo de Login - Taller Vargas ERP
// Pantalla de inicio de sesión con JWT
// ============================================================

import * as api from '../api.js';

export async function init(container) {
  container.innerHTML = buildLoginHTML();
  attachEvents();
}

function buildLoginHTML() {
  return `
  <div class="login-page">
    <!-- Fondo animado con formas -->
    <div class="login-bg">
      <div class="login-shape login-shape-1"></div>
      <div class="login-shape login-shape-2"></div>
      <div class="login-shape login-shape-3"></div>
    </div>

    <!-- Tarjeta de Login -->
    <div class="login-card">
      <!-- Logo / Header -->
      <div class="login-header">
        <div class="login-logo">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 13l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </div>
        <h1 class="login-title">Taller Vargas</h1>
        <p class="login-subtitle">Sistema de Gestión ERP</p>
      </div>

      <!-- Formulario -->
      <form id="login-form" class="login-form" novalidate>
        <div class="login-field">
          <label for="login-username" class="login-label">Usuario</label>
          <div class="login-input-wrap">
            <svg class="login-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <input
              type="text"
              id="login-username"
              name="username"
              class="login-input"
              placeholder="Ingresa tu usuario"
              autocomplete="username"
              required
            />
          </div>
        </div>

        <div class="login-field">
          <label for="login-password" class="login-label">Contraseña</label>
          <div class="login-input-wrap">
            <svg class="login-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              type="password"
              id="login-password"
              name="password"
              class="login-input"
              placeholder="••••••••"
              autocomplete="current-password"
              required
            />
            <button type="button" id="toggle-password" class="login-eye-btn" title="Mostrar/ocultar contraseña">
              <svg id="eye-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <svg id="eye-closed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Mensaje de error -->
        <div id="login-error" class="login-error hidden">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span id="login-error-msg">Error de autenticación</span>
        </div>

        <button type="submit" id="login-btn" class="login-btn">
          <span id="login-btn-text">Iniciar Sesión</span>
          <div id="login-spinner" class="login-spinner hidden"></div>
        </button>
      </form>

      <!-- Footer -->
      <div class="login-footer">
        <p>Acceso restringido al personal autorizado</p>
      </div>
    </div>
  </div>
  `;
}

function attachEvents() {
  const form         = document.getElementById('login-form');
  const usernameEl   = document.getElementById('login-username');
  const passwordEl   = document.getElementById('login-password');
  const errorBox     = document.getElementById('login-error');
  const errorMsg     = document.getElementById('login-error-msg');
  const btnText      = document.getElementById('login-btn-text');
  const spinner      = document.getElementById('login-spinner');
  const toggleBtn    = document.getElementById('toggle-password');
  const eyeOpen      = document.getElementById('eye-open');
  const eyeClosed    = document.getElementById('eye-closed');

  // Mostrar/ocultar contraseña
  toggleBtn.addEventListener('click', () => {
    const isPassword = passwordEl.type === 'password';
    passwordEl.type = isPassword ? 'text' : 'password';
    eyeOpen.style.display   = isPassword ? 'none' : '';
    eyeClosed.style.display = isPassword ? '' : 'none';
  });

  // Submit del formulario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameEl.value.trim();
    const password = passwordEl.value;

    if (!username || !password) {
      showError('Por favor ingresa usuario y contraseña.');
      return;
    }

    setLoading(true);
    hideError();

    try {
      const data = await api.login(username, password);
      // Guardar token y datos del usuario
      localStorage.setItem('vargas_token', data.token);
      localStorage.setItem('vargas_user', JSON.stringify(data.user));
      // Redirigir al dashboard principal
      window.location.hash = '';
      window.navigate('/');
    } catch (err) {
      showError(err.message || 'Credenciales incorrectas. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  });

  // Focus automático en el campo de usuario
  setTimeout(() => usernameEl.focus(), 100);

  function setLoading(val) {
    const btn = document.getElementById('login-btn');
    btn.disabled = val;
    btnText.textContent = val ? 'Verificando...' : 'Iniciar Sesión';
    spinner.classList.toggle('hidden', !val);
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  function hideError() {
    errorBox.classList.add('hidden');
  }
}
