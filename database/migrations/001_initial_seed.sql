
USE football_card_shop;

-- Starter packs
INSERT INTO card_packs
(name, description, price, cards_per_pack)
VALUES
('Starter Pack', 'Beginner football card pack', 100, 3),
('Bronze Pack', 'Basic football collection pack', 300, 5),
('Gold Pack', 'Premium football card pack', 2000, 5);

-- Sample football players
-- Stats below are illustrative game data.
INSERT INTO football_players
(name, nationality, club, position,
 pac, sho, pas, dri, def, phy, overall)
VALUES
('Cristiano Ronaldo', 'Portugal', 'Al Nassr', 'ST',
 91, 95, 82, 89, 35, 80, 94),

('Lionel Messi', 'Argentina', 'Inter Miami', 'RW',
 85, 92, 95, 96, 35, 65, 94),

('Neymar Jr', 'Brazil', 'Santos', 'LW',
 90, 85, 86, 95, 35, 65, 90),

('Kylian Mbappe', 'France', 'Real Madrid', 'ST',
 97, 92, 80, 93, 39, 78, 93),

('Erling Haaland', 'Norway', 'Manchester City', 'ST',
 89, 95, 70, 80, 45, 90, 92);

-- Sample card editions
INSERT INTO card_editions
(player_id, edition_name, rarity, overall, market_value)
SELECT id, 'Base Edition', 'legendary', overall, 5000
FROM football_players;

-- Starter Pack drop rates
INSERT INTO pack_drop_rates (pack_id, rarity, weight)
VALUES
(1, 'common', 80),
(1, 'rare', 17),
(1, 'epic', 2.7),
(1, 'legendary', 0.3),
(2, 'common', 65),
(2, 'rare', 28),
(2, 'epic', 6),
(2, 'legendary', 1),
(3, 'common', 25),
(3, 'rare', 45),
(3, 'epic', 23),
(3, 'legendary', 6),
(3, 'icon', 1);
