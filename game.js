const { useState, useEffect, useRef, useCallback } = React;

// === ПЛАГИННАЯ ИНФРАСТРУКТУРА ===
window.GameEvents = window.GameEvents || {
    listeners: {},
    on(event, cb) { if (!this.listeners[event]) this.listeners[event] = []; this.listeners[event].push(cb); },
    emit(event, data) { if (this.listeners[event]) this.listeners[event].forEach(cb => { try { cb(data); } catch(e) { console.error(e); } }); }
};
window.PackUIs = window.PackUIs || [];
window.GameBoot = window.GameBoot || {
    triggered: false, callbacks: [],
    onReady(cb) { if (this.triggered) { try { cb(); } catch(e){ console.error(e); } return; } this.callbacks.push(cb); },
    trigger() { if (this.triggered) return; this.triggered = true; this.callbacks.forEach(cb => { try { cb(); } catch(e){ console.error(e); } }); this.callbacks = []; }
};

// === ЗАЩИТА ОТ ОТСУТСТВИЯ CONFIG.JS ===
const DEFAULT_CONFIG = {
    physics: { gravity: 0.75, jumpForce: -10.5, holdThrust: 0.45, groundY: 530, baseSpeed: 4.0, speedMultiplier: 0.8 },
    defaultSettings: { sfxVolume: 0.7, ambientVolume: 0.25, masterVolume: 1.0, soundEnabled: true, graphics: 'high', comboEnabled: true, comboVisualsEnabled: true, weatherEnabled: true, dynamicMusicEnabled: true, biomesEnabled: true, achievementsEnabled: true, dailyGoalsEnabled: true },
    combo: { decayTimeMs: 3000, tiers: [{ threshold: 3, mult: 2, emoji: '😎', color: '#00FFFF' }], sadEmoji: '😢', sadColor: '#888888' },
    pack2: { powerups: { spawnChance: 0.05, types: {} }, weather: { changeDistance: 1000 }, music: { layers: [], maxTempoRate: 1.15, tempoDistance: 2000 } },
    pack3: { biomes: [], music: { layers: [] }, achievements: [] },
    pack4: { economy: {}, shop: {}, missions: [], secrets: {} },
    characters: {
        crocodile: { id: 'crocodile', name: 'Crocodile', emoji: '🐊', folder: 'source/characters/crocodile', frameCount: 12, baseWidth: 165.4, baseHeight: 110.3, foodEmojis: ['🍗', '🍔', '🍕', '🥩'], eatEmoji: null, eatFolder: null, eatFrameCount: 0, eatDuration: 0 },
        panda: { id: 'panda', name: 'Panda', emoji: '🐼', folder: 'source/characters/panda', frameCount: 20, baseWidth: 160, baseHeight: 120, foodEmojis: ['🎋'], eatEmoji: '🎋', eatFolder: 'source/characters/panda/eating', eatFrameCount: 8, eatDuration: 4.0 }
    },
    biomes: {
        default: { id: 'default', name: 'Forest', emoji: '🌳', dayImg: 'source/landscape.jpg', nightImg: 'source/landscape_n.jpg', groundOffset: 0, obstacleTypes: ['barrel', 'rock', 'cactus', 'puddle', 'pit'], foodEmojis: null },
        cartoon: { id: 'cartoon', name: 'Cartoon', emoji: '🌲', dayImg: 'source/cartoon_forest.png', nightImg: 'source/cartoon_forest_n.png', groundOffset: 30, obstacleTypes: ['rock', 'puddle', 'pit'], foodEmojis: ['🎋'] }
    }
};

const CONFIG = (window.GAME_CONFIG && window.GAME_CONFIG.physics) ? window.GAME_CONFIG : DEFAULT_CONFIG;
const FLIP_CROC = false; 
const GRAVITY = CONFIG.physics.gravity ?? 0.75;        
const JUMP_FORCE = CONFIG.physics.jumpForce ?? -10.5;    
const HOLD_THRUST = CONFIG.physics.holdThrust ?? 0.45;    
const GROUND_Y = CONFIG.physics.groundY ?? 530; 
const BASE_SPEED = CONFIG.physics.baseSpeed ?? 4.0; 
const SPEED_MULTIPLIER = CONFIG.physics.speedMultiplier ?? 0.8;
const DEFAULT_SETTINGS = CONFIG.defaultSettings;

const RenderEngine = (function () {
    // ... (код RenderEngine остается без изменений, так как это canvas-отрисовка) ...
    // Для краткости я пропущу его здесь, но в вашем файле он должен быть на месте.
    // Вставьте сюда полный код RenderEngine из предыдущего сообщения.
})();

window.RenderEngine = RenderEngine;
const CHARACTERS = CONFIG.characters;
const BACKGROUNDS = CONFIG.biomes;

function Game() {
    // ... (Вся логика useState, useEffect, useRef, updateLogic, handleKeyDown и т.д. остается без изменений) ...
    // Я показываю только измененный return. Остальной JS-код остался прежним.

    const [gameState, setGameState] = useState('menu');
    const [timeOfDay, setTimeOfDay] = useState(() => localStorage.getItem('lacosteTimeOfDay') || 'day');
    const [background, setBackground] = useState(() => { const saved = localStorage.getItem('lacosteBackground'); return (saved && BACKGROUNDS[saved]) ? saved : Object.keys(BACKGROUNDS)[0]; });
    const [character, setCharacter] = useState(() => { const saved = localStorage.getItem('lacosteCharacter'); return (saved && CHARACTERS[saved]) ? saved : Object.keys(CHARACTERS)[0]; });
    
    const [score, setScore] = useState(0);
    const [speedDisplay, setSpeedDisplay] = useState(1.0); 
    const [powerDisplay, setPowerDisplay] = useState(1.0);
    const [health, setHealth] = useState(6);
    const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('lacosteHighScore')) || 0);

    const [settings, setSettings] = useState(() => {
        try { const saved = JSON.parse(localStorage.getItem('lacosteSettings') || '{}'); return { ...DEFAULT_SETTINGS, ...saved }; } catch { return { ...DEFAULT_SETTINGS }; }
    });
    const [showSettings, setShowSettings] = useState(false);

    // ... (Все useEffect и useRef остаются прежними) ...

    const startGame = () => resetGame();
    const formatScore = (num) => num.toString().padStart(5, '0');
    const getHearts = () => { let h = []; for (let i = 0; i < 4; i++) { if (health >= (i + 1) * 2) h.push('❤️'); else if (health === i * 2 + 1) h.push('💔'); else h.push('🖤'); } return h.join(''); };

    const renderCharacterPanel = () => React.createElement('div', { className: 'char-panel' }, 
        Object.values(CHARACTERS).map(char => React.createElement('button', { 
            key: char.id, 
            className: `char-btn ${character === char.id ? 'active' : ''}`, 
            onClick: () => setCharacter(char.id) 
        }, 
            React.createElement('span', { className: 'char-emoji' }, char.emoji || '❓'), 
            React.createElement('span', { className: 'char-name' }, char.name)
        ))
    );

    const renderBackgroundPanel = () => React.createElement('div', { className: 'settings', style: { marginBottom: '20px' } }, 
        Object.values(BACKGROUNDS).map(bg => React.createElement('button', { 
            key: bg.id, 
            className: `btn ${background === bg.id ? 'active' : ''}`, 
            onClick: () => setBackground(bg.id) 
        }, `${bg.emoji} ${bg.name}`))
    );

    return React.createElement('div', { id: 'game-container' },
        
        // === HUD ИГРЫ (ТОЛЬКО КОГДА ИГРАЕМ) ===
        (gameState === 'playing' || gameState === 'paused') ? React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'hud-left' }, 
                React.createElement('span', { style: { letterSpacing: '2px' } }, getHearts()),
                React.createElement('span', { style: { fontSize: '16px', color: '#8892B0' } }, `🍗 ${playerRef.current.foodEaten}/${playerRef.current.foodTarget}`)
            ),
            React.createElement('div', { className: 'hud-right' }, 
                React.createElement('span', { style: { color: 'var(--fh-accent)' } }, `${speedDisplay === 'REVERSE' ? '◄◄' : speedDisplay} KM/H`),
                React.createElement('span', null, `${formatScore(score)} M`),
                React.createElement('span', null, `HI: ${formatScore(highScore)} M`)
            )
        ) : null,

        React.createElement('canvas', { ref: canvasRef, width: 1200, height: 600 }),

        gameState === 'playing' ? React.createElement(React.Fragment, null,
            React.createElement('button', { id: 'btn-fullscreen', className: 'game-btn', onClick: toggleFullscreen }, '⛶'),
            React.createElement('button', { id: 'btn-pause', className: 'game-btn', onClick: () => setGameState('paused') }, '❚❚')
        ) : null,
        
        // === ГЛАВНОЕ МЕНЮ ===
        gameState === 'menu' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title' }, 'LACOSTE', React.createElement('br'), 'RUNNER'),
            React.createElement('div', { className: 'subtitle' }, 'VICE CITY EDITION'),

            renderCharacterPanel(),
            renderBackgroundPanel(),

            React.createElement('div', { className: 'settings' }, 
                React.createElement('button', { className: `btn ${timeOfDay === 'day' ? 'active' : ''}`, onClick: () => setTimeOfDay('day') }, '☀️ Day'), 
                React.createElement('button', { className: `btn ${timeOfDay === 'night' ? 'active' : ''}`, onClick: () => setTimeOfDay('night') }, '🌙 Night')
            ),

            React.createElement('div', { style: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', justifyContent: 'center' } }, 
                React.createElement('button', { className: 'btn', onClick: toggleFullscreen }, '⛶ Fullscreen'), 
                React.createElement('button', { className: 'btn', onClick: () => window.GameEvents.emit('show_achievements') }, '🏆 Achievements'),
                React.createElement('button', { className: 'btn', onClick: () => window.GameEvents.emit('show_shop') }, '🛒 Shop'),
                React.createElement('button', { className: 'btn', onClick: () => window.GameEvents.emit('show_leaderboard') }, '🏅 Leaderboard')
            ),

            React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'START ESCAPE'),
            React.createElement('button', { className: 'btn', onClick: () => setShowSettings(true), style: { marginTop: '20px', background: 'transparent' } }, '⚙ SETTINGS'),
            
            React.createElement('div', { style: { marginTop: '20px', color: 'var(--fh-text-muted)', fontSize: '12px', fontFamily: 'Montserrat' } }, 
                React.createElement('p', null, 'Space / Tap — jump, HOLD — high jump!'),
                React.createElement('p', null, 'Eat food to grow stronger. Avoid pits.')
            )
        ) : null,

        // === ПАУЗА ===
        gameState === 'paused' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title', style: { fontSize: '48px' } }, 'PAUSED'),
            React.createElement('div', { style: { display: 'flex', gap: '15px', marginTop: '20px' } },
                React.createElement('button', { className: 'btn btn-start', onClick: () => setGameState('playing') }, 'RESUME'),
                React.createElement('button', { className: 'btn', onClick: () => resetGame() }, 'RESTART'),
                React.createElement('button', { className: 'btn', onClick: () => setGameState('menu') }, 'MENU')
            )
        ) : null,
        
        // === ЭКРАН ПРОИГРЫША ===
        gameState === 'gameover' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title', style: { color: '#FF3333', filter: 'none', background: 'none', WebkitTextFillColor: '#FF3333', fontSize: '60px' } }, 'BUSTED'),
            React.createElement('div', { className: 'subtitle', style: { marginBottom: '30px' } }, 'The employees caught you'),
            
            React.createElement('div', { style: { fontSize: '32px', fontFamily: 'Rajdhani', fontWeight: 'bold', marginBottom: '20px' } }, 
                `${Math.floor(score)} M`, 
                React.createElement('span', { style: { fontSize: '18px', color: 'var(--fh-text-muted)', marginLeft: '10px' } }, `(HI: ${highScore} M)`)
            ),

            React.createElement('div', { style: { display: 'flex', gap: '15px', marginBottom: '30px' } },
                React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'TRY AGAIN'),
                React.createElement('button', { className: 'btn', onClick: () => setGameState('menu') }, 'MENU'),
                React.createElement('button', { className: 'btn', onClick: () => window.GameEvents.emit('show_share') }, '📸 SHARE')
            )
        ) : null,

        // === НАСТРОЙКИ ===
        showSettings && React.createElement('div', { className: 'settings-overlay' },
            React.createElement('div', { className: 'settings-panel' },
                React.createElement('div', { className: 'settings-header' }, 
                    React.createElement('div', { className: 'settings-title' }, 'SETTINGS'), 
                    React.createElement('button', { className: 'settings-close', onClick: () => setShowSettings(false) }, '✕')
                ),
                
                React.createElement('div', { className: 'settings-section' },
                    React.createElement('div', { className: 'settings-section-title' }, 'Graphics'),
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'Quality'), 
                        React.createElement('div', { className: 'segmented' }, ['low', 'medium', 'high'].map(q => 
                            React.createElement('button', { key: q, className: settings.graphics === q ? 'active' : '', onClick: () => setSettings(s => ({ ...s, graphics: q })) }, q.toUpperCase())
                        ))
                    )
                ),

                React.createElement('div', { className: 'settings-section' },
                    React.createElement('div', { className: 'settings-section-title' }, 'Gameplay Features'),
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'Combo System'), 
                        React.createElement('button', { className: `setting-toggle ${settings.comboEnabled ? 'on' : ''}`, onClick: () => setSettings(s => ({ ...s, comboEnabled: !s.comboEnabled })) })
                    ),
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'Weather Effects'), 
                        React.createElement('button', { className: `setting-toggle ${settings.weatherEnabled ? 'on' : ''}`, onClick: () => setSettings(s => ({ ...s, weatherEnabled: !s.weatherEnabled })) })
                    ),
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'Dynamic Biomes'), 
                        React.createElement('button', { className: `setting-toggle ${settings.biomesEnabled ? 'on' : ''}`, onClick: () => setSettings(s => ({ ...s, biomesEnabled: !s.biomesEnabled })) })
                    )
                ),

                React.createElement('div', { className: 'settings-section' },
                    React.createElement('div', { className: 'settings-section-title' }, 'Audio'),
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'Master Volume'), 
                        React.createElement('input', { type: 'range', min: 0, max: 100, value: Math.round(settings.masterVolume * 100), onChange: (e) => setSettings(s => ({ ...s, masterVolume: Number(e.target.value) / 100 })), className: 'setting-slider' }),
                        React.createElement('span', { className: 'setting-value' }, `${Math.round(settings.masterVolume * 100)}%`)
                    )
                ),

                React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '10px' } },
                    React.createElement('button', { className: 'btn', onClick: () => setSettings({ ...DEFAULT_SETTINGS }) }, 'RESET DEFAULTS')
                )
            )
        ),
        
        // === РЕНДЕР ПЛАГИНОВ ===
        ...(window.PackUIs || []).map((UI, i) => React.createElement(UI, { key: 'plugin-' + i, gameState, setGameState, score }))
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
window.__bootGame = function () { if (window.__GAME_STARTED__) return; window.__GAME_STARTED__ = true; root.render(React.createElement(Game)); };
if (!window.__LOADER_ACTIVE__) { window.__bootGame(); }
