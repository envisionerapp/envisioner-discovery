-- =============================================
-- ENVISIONER DISCOVERY - TEST SEED DATA
-- Run after 001_create_discovery_tables.sql
-- =============================================

-- TWITCH CREATORS
INSERT INTO discovery_creators (platform, platform_id, username, display_name, region, language, followers, avg_viewers, minutes_watched, duration_minutes, peak_viewers, engagement_rate, primary_category, tags, is_live, current_viewers, last_stream_title, last_stream_game, last_scraped_at) VALUES
('twitch', '71092938', 'xqc', 'xQc', 'Canada', 'en', 12400000, 45000, 2840000, 480, 85000, 63.1, 'Just Chatting', ARRAY['variety', 'react'], true, 52000, 'LIVE GAMING AND STUFF', 'Just Chatting', NOW()),
('twitch', '83232866', 'ibai', 'Ibai', 'Spain', 'es', 13800000, 48000, 1920000, 360, 120000, 40.0, 'Just Chatting', ARRAY['esports', 'entertainment'], true, 61000, 'CHARLANDO', 'Just Chatting', NOW()),
('twitch', '459331509', 'auronplay', 'Auronplay', 'Spain', 'es', 14200000, 38000, 1650000, 300, 95000, 43.4, 'Gaming', ARRAY['minecraft', 'variety'], false, 0, NULL, NULL, NOW() - INTERVAL '3 days'),
('twitch', '19571641', 'ninja', 'Ninja', 'USA', 'en', 18900000, 8000, 4200000, 240, 200000, 525.0, 'Gaming', ARRAY['fortnite', 'fps'], false, 0, NULL, NULL, NOW() - INTERVAL '7 days'),
('twitch', '44445592', 'pokimane', 'Pokimane', 'USA', 'en', 9400000, 12000, 3100000, 180, 45000, 258.3, 'Just Chatting', ARRAY['variety', 'react'], true, 14000, 'chatting with chat', 'Just Chatting', NOW()),
('twitch', '37402112', 'shroud', 'Shroud', 'Canada', 'en', 10200000, 15000, 5800000, 300, 100000, 386.7, 'Gaming', ARRAY['fps', 'valorant'], true, 18000, 'FPS GAMES', 'VALORANT', NOW()),
('twitch', '178393491', 'juansguarnizo', 'JuanSGuarnizo', 'Colombia', 'es', 9100000, 22000, 2200000, 240, 65000, 100.0, 'Gaming', ARRAY['gta', 'variety'], true, 25000, 'GTA RP', 'Grand Theft Auto V', NOW()),
('twitch', '125387632', 'amouranth', 'Amouranth', 'USA', 'en', 6400000, 8000, 8760000, 480, 35000, 1095.0, 'Just Chatting', ARRAY['irl', 'business'], true, 9500, 'POOL STREAM', 'Just Chatting', NOW()),
('twitch', '22552479', 'gaules', 'Gaules', 'Brazil', 'pt', 4200000, 35000, 4100000, 360, 150000, 117.1, 'Gaming', ARRAY['csgo', 'esports'], true, 42000, 'CS2 MAJOR', 'Counter-Strike 2', NOW()),
('twitch', '472309577', 'loudcoringa', 'Loud Coringa', 'Brazil', 'pt', 3800000, 18000, 1850000, 180, 55000, 102.8, 'Gaming', ARRAY['freefire', 'variety'], false, 0, NULL, NULL, NOW() - INTERVAL '2 days');

-- KICK CREATORS
INSERT INTO discovery_creators (platform, platform_id, username, display_name, region, language, followers, avg_viewers, minutes_watched, duration_minutes, peak_viewers, engagement_rate, primary_category, tags, is_live, current_viewers, last_stream_title, last_stream_game, last_scraped_at) VALUES
('kick', 'adinross', 'adinross', 'Adin Ross', 'USA', 'en', 8200000, 67000, 1200000, 360, 150000, 17.9, 'Just Chatting', ARRAY['irl', 'gambling'], true, 72000, 'SPINNING WITH VIEWERS', 'Slots', NOW()),
('kick', 'roshtein', 'roshtein', 'Roshtein', 'Sweden', 'en', 2100000, 28000, 3200000, 480, 85000, 114.3, 'Slots', ARRAY['casino', 'slots'], true, 31000, 'BIG WINS TONIGHT', 'Slots', NOW()),
('kick', 'trainwreckstv', 'trainwreckstv', 'Trainwreckstv', 'USA', 'en', 2800000, 35000, 2800000, 420, 95000, 80.0, 'Slots', ARRAY['gambling', 'slots'], true, 42000, 'GAMBLING STREAM', 'Slots', NOW()),
('kick', 'xposed', 'xposed', 'xposed', 'Canada', 'en', 1200000, 12000, 980000, 300, 45000, 81.7, 'Slots', ARRAY['gambling', 'casino'], false, 0, NULL, NULL, NOW() - INTERVAL '1 day');

-- YOUTUBE CREATORS
INSERT INTO discovery_creators (platform, platform_id, username, display_name, region, language, followers, total_views, total_likes, total_comments, avg_viewers, minutes_watched, engagement_rate, primary_category, tags, is_live, last_scraped_at) VALUES
('youtube', 'UCXuqSBlHAE6Xw-yeJA0Tunw', 'rubius', 'Rubius', 'Spain', 'es', 46000000, 10200000000, 890000000, 45000000, 2500000, 156000000, 10.9, 'Entertainment', ARRAY['vlogs', 'gaming'], false, NOW() - INTERVAL '5 days'),
('youtube', 'UCX6OQ3DkcsbYNE6H8uQQuVA', 'mrbeast', 'MrBeast', 'USA', 'en', 245000000, 47000000000, 2100000000, 89000000, 150000000, 850000000, 21.5, 'Entertainment', ARRAY['challenges', 'philanthropy'], false, NOW() - INTERVAL '2 days'),
('youtube', 'UCbmNph6atAoGfqLoCL_duAg', 'luisitocomunica', 'Luisito Comunica', 'Mexico', 'es', 42000000, 8900000000, 620000000, 28000000, 3200000, 98000000, 13.7, 'IRL', ARRAY['travel', 'vlogs'], false, NOW() - INTERVAL '1 day'),
('youtube', 'UCYiGq8XF7YQD00x7wAd62Zg', 'werevertumorro', 'Werevertumorro', 'Mexico', 'es', 18000000, 4200000000, 280000000, 12000000, 1800000, 45000000, 14.4, 'Entertainment', ARRAY['comedy', 'sketches'], false, NOW() - INTERVAL '21 days'),
('youtube', 'UCYiGq8XF7YQD00x7wAd62Zw', 'fernanfloo', 'Fernanfloo', 'USA', 'es', 46000000, 10500000000, 720000000, 38000000, 2100000, 120000000, 13.8, 'Gaming', ARRAY['gaming', 'comedy'], false, NOW() - INTERVAL '60 days'),
('youtube', 'UC-lHJZR3Gqxm24_Vd_AJ5Yw', 'pewdiepie', 'PewDiePie', 'Sweden', 'en', 111000000, 29000000000, 1800000000, 95000000, 4500000, 320000000, 15.3, 'Entertainment', ARRAY['gaming', 'commentary'], false, NOW() - INTERVAL '7 days');

-- INSTAGRAM CREATORS
INSERT INTO discovery_creators (platform, platform_id, username, display_name, region, language, followers, total_views, total_likes, total_comments, engagement_rate, primary_category, tags, last_scraped_at) VALUES
('instagram', '12281817', 'kyliejenner', 'Kylie Jenner', 'USA', 'en', 400000000, 850000000, 8500000, 45000, 99.5, 'Lifestyle', ARRAY['beauty', 'fashion'], NOW() - INTERVAL '2 hours'),
('instagram', '173560420', 'cristiano', 'Cristiano Ronaldo', 'Portugal', 'en', 615000000, 1200000000, 12000000, 85000, 99.3, 'Sports', ARRAY['football', 'sports'], NOW() - INTERVAL '1 day'),
('instagram', '460563723', 'selenagomez', 'Selena Gomez', 'USA', 'en', 430000000, 920000000, 9200000, 62000, 99.3, 'Entertainment', ARRAY['music', 'beauty'], NOW() - INTERVAL '5 hours'),
('instagram', '427553890', 'leomessi', 'Lionel Messi', 'Argentina', 'es', 503000000, 1100000000, 11000000, 78000, 99.3, 'Sports', ARRAY['football', 'sports'], NOW() - INTERVAL '3 days');

-- TIKTOK CREATORS
INSERT INTO discovery_creators (platform, platform_id, username, display_name, region, language, followers, total_views, total_likes, total_comments, total_shares, engagement_rate, primary_category, tags, last_scraped_at) VALUES
('tiktok', '6943210968390566913', 'khaby.lame', 'Khaby Lame', 'Italy', 'en', 162000000, 45000000, 4200000, 28000, 850000, 8.9, 'Entertainment', ARRAY['comedy', 'reactions'], NOW() - INTERVAL '6 hours'),
('tiktok', '5831967', 'charlidamelio', 'Charli D''Amelio', 'USA', 'en', 151000000, 28000000, 3100000, 45000, 620000, 7.4, 'Entertainment', ARRAY['dance', 'lifestyle'], NOW() - INTERVAL '1 day'),
('tiktok', '6870478428247498757', 'bellapoarch', 'Bella Poarch', 'USA', 'en', 93000000, 18000000, 2800000, 32000, 420000, 5.5, 'Entertainment', ARRAY['music', 'comedy'], NOW() - INTERVAL '2 days'),
('tiktok', '6761758958748934150', 'addisonre', 'Addison Rae', 'USA', 'en', 88000000, 15000000, 2200000, 28000, 380000, 5.8, 'Lifestyle', ARRAY['dance', 'fashion'], NOW() - INTERVAL '4 days');

-- FACEBOOK CREATORS
INSERT INTO discovery_creators (platform, platform_id, username, display_name, region, language, followers, total_views, total_likes, total_comments, engagement_rate, primary_category, tags, is_live, current_viewers, last_scraped_at) VALUES
('facebook', 'jexigaming', 'jexigaming', 'JEXI', 'Mexico', 'es', 12000000, 45000000, 1200000, 85000, 35.0, 'Gaming', ARRAY['freefire', 'gaming'], true, 8500, NOW()),
('facebook', 'alodia', 'alodia', 'Alodia Gosiengfiao', 'USA', 'en', 8500000, 28000000, 890000, 45000, 29.9, 'Gaming', ARRAY['cosplay', 'gaming'], false, 0, NOW() - INTERVAL '7 days'),
('facebook', 'esportsarena', 'esportsarena', 'Esports Arena', 'USA', 'en', 5200000, 62000000, 1500000, 120000, 38.3, 'Gaming', ARRAY['esports', 'tournaments'], true, 12000, NOW());

-- X (TWITTER) CREATORS
INSERT INTO discovery_creators (platform, platform_id, username, display_name, region, language, followers, total_views, total_likes, total_comments, engagement_rate, primary_category, tags, last_scraped_at) VALUES
('x', '44196397', 'elonmusk', 'Elon Musk', 'USA', 'en', 170000000, 45000000, 520000, 85000, 74.4, 'Business', ARRAY['tech', 'business'], NOW() - INTERVAL '30 minutes'),
('x', '813286', 'barackobama', 'Barack Obama', 'USA', 'en', 133000000, 12000000, 280000, 42000, 37.3, 'News', ARRAY['politics', 'news'], NOW() - INTERVAL '2 days'),
('x', '155659213', 'cristiano', 'Cristiano Ronaldo', 'Portugal', 'en', 112000000, 8500000, 195000, 28000, 38.1, 'Sports', ARRAY['football', 'sports'], NOW() - INTERVAL '1 day');

-- LINKEDIN CREATORS
INSERT INTO discovery_creators (platform, platform_id, username, display_name, region, language, followers, total_views, total_likes, total_comments, engagement_rate, primary_category, tags, last_scraped_at) VALUES
('linkedin', 'garyvee', 'garyvee', 'Gary Vee', 'USA', 'en', 5000000, 2500000, 12000, 850, 194.6, 'Business', ARRAY['marketing', 'entrepreneur'], NOW() - INTERVAL '1 day'),
('linkedin', 'billgates', 'billgates', 'Bill Gates', 'USA', 'en', 35000000, 8500000, 45000, 3200, 176.3, 'Tech', ARRAY['tech', 'philanthropy'], NOW() - INTERVAL '3 days'),
('linkedin', 'satyanadella', 'satyanadella', 'Satya Nadella', 'USA', 'en', 12000000, 4200000, 28000, 1800, 140.9, 'Tech', ARRAY['tech', 'leadership'], NOW() - INTERVAL '5 days');

-- =============================================
-- VERIFY SEED DATA
-- =============================================
SELECT
  platform,
  COUNT(*) as count,
  SUM(followers) as total_followers
FROM discovery_creators
GROUP BY platform
ORDER BY count DESC;
