/* ==================================================================
   PACK 3 — UI (Меню, HUD, Настройки, Экран Смерти)
   ================================================================== */
(function () {
    'use strict';

    const { useState, useEffect } = React;

    function MainUI({ gameState, setGameState }) {
        // --- 1. ЛОКАЛЬНЫЕ СТЕЙТЫ ---
        const [score, setScore] = useState(0);
        const [health, setHealth] = useState(6);
        const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('lacosteHighScore')) || 0);
        
        // Настройки (графика, звук)
        const [showSettings, setShowSettings] = useState(false);
        const [settings, setSettings] = useState(() => {
            try {
                const s = JSON.parse(localStorage.getItem('lacosteSettings') || '{}');
                return { graphics: 'high', emojiStyle: 'apple', soundEnabled: true, masterVolume: 1, ...s };
            } catch { return { graphics: 'high', emojiStyle: 'apple', soundEnabled: true, masterVolume: 1 }; }
        });

        // Выбор персонажа и фона
        const [character, setCharacter] = useState(() => localStorage.getItem('lacosteCharacter') || 'crocodile');
        const [background, setBackground] = useState(() => localStorage.getItem('lacosteBackground') || 'default');
        const [timeOfDay, setTimeOfDay] = useState(() => localStorage.getItem('lacosteTimeOfDay') || 'day');

        // --- 2. ПОДПИСКА НА СОБЫТИЯ ---
        useEffect(() => {
            const onTick = (data) => {
                setScore(Math.floor(data.distance));
                setHealth(data.health);
            };
            const onGameOver = (data) => {
                if (data.distance > highScore) {
                    const newHigh = Math.floor(data.distance);
                    setHighScore(newHigh);
                    localStorage.setItem('lacosteHighScore', newHigh);
                }
            };
            
            window.GameEvents.on('world_tick', onTick);
            window.GameEvents.on('gameover', onGameOver);
        }, [highScore]);

        // --- 3. СОХРАНЕНИЕ НАСТРОЕК ---
        useEffect(() => {
            localStorage.setItem('lacosteSettings', JSON.stringify(settings));
            document.body.className = `emoji-${settings.emojiStyle}`;
            
            // Передаём настройки в движок и аудио-модуль
            if (window.RenderEngine && window.RenderEngine.setQuality) {
                window.RenderEngine.setQuality(settings.graphics);
            }
            window.GameEvents.emit('settings_changed', settings);
        }, [settings]);

        // --- 4. ФУНКЦИИ ---
        const startGame = () => {
            localStorage.setItem('lacosteCharacter', character);
            localStorage.setItem('lacosteBackground', background);
            localStorage.setItem('lacosteTimeOfDay', timeOfDay);
            
            window.GameState = { background, timeOfDay }; // Глобально для мира
            setGameState('playing');
            window.GameEvents.emit('game_start', { character, background, timeOfDay, settings });
        };

        const restartGame = () => {
            setGameState('playing');
            window.GameEvents.emit('game_start', { character, background, timeOfDay, settings });
        };

        const formatScore = (num) => num.toString().padStart(5, '0');
        
        const getHearts = () => {
            let h = [];
            for (let i = 0; i < 3; i++) {
                if (health >= (i + 1) * 2) h.push('❤️');
                else if (health === i * 2 + 1) h.push('💔');
                else h.push('🖤');
            }
            return h.join(' ');
        };

        // --- 5. РЕНДЕР ---
        return React.createElement(React.Fragment, null,
            
            // 1. HUD (Счёт и здоровье) в игре
            (gameState === 'playing' || gameState === 'paused') ? React.createElement(React.Fragment, null,
                React.createElement('div', { className: 'hud-left' },
                    React.createElement('span', null, `DIST: ${score}m`),
                    React.createElement('span', { style: { fontSize: 'clamp(14px, 2.5vmin, 24px)', letterSpacing: '2px' } }, getHearts())
                ),
                React.createElement('div', { className: 'hud-right' },
                    React.createElement('span', null, `HI ${formatScore(highScore)}m`)
                )
            ) : null,

            // 2. Кнопка паузы
            gameState === 'playing' ? React.createElement('button', { 
                id: 'btn-pause', className: 'game-btn', onClick: () => setGameState('paused') 
            }, '❚❚') : null,

            // 3. Главное меню
            gameState === 'menu' ? React.createElement('div', { className: 'menu-overlay' },
                React.createElement('div', { className: 'title' }, 'LACOSTE', React.createElement('br'), 'RUNNER'),
                React.createElement('div', { className: 'subtitle' }, 'VICE CITY EDITION'),
                
                // Выбор персонажа
                React.createElement('div', { className: 'char-panel' },
                    React.createElement('div', { className: 'char-panel-title' }, 'Hero'),
                    Object.values(window.GameConfig.CHARACTERS).map(char => 
                        React.createElement('button', {
                            key: char.id,
                            className: `char-btn ${character === char.id ? 'active' : ''}`,
                            onClick: () => setCharacter(char.id)
                        },
                            React.createElement('span', { className: 'char-emoji' }, char.emoji),
                            React.createElement('span', { className: 'char-name' }, char.name)
                        )
                    )
                ),

                // Выбор фона
                React.createElement('div', { className: 'settings', style: { marginTop: '-5px' } },
                    Object.values(window.GameConfig.BACKGROUNDS).map(bg => 
                        React.createElement('button', {
                            key: bg.id,
                            className: `btn ${background === bg.id ? 'active' : ''}`,
                            onClick: () => setBackground(bg.id)
                        }, `${bg.emoji} ${bg.name}`)
                    )
                ),

                // День/Ночь
                React.createElement('div', { className: 'settings', style: { marginTop: '-10px' } },
                    React.createElement('button', { className: `btn ${timeOfDay === 'day' ? 'active' : ''}`, onClick: () => setTimeOfDay('day') }, '☀️ Day'),
                    React.createElement('button', { className: `btn ${timeOfDay === 'night' ? 'active' : ''}`, onClick: () => setTimeOfDay('night') }, '🌙 Night')
                ),

                React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'Start Escape'),

                React.createElement('button', { className: 'settings-open-btn', onClick: () => setShowSettings(true), style: { marginTop: '15px' } }, '⚙ SETTINGS')
            ) : null,

            // 4. Пауза
            gameState === 'paused' ? React.createElement('div', { className: 'menu-overlay' },
                React.createElement('div', { className: 'title', style: { color: '#00FFFF' } }, 'PAUSED'),
                React.createElement('button', { className: 'btn btn-start', onClick: () => setGameState('playing'), style: { marginBottom: '10px' } }, 'Resume'),
                React.createElement('div', { className: 'settings' },
                    React.createElement('button', { className: 'btn', onClick: restartGame }, 'Restart'),
                    React.createElement('button', { className: 'btn', onClick: () => setGameState('menu') }, 'Menu')
                )
            ) : null,

            // 5. Экран смерти
            gameState === 'gameover' ? React.createElement('div', { className: 'menu-overlay' },
                React.createElement('div', { className: 'title', style: { color: 'red' } }, 'BUSTED'),
                React.createElement('div', { className: 'subtitle' }, 'DIST: ', score, 'm | HI: ', highScore, 'm'),
                React.createElement('button', { className: 'btn btn-start', onClick: restartGame }, 'Try Again'),
                React.createElement('button', { className: 'btn', onClick: () => setGameState('menu'), style: { marginTop: '10px' } }, 'Menu')
            ) : null,

            // 6. Настройки
            showSettings ? React.createElement('div', { className: 'settings-overlay' },
                React.createElement('div', { className: 'settings-panel' },
                    React.createElement('div', { className: 'settings-header' },
                        React.createElement('div', { className: 'settings-title' }, 'SETTINGS'),
                        React.createElement('button', { className: 'settings-close', onClick: () => setShowSettings(false) }, '✕')
                    ),
                    
                    // Графика
                    React.createElement('div', { className: 'settings-section' },
                        React.createElement('div', { className: 'settings-section-title' }, '🖥 Graphics'),
                        React.createElement('div', { className: 'setting-row' },
                            React.createElement('span', { className: 'setting-label' }, 'Quality'),
                            React.createElement('div', { className: 'segmented' },
                                ['low', 'medium', 'high'].map(q => React.createElement('button', {
                                    key: q, className: settings.graphics === q ? 'active' : '',
                                    onClick: () => setSettings(s => ({ ...s, graphics: q }))
                                }, q.toUpperCase()))
                            )
                        )
                    ),

                    // Звук
                    React.createElement('div', { className: 'settings-section' },
                        React.createElement('div', { className: 'settings-section-title' }, '🔊 Audio'),
                        React.createElement('div', { className: 'setting-row' },
                            React.createElement('span', { className: 'setting-label' }, 'Sound'),
                            React.createElement('button', {
                                className: `setting-toggle ${settings.soundEnabled ? 'on' : ''}`,
                                onClick: () => setSettings(s => ({ ...s, soundEnabled: !s.soundEnabled }))
                            })
                        )
                    ),

                    React.createElement('div', { className: 'settings-footer' },
                        React.createElement('button', { className: 'settings-reset', onClick: () => setSettings({ graphics: 'high', emojiStyle: 'apple', soundEnabled: true, masterVolume: 1 }) }, 'RESET')
                    )
                )
            ) : null
        );
    }

    if (window.PackUIs) window.PackUIs.push(MainUI);
    else window.PackUIs = [MainUI];

    console.log('%c🎨 [Pack 3] UI loaded', 'color:#00FFFF;font-weight:bold');
})();
