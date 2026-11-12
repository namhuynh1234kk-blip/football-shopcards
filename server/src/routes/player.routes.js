
import { Router } from "express";
import { z } from "zod";
import pool from "../config/database.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

// GET /api/player/me
router.get("/me", async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         u.id, u.username, u.email, u.role, u.created_at,
         p.display_name, p.level, p.xp,
         p.reputation, p.playtime_seconds,
         w.cash, w.gems
       FROM users u
       JOIN player_profiles p ON p.user_id = u.id
       JOIN player_wallets w ON w.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ người chơi."
      });
    }

    res.json({
      success: true,
      player: rows[0]
    });
  } catch (error) {
    next(error);
  }
});

const saveSchema = z.object({
  saveData: z.record(z.string(), z.unknown())
});

// PUT /api/player/save
router.put("/save", async (req, res, next) => {
  const parsed = saveSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu lưu game không hợp lệ."
    });
  }

  try {
    const saveJson = JSON.stringify(parsed.data.saveData);

    await pool.execute(
      `INSERT INTO game_saves (user_id, save_data, version)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE
         save_data = VALUES(save_data),
         version = version + 1,
         updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, saveJson]
    );

    res.json({
      success: true,
      message: "Đã lưu tiến trình game."
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/player/save
router.get("/save", async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT save_data, version, updated_at
       FROM game_saves
       WHERE user_id = ?
       LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        hasSave: false,
        saveData: null
      });
    }

    let saveData = rows[0].save_data;

    if (typeof saveData === "string") {
      saveData = JSON.parse(saveData);
    }

    res.json({
      success: true,
      hasSave: true,
      saveData,
      version: rows[0].version,
      updatedAt: rows[0].updated_at
    });
  } catch (error) {
    next(error);
  }
});

export default router;
