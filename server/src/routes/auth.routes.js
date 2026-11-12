
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import pool from "../config/database.js";
import { createToken } from "../utils/token.js";

const router = Router();

const registerSchema = z.object({
  username: z.string().trim().min(3).max(30),
  email: z.string().trim().email().max(150),
  password: z.string().min(8).max(72)
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(72)
});

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Thông tin đăng ký không hợp lệ.",
      errors: parsed.error.flatten().fieldErrors
    });
  }

  const { username, email, password } = parsed.data;
  const connection = await pool.getConnection();

  try {
    const [existing] = await connection.execute(
      "SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1",
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Username hoặc email đã được sử dụng."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await connection.beginTransaction();

    const [userResult] = await connection.execute(
      `INSERT INTO users (username, email, password_hash, role, status)
       VALUES (?, ?, ?, 'user', 'active')`,
      [username, email, passwordHash]
    );

    const userId = userResult.insertId;

    await connection.execute(
      `INSERT INTO player_profiles
       (user_id, display_name, level, xp, reputation, playtime_seconds)
       VALUES (?, ?, 1, 0, 0, 0)`,
      [userId, username]
    );

    await connection.execute(
      `INSERT INTO player_wallets (user_id, cash, gems)
       VALUES (?, 10000, 0)`,
      [userId]
    );

    await connection.commit();

    const user = {
      id: userId,
      username,
      email,
      role: "user"
    };

    return res.status(201).json({
      success: true,
      message: "Đăng ký thành công.",
      token: createToken(user),
      user
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Email hoặc mật khẩu không hợp lệ."
    });
  }

  try {
    const { email, password } = parsed.data;

    const [rows] = await pool.execute(
      `SELECT id, username, email, password_hash, role, status
       FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác."
      });
    }

    const user = rows[0];

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản hiện không hoạt động."
      });
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác."
      });
    }

    return res.json({
      success: true,
      message: "Đăng nhập thành công.",
      token: createToken(user),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
