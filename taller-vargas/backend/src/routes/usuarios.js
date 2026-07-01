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

// GET /api/usuarios - Listar todos los usuarios
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, username, rol, created_at FROM usuarios ORDER BY username ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/usuarios - Crear nuevo usuario
router.post('/', async (req, res) => {
  const { username, password, rol } = req.body;

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

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El nombre de usuario ya está registrado.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/usuarios/:id - Editar usuario (rol, nombre, contraseña opcional)
router.put('/:id', async (req, res) => {
  const { username, password, rol } = req.body;
  const { id } = req.params;

  if (!username || !rol) {
    return res.status(400).json({ error: 'Nombre de usuario y rol son obligatorios.' });
  }

  if (rol !== 'administrador' && rol !== 'operario') {
    return res.status(400).json({ error: 'Rol no válido.' });
  }

  try {
    // Si se envía contraseña, la actualizamos también
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);

      const result = await query(
        'UPDATE usuarios SET username = $1, password_hash = $2, rol = $3 WHERE id = $4 RETURNING id, username, rol, created_at',
        [username.toLowerCase().trim(), hash, rol, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
      return res.json(result.rows[0]);
    } else {
      const result = await query(
        'UPDATE usuarios SET username = $1, rol = $2 WHERE id = $3 RETURNING id, username, rol, created_at',
        [username.toLowerCase().trim(), rol, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
      return res.json(result.rows[0]);
    }
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El nombre de usuario ya está registrado.' });
    }
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
