
-- =====================================================
-- FOOTBALL CARD SHOP SIMULATOR
-- Migration: 001_initial_schema.sql
-- MySQL 8.0+
-- =====================================================

CREATE DATABASE IF NOT EXISTS football_card_shop
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE football_card_shop;

-- 1. USERS
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('player', 'admin') NOT NULL DEFAULT 'player',
    status ENUM('active', 'banned') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. PLAYER PROFILES
CREATE TABLE player_profiles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL UNIQUE,
    display_name VARCHAR(80) NOT NULL,
    level INT UNSIGNED NOT NULL DEFAULT 1,
    xp BIGINT UNSIGNED NOT NULL DEFAULT 0,
    reputation INT UNSIGNED NOT NULL DEFAULT 0,
    playtime_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_profile_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. PLAYER WALLETS
CREATE TABLE player_wallets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL UNIQUE,
    cash BIGINT UNSIGNED NOT NULL DEFAULT 10000,
    gems BIGINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_wallet_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. FOOTBALL PLAYERS
CREATE TABLE football_players (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    nationality VARCHAR(80),
    club VARCHAR(120),
    position VARCHAR(10),
    preferred_foot ENUM('left', 'right', 'both'),
    pac TINYINT UNSIGNED DEFAULT 0,
    sho TINYINT UNSIGNED DEFAULT 0,
    pas TINYINT UNSIGNED DEFAULT 0,
    dri TINYINT UNSIGNED DEFAULT 0,
    def TINYINT UNSIGNED DEFAULT 0,
    phy TINYINT UNSIGNED DEFAULT 0,
    overall TINYINT UNSIGNED NOT NULL,
    portrait_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_player_name (name),
    INDEX idx_player_club (club),
    INDEX idx_player_overall (overall)
) ENGINE=InnoDB;

-- 5. CARD EDITIONS
CREATE TABLE card_editions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    player_id BIGINT UNSIGNED NOT NULL,
    edition_name VARCHAR(100) NOT NULL,
    rarity ENUM(
        'common',
        'rare',
        'epic',
        'legendary',
        'icon'
    ) NOT NULL,
    overall TINYINT UNSIGNED NOT NULL,
    artwork_url VARCHAR(500),
    market_value BIGINT UNSIGNED NOT NULL DEFAULT 100,
    max_supply INT UNSIGNED DEFAULT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_edition_player
        FOREIGN KEY (player_id) REFERENCES football_players(id),

    INDEX idx_edition_rarity (rarity),
    INDEX idx_edition_player (player_id)
) ENGINE=InnoDB;

-- 6. CARD INSTANCES
-- Each card owned by a player is an independent item.
CREATE TABLE card_instances (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    edition_id BIGINT UNSIGNED NOT NULL,
    serial_number INT UNSIGNED DEFAULT NULL,
    acquisition_price BIGINT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM(
        'owned',
        'listed',
        'displayed',
        'locked',
        'sold'
    ) NOT NULL DEFAULT 'owned',
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_card_owner
        FOREIGN KEY (user_id) REFERENCES users(id),

    CONSTRAINT fk_card_edition
        FOREIGN KEY (edition_id) REFERENCES card_editions(id),

    UNIQUE KEY uq_edition_serial (edition_id, serial_number),
    INDEX idx_card_owner (user_id, status),
    INDEX idx_card_edition (edition_id)
) ENGINE=InnoDB;

-- 7. CARD PACKS
CREATE TABLE card_packs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price BIGINT UNSIGNED NOT NULL,
    cards_per_pack TINYINT UNSIGNED NOT NULL,
    image_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 8. PACK DROP RATES
-- weight is used by backend weighted-random selection.
CREATE TABLE pack_drop_rates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pack_id BIGINT UNSIGNED NOT NULL,
    rarity ENUM(
        'common',
        'rare',
        'epic',
        'legendary',
        'icon'
    ) NOT NULL,
    weight DECIMAL(8,4) NOT NULL,

    CONSTRAINT fk_drop_pack
        FOREIGN KEY (pack_id) REFERENCES card_packs(id)
        ON DELETE CASCADE,

    UNIQUE KEY uq_pack_rarity (pack_id, rarity),
    CHECK (weight >= 0)
) ENGINE=InnoDB;

-- 9. PLAYER PACK INVENTORY
CREATE TABLE player_pack_inventory (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    pack_id BIGINT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_pack_inventory_user
        FOREIGN KEY (user_id) REFERENCES users(id),

    CONSTRAINT fk_pack_inventory_pack
        FOREIGN KEY (pack_id) REFERENCES card_packs(id),

    UNIQUE KEY uq_user_pack (user_id, pack_id)
) ENGINE=InnoDB;

-- 10. PACK OPENINGS
CREATE TABLE pack_openings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    pack_id BIGINT UNSIGNED NOT NULL,
    total_cards TINYINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_opening_user
        FOREIGN KEY (user_id) REFERENCES users(id),

    CONSTRAINT fk_opening_pack
        FOREIGN KEY (pack_id) REFERENCES card_packs(id),

    INDEX idx_opening_user (user_id, created_at)
) ENGINE=InnoDB;

-- 11. PACK OPENING ITEMS
CREATE TABLE pack_opening_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    opening_id BIGINT UNSIGNED NOT NULL,
    card_instance_id BIGINT UNSIGNED NOT NULL,

    CONSTRAINT fk_opening_item
        FOREIGN KEY (opening_id) REFERENCES pack_openings(id),

    CONSTRAINT fk_opening_card
        FOREIGN KEY (card_instance_id) REFERENCES card_instances(id),

    UNIQUE KEY uq_opening_card (card_instance_id)
) ENGINE=InnoDB;

-- 12. TRANSACTIONS
CREATE TABLE transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    transaction_type ENUM(
        'pack_purchase',
        'pack_opening',
        'card_sale',
        'card_purchase',
        'shop_upgrade',
        'reward',
        'expense'
    ) NOT NULL,
    amount BIGINT UNSIGNED NOT NULL,
    balance_after BIGINT UNSIGNED NOT NULL,
    description VARCHAR(255),
    reference_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_transaction_user
        FOREIGN KEY (user_id) REFERENCES users(id),

    INDEX idx_transaction_user (user_id, created_at)
) ENGINE=InnoDB;

-- 13. GAME SAVES
CREATE TABLE game_saves (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL UNIQUE,
    save_data JSON NOT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_save_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;
