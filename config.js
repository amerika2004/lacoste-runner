/* ==================================================================
   config.js — Глобальная конфигурация игры
   Здесь настраиваются физика, персонажи, биомы и дефолтные настройки.
   ================================================================== */
(function () {
    'use strict';

    window.GAME_CONFIG = {
        // === ФИЗИКА И ИГРОВОЙ ПРОЦЕСС ===
        physics: {
            gravity: 0.75,          // Сила притяжения
            jumpForce: -10.5,       // Начальная сила прыжка
            holdThrust: 0.45,       // Сила удержания кнопки прыжка (для высокого прыжка)
            groundY: 530,           // Базовая линия земли (Y координата)
            baseSpeed: 4.0,         // Базовая скорость игры
            speedMultiplier: 0.8    // Множитель сложности
        },

        // === НАСТРОЙКИ ПО УМОЛЧАНИЮ ===
        defaultSettings: {
            sfxVolume: 0.7,
            ambientVolume: 0.25,
            masterVolume: 1.0,
            soundEnabled: true,
            graphics: 'high',       // 'low', 'medium', 'high'
            comboEnabled: true      // Для плагина Pack1 (Combo System)
        },

        // === РЕЕСТР ПЕРСОНАЖЕЙ ===
        // Чтобы добавить нового героя, просто скопируйте блок и измените параметры.
        characters: {
            crocodile: {
                id: 'crocodile',
                name: 'Crocodile',
                emoji: '🐊',
                folder: 'source/characters/crocodile',
                frameCount: 12,              // Количество кадров анимации бега
                baseWidth: 165.4,
                baseHeight: 110.3,
                foodEmojis: ['🍗', '🍔', '🍕', '🥩'],
                eatEmoji: null,              // Если null, персонаж не будет останавливаться на еду
                eatFolder: null,             // Папка с анимацией поедания
                eatFrameCount: 0,
                eatDuration: 0
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
                eatEmoji: '🎋',              // При поедании этого эмодзи, запустится анимация
                eatFolder: 'source/characters/panda/eating',
                eatFrameCount: 8,
                eatDuration: 4.0             // Длительность анимации в секундах
            }
            // Пример добавления нового персонажа:
            // ninja: {
            //     id: 'ninja', name: 'Ninja', emoji: '🥷',
            //     folder: 'source/characters/ninja', frameCount: 10,
            //     baseWidth: 150, baseHeight: 100,
            //     foodEmojis: ['🍣'], eatEmoji: '🍣',
            //     eatFolder: 'source/characters/ninja/eating', eatFrameCount: 6, eatDuration: 3.0
            // }
        },

        // === РЕЕСТР БИОМОВ (УРОВНЕЙ) ===
        // Каждый биом имеет свой фон, список препятствий и доступную еду.
        biomes: {
            default: {
                id: 'default',
                name: 'Forest',
                emoji: '🌳',
                dayImg: 'source/landscape.jpg',
                nightImg: 'source/landscape_n.jpg',
                groundOffset: 0,     // Смещение земли (если картинка ниже/выше)
                obstacleTypes: ['barrel', 'rock', 'cactus', 'puddle', 'pit'],
                foodEmojis: null     // Если null, берется еда из настроек персонажа
            },
            cartoon: {
                id: 'cartoon',
                name: 'Cartoon',
                emoji: '🌲',
                dayImg: 'source/cartoon_forest.png',
                nightImg: 'source/cartoon_forest_n.png',
                groundOffset: 30,
                obstacleTypes: ['rock', 'puddle', 'pit'],
                foodEmojis: ['🎋']
            }
            // Пример добавления пустыни:
            // desert: {
            //     id: 'desert', name: 'Desert', emoji: '🏜️',
            //     dayImg: 'source/desert.png', nightImg: 'source/desert_n.png',
            //     groundOffset: 10,
            //     obstacleTypes: ['cactus', 'pit', 'rock'],
            //     foodEmojis: ['🌵', '🍉']
            // }
        }
    };
})();
