// ============================================================
// Ruta de Autenticación - Taller Vargas ERP
// POST /api/auth/login  → devuelve JWT firmado
// GET  /api/auth/me     → info del usuario logueado
// ============================================================

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { requiereToken } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'taller_vargas_secret_key_2026';
const JWT_EXPIRES = '12h'; // Token válido 12 horas

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  try {
    const result = await query(
      'SELECT id, username, password_hash, rol FROM usuarios WHERE username = $1',
      [username.toLowerCase().trim()]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const payload = { id: user.id, username: user.username, rol: user.rol };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    return res.json({
      token,
      user: { id: user.id, username: user.username, rol: user.rol }
    });
  } catch (err) {
    console.error('[Auth] Error en login:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /api/auth/me - verificar token y obtener datos del usuario
router.get('/me', requiereToken, (req, res) => {
  res.json({ user: req.user });
});

export default router;
