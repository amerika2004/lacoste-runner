/* ==================================================================
   CONFIG — Все настройки игры
   Здесь меняются скорости, гравитация, персонажи, фоны и цены.
   ================================================================== */
(function () {
    'use strict';

    window.GameConfig = {
        // === 1. ФИЗИКА ===
        PHYSICS: {
            GRAVITY: 0.75,        // Сила притяжения (чем больше, тем быстрее падает)
            JUMP_FORCE: -10.5,    // Сила прыжка (отрицательная — вверх)
            HOLD_THRUST: 0.45,    // Доп. сила при удержании (высокий прыжок)
            GROUND_Y: 530,        // Уровень земли (отсчёт от верха)
        },

        // === 2. СКОРОСТЬ ===
        SPEED: {
            BASE_SPEED: 4.0,          // Базовая скорость движения мира
            SPEED_MULTIPLIER: 0.8,    // Общий множитель (0.8 = комфортная скорость)
        },

        // === 3. ПЕРСОНАЖИ ===
        // w, h — размеры спрайта. food — что он ест.
        CHARACTERS: {
            crocodile: {
                id: 'crocodile',
                name: 'Crocodile',
                emoji: '🐊',
                folder: 'source/characters/crocodile',
                frameCount: 12,
                w: 165.4,
                h: 110.3,
                food: ['🍗', '🍔', '🍕', '🥩'],
            },
            panda: {
                id: 'panda',
                name: 'Panda',
                emoji: '🐼',
                folder: 'source/characters/panda',
                frameCount: 20,
                w: 160,
                h: 120,
                food: ['🎋'],
                eatEmoji: '🎋',
                eatFolder: 'source/characters/panda/eating',
                eatFrameCount: 8,
                eatDuration: 240, // 240 тиков = 4 секунды при 60 FPS
            }
        },

        // === 4. ФОНЫ (БИОМЫ) ===
        // types — какие препятствия могут появляться в этом фоне.
        BACKGROUNDS: {
            default: {
                id: 'default',
                name: 'Forest',
                emoji: '🌳',
                day: 'source/landscape.jpg',
                night: 'source/landscape_n.jpg',
                offset: 0, // Смещение земли (если нужно опустить)
                types: ['barrel', 'rock', 'cactus', 'puddle', 'pit'],
            },
            cartoon: {
                id: 'cartoon',
                name: 'Cartoon',
                emoji: '🌲',
                day: 'source/cartoon_forest.png',
                night: 'source/cartoon_forest_n.png',
                offset: 30, // Опускаем землю на 30px (под мультяшный фон)
                types: ['rock', 'puddle', 'pit'],
            }
        },

        // === 5. ТИПЫ ЕДЫ ===
        // weight — шанс выпадения (сумма = 100)
        FOOD_TYPES: {
            normal: {
                weight: 70,
                color: '#FFFFFF',
                emoji: null,
            },
            golden: {
                weight: 15,
                color: '#FFD700',
                emoji: '⭐',
                score: 50, // Даёт +50 очков
            },
            rare: {
                weight: 10,
                color: '#00FFFF',
                emoji: '💎',
                heal: 2, // Восстанавливает 2 HP
            },
            poison: {
                weight: 5,
                color: '#8B00FF',
                emoji: '☠',
                damage: 1, // Наносит 1 урон
                speedPenalty: 0.9, // Замедляет на 10%
            },
        },

        // === 6. СПАВН ПРЕПЯТСТВИЙ ===
        SPAWN: {
            minInterval: 70,      // Минимальная пауза между спавнами (тики)
            maxInterval: 140,     // Максимальная пауза
            foodChance: 100,      // Базовый шанс еды (каждые N тиков)
        },

        // === 7. ЭКОНОМИКА (если понадобится магазин) ===
        ECONOMY: {
            coinsPerMeter: 0.1,   // 1 монета за 10 метров
            coinsForGolden: 5,    // Бонус за золотую еду
        }
    };

    console.log('%c⚙️ [Config] Loaded all settings', 'color:#FFD700;font-weight:bold');
})();
