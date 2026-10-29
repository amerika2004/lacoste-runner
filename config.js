/* ==================================================================
   config.js — Глобальная конфигурация игры
   ================================================================== */
(function () {
    'use strict';

    window.GAME_CONFIG = {
        physics: {
            gravity: 0.75,
            jumpForce: -10.5,
            holdThrust: 0.45,
            groundY: 530,
            baseSpeed: 4.0,
            speedMultiplier: 0.8
        },

        defaultSettings: {
            sfxVolume: 0.7,
            ambientVolume: 0.25,
            masterVolume: 1.0,
            soundEnabled: true,
            graphics: 'high',
            comboEnabled: true,
            comboVisualsEnabled: true,
            weatherEnabled: true,
            dynamicMusicEnabled: true
        },

        combo: {
            decayTimeMs: 3000,
            tiers: [
                { threshold: 3,  mult: 2, emoji: '😎', color: '#00FFFF' },
                { threshold: 5,  mult: 3, emoji: '🔥', color: '#FFD700' },
                { threshold: 10, mult: 5, emoji: '👑', color: '#FF007F' },
                { threshold: 20, mult: 10, emoji: '🌈', color: '#FFFFFF' }
            ],
            sadEmoji: '😢',
            sadColor: '#888888'
        },

        // === PACK 2: АТМОСФЕРА И ТАКТИКА ===
        pack2: {
            powerups: {
                spawnChance: 0.05, // 5% шанс спавна вместо еды
                types: {
                    shield: { emoji: '🛡️', duration: 0, color: '#00FFFF', sound: 'source/sounds/powerup_shield.wav' },
                    magnet: { emoji: '🧲', duration: 5000, color: '#FF0000', sound: 'source/sounds/powerup_magnet.wav' },
                    slowmo: { emoji: '⏳', duration: 3000, color: '#0000FF', sound: 'source/sounds/powerup_slowmo.wav' },
                    sprint: { emoji: '⚡', duration: 3000, color: '#FFD700', sound: 'source/sounds/powerup_sprint.wav' }
                }
            },
            weather: {
                types: ['clear', 'rain', 'fog', 'storm'],
                changeDistance: 1000, // Смена погоды каждые 1000м
                stormChance: 0.1 // 10% шанс грозы
            },
            music: {
                layers: [
                    { file: 'source/music/theme_bass.mp3', minDistance: 0 },
                    { file: 'source/music/theme_drums.mp3', minDistance: 500 },
                    { file: 'source/music/theme_lead.mp3', minDistance: 1500 }
                ],
                maxTempoRate: 1.15,
                tempoDistance: 2000
            }
        },

        characters: {
            crocodile: { id: 'crocodile', name: 'Crocodile', emoji: '🐊', folder: 'source/characters/crocodile', frameCount: 12, baseWidth: 165.4, baseHeight: 110.3, foodEmojis: ['🍗', '🍔', '🍕', '🥩'], eatEmoji: null, eatFolder: null, eatFrameCount: 0, eatDuration: 0 },
            panda: { id: 'panda', name: 'Panda', emoji: '🐼', folder: 'source/characters/panda', frameCount: 20, baseWidth: 160, baseHeight: 120, foodEmojis: ['🎋'], eatEmoji: '🎋', eatFolder: 'source/characters/panda/eating', eatFrameCount: 8, eatDuration: 4.0 }
        },

        biomes: {
            default: { id: 'default', name: 'Forest', emoji: '🌳', dayImg: 'source/landscape.jpg', nightImg: 'source/landscape_n.jpg', groundOffset: 0, obstacleTypes: ['barrel', 'rock', 'cactus', 'puddle', 'pit'], foodEmojis: null },
            cartoon: { id: 'cartoon', name: 'Cartoon', emoji: '🌲', dayImg: 'source/cartoon_forest.png', nightImg: 'source/cartoon_forest_n.png', groundOffset: 30, obstacleTypes: ['rock', 'puddle', 'pit'], foodEmojis: ['🎋'] }
        }
    };
})();
