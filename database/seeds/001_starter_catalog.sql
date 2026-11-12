-- FOOTBALL CARD SHOP - starter catalog seed
-- Sample gameplay data. Player ratings and market values are fictional/balanced for this prototype.
USE football_card_shop;

INSERT INTO football_players
(name, nationality, club, position, preferred_foot, pac, sho, pas, dri, def, phy, overall, portrait_url, is_active)
SELECT s.name, s.nationality, s.club, s.position, s.preferred_foot,
       s.pac, s.sho, s.pas, s.dri, s.def, s.phy, s.overall, NULL, TRUE
FROM (
  SELECT 'Lionel Messi' name, 'Argentina' nationality, 'Inter Miami' club, 'RW' position, 'left' preferred_foot, 82 pac, 90 sho, 92 pas, 96 dri, 35 def, 65 phy, 93 overall
  UNION ALL SELECT 'Cristiano Ronaldo', 'Portugal', 'Al Nassr', 'ST', 'right', 85, 94, 78, 87, 34, 80, 92
  UNION ALL SELECT 'Kylian Mbappe', 'France', 'Real Madrid', 'ST', 'right', 97, 90, 80, 92, 36, 78, 91
  UNION ALL SELECT 'Erling Haaland', 'Norway', 'Manchester City', 'ST', 'left', 89, 94, 66, 80, 45, 88, 91
  UNION ALL SELECT 'Neymar Jr', 'Brazil', 'Santos', 'LW', 'right', 88, 83, 86, 95, 37, 61, 89
  UNION ALL SELECT 'Kevin De Bruyne', 'Belgium', 'Manchester City', 'CM', 'right', 72, 88, 94, 87, 64, 78, 91
  UNION ALL SELECT 'Jude Bellingham', 'England', 'Real Madrid', 'CM', 'right', 80, 86, 84, 88, 78, 83, 90
  UNION ALL SELECT 'Vinicius Junior', 'Brazil', 'Real Madrid', 'LW', 'right', 95, 84, 81, 93, 29, 68, 90
  UNION ALL SELECT 'Son Heung-min', 'South Korea', 'Tottenham Hotspur', 'LW', 'both', 88, 89, 82, 87, 42, 68, 88
  UNION ALL SELECT 'Luka Modric', 'Croatia', 'AC Milan', 'CM', 'right',  ಕೊ 68, 76, 91, 90, 72, 65, 87
) s
WHERE NOT EXISTS (SELECT 1 FROM football_players p WHERE p.name = s.name);

INSERT INTO card_editions
(player_id, edition_name, rarity, overall, artwork_url, market_value, max_supply, is_active)
SELECT p.id,
       CASE p.name
         WHEN 'Lionel Messi' THEN 'World Star'
         WHEN 'Cristiano Ronaldo' THEN 'Legendary Finisher'
         WHEN 'Kylian Mbappe' THEN 'Future Icon'
         WHEN 'Erling Haaland' THEN 'Goal Machine'
         WHEN 'Neymar Jr' THEN 'Showtime'
         WHEN 'Kevin De Bruyne' THEN 'Playmaker'
         WHEN 'Jude Bellingham' THEN 'Rising Star'
         WHEN 'Vinicius Junior' THEN 'Speed Demon'
         WHEN 'Son Heung-min' THEN 'Captain'
         ELSE 'Maestro'
       END,
       CASE
         WHEN p.overall >= 93 THEN 'icon'
         WHEN p.overall >= 91 THEN 'legendary'
         WHEN p.overall >= 89 THEN 'epic'
         ELSE 'rare'
       END,
       p.overall, NULL,
       CASE
         WHEN p.overall >= 93 THEN 12000
         WHEN p.overall >= 91 THEN 8000
         WHEN p.overall >= 89 THEN 4500
         ELSE 2200
       END,
       NULL, TRUE
FROM football_players p
WHERE p.name IN (
  'Lionel Messi','Cristiano Ronaldo','Kylian Mbappe','Erling Haaland',
  'Neymar Jr','Kevin De Bruyne','Jude Bellingham','Vinicius Junior',
  'Son Heung-min','Luka Modric'
)
AND NOT EXISTS (
  SELECT 1 FROM card_editions ce
  WHERE ce.player_id = p.id AND ce.edition_name = CASE p.name
    WHEN 'Lionel Messi' THEN 'World Star'
    WHEN 'Cristiano Ronaldo' THEN 'Legendary Finisher'
    WHEN 'Kylian Mbappe' THEN 'Future Icon'
    WHEN 'Erling Haaland' THEN 'Goal Machine'
    WHEN 'Neymar Jr' THEN 'Showtime'
    WHEN 'Kevin De Bruyne' THEN 'Playmaker'
    WHEN 'Jude Bellingham' THEN 'Rising Star'
    WHEN 'Vinicius Junior' THEN 'Speed Demon'
    WHEN 'Son Heung-min' THEN 'Captain'
    ELSE 'Maestro'
  END
);

INSERT INTO card_packs (name, description, price, cards_per_pack, image_url, is_active)
SELECT s.name, s.description, s.price, s.cards_per_pack, NULL, TRUE
FROM (
  SELECT 'Starter Pack' name, 'Gói khởi đầu dành cho cửa hàng mới.' description, 100 price, 3 cards_per_pack
  UNION ALL SELECT 'Bronze Pack', 'Gói cơ bản với cơ hội nhận thẻ hiếm.', 300, 5
  UNION ALL SELECT 'Silver Pack', 'Gói nâng cấp với nhiều thẻ chất lượng.', 800, 5
  UNION ALL SELECT 'Gold Pack', 'Gói cao cấp với cơ hội nhận thẻ Epic và Legendary.', 2000, 5
) s
WHERE NOT EXISTS (SELECT 1 FROM card_packs cp WHERE cp.name = s.name);

INSERT INTO pack_drop_rates (pack_id, rarity, weight)
SELECT cp.id, rates.rarity, rates.weight
FROM card_packs cp
JOIN (
  SELECT 'Starter Pack' pack_name, 'common' rarity, 80.0 weight
  UNION ALL SELECT 'Starter Pack', 'rare', 17.0
  UNION ALL SELECT 'Starter Pack', 'epic', 2.7
  UNION ALL SELECT 'Starter Pack', 'legendary', 0.3
  UNION ALL SELECT 'Bronze Pack', 'common', 65.0
  UNION ALL SELECT 'Bronze Pack', 'rare', 28.0
  UNION ALL SELECT 'Bronze Pack', 'epic', 6.0
  UNION ALL SELECT 'Bronze Pack', 'legendary', 1.0
  UNION ALL SELECT 'Silver Pack', 'common', 45.0
  UNION ALL SELECT 'Silver Pack', 'rare', 35.0
  UNION ALL SELECT 'Silver Pack', 'epic', 16.0
  UNION ALL SELECT 'Silver Pack', 'legendary', 3.5
  UNION ALL SELECT 'Silver Pack', 'icon', 0.5
  UNION ALL SELECT 'Gold Pack', 'common', 25.0
  UNION ALL SELECT 'Gold Pack', 'rare', 45.0
  UNION ALL SELECT 'Gold Pack', 'epic', 23.0
  UNION ALL SELECT 'Gold Pack', 'legendary', 6.0
  UNION ALL SELECT 'Gold Pack', 'icon', 1.0
) rates ON rates.pack_name = cp.name
WHERE NOT EXISTS (
  SELECT 1 FROM pack_drop_rates dr
  WHERE dr.pack_id = cp.id AND dr.rarity = rates.rarity
);
