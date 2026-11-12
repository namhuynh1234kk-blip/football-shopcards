
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

// GET /api/player/cards - player's card collection
router.get("/cards", async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim().slice(0, 80);
    const rarity = String(req.query.rarity || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim().toLowerCase();
    const allowedRarities = ["common", "rare", "epic", "legendary", "icon"];
    const allowedStatuses = ["owned", "listed", "displayed", "locked"];

    if (rarity && !allowedRarities.includes(rarity)) {
      return res.status(400).json({ success: false, message: "Độ hiếm không hợp lệ." });
    }
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái thẻ không hợp lệ." });
    }

    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 100);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;
    const conditions = ["ci.user_id = ?", "ci.status <> 'sold'"];
    const params = [req.user.id];

    if (rarity) {
      conditions.push("ce.rarity = ?");
      params.push(rarity);
    }
    if (status) {
      conditions.push("ci.status = ?");
      params.push(status);
    }
    if (search) {
      conditions.push("(fp.name LIKE ? OR fp.club LIKE ? OR ce.edition_name LIKE ?)");
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword);
    }

    const where = conditions.join(" AND ");
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM card_instances ci
       JOIN card_editions ce ON ce.id = ci.edition_id
       JOIN football_players fp ON fp.id = ce.player_id
       WHERE ${where}`,
      params
    );

    const [cards] = await pool.execute(
      `SELECT
         ci.id AS card_id, ci.serial_number, ci.acquisition_price,
         ci.status, ci.acquired_at,
         ce.id AS edition_id, ce.edition_name, ce.rarity,
         ce.overall, ce.artwork_url, ce.market_value,
         fp.id AS player_id, fp.name AS player_name,
         fp.nationality, fp.club, fp.position,
         fp.pac, fp.sho, fp.pas, fp.dri, fp.def, fp.phy
       FROM card_instances ci
       JOIN card_editions ce ON ce.id = ci.edition_id
       JOIN football_players fp ON fp.id = ce.player_id
       WHERE ${where}
       ORDER BY ce.overall DESC, ci.acquired_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      cards,
      pagination: {
        page,
        limit,
        total: Number(countRows[0].total),
        totalPages: Math.ceil(Number(countRows[0].total) / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/player/cards/:cardId
router.get("/cards/:cardId", async (req, res, next) => {
  try {
    const cardId = Number.parseInt(req.params.cardId, 10);
    if (!Number.isSafeInteger(cardId) || cardId < 1) {
      return res.status(400).json({ success: false, message: "ID thẻ không hợp lệ." });
    }

    const [rows] = await pool.execute(
      `SELECT
         ci.id AS card_id, ci.serial_number, ci.acquisition_price,
         ci.status, ci.acquired_at,
         ce.id AS edition_id, ce.edition_name, ce.rarity,
         ce.overall, ce.artwork_url, ce.market_value,
         fp.id AS player_id, fp.name AS player_name,
         fp.nationality, fp.club, fp.position,
         fp.pac, fp.sho, fp.pas, fp.dri, fp.def, fp.phy
       FROM card_instances ci
       JOIN card_editions ce ON ce.id = ci.edition_id
       JOIN football_players fp ON fp.id = ce.player_id
       WHERE ci.id = ? AND ci.user_id = ? AND ci.status <> 'sold'
       LIMIT 1`,
      [cardId, req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thẻ trong bộ sưu tập." });
    }
    res.json({ success: true, card: rows[0] });
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
