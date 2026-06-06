import { getCobros, getStatsCobros, registrarCobro, dividirCobro } from '../api.js';

let containerElement = null;
let cobrosList = [];

export async function init(container) {
  containerElement = container;
  container.innerHTML = `<div class="fade-in" id="facturacion-root"></div>`;
  const root = document.getElementById('facturacion-root');

  // CTA Global: Sin acción en facturación
  window.setCTAButton(null);

  // Renderizar skeleton
  root.innerHTML = renderSkeleton();

  try {
    await cargarDatos();
  } catch (err) {
    root.innerHTML = renderError(err.message);
  }
}

async function cargarDatos() {
  const [cobros, stats] = await Promise.all([getCobros(), getStatsCobros()]);
  cobrosList = cobros;
  renderFacturacion(cobros, stats);
}

function renderSkeleton() {
  return `
    <div class="mb-6 flex justify-between items-center">
      <div style="height:24px;width:200px;background:var(--slate-8);border-radius:8px"></div>
      <div style="height:38px;width:250px;background:var(--slate-8);border-radius:8px"></div>
    </div>
    <div class="grid grid-cols-2 gap-4 mb-6">
      <div style="height:100px;background:var(--white);border-radius:20px;border:1px solid var(--slate-8)"></div>
      <div style="height:100px;background:var(--white);border-radius:20px;border:1px solid var(--slate-8)"></div>
    </div>
    <div class="card" style="height:300px;background:var(--white);"></div>
  `;
}

function renderError(msg) {
  return `
    <div class="card" style="max-width:480px;margin:40px auto;">
      <div class="card-body text-center" style="padding:48px 24px;">
        <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
        <p style="font-weight:800;color:var(--dark);margin-bottom:8px;">Error al cargar facturación</p>
        <p style="font-size:13px;color:var(--slate-5);margin-bottom:20px;">${msg}</p>
        <button class="btn-primary" onclick="location.reload()">Reintentar</button>
      </div>
    </div>`;
}

function renderFacturacion(cobros, stats) {
  const root = document.getElementById('facturacion-root');

  root.innerHTML = `
    <!-- Header & Search -->
    <div class="flex justify-between items-center mb-6" style="flex-wrap:wrap;gap:16px;">
      <div>
        <h1 style="font-size:22px;font-weight:900;color:var(--dark);text-transform:uppercase;letter-spacing:-.5px;">Facturación y Cobros</h1>
        <p style="font-size:13px;color:var(--slate-5);margin-top:2px;">Gestión de cobros de órdenes finalizadas y facturación corporativa.</p>
      </div>
      <div>
        <input type="text" id="search-cobros" placeholder="Buscar orden o cliente..." class="form-input" style="width:260px;" />
      </div>
    </div>

    <!-- Stats grid -->
    <div class="grid grid-cols-2 gap-4 mb-6" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
      <div class="stat-card flex items-center gap-4">
        <div style="padding:10px;background:#fef3c7;border-radius:12px;color:#b45309;">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div>
          <p style="font-size:11px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Por Cobrar (Pendiente)</p>
          <p style="font-size:22px;font-weight:900;color:var(--dark);margin-top:2px;font-family:monospace;">S/ ${parseFloat(stats.por_cobrar || 0).toLocaleString('es-PE', {minimumFractionDigits:2})}</p>
        </div>
      </div>

      <div class="stat-card flex items-center gap-4">
        <div style="padding:10px;background:#d1fae5;border-radius:12px;color:#065f46;">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div>
          <p style="font-size:11px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Ingresos del Mes (Cancelados)</p>
          <p style="font-size:22px;font-weight:900;color:var(--dark);margin-top:2px;font-family:monospace;">S/ ${parseFloat(stats.ingresos || 0).toLocaleString('es-PE', {minimumFractionDigits:2})}</p>
        </div>
      </div>
    </div>

    <!-- Table Card -->
    <div class="card">
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>N° Pago</th>
              <th>Ref. Orden</th>
              <th>Cliente / Propietario</th>
              <th>Fecha Emisión</th>
              <th class="text-right">Monto Total</th>
              <th class="text-center">Estado</th>
              <th class="text-right">Acción</th>
            </tr>
          </thead>
          <tbody id="tabla-cobros-body">
            ${renderTableRows(cobros)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Registrar Cobro -->
    <div id="modal-cobro" class="modal-overlay">
      <div class="modal modal-md">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="modal-header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            </div>
            <span class="modal-title">Registrar Cobro</span>
          </div>
          <button class="modal-close" id="btn-close-cobro-x">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form id="form-cobro">
          <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;">
            <input type="hidden" id="cobro-id" />
            <input type="hidden" id="cobro-total-oculto" />

            <div class="text-center" style="background:var(--slate-9);padding:16px;border-radius:var(--radius-md);border:1px solid var(--slate-8);">
              <p style="font-size:10px;font-weight:700;color:var(--slate-5);text-transform:uppercase;">Total a Cobrar</p>
              <p id="cobro-monto" style="font-size:28px;font-weight:900;color:var(--dark);margin-top:2px;font-family:monospace;"></p>
              <p id="cobro-cliente-info" style="font-size:12px;color:var(--slate-5);margin-top:4px;"></p>
            </div>

            <div class="form-group">
              <label class="form-label">Método de Pago</label>
              <select id="cobro-metodo" class="form-select" required>
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta de Crédito / Débito</option>
                <option value="Yape/Plin">Yape / Plin / Billetera Digital</option>
                <option value="Transferencia">Transferencia Bancaria</option>
              </select>
            </div>

            <!-- Opción de Pago Dividido -->
            <div class="flex items-center gap-2" style="margin:4px 0;">
              <input type="checkbox" id="chk-dividir-pago" style="width:16px;height:16px;cursor:pointer;" />
              <label for="chk-dividir-pago" style="font-size:12px;font-weight:700;color:var(--slate-4);cursor:pointer;text-transform:uppercase;letter-spacing:.3px;">
                Dividir pago entre dos empresas / clientes
              </label>
            </div>

            <!-- Campos simples de comprobante -->
            <div id="wrapper-comprobante-simple">
              <div class="form-group">
                <label class="form-label">Tipo de Comprobante</label>
                <select id="cobro-comprobante" class="form-select">
                  <option value="Boleta">Boleta de Venta Electrónica</option>
                  <option value="Factura">Factura Electrónica</option>
                  <option value="Nota de Venta">Nota de Venta (Control Interno)</option>
                </select>
              </div>
            </div>

            <!-- Campos de Pago Dividido -->
            <div id="wrapper-comprobante-dividido" class="hidden" style="border-top:1px dashed var(--slate-8);padding-top:12px;display:flex;flex-direction:column;gap:12px;">
              <div class="form-section-title">Distribución de Pagadores</div>
              
              <!-- Empresa 1 -->
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:12px;border-radius:var(--radius-md);">
                <div style="font-weight:700;font-size:11px;color:#166534;margin-bottom:8px;text-transform:uppercase;">Empresa 1 (Propietario actual)</div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="form-group">
                    <label class="form-label" style="color:#166534;">Monto (S/)</label>
                    <input type="number" id="div-monto-1" step="0.01" min="0" class="form-input text-right font-mono font-bold" style="background:#fff;" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="color:#166534;">Comprobante</label>
                    <select id="div-comprobante-1" class="form-select" style="background:#fff;">
                      <option value="Factura">Factura Electrónica</option>
                      <option value="Boleta">Boleta Electrónica</option>
                      <option value="Nota de Venta">Nota de Venta</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Empresa 2 -->
              <div style="background:#fefeff;border:1px solid var(--slate-8);padding:12px;border-radius:var(--radius-md);">
                <div style="font-weight:700;font-size:11px;color:var(--slate-5);margin-bottom:8px;text-transform:uppercase;">Empresa 2 / Co-pagador</div>
                <div class="grid grid-cols-2 gap-3 mb-2">
                  <div class="form-group">
                    <label class="form-label">RUC / DNI Co-pagador</label>
                    <input type="text" id="div-doc-2" class="form-input font-mono" placeholder="Ej: 20512345678" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Razón Social Co-pagador</label>
                    <input type="text" id="div-nombre-2" class="form-input" placeholder="Ej: Distribuidora Sol S.A." />
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="form-group">
                    <label class="form-label">Monto (S/)</label>
                    <input type="number" id="div-monto-2" step="0.01" min="0" class="form-input text-right font-mono font-bold" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Comprobante</label>
                    <select id="div-comprobante-2" class="form-select">
                      <option value="Factura">Factura Electrónica</option>
                      <option value="Boleta">Boleta Electrónica</option>
                      <option value="Nota de Venta">Nota de Venta</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

          </div>
          <div class="modal-footer">
            <button type="button" class="btn-ghost" id="btn-close-cobro-cancel">Cancelar</button>
            <button type="submit" class="btn-primary" id="btn-confirm-cobro">Confirmar Pago</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Registrar Eventos
  document.getElementById('search-cobros').addEventListener('input', filtrarCobros);
  document.getElementById('btn-close-cobro-x').addEventListener('click', cerrarModalCobro);
  document.getElementById('btn-close-cobro-cancel').addEventListener('click', cerrarModalCobro);
  document.getElementById('form-cobro').addEventListener('submit', procesarCobro);

  const chkDividir = document.getElementById('chk-dividir-pago');
  chkDividir.addEventListener('change', toggleDividirPago);

  // Escuchar cobros dinámicos en la tabla
  document.getElementById('tabla-cobros-body').addEventListener('click', (e) => {
    const payBtn = e.target.closest('.btn-pay-cobro');
    if (payBtn) {
      abrirModalCobro(payBtn.dataset.id);
    }
  });
}

function renderTableRows(cobros) {
  if (cobros.length === 0) {
    return `<tr><td colspan="7" class="td-empty">No se encontraron órdenes de pago</td></tr>`;
  }

  return cobros.map(c => {
    const isPaid = c.estado === 'Cancelado' || c.estado === 'Dividido';
    const dateStr = new Date(c.fecha_emision).toLocaleDateString('es-PE');
    
    let badge = '';
    if (c.estado === 'Cancelado') {
      badge = `<span class="badge badge-emerald">Cancelado</span>`;
    } else if (c.estado === 'Dividido') {
      badge = `<span class="badge badge-purple" title="Pago repartido">Dividido</span>`;
    } else {
      badge = `<span class="badge badge-amber">Pendiente</span>`;
    }

    let actionButton = '';
    if (!isPaid) {
      actionButton = `
        <button class="btn-success btn-pay-cobro" data-id="${c.id}" style="font-size:11px;padding:6px 12px;text-transform:none;">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="margin-right:2px;"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          Cobrar
        </button>`;
    } else {
      const details = c.estado === 'Dividido' 
        ? `<div style="font-size:10px;color:var(--slate-5);margin-top:2px;">Doc1: ${c.tipo_comprobante} (S/ ${parseFloat(c.monto_pagador1).toFixed(2)})<br>Doc2: ${c.comprobante2} (S/ ${parseFloat(c.monto_pagador2).toFixed(2)})</div>`
        : `<div style="font-size:10px;color:var(--slate-5);margin-top:2px;">${c.tipo_comprobante} - ${c.metodo_pago}</div>`;

      actionButton = `
        <div class="text-right">
          <span style="font-size:11px;font-weight:700;color:var(--slate-6);display:flex;align-items:center;justify-content:flex-end;gap:3px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="color:#10b981;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Cobrado
          </span>
          ${details}
        </div>`;
    }

    return `
      <tr>
        <td class="font-mono font-bold">CP-${c.id}</td>
        <td>
          <span class="placa-badge" style="font-size:10px;padding:2px 6px;">${c.placa || '—'}</span>
          <div style="font-size:10px;color:var(--slate-5);margin-top:2px;font-family:monospace;">OT-#${c.orden_numero}</div>
        </td>
        <td>
          <strong>${c.cliente_nombre}</strong>
          <div style="font-size:10px;color:var(--slate-5);">${c.tipo_doc}: ${c.num_doc}</div>
        </td>
        <td>${dateStr}</td>
        <td class="text-right font-mono font-bold" style="font-size:14px;color:var(--dark);">S/ ${parseFloat(c.monto_total).toFixed(2)}</td>
        <td class="text-center">${badge}</td>
        <td class="text-right">${actionButton}</td>
      </tr>
    `;
  }).join('');
}

function filtrarCobros() {
  const q = document.getElementById('search-cobros').value.toLowerCase().trim();
  const filtrados = cobrosList.filter(c => 
    c.cliente_nombre.toLowerCase().includes(q) || 
    (c.placa && c.placa.toLowerCase().includes(q)) || 
    c.id.toString().includes(q) ||
    c.orden_numero.toString().includes(q)
  );
  document.getElementById('tabla-cobros-body').innerHTML = renderTableRows(filtrados);
}

function abrirModalCobro(id) {
  const c = cobrosList.find(item => item.id == id);
  if (!c) return;

  const form = document.getElementById('form-cobro');
  form.reset();

  document.getElementById('cobro-id').value = c.id;
  document.getElementById('cobro-total-oculto').value = c.monto_total;
  
  const totalFmt = parseFloat(c.monto_total).toFixed(2);
  document.getElementById('cobro-monto').textContent = `S/ ${totalFmt}`;
  document.getElementById('cobro-cliente-info').textContent = `Cliente: ${c.cliente_nombre} | RUC/DNI: ${c.num_doc}`;

  // Resetear estado del checkbox y vistas
  document.getElementById('chk-dividir-pago').checked = false;
  document.getElementById('wrapper-comprobante-simple').classList.remove('hidden');
  document.getElementById('wrapper-comprobante-dividido').classList.add('hidden');

  // Rellenar valores por defecto para división (mitad y mitad)
  const half = (parseFloat(c.monto_total) / 2).toFixed(2);
  document.getElementById('div-monto-1').value = half;
  document.getElementById('div-monto-2').value = half;

  document.getElementById('modal-cobro').classList.add('active');
}

function cerrarModalCobro() {
  document.getElementById('modal-cobro').classList.remove('active');
}

function toggleDividirPago() {
  const chk = document.getElementById('chk-dividir-pago').checked;
  const simple = document.getElementById('wrapper-comprobante-simple');
  const dividido = document.getElementById('wrapper-comprobante-dividido');

  if (chk) {
    simple.classList.add('hidden');
    dividido.classList.remove('hidden');
    document.getElementById('cobro-comprobante').required = false;
    document.getElementById('div-doc-2').required = true;
    document.getElementById('div-nombre-2').required = true;
  } else {
    simple.classList.remove('hidden');
    dividido.classList.add('hidden');
    document.getElementById('cobro-comprobante').required = true;
    document.getElementById('div-doc-2').required = false;
    document.getElementById('div-nombre-2').required = false;
  }
}

async function procesarCobro(e) {
  e.preventDefault();
  const id = document.getElementById('cobro-id').value;
  const chkDividir = document.getElementById('chk-dividir-pago').checked;
  const metodo_pago = document.getElementById('cobro-metodo').value;

  try {
    if (!chkDividir) {
      // Cobro simple
      const tipo_comprobante = document.getElementById('cobro-comprobante').value;
      await registrarCobro(id, { metodo_pago, tipo_comprobante });
      alert('¡Pago registrado con éxito!');
    } else {
      // Cobro dividido
      const total = parseFloat(document.getElementById('cobro-total-oculto').value);
      const monto_pagador1 = parseFloat(document.getElementById('div-monto-1').value) || 0;
      const monto_pagador2 = parseFloat(document.getElementById('div-monto-2').value) || 0;
      
      if (Math.abs((monto_pagador1 + monto_pagador2) - total) > 0.05) {
        alert(`La suma de los montos (S/ ${(monto_pagador1 + monto_pagador2).toFixed(2)}) no coincide con el total a cobrar (S/ ${total.toFixed(2)}).`);
        return;
      }

      const pagador2_doc = document.getElementById('div-doc-2').value.trim();
      const pagador2_nombre = document.getElementById('div-nombre-2').value.trim();
      const tipo_comprobante = document.getElementById('div-comprobante-1').value;
      const comprobante2 = document.getElementById('div-comprobante-2').value;

      await dividirCobro(id, {
        metodo_pago,
        tipo_comprobante,
        pagador2_nombre,
        pagador2_doc,
        monto_pagador1,
        monto_pagador2,
        comprobante2
      });
      alert('¡Pago dividido registrado exitosamente para ambas empresas!');
    }

    cerrarModalCobro();
    await cargarDatos();
  } catch (err) {
    alert(err.message);
  }
}

export function destroy() {}
