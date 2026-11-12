import { Router } from "express";
import pool from "../config/database.js";

const router = Router();

// GET /api/catalog/players
// Public catalog: optional search, position and pagination.
router.get("/players", async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim().slice(0, 80);
    const position = String(req.query.position || "").trim().toUpperCase();
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 24, 1), 100);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    const conditions = ["fp.is_active = TRUE"];
    const params = [];

    if (search) {
      conditions.push("(fp.name LIKE ? OR fp.nationality LIKE ? OR fp.club LIKE ?)");
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword);
    }

    if (position) {
      conditions.push("UPPER(fp.position) = ?");
      params.push(position);
    }

    const where = conditions.join(" AND ");

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM football_players fp WHERE ${where}`,
      params
    );

    const [players] = await pool.execute(
      `SELECT
         fp.id, fp.name, fp.nationality, fp.club, fp.position,
         fp.preferred_foot, fp.pac, fp.sho, fp.pas, fp.dri,
         fp.def, fp.phy, fp.overall, fp.portrait_url,
         COUNT(ce.id) AS edition_count,
         MIN(ce.market_value) AS starting_value
       FROM football_players fp
       LEFT JOIN card_editions ce ON ce.player_id = fp.id AND ce.is_active = TRUE
       WHERE ${where}
       GROUP BY fp.id
       ORDER BY fp.overall DESC, fp.name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      players,
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

// GET /api/catalog/players/:id
router.get("/players/:id", async (req, res, next) => {
  try {
    const playerId = Number.parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(playerId) || playerId < 1) {
      return res.status(400).json({ success: false, message: "ID cầu thủ không hợp lệ." });
    }

    const [players] = await pool.execute(
      `SELECT id, name, nationality, club, position, preferred_foot,
              pac, sho, pas, dri, def, phy, overall, portrait_url
       FROM football_players
       WHERE id = ? AND is_active = TRUE
       LIMIT 1`,
      [playerId]
    );

    if (players.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy cầu thủ." });
    }

    const [editions] = await pool.execute(
      `SELECT id, edition_name, rarity, overall, artwork_url, market_value, max_supply
       FROM card_editions
       WHERE player_id = ? AND is_active = TRUE
       ORDER BY overall DESC, market_value DESC`,
      [playerId]
    );

    res.json({ success: true, player: players[0], editions });
  } catch (error) {
    next(error);
  }
});

// GET /api/catalog/packs
router.get("/packs", async (req, res, next) => {
  try {
    const [packs] = await pool.execute(
      `SELECT id, name, description, price, cards_per_pack, image_url
       FROM card_packs
       WHERE is_active = TRUE
       ORDER BY price ASC, id ASC`
    );

    res.json({ success: true, packs });
  } catch (error) {
    next(error);
  }
});

export default router;
