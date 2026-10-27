/* ==================================================================
   PACK 0 — CORE CONFIG & ASSETS
   Фундамент игры. Настройки, реестры персонажей/фонов, базовые ассеты.
   ================================================================== */
(function () {
    'use strict';

    // 1. Глобальные настройки физики и спавна
    window.GameConfig = {
        GRAVITY: 0.75,
        JUMP_FORCE: -10.5,
        HOLD_THRUST: 0.45,
        BASE_SPEED: 4.0,
        SPEED_MULTIPLIER: 0.8,
        GROUND_Y: 530,
        
        // 2. Реестр персонажей
        CHARACTERS: {
            crocodile: { 
                id: 'crocodile', 
                name: 'Crocodile', 
                emoji: '🐊', 
                folder: 'source/characters/crocodile', 
                frameCount: 12, 
                baseWidth: 165.4, 
                baseHeight: 110.3,
                foodEmojis: ['🍗', '🍔', '🍕', '🥩']
            },
            panda: { 
                id: 'panda', 
                name: 'Panda', 
                emoji: '🐼', 
                folder: 'source/characters/panda', 
                frameCount: 20, 
                baseWidth: 160, 
                baseHeight: 120,
                foodEmojis: ['🎋'],
                eatEmoji: '🎋',
                eatFolder: 'source/characters/panda/eating',
                eatFrameCount: 8,
                eatDuration: 4.0
            }
        },

        // 3. Реестр фонов
        BACKGROUNDS: {
            default: { 
                id: 'default', 
                name: 'Forest', 
                emoji: '🌳', 
                dayImg: 'source/landscape.jpg', 
                nightImg: 'source/landscape_n.jpg', 
                groundOffset: 0, 
                obstacleTypes: ['barrel', 'rock', 'cactus', 'puddle', 'pit'] 
            },
            cartoon: { 
                id: 'cartoon', 
                name: 'Cartoon', 
                emoji: '🌲', 
                dayImg: 'source/cartoon_forest.png', 
                nightImg: 'source/cartoon_forest_n.png', 
                groundOffset: 30, 
                obstacleTypes: ['rock', 'puddle', 'pit'] 
            }
        },

        // 4. Типы еды
        FOOD_TYPES: {
            normal:  { weight: 70, color: '#FFFFFF', emoji: null },
            golden:  { weight: 15, color: '#FFD700', emoji: '⭐', scoreBonus: 50 },
            rare:    { weight: 10, color: '#00FFFF', emoji: '💎', healBonus: 2 },
            poison:  { weight: 5,  color: '#8B00FF', emoji: '☠', speedPenalty: 0.1 },
        }
    };

    // 5. Кэш изображений (чтобы не грузить одно и то же дважды)
    window.GameAssets = {
        walkFrames: {}, // { crocodile: [img1, img2...], panda: [...] }
        eatFrames: {},  // { panda: [img1, img2...] }
        backgrounds: {},// { default: { day: img, night: img } }
        obstacles: {},  // { barrel: img, rock: img ... }

        init() {
            const cfg = window.GameConfig;
            
            // Загружаем персонажей
            Object.values(cfg.CHARACTERS).forEach(char => {
                this.walkFrames[char.id] = [];
                for (let i = 1; i <= char.frameCount; i++) {
                    const img = new Image();
                    img.src = `${char.folder}/${i}.png`;
                    this.walkFrames[char.id].push(img);
                }
                if (char.eatFolder && char.eatFrameCount) {
                    this.eatFrames[char.id] = [];
                    for (let i = 1; i <= char.eatFrameCount; i++) {
                        const img = new Image();
                        img.src = `${char.eatFolder}/${i}.png`;
                        this.eatFrames[char.id].push(img);
                    }
                }
            });

            // Загружаем фоны
            Object.values(cfg.BACKGROUNDS).forEach(bg => {
                const day = new Image(); day.src = bg.dayImg;
                const night = new Image(); night.src = bg.nightImg;
                this.backgrounds[bg.id] = { day, night };
            });

            // Загружаем препятствия (день/ночь)
            const obsList = ['puddle', 'rock', 'pit', 'barrel', 'cactus', 'explosion'];
            obsList.forEach(obs => {
                const day = new Image(); day.src = `source/${obs}.png`;
                const night = new Image(); night.src = `source/${obs}_n.png`;
                this.obstacles[obs] = { day, night };
            });

            console.log('✅ [Pack 0] Core config and assets initialized');
        }
    };

    // Запускаем инициализацию при загрузке скрипта
    // Небольшая задержка, чтобы DOM успел прогрузиться
    setTimeout(() => window.GameAssets.init(), 0);

    // Утилита для выбора дня/ночи (используется во многих модулях)
    window.getTimeImg = function(assetsPair, timeOfDay) {
        if (!assetsPair) return null;
        return timeOfDay === 'night' ? assetsPair.night : assetsPair.day;
    };

})();
