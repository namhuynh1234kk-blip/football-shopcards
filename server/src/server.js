
import "dotenv/config";
import express from "express";
import cors from "cors";
import pool from "./config/database.js";

import authRoutes from "./routes/auth.routes.js";
import playerRoutes from "./routes/player.routes.js";
import catalogRoutes from "./routes/catalog.routes.js";

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173"
}));

app.use(express.json({ limit: "1mb" }));

// Kiểm tra API và MySQL
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      service: "football-card-shop-api",
      database: "connected"
    });
  } catch (error) {
    console.error("Database error:", error.message);

    res.status(503).json({
      success: false,
      service: "football-card-shop-api",
      database: "disconnected"
    });
  }
});

// API đăng ký và đăng nhập
app.use("/api/auth", authRoutes);

// API người chơi
app.use("/api/player", playerRoutes);

// Public player and pack catalog
app.use("/api/catalog", catalogRoutes);

// Không tìm thấy API
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint không tồn tại."
  });
});

// Xử lý lỗi
app.use((error, req, res, next) => {
  console.error("Server error:", error);

  res.status(500).json({
    success: false,
    message: "Lỗi máy chủ."
  });
});

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log("----------------------------------");
  console.log("FOOTBALL CARD SHOP API");
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log("----------------------------------");
});
