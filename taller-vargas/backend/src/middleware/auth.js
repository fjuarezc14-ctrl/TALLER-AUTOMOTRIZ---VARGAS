// ============================================================
// Middleware de autenticación JWT - Taller Vargas ERP
// Verifica el token Bearer en cada ruta protegida
// ============================================================

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'taller_vargas_secret_key_2026';

/**
 * Middleware que verifica el token JWT en el header Authorization.
 * Si es válido, agrega req.user con { id, username, rol }.
 */
export function requiereToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Token requerido.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, rol }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado. Vuelve a iniciar sesión.' });
  }
}

/**
 * Middleware que verifica que el usuario sea administrador.
 * Debe usarse DESPUÉS de requiereToken.
 */
export function soloAdmin(req, res, next) {
  if (!req.user || req.user.rol !== 'administrador') {
    return res.status(403).json({ error: 'Acceso restringido. Se requieren permisos de administrador.' });
  }
  next();
}
