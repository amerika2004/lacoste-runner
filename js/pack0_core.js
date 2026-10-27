/* ==================================================================
   PACK 0 — CORE ASSETS (Загрузчик картинок)
   ================================================================== */
(function () {
    'use strict';

    // Глобальное хранилище картинок
    window.GameAssets = {
        walk: {},       // Кадры ходьбы: { crocodile: [img1, img2...], panda: [...] }
        eat: {},        // Кадры поедания: { panda: [img1, img2...] }
        bg: {},         // Фоны: { default: { day: img, night: img }, ... }
        obs: {}         // Препятствия: { barrel: { day: img, night: img }, ... }
    };

    // Ждём загрузки страницы, чтобы конфиг точно был доступен
    window.addEventListener('load', () => {
        setTimeout(() => {
            const cfg = window.GameConfig;
            if (!cfg) {
                console.error('❌ [Pack 0] GameConfig not found! Check manifest.json order.');
                return;
            }

            console.log('🔄 [Pack 0] Loading assets...');

            // 1. Загрузка персонажей
            Object.values(cfg.CHARACTERS).forEach(char => {
                // Кадры ходьбы
                window.GameAssets.walk[char.id] = [];
                for (let i = 1; i <= char.frameCount; i++) {
                    const img = new Image();
                    img.src = `${char.folder}/${i}.png`;
                    window.GameAssets.walk[char.id].push(img);
                }

                // Кадры поедания
                if (char.eatFolder && char.eatFrameCount) {
                    window.GameAssets.eat[char.id] = [];
                    for (let i = 1; i <= char.eatFrameCount; i++) {
                        const img = new Image();
                        img.src = `${char.eatFolder}/${i}.png`;
                        window.GameAssets.eat[char.id].push(img);
                    }
                }
            });

            // 2. Загрузка фонов
            Object.values(cfg.BACKGROUNDS).forEach(bg => {
                const day = new Image();
                day.src = bg.day;
                const night = new Image();
                night.src = bg.night;
                window.GameAssets.bg[bg.id] = { day, night };
            });

            // 3. Загрузка препятствий (день/ночь)
            const allObstacles = new Set();
            Object.values(cfg.BACKGROUNDS).forEach(bg => {
                if (bg.types) bg.types.forEach(t => allObstacles.add(t));
            });

            allObstacles.forEach(obsName => {
                const day = new Image();
                day.src = `source/${obsName}.png`;
                const night = new Image();
                night.src = `source/${obsName}_n.png`;
                window.GameAssets.obs[obsName] = { day, night };
            });

            console.log('✅ [Pack 0] Core assets loaded');
        }, 100);
    });

})();
