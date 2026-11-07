-- 建議給後端的 Flyway migration（例如 V4__seed_landmark_backgrounds.sql），由後端確認後再放進 backend/src/main/resources/db/migration/。
-- 前端以「名稱」對應 public/data/backgrounds.json，取得攝影師標示與經緯度（離我最近排序），名稱必須完全一致。
-- 套用前先把 GoodMorning/public/backgrounds/ 的 10 張照片上傳到 S3 的同名 object key，否則畫面會出現破圖。
-- 照片授權：Unsplash License（https://unsplash.com/license），攝影師與出處見 backgrounds.json。
-- id 從 2 開始，避開既有的 1（台北晨曦）。
INSERT INTO backgrounds (id, name, image_object_key, unlock_threshold, is_active) VALUES
    (2, '台北101夕照', 'backgrounds/taipei101-sunset.jpg', 0, TRUE),
    (3, '台北101天際線', 'backgrounds/taipei101-skyline.jpg', 0, TRUE),
    (4, '艋舺龍山寺', 'backgrounds/longshan-temple.jpg', 0, TRUE),
    (5, '中正紀念堂', 'backgrounds/cks-memorial-hall.jpg', 0, TRUE),
    (6, '大稻埕碼頭', 'backgrounds/dadaocheng-wharf.jpg', 0, TRUE),
    (7, '饒河街觀光夜市', 'backgrounds/raohe-night-market.jpg', 0, TRUE),
    (8, '西門町', 'backgrounds/ximending.jpg', 0, TRUE),
    (9, '陽明山草原', 'backgrounds/yangmingshan.jpg', 0, TRUE),
    (10, '圓山大飯店', 'backgrounds/grand-hotel.jpg', 3, TRUE),
    (11, '國立故宮博物院', 'backgrounds/palace-museum.jpg', 3, TRUE);
