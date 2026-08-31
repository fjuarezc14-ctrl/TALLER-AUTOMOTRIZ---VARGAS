// ─── Siluetas Vectoriales e Inspección de Daños de Vehículos ─────────

// Colores para cada tipo de daño
export const dmgColors = {
  Q: '#ef4444', // Quebrado / Roto
  A: '#f97316', // Abolladura
  R: '#8b5cf6', // Rayón
  F: '#64748b'  // Faltante
};

// 1. Silueta Lateral Izquierda
export const leftSilhouette = `
  <!-- Ground reference -->
  <line x1="20" y1="200" x2="380" y2="200" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4 4" />
  
  <!-- Body Silhouette -->
  <path d="M 30,175 C 30,165 40,150 70,148 L 110,140 L 160,105 Q 210,95 270,105 L 310,135 L 360,138 C 370,138 375,150 375,175 C 375,185 365,190 355,190 L 320,190 L 260,190 H 140 L 80,190 Z" fill="#f1f5f9" stroke="#475569" stroke-width="2" stroke-linejoin="round" />
  
  <!-- Windows -->
  <path d="M 165,110 L 210,110 L 210,135 L 150,135 Z" fill="#e2e8f0" stroke="#475569" stroke-width="1.5" />
  <path d="M 215,110 L 265,110 L 295,135 L 215,135 Z" fill="#e2e8f0" stroke="#475569" stroke-width="1.5" />
  
  <!-- Door seams -->
  <path d="M 210,110 L 210,190" stroke="#94a3b8" stroke-width="1.5" />
  <path d="M 148,135 L 148,190" stroke="#94a3b8" stroke-width="1.5" />
  <path d="M 270,115 C 275,135 275,190 275,190" stroke="#94a3b8" stroke-width="1.5" />
  
  <!-- Door handles -->
  <line x1="195" y1="142" x2="205" y2="142" stroke="#475569" stroke-width="2" stroke-linecap="round" />
  <line x1="255" y1="142" x2="265" y2="142" stroke="#475569" stroke-width="2" stroke-linecap="round" />
  
  <!-- Lights -->
  <path d="M 30,158 Q 38,158 38,165 L 30,168 Z" fill="#fef08a" stroke="#eab308" stroke-width="1" />
  <path d="M 374,145 Q 366,145 366,155 L 374,158 Z" fill="#fecaca" stroke="#dc2626" stroke-width="1" />

  <!-- Wheels (under arches) -->
  <!-- Front wheel arch -->
  <path d="M 80,175 A 30,30 0 0,1 140,175" fill="none" stroke="#475569" stroke-width="2" />
  <circle cx="110" cy="175" r="22" fill="#1e293b" stroke="#0f172a" stroke-width="2" />
  <circle cx="110" cy="175" r="10" fill="#94a3b8" stroke="#475569" stroke-width="1" />
  
  <!-- Rear wheel arch -->
  <path d="M 260,175 A 30,30 0 0,1 320,175" fill="none" stroke="#475569" stroke-width="2" />
  <circle cx="290" cy="175" r="22" fill="#1e293b" stroke="#0f172a" stroke-width="2" />
  <circle cx="290" cy="175" r="10" fill="#94a3b8" stroke="#475569" stroke-width="1" />
`;

export const leftSvgContent = leftSilhouette;

// 2. Silueta Lateral Derecha
export const rightSilhouette = `
  <!-- Ground reference -->
  <line x1="20" y1="200" x2="380" y2="200" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4 4" />
  <g transform="translate(400, 0) scale(-1, 1)">
    <!-- Body Silhouette -->
    <path d="M 30,175 C 30,165 40,150 70,148 L 110,140 L 160,105 Q 210,95 270,105 L 310,135 L 360,138 C 370,138 375,150 375,175 C 375,185 365,190 355,190 L 320,190 L 260,190 H 140 L 80,190 Z" fill="#f1f5f9" stroke="#475569" stroke-width="2" stroke-linejoin="round" />
    
    <!-- Windows -->
    <path d="M 165,110 L 210,110 L 210,135 L 150,135 Z" fill="#e2e8f0" stroke="#475569" stroke-width="1.5" />
    <path d="M 215,110 L 265,110 L 295,135 L 215,135 Z" fill="#e2e8f0" stroke="#475569" stroke-width="1.5" />
    
    <!-- Door seams -->
    <path d="M 210,110 L 210,190" stroke="#94a3b8" stroke-width="1.5" />
    <path d="M 148,135 L 148,190" stroke="#94a3b8" stroke-width="1.5" />
    <path d="M 270,115 C 275,135 275,190 275,190" stroke="#94a3b8" stroke-width="1.5" />
    
    <!-- Door handles -->
    <line x1="195" y1="142" x2="205" y2="142" stroke="#475569" stroke-width="2" stroke-linecap="round" />
    <line x1="255" y1="142" x2="265" y2="142" stroke="#475569" stroke-width="2" stroke-linecap="round" />
    
    <!-- Lights -->
    <path d="M 30,158 Q 38,158 38,165 L 30,168 Z" fill="#fef08a" stroke="#eab308" stroke-width="1" />
    <path d="M 374,145 Q 366,145 366,155 L 374,158 Z" fill="#fecaca" stroke="#dc2626" stroke-width="1" />

    <!-- Wheels (under arches) -->
    <!-- Front wheel arch -->
    <path d="M 80,175 A 30,30 0 0,1 140,175" fill="none" stroke="#475569" stroke-width="2" />
    <circle cx="110" cy="175" r="22" fill="#1e293b" stroke="#0f172a" stroke-width="2" />
    <circle cx="110" cy="175" r="10" fill="#94a3b8" stroke="#475569" stroke-width="1" />
    
    <!-- Rear wheel arch -->
    <path d="M 260,175 A 30,30 0 0,1 320,175" fill="none" stroke="#475569" stroke-width="2" />
    <circle cx="290" cy="175" r="22" fill="#1e293b" stroke="#0f172a" stroke-width="2" />
    <circle cx="290" cy="175" r="10" fill="#94a3b8" stroke="#475569" stroke-width="1" />
  </g>
`;

export const rightSvgContent = rightSilhouette;

// 3. Silueta Superior
export const topSvgContent = `
  <!-- Symmetry Axis -->
  <line x1="40" y1="125" x2="360" y2="125" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="2 2" />
  
  <!-- Body Outer border -->
  <path d="M 40,125 C 40,90 60,65 110,65 L 290,65 C 340,65 360,90 360,125 C 360,160 340,185 290,185 L 110,185 C 60,185 40,160 40,125 Z" fill="#f1f5f9" stroke="#475569" stroke-width="2" stroke-linejoin="round" />
  
  <!-- Hood seam -->
  <path d="M 105,65 L 105,185" stroke="#94a3b8" stroke-width="1.5" />
  
  <!-- Front windshield -->
  <path d="M 105,75 Q 140,125 105,175 L 130,170 Q 155,125 130,80 Z" fill="#e2e8f0" stroke="#475569" stroke-width="1.5" />
  
  <!-- Roof -->
  <path d="M 130,80 H 270 V 170 H 130 Z" fill="#f8fafc" stroke="#475569" stroke-width="1.5" />
  
  <!-- Rear window -->
  <path d="M 270,80 Q 255,125 270,170 L 290,175 Q 275,125 290,75 Z" fill="#e2e8f0" stroke="#475569" stroke-width="1.5" />
  
  <!-- Trunk seam -->
  <path d="M 290,65 L 290,185" stroke="#94a3b8" stroke-width="1.5" />
  
  <!-- Mirrors -->
  <path d="M 115,65 C 115,55 125,50 130,55 C 130,60 125,65 115,65 Z" fill="#475569" stroke="#475569" />
  <path d="M 115,185 C 115,195 125,200 130,195 C 130,190 125,185 115,185 Z" fill="#475569" stroke="#475569" />
`;

// 4. Silueta Frontal
export const frontSvgContent = `
  <!-- Roof -->
  <path d="M 130,80 Q 200,70 270,80" stroke="#475569" stroke-width="2" fill="none" />
  <!-- Windshield -->
  <path d="M 130,80 L 270,80 L 285,130 L 115,130 Z" fill="#e2e8f0" stroke="#475569" stroke-width="2" />
  <!-- Hood -->
  <path d="M 115,130 L 285,130 L 300,170 L 100,170 Z" fill="#f1f5f9" stroke="#475569" stroke-width="2" />
  
  <!-- Headlights -->
  <path d="M 102,170 H 140 L 135,185 H 105 Z" fill="#fef08a" stroke="#eab308" stroke-width="1.5" />
  <path d="M 298,170 H 260 L 265,185 H 295 Z" fill="#fef08a" stroke="#eab308" stroke-width="1.5" />
  
  <!-- Grille -->
  <path d="M 150,170 H 250 V 190 H 150 Z" fill="#1e293b" stroke="#475569" stroke-width="1.5" />
  <line x1="170" y1="170" x2="170" y2="190" stroke="#475569" stroke-width="1" />
  <line x1="190" y1="170" x2="190" y2="190" stroke="#475569" stroke-width="1" />
  <line x1="210" y1="170" x2="210" y2="190" stroke="#475569" stroke-width="1" />
  <line x1="230" y1="170" x2="230" y2="190" stroke="#475569" stroke-width="1" />
  
  <!-- Front bumper -->
  <path d="M 90,185 H 310 C 310,210 290,215 200,215 C 110,215 90,210 90,185 Z" fill="#f1f5f9" stroke="#475569" stroke-width="2" />
  
  <!-- Wheels showing at bottom -->
  <rect x="100" y="200" width="20" height="20" fill="#1e293b" stroke="#0f172a" />
  <rect x="280" y="200" width="20" height="20" fill="#1e293b" stroke="#0f172a" />
  
  <!-- Mirrors -->
  <path d="M 110,115 C 95,115 90,120 95,125 Z" fill="#475569" stroke="#475569" />
  <path d="M 290,115 C 305,115 310,120 305,125 Z" fill="#475569" stroke="#475569" />
`;

// 5. Silueta Posterior
export const rearSvgContent = `
  <!-- Roof -->
  <path d="M 130,80 Q 200,70 270,80" stroke="#475569" stroke-width="2" fill="none" />
  <!-- Rear window -->
  <path d="M 130,80 L 270,80 L 285,135 L 115,135 Z" fill="#e2e8f0" stroke="#475569" stroke-width="2" />
  <!-- Trunk lid -->
  <path d="M 115,135 L 285,135 L 295,175 L 105,175 Z" fill="#f1f5f9" stroke="#475569" stroke-width="2" />
  
  <!-- License plate -->
  <rect x="170" y="180" width="60" height="18" fill="#fef08a" stroke="#eab308" stroke-width="1" rx="2" />
  <text x="200" y="191" font-size="8" font-family="monospace" text-anchor="middle" fill="#000">PLACA</text>
  
  <!-- Tail lights -->
  <path d="M 105,170 H 145 V 185 H 105 Z" fill="#ef4444" stroke="#dc2626" stroke-width="1.5" />
  <path d="M 295,170 H 255 V 185 H 295 Z" fill="#ef4444" stroke="#dc2626" stroke-width="1.5" />
  
  <!-- Bumper -->
  <path d="M 90,185 H 310 C 310,210 290,215 200,215 C 110,215 90,210 90,185 Z" fill="#f1f5f9" stroke="#475569" stroke-width="2" />
  
  <!-- Wheels showing at bottom -->
  <rect x="100" y="200" width="20" height="20" fill="#1e293b" stroke="#0f172a" />
  <rect x="280" y="200" width="20" height="20" fill="#1e293b" stroke="#0f172a" />
  
  <!-- Mirrors -->
  <path d="M 110,115 C 95,115 90,120 95,125 Z" fill="#475569" stroke="#475569" />
  <path d="M 290,115 C 305,115 310,120 305,125 Z" fill="#475569" stroke="#475569" />
`;

// 6. Generador de SVG para Hoja de Ingreso e Impresión
export function generatePrintSVG(points = []) {
  const getMarkers = (viewName) => {
    return points
      .filter(pt => pt.view === viewName)
      .map(pt => {
        const color = dmgColors[pt.type] || '#ef4444';
        return `
          <g class="dmg-marker">
            <circle cx="${pt.x}" cy="${pt.y}" r="12" fill="${color}30" stroke="${color}" stroke-width="2"></circle>
            <text x="${pt.x}" y="${pt.y}" fill="${color}" font-family="system-ui, sans-serif" font-weight="bold" font-size="9" text-anchor="middle" dominant-baseline="central">${pt.type}</text>
          </g>
        `;
      })
      .join('');
  };

  return `
    <svg viewBox="0 0 560 225" class="vargas-print-chassis-svg" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff;">
      <!-- VISTA LATERAL IZQUIERDA -->
      <g transform="translate(15, -10) scale(0.58)">
        ${leftSilhouette}
        ${getMarkers('left')}
      </g>
      <text x="131" y="112" font-size="7.5" font-family="system-ui, sans-serif" font-weight="bold" fill="#475569" text-anchor="middle">LATERAL IZQUIERDA</text>

      <!-- VISTA LATERAL DERECHA -->
      <g transform="translate(310, -10) scale(0.58)">
        ${rightSilhouette}
        ${getMarkers('right')}
      </g>
      <text x="426" y="112" font-size="7.5" font-family="system-ui, sans-serif" font-weight="bold" fill="#475569" text-anchor="middle">LATERAL DERECHA</text>

      <!-- VISTA FRONTAL -->
      <g transform="translate(15, 115) scale(0.48)">
        ${frontSvgContent}
        ${getMarkers('front')}
      </g>
      <text x="111" y="222" font-size="7.5" font-family="system-ui, sans-serif" font-weight="bold" fill="#475569" text-anchor="middle">VISTA FRONTAL</text>

      <!-- VISTA SUPERIOR -->
      <g transform="translate(184, 115) scale(0.48)">
        ${topSvgContent}
        ${getMarkers('top')}
      </g>
      <text x="280" y="222" font-size="7.5" font-family="system-ui, sans-serif" font-weight="bold" fill="#475569" text-anchor="middle">VISTA SUPERIOR</text>

      <!-- VISTA POSTERIOR -->
      <g transform="translate(353, 115) scale(0.48)">
        ${rearSvgContent}
        ${getMarkers('rear')}
      </g>
      <text x="449" y="222" font-size="7.5" font-family="system-ui, sans-serif" font-weight="bold" fill="#475569" text-anchor="middle">VISTA POSTERIOR</text>
    </svg>
  `;
}
