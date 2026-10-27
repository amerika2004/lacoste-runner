/* ==================================================================
   CONFIG — Все настройки игры
   ================================================================== */
window.GameConfig = {
    // 1. Физика
    PHYSICS: {
        GRAVITY: 0.75,
        JUMP_FORCE: -10.5,
        HOLD_THRUST: 0.45,
        GROUND_Y: 530
    },
    
    // 2. Скорость мира
    SPEED: {
        BASE_SPEED: 4.0,
        SPEED_MULTIPLIER: 0.8
    },
    
    // 3. Фоны (Биомы)
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
            groundOffset: 30, // Земля ниже на 30px для этого фона
            obstacleTypes: ['rock', 'puddle', 'pit']
        }
    },
    
    // 4. Типы еды (для будущего расширения)
    FOOD_TYPES: {
        normal: { weight: 70, color: '#FFFFFF', emoji: null },
        golden: { weight: 15, color: '#FFD700', emoji: '⭐', scoreBonus: 50 },
        rare:   { weight: 10, color: '#00FFFF', emoji: '💎', healBonus: 2 },
        poison: { weight: 5,  color: '#8B00FF', emoji: '☠', speedPenalty: 0.1 }
    },
    
    // 5. Настройки по умолчанию (сохраняются в localStorage)
    DEFAULT_SETTINGS: {
        sfxVolume: 0.7,
        ambientVolume: 0.25,
        masterVolume: 1.0,
        soundEnabled: true,
        graphics: 'high',
        emojiStyle: 'apple',
        comboEnabled: true
    }
};

console.log('%c⚙️ Config loaded', 'color:#FFD700;font-weight:bold');
