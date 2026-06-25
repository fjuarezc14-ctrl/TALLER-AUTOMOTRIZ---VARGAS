import { getOrdenPublica, confirmarOrdenPublica } from '../api.js';

let currentOrden = null;

export async function init(container) {
  const urlParams = new URLSearchParams(window.location.search);
  const ordenId = urlParams.get('id');

  if (!ordenId) {
    container.innerHTML = renderError("Falta el identificador de la orden de servicio.");
    return;
  }

  container.innerHTML = renderSkeleton();

  try {
    currentOrden = await getOrdenPublica(ordenId);
    renderConfirmacion(container);
  } catch (err) {
    container.innerHTML = renderError(err.message || "No se pudo cargar la proforma. Verifique el enlace.");
  }
}

function renderSkeleton() {
  return `
    <div style="max-width:680px;margin:40px auto;padding:20px;width:100%;box-sizing:border-box;font-family:'Inter',sans-serif;">
      <div style="background:#fff;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.05);padding:30px;border:1px solid #e2e8f0;text-align:center;">
        <div style="width:120px;height:24px;background:#e2e8f0;margin:0 auto 20px;border-radius:6px;animation:pulse 1.5s infinite;"></div>
        <div style="height:32px;background:#e2e8f0;width:70%;margin:0 auto 15px;border-radius:8px;animation:pulse 1.5s infinite;"></div>
        <div style="height:120px;background:#f8fafc;border-radius:12px;margin-bottom:20px;animation:pulse 1.5s infinite;"></div>
        <div style="height:200px;background:#f8fafc;border-radius:12px;animation:pulse 1.5s infinite;"></div>
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
      </style>
    </div>
  `;
}

function renderError(msg) {
  return `
    <div style="max-width:550px;margin:60px auto;padding:20px;width:100%;box-sizing:border-box;text-align:center;font-family:'Inter',sans-serif;">
      <div style="background:#fff;border-radius:16px;box-shadow:0 15px 35px rgba(0,0,0,0.08);padding:40px 24px;border:1px solid #fee2e2;">
        <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
        <h3 style="font-size:18px;font-weight:800;color:#991b1b;margin-bottom:8px;">Error al cargar presupuesto</h3>
        <p style="font-size:13px;color:#64748b;line-height:1.5;margin-bottom:24px;">${msg}</p>
        <p style="font-size:12px;color:#94a3b8;">Inversiones y Servicios Vargas E.I.R.L. · Cajamarca</p>
      </div>
    </div>
  `;
}

function renderConfirmacion(container) {
  const o = currentOrden;
  const isPendingApproval = o.estado === 'Diagnostico';

  const subtotal = (o.total_estimado || 0) / 1.18;
  const igv = (o.total_estimado || 0) - subtotal;

  container.innerHTML = `
    <div class="confirmar-wrapper" style="max-width:680px;margin:40px auto;padding:20px;width:100%;box-sizing:border-box;font-family:'Inter',sans-serif;">
      
      <!-- Ficha de confirmación -->
      <div style="background:#fff;border-radius:16px;box-shadow:0 15px 35px rgba(0,0,0,0.06);border:1px solid #e2e8f0;overflow:hidden;margin-bottom:30px;">
        
        <!-- Cabecera Corporativa -->
        <div style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:24px 30px;color:white;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div>
              <h2 style="font-size:16px;font-weight:900;margin:0;letter-spacing:.5px;text-transform:uppercase;">Inversiones y Servicios Vargas E.I.R.L.</h2>
              <p style="font-size:10px;color:#94a3b8;margin:2px 0 0;">Jr. Reyna Farge N° 648 - Cajamarca</p>
            </div>
            <div style="background:rgba(255,255,255,0.08);padding:6px 12px;border-radius:8px;font-size:11px;border:1px solid rgba(255,255,255,0.1);">
              Orden N°: <strong>OS-${String(o.id).padStart(4, '0')}</strong>
            </div>
          </div>
        </div>

        <div style="padding:30px;">
          <!-- Mensaje descriptivo inicial -->
          <div style="margin-bottom:24px;border-bottom:1px solid #f1f5f9;padding-bottom:20px;text-align:center;">
            <h1 style="font-size:20px;font-weight:900;color:#1e293b;margin:0 0 8px;">Presupuesto de Servicio Mecánico</h1>
            <p style="font-size:13px;color:#64748b;line-height:1.5;margin:0;">
              Hola <strong>${o.cliente}</strong>, revise a continuación el detalle y costos de los trabajos diagnosticados para su vehículo.
            </p>
          </div>

          <!-- Banner de estado actual si ya no requiere aprobación -->
          ${!isPendingApproval ? `
            <div style="background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:12px;padding:16px;margin-bottom:24px;display:flex;align-items:center;gap:12px;">
              <div style="font-size:24px;">✅</div>
              <div>
                <strong style="display:block;font-size:13.5px;">¡Trabajos ya Autorizados!</strong>
                <span style="font-size:12px;color:#047857;">Esta proforma fue aprobada previamente. Su vehículo se encuentra actualmente en estado: <strong>${o.estado}</strong>.</span>
              </div>
            </div>
          ` : ''}

          <!-- Detalles del Vehículo -->
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
            <p style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Detalles del Vehículo</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;">
              <div>
                <span style="font-size:11px;color:#64748b;display:block;">Vehículo</span>
                <strong style="font-size:13px;color:#1e293b;">${o.vehiculo || '—'}</strong>
              </div>
              <div>
                <span style="font-size:11px;color:#64748b;display:block;">Placa</span>
                <strong style="font-size:13px;color:#1e293b;font-family:monospace;">${o.placa || '—'}</strong>
              </div>
              <div>
                <span style="font-size:11px;color:#64748b;display:block;">Kilometraje</span>
                <strong style="font-size:13px;color:#1e293b;">${o.kilometraje ? o.kilometraje.toLocaleString() : '0'} Km</strong>
              </div>
              <div>
                <span style="font-size:11px;color:#64748b;display:block;">Fecha de Ingreso</span>
                <strong style="font-size:13px;color:#1e293b;">${o.created_at ? o.created_at.split('T')[0] : '—'}</strong>
              </div>
            </div>
          </div>

          <!-- Presupuesto / Items -->
          <div style="margin-bottom:24px;">
            <p style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Servicios y Repuestos Cotizados</p>
            <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                  <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#64748b;">
                    <th style="padding:10px 14px;text-align:left;font-weight:600;font-size:11px;text-transform:uppercase;width:50px;">Cant.</th>
                    <th style="padding:10px 14px;text-align:left;font-weight:600;font-size:11px;text-transform:uppercase;">Descripción</th>
                    <th style="padding:10px 14px;text-align:right;font-weight:600;font-size:11px;text-transform:uppercase;width:90px;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${o.items && o.items.length > 0 ? o.items.map((it, idx) => `
                    <tr style="border-bottom:1px solid #f1f5f9;background:${idx % 2 === 0 ? '#fff' : '#fafbfd'};">
                      <td style="padding:12px 14px;font-weight:800;color:#64748b;font-family:monospace;">${it.cantidad}</td>
                      <td style="padding:12px 14px;">
                        <span style="display:block;font-weight:600;color:#1e293b;">${it.descripcion}</span>
                        <span style="font-size:10.5px;color:${it.tipo === 'almacen' ? '#2563eb' : '#16a34a'};font-weight:600;">
                          ${it.tipo === 'almacen' ? '📦 Repuesto' : '🛠️ Mano de Obra'}
                        </span>
                      </td>
                      <td style="padding:12px 14px;text-align:right;font-family:monospace;font-weight:700;color:#1e293b;">
                        S/ ${(parseFloat(it.precio_unitario || 0) * parseInt(it.cantidad || 1)).toFixed(2)}
                      </td>
                    </tr>
                  `).join('') : `
                    <tr>
                      <td colspan="3" style="padding:24px;text-align:center;color:#64748b;font-style:italic;">
                        No hay ítems cargados en el presupuesto actual.
                      </td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Totales -->
          <div style="display:flex;justify-content:flex-end;margin-bottom:30px;">
            <div style="width:260px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;">
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#64748b;">
                <span>Op. Gravadas (Neto)</span>
                <span style="font-family:monospace;">S/ ${subtotal.toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#64748b;border-bottom:1px dashed #cbd5e1;padding-bottom:8px;margin-bottom:8px;">
                <span>IGV (18%)</span>
                <span style="font-family:monospace;">S/ ${igv.toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-weight:900;">
                <span style="color:#1e293b;font-size:13.5px;">TOTAL ESTIMADO</span>
                <span style="color:#059669;font-size:16px;font-family:monospace;">S/ ${(o.total_estimado || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <!-- Sección de Aprobación -->
          ${isPendingApproval ? `
            <div id="approval-box">
              <button id="btn-approve-presupuesto" class="btn-approve" style="width:100%;background:#059669;color:#fff;border:none;border-radius:12px;padding:16px;font-size:15px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 10px 20px rgba(5,150,105,0.2);transition:all .2s ease;">
                <span>✅ AUTORIZAR INICIO DE TRABAJOS</span>
              </button>
              <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:10px;line-height:1.4;">
                Al hacer clic, autoriza digitalmente al taller a comenzar los servicios y repuestos listados arriba.
              </p>
            </div>
          ` : `
            <div style="background:#f1f5f9;border-radius:12px;padding:14px;text-align:center;font-size:12px;color:#475569;">
              ℹ️ Este servicio ya se encuentra en fase operativa y no requiere acciones adicionales.
            </div>
          `}

        </div>
      </div>
      
      <!-- Footer corporativo -->
      <div style="text-align:center;font-size:11.5px;color:#94a3b8;line-height:1.5;">
        <span>Inversiones y Servicios Vargas E.I.R.L.</span><br/>
        <span>Jr. Reyna Farge N° 648 - Cajamarca | Tel: 931 163 369</span>
      </div>

      <style>
        .btn-approve:hover {
          background: #047857 !important;
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(5,150,105,0.3) !important;
        }
        .btn-approve:active {
          transform: translateY(0);
        }
        .btn-approve:disabled {
          background: #94a3b8 !important;
          cursor: not-allowed !important;
          box-shadow: none !important;
          transform: none !important;
        }
      </style>
    </div>
  `;

  // Bind events if pending approval
  if (isPendingApproval) {
    const btnApprove = document.getElementById('btn-approve-presupuesto');
    btnApprove.addEventListener('click', async () => {
      btnApprove.disabled = true;
      btnApprove.innerHTML = `
        <div style="width:18px;height:18px;border:3px border-t-transparent border-white rounded-full animate-spin"></div>
        <span>⏳ Enviando autorización...</span>
      `;
      btnApprove.style.background = '#94a3b8';

      try {
        await confirmarOrdenPublica(o.id);
        renderSuccess(container, o);
      } catch (err) {
        alert(err.message || "Ocurrió un error al autorizar los trabajos.");
        btnApprove.disabled = false;
        btnApprove.style.background = '#059669';
        btnApprove.innerHTML = `<span>✅ AUTORIZAR INICIO DE TRABAJOS</span>`;
      }
    });
  }
}

function renderSuccess(container, o) {
  container.innerHTML = `
    <div style="max-width:580px;margin:60px auto;padding:20px;width:100%;box-sizing:border-box;font-family:'Inter',sans-serif;text-align:center;">
      <div style="background:#fff;border-radius:16px;box-shadow:0 15px 35px rgba(0,0,0,0.08);padding:48px 30px;border:1px solid #a7f3d0;">
        <div style="width:80px;height:80px;background:#d1fae5;color:#059669;font-size:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;box-shadow:0 8px 16px rgba(5,150,105,0.1);">
          ✓
        </div>
        <h2 style="font-size:22px;font-weight:900;color:#065f46;margin:0 0 10px;">¡Presupuesto Autorizado!</h2>
        <p style="font-size:14px;color:#047857;font-weight:600;margin-bottom:16px;">
          Orden OS-${String(o.id).padStart(4, '0')} · Placa: ${o.placa}
        </p>
        <p style="font-size:13.5px;color:#64748b;line-height:1.6;margin:0 0 30px;padding:0 10px;">
          Hemos recibido su confirmación con éxito. El equipo técnico del taller ha sido notificado y comenzará los trabajos inmediatamente en su vehículo.
        </p>
        
        <div style="border-top:1px solid #f1f5f9;padding-top:20px;margin-top:20px;">
          <p style="font-size:12.5px;color:#475569;margin:0 0 4px;">Gracias por confiar en nosotros</p>
          <strong style="font-size:13.5px;color:#1e293b;text-transform:uppercase;letter-spacing:.5px;display:block;">Inversiones y Servicios Vargas E.I.R.L.</strong>
        </div>
      </div>
    </div>
  `;
}

export function destroy() {}
