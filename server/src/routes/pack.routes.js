import { Router } from "express";
import { z } from "zod";
import pool from "../config/database.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

const purchaseSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(20).default(1)
});

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + Number(item.weight), 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= Number(item.weight);
    if (roll < 0) return item;
  }
  return items[items.length - 1] || null;
}

// GET /api/packs/inventory
router.get("/inventory", async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT pi.pack_id, pi.quantity, cp.name, cp.description,
              cp.price, cp.cards_per_pack, cp.image_url
       FROM player_pack_inventory pi
       JOIN card_packs cp ON cp.id = pi.pack_id
       WHERE pi.user_id = ? AND pi.quantity > 0
       ORDER BY cp.price ASC`,
      [req.user.id]
    );
    res.json({ success: true, packs: rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/packs/:packId/purchase
router.post("/:packId/purchase", async (req, res, next) => {
  const parsed = purchaseSchema.safeParse(req.body || {});
  const packId = Number.parseInt(req.params.packId, 10);

  if (!Number.isSafeInteger(packId) || packId < 1 || !parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Thông tin mua pack không hợp lệ."
    });
  }

  const quantity = parsed.data.quantity;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [packs] = await connection.execute(
      "SELECT id, name, price FROM card_packs WHERE id = ? AND is_active = TRUE FOR UPDATE",
      [packId]
    );
    if (!packs.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Pack không tồn tại hoặc đã ngừng bán." });
    }

    const [wallets] = await connection.execute(
      "SELECT cash FROM player_wallets WHERE user_id = ? FOR UPDATE",
      [req.user.id]
    );
    if (!wallets.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy ví người chơi." });
    }

    const totalCost = Number(packs[0].price) * quantity;
    const currentCash = Number(wallets[0].cash);
    if (!Number.isSafeInteger(totalCost) || currentCash < totalCost) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Không đủ tiền để mua pack." });
    }

    const balanceAfter = currentCash - totalCost;
    await connection.execute(
      "UPDATE player_wallets SET cash = ? WHERE user_id = ?",
      [balanceAfter, req.user.id]
    );
    await connection.execute(
      `INSERT INTO player_pack_inventory (user_id, pack_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [req.user.id, packId, quantity]
    );
    await connection.execute(
      `INSERT INTO transactions
       (user_id, transaction_type, amount, balance_after, description, reference_id)
       VALUES (?, 'pack_purchase', ?, ?, ?, ?)`,
      [req.user.id, totalCost, balanceAfter, `Mua ${quantity} x ${packs[0].name}`, String(packId)]
    );

    await connection.commit();
    res.json({
      success: true,
      message: "Mua pack thành công.",
      purchased: { packId, quantity, totalCost },
      wallet: { cash: balanceAfter }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
});

// POST /api/packs/:packId/open - rarity is always selected by the server.
router.post("/:packId/open", async (req, res, next) => {
  const packId = Number.parseInt(req.params.packId, 10);
  if (!Number.isSafeInteger(packId) || packId < 1) {
    return res.status(400).json({ success: false, message: "Pack ID không hợp lệ." });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [packs] = await connection.execute(
      "SELECT id, name, cards_per_pack FROM card_packs WHERE id = ? AND is_active = TRUE FOR UPDATE",
      [packId]
    );
    if (!packs.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Pack không tồn tại hoặc đã ngừng bán." });
    }

    const [inventory] = await connection.execute(
      "SELECT quantity FROM player_pack_inventory WHERE user_id = ? AND pack_id = ? FOR UPDATE",
      [req.user.id, packId]
    );
    if (!inventory.length || Number(inventory[0].quantity) < 1) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Mày không có pack này trong kho." });
    }

    const [rates] = await connection.execute(
      "SELECT rarity, weight FROM pack_drop_rates WHERE pack_id = ? AND weight > 0",
      [packId]
    );
    const [editions] = await connection.execute(
      `SELECT ce.id, ce.edition_name, ce.rarity, ce.overall,
              ce.artwork_url, ce.market_value,
              fp.name AS player_name, fp.club, fp.nationality, fp.position
       FROM card_editions ce
       JOIN football_players fp ON fp.id = ce.player_id
       WHERE ce.is_active = TRUE AND fp.is_active = TRUE`
    );

    if (!editions.length || !rates.length) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: "Chưa có dữ liệu thẻ hoặc tỷ lệ mở pack." });
    }

    const pools = new Map();
    for (const edition of editions) {
      const rarity = String(edition.rarity).toLowerCase();
      if (!pools.has(rarity)) pools.set(rarity, []);
      pools.get(rarity).push(edition);
    }

    // Only normalize configured rates for rarities that currently have eligible cards.
    const availableRates = rates
      .filter(rate => pools.has(String(rate.rarity).toLowerCase()))
      .map(rate => ({ rarity: String(rate.rarity).toLowerCase(), weight: Number(rate.weight) }));

    if (!availableRates.length) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: "Không có thẻ phù hợp với tỷ lệ pack hiện tại." });
    }

    const [openingResult] = await connection.execute(
      "INSERT INTO pack_openings (user_id, pack_id, total_cards) VALUES (?, ?, ?)",
      [req.user.id, packId, packs[0].cards_per_pack]
    );
    const cards = [];

    for (let i = 0; i < Number(packs[0].cards_per_pack); i += 1) {
      const selectedRate = weightedPick(availableRates);
      const candidates = pools.get(selectedRate.rarity);
      const edition = candidates[Math.floor(Math.random() * candidates.length)];

      const [cardResult] = await connection.execute(
        `INSERT INTO card_instances
         (user_id, edition_id, acquisition_price, status)
         VALUES (?, ?, ?, 'owned')`,
        [req.user.id, edition.id, edition.market_value]
      );

      await connection.execute(
        "INSERT INTO pack_opening_items (opening_id, card_instance_id) VALUES (?, ?)",
        [openingResult.insertId, cardResult.insertId]
      );

      cards.push({
        cardId: cardResult.insertId,
        editionId: edition.id,
        playerName: edition.player_name,
        club: edition.club,
        nationality: edition.nationality,
        position: edition.position,
        editionName: edition.edition_name,
        rarity: edition.rarity,
        overall: edition.overall,
        artworkUrl: edition.artwork_url,
        marketValue: edition.market_value
      });
    }

    await connection.execute(
      "UPDATE player_pack_inventory SET quantity = quantity - 1 WHERE user_id = ? AND pack_id = ?",
      [req.user.id, packId]
    );

    const [wallets] = await connection.execute(
      "SELECT cash FROM player_wallets WHERE user_id = ?",
      [req.user.id]
    );
    await connection.execute(
      `INSERT INTO transactions
       (user_id, transaction_type, amount, balance_after, description, reference_id)
       VALUES (?, 'pack_opening', 0, ?, ?, ?)`,
      [req.user.id, wallets[0]?.cash ?? 0, `Mở ${packs[0].name}`, String(openingResult.insertId)]
    );

    await connection.commit();
    res.json({
      success: true,
      message: "Mở pack thành công.",
      openingId: openingResult.insertId,
      pack: packs[0],
      cards
    });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
});

export default router;
