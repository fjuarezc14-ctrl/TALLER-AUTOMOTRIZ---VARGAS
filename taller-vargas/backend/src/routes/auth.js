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
  let { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  try {
    const userStr = String(username).trim().toLowerCase();
    const passStr = String(password);

    const result = await query(
      `SELECT id, username, password_hash, rol, 
              COALESCE(intentos_fallidos, 0) AS intentos_fallidos, 
              bloqueado_hasta, 
              COALESCE(cuenta_bloqueada, false) AS cuenta_bloqueada, 
              bloqueada_motivo 
       FROM usuarios 
       WHERE username = $1`,
      [userStr]
    );

    const user = result.rows[0];

    // 1. Si el usuario no existe: comparación simulada (timing attack protection)
    if (!user) {
      await bcrypt.compare(passStr, '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    // 2. Si la cuenta ya está bloqueada permanentemente (5 intentos fallidos)
    if (user.cuenta_bloqueada) {
      return res.status(423).json({
        error: 'Tu cuenta ha sido bloqueada por seguridad tras 5 intentos fallidos. Por favor, contacta con un administrador para restablecer tu contraseña.',
        cuenta_bloqueada: true,
        bloqueada_motivo: user.bloqueada_motivo || 'Superó 5 intentos fallidos'
      });
    }

    // 3. Si la cuenta está en cooldown temporal (intento 3 o 4)
    if (user.bloqueado_hasta) {
      const tiempoBloqueo = new Date(user.bloqueado_hasta).getTime();
      const ahora = Date.now();
      if (tiempoBloqueo > ahora) {
        const segundosRestantes = Math.max(1, Math.ceil((tiempoBloqueo - ahora) / 1000));
        const restantesParaBloqueo = Math.max(1, 5 - user.intentos_fallidos);
        return res.status(429).json({
          error: `Debes esperar ${segundosRestantes} segundo(s) antes del próximo intento. Advertencia: Al 5to intento fallido tu cuenta será bloqueada (te quedan ${restantesParaBloqueo} intentos).`,
          espera_segundos: segundosRestantes,
          intentos_fallidos: user.intentos_fallidos,
          intentos_restantes: restantesParaBloqueo,
          advertencia_bloqueo: true
        });
      }
    }

    // 4. Validar contraseña con bcrypt
    const passwordOk = await bcrypt.compare(passStr, user.password_hash);

    // 5. Manejo de contraseña correcta
    if (passwordOk) {
      // Restablecer contadores de fallos al ingresar exitosamente
      if (user.intentos_fallidos > 0 || user.bloqueado_hasta) {
        await query(
          'UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_intento_fallido = NULL WHERE id = $1',
          [user.id]
        );
      }

      const payload = { id: user.id, username: user.username, rol: user.rol };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

      return res.json({
        token,
        user: { id: user.id, username: user.username, rol: user.rol }
      });
    }

    // 6. Manejo de contraseña INCORRECTA
    const nuevosIntentos = (user.intentos_fallidos || 0) + 1;

    // Caso A: Llegó a 5 o más intentos fallidos -> Bloqueo permanente
    if (nuevosIntentos >= 5) {
      await query(
        `UPDATE usuarios SET 
           intentos_fallidos = $1, 
           cuenta_bloqueada = TRUE, 
           bloqueada_motivo = 'Cuenta bloqueada automáticamente tras 5 intentos fallidos consecutivos.',
           bloqueado_hasta = NULL, 
           ultimo_intento_fallido = NOW() 
         WHERE id = $2`,
        [nuevosIntentos, user.id]
      );

      return res.status(423).json({
        error: 'Tu cuenta ha sido bloqueada por seguridad tras 5 intentos fallidos. Por favor, contacta con un administrador para restablecer tu contraseña.',
        cuenta_bloqueada: true,
        intentos_fallidos: nuevosIntentos
      });
    }

    // Caso B: 4to intento fallido -> 60 segundos de cooldown + advertencia crítica
    if (nuevosIntentos === 4) {
      await query(
        `UPDATE usuarios SET 
           intentos_fallidos = 4, 
           bloqueado_hasta = NOW() + INTERVAL '60 seconds', 
           ultimo_intento_fallido = NOW() 
         WHERE id = $1`,
        [user.id]
      );

      return res.status(429).json({
        error: 'Contraseña incorrecta. Debes esperar 60 segundos antes de volver a intentar. ¡Atención: Al siguiente intento fallido (5to) tu cuenta será bloqueada!',
        espera_segundos: 60,
        intentos_fallidos: 4,
        intentos_restantes: 1,
        advertencia_bloqueo: true
      });
    }

    // Caso C: 3er intento fallido -> 30 segundos de cooldown + advertencia
    if (nuevosIntentos === 3) {
      await query(
        `UPDATE usuarios SET 
           intentos_fallidos = 3, 
           bloqueado_hasta = NOW() + INTERVAL '30 seconds', 
           ultimo_intento_fallido = NOW() 
         WHERE id = $1`,
        [user.id]
      );

      return res.status(429).json({
        error: 'Contraseña incorrecta. Debes esperar 30 segundos antes de volver a intentar. Advertencia: Al 5to intento fallido tu cuenta será bloqueada (te quedan 2 intentos).',
        espera_segundos: 30,
        intentos_fallidos: 3,
        intentos_restantes: 2,
        advertencia_bloqueo: true
      });
    }

    // Caso D: 1er o 2do intento fallido -> aviso estándar
    await query(
      `UPDATE usuarios SET intentos_fallidos = $1, ultimo_intento_fallido = NOW() WHERE id = $2`,
      [nuevosIntentos, user.id]
    );

    const restantes = 5 - nuevosIntentos;
    return res.status(401).json({
      error: `Usuario o contraseña incorrectos. (Intentos restantes antes de bloqueo: ${restantes})`,
      intentos_fallidos: nuevosIntentos,
      intentos_restantes: restantes
    });

  } catch (err) {
    console.error('[Auth] Error en login:', err);
    return res.status(500).json({ error: err.message || 'Error interno del servidor.' });
  }
});

// GET /api/auth/me - verificar token y obtener datos del usuario
router.get('/me', requiereToken, (req, res) => {
  res.json({ user: req.user });
});

export default router;
