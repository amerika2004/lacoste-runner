const { useState, useEffect, useRef } = React;

// ======================= 1. ШИНА СОБЫТИЙ =======================
window.GameEvents = {
    listeners: {},
    on(event, cb) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(cb);
    },
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => {
                try { cb(data); } catch (e) { console.error(`[EventBus] ${event}:`, e); }
            });
        }
    }
};

// ======================= 2. ГЛОБАЛЬНЫЕ РЕСУРСЫ =======================
window.PackUIs = [];          // Сюда плагины пушат свои React-компоненты (погода, комбо и т.д.)
window.GameCharacters = {};   // Сюда плагины регистрируют персонажей
window.RenderEngine = {       // Заглушка (плагины могут расширять)
    shake() {}, 
    flash() {}, 
    update() {} 
};

// ======================= 3. REACT APP =======================
function App() {
    const [gameState, setGameState] = useState('menu');
    const [timeOfDay, setTimeOfDay] = useState(() => localStorage.getItem('lacosteTimeOfDay') || 'day');
    const [background, setBackground] = useState(() => {
        const s = localStorage.getItem('lacosteBackground');
        return (s && window.GameConfig.BACKGROUNDS[s]) ? s : 'default';
    });
    const [character, setCharacter] = useState(() => {
        const s = localStorage.getItem('lacosteCharacter');
        return (s && window.GameCharacters[s]) ? s : Object.keys(window.GameCharacters)[0] || 'crocodile';
    });
    
    const [score, setScore] = useState(0);
    const [health, setHealth] = useState(6);
    const [comboDisplay, setComboDisplay] = useState({ mult: 1, count: 0 });
    const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('lacosteHighScore')) || 0);
    
    const [settings, setSettings] = useState(() => {
        try { return { ...window.GameConfig.DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('lacosteSettings') || '{}') }; } 
        catch { return { ...window.GameConfig.DEFAULT_SETTINGS }; }
    });
    const [showSettings, setShowSettings] = useState(false);
    
    const canvasRef = useRef(null);
    const requestRef = useRef();

    // Сохранение настроек
    useEffect(() => { localStorage.setItem('lacosteTimeOfDay', timeOfDay); }, [timeOfDay]);
    useEffect(() => { localStorage.setItem('lacosteBackground', background); }, [background]);
    useEffect(() => { localStorage.setItem('lacosteCharacter', character); }, [character]);
    useEffect(() => {
        localStorage.setItem('lacosteSettings', JSON.stringify(settings));
        document.body.className = `emoji-${settings.emojiStyle}`;
        window.GameEvents.emit('settings_changed', settings);
    }, [settings]);

    // Подписка на игровые события (HUD)
    useEffect(() => {
        window.GameEvents.on('world_tick', (d) => { 
            setScore(Math.floor(d.distance)); 
            setHealth(d.health); 
        });
        window.GameEvents.on('combo_changed', (d) => setComboDisplay(d));
        window.GameEvents.on('gameover', (d) => {
            if (d.distance > highScore) { 
                const nh = Math.floor(d.distance); 
                setHighScore(nh); 
                localStorage.setItem('lacosteHighScore', nh); 
            }
            setGameState('gameover');
        });
    }, [highScore]);

    // Главный цикл игры (Fixed Timestep 60 FPS)
    useEffect(() => {
        if (gameState === 'playing') {
            let lastTime = performance.now();
            let accum = 0;
            const loop = (time) => {
                if (gameState !== 'playing') return;
                
                let dt = time - lastTime; 
                lastTime = time;
                if (dt > 250) dt = 250; 
                accum += dt;
                
                const FRAME = 1000 / 60; 
                let loops = 0;
                
                while (accum >= FRAME && loops < 5) { 
                    window.GameEvents.emit('tick'); 
                    window.RenderEngine.update(); 
                    accum -= FRAME; 
                    loops++; 
                }
                
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, 1200, 600);
                window.GameEvents.emit('render_frame', { ctx });
                
                requestRef.current = requestAnimationFrame(loop);
            };
            requestRef.current = requestAnimationFrame(loop);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [gameState]);

    // Ввод (Клавиатура)
    useEffect(() => {
        const kd = (e) => {
            if (e.code === 'Escape') { 
                if (showSettings) { setShowSettings(false); return; } 
                setGameState(s => s === 'playing' ? 'paused' : (s === 'paused' ? 'playing' : s)); 
                return; 
            }
            if (e.code === 'KeyN') { setTimeOfDay(p => p === 'day' ? 'night' : 'day'); return; }
            window.GameEvents.emit('input_keydown', e);
        };
        const ku = (e) => window.GameEvents.emit('input_keyup', e);
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup', ku);
        return () => { 
            window.removeEventListener('keydown', kd); 
            window.removeEventListener('keyup', ku); 
        };
    }, [showSettings]);

    // Ввод (Тач)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ts = (e) => {
            if (e.target.closest('.btn') || e.target.closest('.game-btn') || e.target.closest('.char-btn') || e.target.closest('.settings-panel') || e.target.closest('.settings-open-btn')) return;
            e.preventDefault(); 
            window.GameEvents.emit('input_touch_start', e);
        };
        const te = (e) => window.GameEvents.emit('input_touch_end', e);
        canvas.addEventListener('touchstart', ts, { passive: false });
        canvas.addEventListener('touchend', te, { passive: false });
        return () => { 
            canvas.removeEventListener('touchstart', ts); 
            canvas.removeEventListener('touchend', te); 
        };
    }, []);

    const startGame = () => {
        setScore(0); setHealth(6); setComboDisplay({ mult: 1, count: 0 });
        setGameState('playing');
        window.GameEvents.emit('game_start', { character, background, timeOfDay, settings });
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) { 
            document.documentElement.requestFullscreen().catch(() => {}); 
            if (screen.orientation?.lock) screen.orientation.lock('landscape').catch(() => {}); 
        } else if (document.exitFullscreen) { 
            document.exitFullscreen(); 
        }
    };

    const getHearts = () => {
        let h = [];
        for (let i = 0; i < 3; i++) {
            if (health >= (i + 1) * 2) h.push('❤️'); 
            else if (health === i * 2 + 1) h.push('💔'); 
            else h.push('🖤');
        }
        return h.join(' ');
    };

    return React.createElement('div', { id: 'game-container' },
        // HUD
        (gameState === 'playing' || gameState === 'paused') ? React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'hud-left' }, 
                React.createElement('span', null, `DIST: ${score}m`), 
                React.createElement('span', { style: { fontSize: '24px' } }, getHearts())
            ),
            React.createElement('div', { className: 'hud-right' }, 
                React.createElement('span', null, `HI ${highScore.toString().padStart(5, '0')}`)
            ),
            comboDisplay.mult > 1 ? React.createElement('div', { key: comboDisplay.count, className: `combo-indicator combo-x${comboDisplay.mult}` }, `COMBO x${comboDisplay.mult}`) : null
        ) : null,

        React.createElement('canvas', { ref: canvasRef, width: 1200, height: 600 }),

        // Кнопки в игре
        gameState === 'playing' ? React.createElement(React.Fragment, null,
            React.createElement('button', { id: 'btn-fullscreen', className: 'game-btn', onClick: toggleFullscreen }, '⛶'),
            React.createElement('button', { id: 'btn-pause', className: 'game-btn', onClick: () => setGameState('paused') }, '❚❚')
        ) : null,

        // Главное меню
        gameState === 'menu' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: `celestial-sun ${timeOfDay === 'day' ? 'visible' : ''}` }, 
                React.createElement('div', { className: 'sun-rays' }), 
                React.createElement('div', { className: 'sun-core' })
            ),
            React.createElement('div', { className: `celestial-moon ${timeOfDay === 'night' ? 'visible' : ''}` }, 
                React.createElement('div', { className: 'moon-crescent' }), 
                React.createElement('span', { className: 'star s1' }), React.createElement('span', { className: 'star s2' }), 
                React.createElement('span', { className: 'star s3' }), React.createElement('span', { className: 'star s4' }), 
                React.createElement('span', { className: 'star s5' })
            ),
            React.createElement('div', { className: 'title' }, 'LACOSTE', React.createElement('br'), 'RUNNER'),
            React.createElement('div', { className: 'subtitle' }, 'VICE CITY EDITION'),
            
            // Панель персонажей
            React.createElement('div', { className: 'char-panel' }, 
                React.createElement('div', { className: 'char-panel-title' }, 'Hero'), 
                Object.values(window.GameCharacters).map(c => React.createElement('button', { 
                    key: c.id, 
                    className: `char-btn ${character === c.id ? 'active' : ''}`, 
                    onClick: () => setCharacter(c.id) 
                }, 
                    React.createElement('span', { className: 'char-emoji' }, c.emoji), 
                    React.createElement('span', { className: 'char-name' }, c.name)
                ))
            ),
            
            // Панель фонов
            React.createElement('div', { className: 'settings', style: { marginTop: '-5px' } }, 
                Object.values(window.GameConfig.BACKGROUNDS).map(bg => React.createElement('button', { 
                    key: bg.id, 
                    className: `btn ${background === bg.id ? 'active' : ''}`, 
                    onClick: () => setBackground(bg.id) 
                }, `${bg.emoji} ${bg.name}`))
            ),
            
            // Переключатель День/Ночь
            React.createElement('div', { className: 'settings', style: { marginTop: '-10px' } }, 
                React.createElement('button', { className: `btn ${timeOfDay === 'day' ? 'active' : ''}`, onClick: () => setTimeOfDay('day') }, '☀️ Day'), 
                React.createElement('button', { className: `btn ${timeOfDay === 'night' ? 'active' : ''}`, onClick: () => setTimeOfDay('night') }, '🌙 Night')
            ),
            
            React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'Start Escape'),
            React.createElement('button', { className: 'settings-open-btn', onClick: () => setShowSettings(true), style: { marginTop: '15px' } }, '⚙ SETTINGS')
        ) : null,

        // Экран паузы
        gameState === 'paused' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title', style: { color: '#00FFFF' } }, 'PAUSED'),
            React.createElement('button', { className: 'btn btn-start', onClick: () => setGameState('playing'), style: { marginBottom: '10px' } }, 'Resume'),
            React.createElement('div', { className: 'settings' }, 
                React.createElement('button', { className: 'btn', onClick: () => { setGameState('menu'); window.GameEvents.emit('game_abort'); } }, 'Restart'), 
                React.createElement('button', { className: 'btn', onClick: () => setGameState('menu') }, 'Menu')
            )
        ) : null,

        // Экран смерти
        gameState === 'gameover' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title', style: { color: 'red' } }, 'BUSTED'),
            React.createElement('div', { className: 'subtitle' }, 'DIST: ', score, 'm | HI: ', highScore, 'm'),
            React.createElement('div', { className: 'settings' }, 
                React.createElement('button', { className: 'btn', onClick: () => setGameState('menu') }, 'Menu'), 
                React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'Try Again')
            )
        ) : null,

        // Модальное окно настроек
        showSettings ? React.createElement('div', { className: 'settings-overlay' },
            React.createElement('div', { className: 'settings-panel' },
                React.createElement('div', { className: 'settings-header' }, 
                    React.createElement('div', { className: 'settings-title' }, 'SETTINGS'), 
                    React.createElement('button', { className: 'settings-close', onClick: () => setShowSettings(false) }, '✕')
                ),
                React.createElement('div', { className: 'settings-section' }, 
                    React.createElement('div', { className: 'settings-section-title' }, '🔊 Audio'), 
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'Sound'), 
                        React.createElement('button', { className: `setting-toggle ${settings.soundEnabled ? 'on' : ''}`, onClick: () => setSettings(s => ({ ...s, soundEnabled: !s.soundEnabled })) })
                    )
                ),
                React.createElement('div', { className: 'settings-footer' }, 
                    React.createElement('button', { className: 'settings-reset', onClick: () => setSettings({ ...window.GameConfig.DEFAULT_SETTINGS }) }, 'RESET')
                )
            )
        ) : null,

        // Слой для UI-плагинов (погода, комбо, и т.д.)
        (window.PackUIs || []).map((UI, i) => React.createElement(UI, { key: i, gameState, setGameState }))
    );
}

// ======================= 4. ЗАПУСК ДВИЖКА (МГНОВЕННЫЙ) =======================
window.GameBoot = {
    triggered: false,
    callbacks: [],
    onReady(cb) {
        if (this.triggered) { try { cb(); } catch (e) { console.error(e); } return; }
        this.callbacks.push(cb);
    },
    trigger() {
        if (this.triggered) return;
        this.triggered = true;
        window.__MODULES_READY__ = true;
        this.callbacks.forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
        this.callbacks = [];
    }
};

function boot() { 
    if (!window.__BOOTED__) { 
        window.__BOOTED__ = true; 
        console.log('%c🎮 Booting React App...', 'color:#FF007F;font-weight:bold');
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App)); 
    } 
}

// Мгновенный запуск как только loader.js закончит загрузку плагинов
window.GameBoot.onReady(boot);

// Фоллбэк: если loader.js не подключен или упал (ошибка сети)
setTimeout(() => { 
    if (!window.__BOOTED__) { 
        console.warn('⚠️ Fallback boot (loader failed or timed out)');
        window.GameBoot.trigger();
    } 
}, 3000);
