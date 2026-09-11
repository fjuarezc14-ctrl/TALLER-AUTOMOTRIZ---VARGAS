// ============================================================
// Ruta de Usuarios - Taller Vargas ERP
// Solo accesible para administradores
// ============================================================

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requiereToken, soloAdmin } from '../middleware/auth.js';

const router = Router();

// Todos los endpoints de usuarios requieren token y ser administrador
router.use(requiereToken, soloAdmin);

// GET /api/usuarios - Listar personal unificado con métricas operativas
router.get('/', async (req, res) => {
  try {
    const [uRes, mRes, statsRes] = await Promise.all([
      query(`
        SELECT id, username, rol, created_at, 
               COALESCE(intentos_fallidos, 0) AS intentos_fallidos, 
               COALESCE(cuenta_bloqueada, false) AS cuenta_bloqueada, 
               bloqueada_motivo, 
               bloqueado_hasta 
        FROM usuarios 
        ORDER BY id ASC
      `),
      query('SELECT id, nombre, activo, created_at FROM mecanicos ORDER BY nombre ASC'),
      query(`
        SELECT 
          mecanico_id,
          COUNT(CASE WHEN estado NOT IN ('Finalizado','Entregado','No realizo servicio') THEN 1 END)::int AS ordenes_activas,
          COUNT(CASE WHEN estado IN ('Finalizado','Entregado') THEN 1 END)::int AS ordenes_completadas,
          ROUND(
            COALESCE(
              AVG(
                CASE WHEN estado = 'Finalizado' AND fecha_entrega IS NOT NULL
                  THEN EXTRACT(EPOCH FROM (fecha_entrega - fecha_ingreso)) / 86400.0
                END
              ), 0)::numeric, 1
          ) AS dias_promedio
        FROM ordenes_servicio
        GROUP BY mecanico_id
      `)
    ]);

    const statsMap = {};
    statsRes.rows.forEach(s => {
      statsMap[s.mecanico_id] = s;
    });

    const mecanicos = mRes.rows.map(m => ({
      ...m,
      stats: statsMap[m.id] || { ordenes_activas: 0, ordenes_completadas: 0, dias_promedio: 0 }
    }));

    const usuarios = uRes.rows.map(u => {
      const matchedMec = mecanicos.find(m => 
        m.nombre.toLowerCase().trim() === u.username.toLowerCase().trim() ||
        m.nombre.toLowerCase().trim().includes(u.username.toLowerCase().trim()) ||
        u.username.toLowerCase().trim().includes(m.nombre.toLowerCase().trim())
      );
      return {
        ...u,
        mecanico_id: matchedMec ? matchedMec.id : null,
        nombre_completo: matchedMec ? matchedMec.nombre : u.username,
        activo: matchedMec ? matchedMec.activo : true,
        ordenes_activas: matchedMec ? matchedMec.stats.ordenes_activas : 0,
        ordenes_completadas: matchedMec ? matchedMec.stats.ordenes_completadas : 0,
        dias_promedio: matchedMec ? matchedMec.stats.dias_promedio : 0
      };
    });

    res.json({
      usuarios,
      mecanicos
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/usuarios - Crear nuevo usuario y sincronizar mecánico si aplica
router.post('/', async (req, res) => {
  const { username, password, rol, nombre_completo } = req.body;

  if (!username || !password || !rol) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  if (rol !== 'administrador' && rol !== 'operario') {
    return res.status(400).json({ error: 'Rol no válido.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const result = await query(
      'INSERT INTO usuarios (username, password_hash, rol) VALUES ($1, $2, $3) RETURNING id, username, rol, created_at',
      [username.toLowerCase().trim(), hash, rol]
    );

    const newUser = result.rows[0];

    // Si es operario/mecánico, sincronizar automáticamente con la tabla mecanicos
    if (rol === 'operario') {
      const nom = (nombre_completo || username).trim();
      const existingMec = await query('SELECT id FROM mecanicos WHERE LOWER(TRIM(nombre)) = LOWER($1)', [nom]);
      if (existingMec.rows.length === 0) {
        await query('INSERT INTO mecanicos (nombre, activo) VALUES ($1, TRUE)', [nom]);
      } else {
        await query('UPDATE mecanicos SET activo = TRUE WHERE id = $1', [existingMec.rows[0].id]);
      }
    }

    res.status(201).json(newUser);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El nombre de usuario ya está registrado.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/usuarios/:id - Editar usuario (rol, nombre, contraseña opcional)
router.put('/:id', async (req, res) => {
  const { username, password, rol, nombre_completo, activo } = req.body;
  const { id } = req.params;

  if (!username || !rol) {
    return res.status(400).json({ error: 'Nombre de usuario y rol son obligatorios.' });
  }

  if (rol !== 'administrador' && rol !== 'operario') {
    return res.status(400).json({ error: 'Rol no válido.' });
  }

  try {
    let result;
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);

      result = await query(
        `UPDATE usuarios 
         SET username = $1, password_hash = $2, rol = $3, 
             cuenta_bloqueada = FALSE, intentos_fallidos = 0, bloqueado_hasta = NULL, bloqueada_motivo = NULL 
         WHERE id = $4 
         RETURNING id, username, rol, created_at, cuenta_bloqueada, intentos_fallidos`,
        [username.toLowerCase().trim(), hash, rol, id]
      );
    } else {
      result = await query(
        `UPDATE usuarios 
         SET username = $1, rol = $2 
         WHERE id = $3 
         RETURNING id, username, rol, created_at, cuenta_bloqueada, intentos_fallidos`,
        [username.toLowerCase().trim(), rol, id]
      );
    }

    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });

    // Sincronizar mecánico si aplica
    if (rol === 'operario') {
      const nom = (nombre_completo || username).trim();
      const existingMec = await query('SELECT id FROM mecanicos WHERE LOWER(TRIM(nombre)) = LOWER($1)', [nom]);
      if (existingMec.rows.length === 0) {
        await query('INSERT INTO mecanicos (nombre, activo) VALUES ($1, $2)', [nom, activo !== undefined ? Boolean(activo) : true]);
      } else if (activo !== undefined) {
        await query('UPDATE mecanicos SET activo = $1 WHERE id = $2', [Boolean(activo), existingMec.rows[0].id]);
      }
    }

    return res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El nombre de usuario ya está registrado.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/usuarios/:id/desbloquear - Desbloquear cuenta manualmente
router.patch('/:id/desbloquear', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(
      `UPDATE usuarios 
       SET cuenta_bloqueada = FALSE, 
           intentos_fallidos = 0, 
           bloqueado_hasta = NULL, 
           bloqueada_motivo = NULL 
       WHERE id = $1 
       RETURNING id, username, rol, cuenta_bloqueada, intentos_fallidos`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json({ message: 'Cuenta desbloqueada correctamente.', usuario: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/usuarios/:id - Eliminar usuario
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  // Evitar eliminar al usuario activo actual
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario activo.' });
  }

  try {
    const uRes = await query('SELECT username, rol FROM usuarios WHERE id = $1', [id]);
    if (uRes.rows.length > 0 && uRes.rows[0].rol === 'operario') {
      // Desactivar mecánico en lugar de romper órdenes pasadas
      await query('UPDATE mecanicos SET activo = FALSE WHERE LOWER(TRIM(nombre)) = LOWER($1)', [uRes.rows[0].username]);
    }

    const result = await query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.json({ message: 'Usuario eliminado correctamente.', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
