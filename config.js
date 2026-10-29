/* ==================================================================
   config.js — Глобальная конфигурация игры
   ================================================================== */
(function () {
    'use strict';

    window.GAME_CONFIG = {
        // === ФИЗИКА И ИГРОВОЙ ПРОЦЕСС ===
        physics: {
            gravity: 0.75,
            jumpForce: -10.5,
            holdThrust: 0.45,
            groundY: 530,
            baseSpeed: 4.0,
            speedMultiplier: 0.8
        },

        // === НАСТРОЙКИ ПО УМОЛЧАНИЮ ===
        defaultSettings: {
            sfxVolume: 0.7,
            ambientVolume: 0.25,
            masterVolume: 1.0,
            soundEnabled: true,
            graphics: 'high', // 'low', 'medium', 'high'
            comboEnabled: true,
            comboVisualsEnabled: true
        },

        // === НАСТРОЙКИ КОМБО-СИСТЕМЫ (PACK 1) ===
        combo: {
            decayTimeMs: 3000, // Через сколько миллисекунд без прыжка комбо сбрасывается
            tiers: [
                { threshold: 3,  mult: 2, emoji: '😎', color: '#00FFFF' },
                { threshold: 5,  mult: 3, emoji: '🔥', color: '#FFD700' },
                { threshold: 10, mult: 5, emoji: '👑', color: '#FF007F' },
                { threshold: 20, mult: 10, emoji: '🌈', color: '#FFFFFF' }
            ],
            sadEmoji: '😢',
            sadColor: '#888888'
        },

        // === РЕЕСТР ПЕРСОНАЖЕЙ ===
        characters: {
            crocodile: {
                id: 'crocodile',
                name: 'Crocodile',
                emoji: '🐊',
                folder: 'source/characters/crocodile',
                frameCount: 12,
                baseWidth: 165.4,
                baseHeight: 110.3,
                foodEmojis: ['🍗', '🍔', '🍕', '🥩'],
                eatEmoji: null,
                eatFolder: null,
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
                eatEmoji: '🎋',
                eatFolder: 'source/characters/panda/eating',
                eatFrameCount: 8,
                eatDuration: 4.0
            }
        },

        // === РЕЕСТР БИОМОВ (УРОВНЕЙ) ===
        biomes: {
            default: {
                id: 'default',
                name: 'Forest',
                emoji: '🌳',
                dayImg: 'source/landscape.jpg',
                nightImg: 'source/landscape_n.jpg',
                groundOffset: 0,
                obstacleTypes: ['barrel', 'rock', 'cactus', 'puddle', 'pit'],
                foodEmojis: null
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
        }
    };
})();
