/* ==================================================================
   config.js — Глобальная конфигурация игры
   ================================================================== */
(function () {
    'use strict';

    window.GAME_CONFIG = {
        physics: { gravity: 0.75, jumpForce: -10.5, holdThrust: 0.45, groundY: 530, baseSpeed: 4.0, speedMultiplier: 0.8 },
        defaultSettings: { sfxVolume: 0.7, ambientVolume: 0.25, masterVolume: 1.0, soundEnabled: true, graphics: 'high', comboEnabled: true, comboVisualsEnabled: true, weatherEnabled: true, dynamicMusicEnabled: true },
        
        combo: {
            decayTimeMs: 3000,
            tiers: [
                { threshold: 3,  mult: 2, emoji: '😎', color: '#00FFFF' },
                { threshold: 5,  mult: 3, emoji: '🔥', color: '#FFD700' },
                { threshold: 10, mult: 5, emoji: '👑', color: '#FF007F' },
                { threshold: 20, mult: 10, emoji: '🌈', color: '#FFFFFF' }
            ],
            sadEmoji: '😢', sadColor: '#888888'
        },
        
        pack2: {
            powerups: {
                spawnChance: 0.05,
                types: {
                    shield: { emoji: '🛡️', duration: 0, color: '#00FFFF', sound: 'source/sounds/powerup_shield.wav' },
                    magnet: { emoji: '🧲', duration: 5000, color: '#FF0000', sound: 'source/sounds/powerup_magnet.wav' },
                    slowmo: { emoji: '⏳', duration: 3000, color: '#0000FF', sound: 'source/sounds/powerup_slowmo.wav' },
                    sprint: { emoji: '⚡', duration: 3000, color: '#FFD700', sound: 'source/sounds/powerup_sprint.wav' }
                }
            },
            weather: {
                changeDistance: 1000,
                combinations: [
                    { id: 'clear', label: '☀️', rain: false, fog: false, storm: false, tint: 'rgba(0,0,0,0)' },
                    { id: 'cloudy', label: '☁️', rain: false, fog: false, storm: false, tint: 'rgba(50,50,60,0.2)' },
                    { id: 'rain', label: '🌧️', rain: true, fog: false, storm: false, tint: 'rgba(20,40,60,0.25)' },
                    { id: 'fog', label: '🌫️', rain: false, fog: true, storm: false, tint: 'rgba(200,200,210,0.4)' },
                    { id: 'storm', label: '⛈️', rain: true, fog: false, storm: true, tint: 'rgba(10,10,20,0.5)' },
                    { id: 'sunshower', label: '🌦️', rain: true, fog: false, storm: false, tint: 'rgba(255,200,100,0.1)' }
                ]
            }
        },

        pack3: {
            biomes: [
                { id: 'forest', name: '🌳 Forest', distance: 0, dayImg: 'source/landscape.jpg', nightImg: 'source/landscape_n.jpg', obstacleTypes: ['barrel', 'rock', 'cactus', 'puddle', 'pit'] },
                { id: 'desert', name: '🏜️ Desert', distance: 1000, dayImg: 'source/desert_day.jpg', nightImg: 'source/desert_night.jpg', obstacleTypes: ['cactus', 'rock', 'pit'] },
                { id: 'city', name: '🏙️ City', distance: 2000, dayImg: 'source/city_day.jpg', nightImg: 'source/city_night.jpg', obstacleTypes: ['barrel', 'puddle', 'pit'] },
                { id: 'jungle', name: '🌿 Jungle', distance: 3000, dayImg: 'source/jungle_day.jpg', nightImg: 'source/jungle_night.jpg', obstacleTypes: ['cactus', 'puddle', 'pit'] }
            ],
            music: {
                layers: [
                    { file: 'source/music/theme_bass.mp3', minDistance: 0 },
                    { file: 'source/music/theme_drums.mp3', minDistance: 500 },
                    { file: 'source/music/theme_lead.mp3', minDistance: 1500 }
                ],
                maxTempoRate: 1.15, tempoDistance: 2000
            },
            achievements: [
                { id: 'dist_1000', title: 'Marathoner', desc: 'Run 1000m', icon: '🏃' },
                { id: 'dist_3000', title: 'Legend', desc: 'Run 3000m', icon: '👑' },
                { id: 'no_damage_500', title: 'Untouchable', desc: '500m without damage', icon: '🛡️' },
                { id: 'food_50', title: 'Gourmand', desc: 'Eat 50 foods', icon: '🍔' },
                { id: 'jumps_100', title: 'Jumping Jack', desc: 'Jump 100 times', icon: '🦘' },
                { id: 'combo_10', title: 'Combo Master', desc: 'Reach x10 combo', icon: '🔥' }
            ],
            dailyGoals: [
                { id: 'd_jump_30', title: 'Jump 30 times', target: 30, type: 'jumps', reward: 'Shield x1' },
                { id: 'd_eat_15', title: 'Eat 15 foods', target: 15, type: 'food', reward: 'Magnet x1' },
                { id: 'd_dist_500', title: 'Run 500m', target: 500, type: 'distance', reward: 'Sprint x1' }
            ]
        },

        characters: {
            crocodile: { id: 'crocodile', name: 'Crocodile', emoji: '🐊', folder: 'source/characters/crocodile', frameCount: 12, baseWidth: 165.4, baseHeight: 110.3, foodEmojis: ['🍗', '🍔', '🍕', '🥩'], eatEmoji: null, eatFolder: null, eatFrameCount: 0, eatDuration: 0 },
            panda: { id: 'panda', name: 'Panda', emoji: '🐼', folder: 'source/characters/panda', frameCount: 20, baseWidth: 160, baseHeight: 120, foodEmojis: ['🎋'], eatEmoji: '🎋', eatFolder: 'source/characters/panda/eating', eatFrameCount: 8, eatDuration: 4.0 }
        },

        biomes: { // Дефолтные биомы для главного меню (совместимость с Pack 2)
            default: { id: 'default', name: 'Forest', emoji: '🌳', dayImg: 'source/landscape.jpg', nightImg: 'source/landscape_n.jpg', groundOffset: 0, obstacleTypes: ['barrel', 'rock', 'cactus', 'puddle', 'pit'], foodEmojis: null },
            cartoon: { id: 'cartoon', name: 'Cartoon', emoji: '🌲', dayImg: 'source/cartoon_forest.png', nightImg: 'source/cartoon_forest_n.png', groundOffset: 30, obstacleTypes: ['rock', 'puddle', 'pit'], foodEmojis: ['🎋'] }
        }
    };
})();
