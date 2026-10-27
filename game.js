/**
 * ==================================================================
 * LACOSTE RUNNER — MONOLITHIC CORE ENGINE + PLUGIN LOADER
 * ==================================================================
 */
(function() {
    'use strict';

    // ======================= 1. EVENT BUS =======================
    window.GameEvents = {
        listeners: {},
        on: function(event, cb) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(cb);
        },
        emit: function(event, data) {
            if (this.listeners[event]) {
                this.listeners[event].forEach(cb => {
                    try { cb(data); } catch (e) { console.error(`[EventBus Error] '${event}':`, e); }
                });
            }
        }
    };

    // ======================= 2. CORE ASSETS & RENDER =======================
    window.PackUIs = [];
    window.RenderEngine = {
        init: function(ref) { this.canvas = ref.current; this.ctx = this.canvas.getContext('2d'); },
        shake: function() {}, flash: function() {}, update: function() {},
        render: function() {}
    };

    // ======================= 3. PLUGIN LOADER =======================
    function loadScript(src) {
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = false;
            s.onload = () => { console.log(`✅ Loaded: ${src}`); resolve(); };
            s.onerror = () => { console.error(`❌ Failed: ${src}`); resolve(); };
            document.body.appendChild(s);
        });
    }

    async function loadAll() {
        let modules = [];
        try {
            const res = await fetch('js/manifest.json?t=' + Date.now(), { cache: 'no-store' });
            const data = await res.json();
            modules = data.modules || [];
        } catch (e) {
            console.warn('manifest.json not found, loading fallback.');
        }

        for (const src of modules) {
            await loadScript(src);
        }

        console.log('%c🚀 All modules ready! Booting React...', 'color:#00FF41;font-weight:bold');
        bootReact();
    }

    // ======================= 4. REACT ENGINE =======================
    const { useState, useEffect, useRef } = React;

    function Game() {
        const [gameState, setGameState] = useState('menu');
        const [score, setScore] = useState(0);
        const [health, setHealth] = useState(6);
        const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('lacosteHighScore')) || 0);
        
        const canvasRef = useRef(null);
        const requestRef = useRef();

        useEffect(() => {
            if (window.RenderEngine) window.RenderEngine.init(canvasRef);
            
            // Слушаем игровые события для обновления HUD
            window.GameEvents.on('world_tick', (d) => {
                setScore(Math.floor(d.distance));
                setHealth(d.health);
            });
            window.GameEvents.on('gameover', (d) => {
                if (d.distance > highScore) {
                    setHighScore(Math.floor(d.distance));
                    localStorage.setItem('lacosteHighScore', Math.floor(d.distance));
                }
                setGameState('gameover');
            });
        }, [highScore]);

        // Главный цикл
        useEffect(() => {
            if (gameState === 'playing') {
                const loop = () => {
                    window.GameEvents.emit('tick');
                    if (window.RenderEngine) window.RenderEngine.update();
                    
                    const ctx = canvasRef.current.getContext('2d');
                    ctx.clearRect(0, 0, 1200, 600);
                    window.GameEvents.emit('render_frame', { ctx });
                    
                    requestRef.current = requestAnimationFrame(loop);
                };
                requestRef.current = requestAnimationFrame(loop);
            }
            return () => cancelAnimationFrame(requestRef.current);
        }, [gameState]);

        // Ввод
        useEffect(() => {
            const kd = (e) => {
                if (e.code === 'Escape') {
                    if (gameState === 'playing') setGameState('paused');
                    else if (gameState === 'paused') setGameState('playing');
                    return;
                }
                window.GameEvents.emit('input_keydown', e);
            };
            const ku = (e) => window.GameEvents.emit('input_keyup', e);
            window.addEventListener('keydown', kd);
            window.addEventListener('keyup', ku);
            return () => {
                window.removeEventListener('keydown', kd);
                window.removeEventListener('keyup', ku);
            };
        }, [gameState]);

        const startGame = () => {
            setGameState('playing');
            window.GameEvents.emit('game_start', { character: 'crocodile', background: 'default', settings: {} });
        };

        // ======================= ВСТРОЕННЫЙ UI (ГАРАНТИЯ) =======================
        const builtInUI = React.createElement(React.Fragment, null,
            gameState === 'menu' ? React.createElement('div', { className: 'menu-overlay' },
                React.createElement('h1', { className: 'title' }, 'LACOSTE RUNNER'),
                React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'START ESCAPE')
            ) : null,
            
            gameState === 'playing' ? React.createElement('div', { style: { position: 'absolute', top: 20, left: 20, color: '#00FF41', fontFamily: 'monospace', fontSize: '24px', zIndex: 10, textShadow: '1px 1px 0 #000' } },
                React.createElement('div', null, `DIST: ${score}m`),
                React.createElement('div', null, `HP: ${'❤️'.repeat(Math.ceil(health/2))}`)
            ) : null,

            gameState === 'paused' ? React.createElement('div', { className: 'menu-overlay' },
                React.createElement('h1', { className: 'title', style: { color: '#00FFFF' } }, 'PAUSED'),
                React.createElement('button', { className: 'btn btn-start', onClick: () => setGameState('playing') }, 'RESUME')
            ) : null,

            gameState === 'gameover' ? React.createElement('div', { className: 'menu-overlay' },
                React.createElement('h1', { className: 'title', style: { color: 'red' } }, 'BUSTED'),
                React.createElement('div', { style: { fontSize: '24px', color: 'white', marginBottom: '20px' } }, `DIST: ${score}m | HI: ${highScore}m`),
                React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'TRY AGAIN'),
                React.createElement('button', { className: 'btn', onClick: () => setGameState('menu'), style: { marginTop: '10px' } }, 'MENU')
            ) : null
        );

        const uis = Array.isArray(window.PackUIs) ? window.PackUIs : [];

        return React.createElement('div', { id: 'game-container' },
            React.createElement('canvas', { ref: canvasRef, width: 1200, height: 600 }),
            builtInUI,
            // Плагины рендерятся поверх, но если они пустые — builtInUI спасет ситуацию
            uis.map((UI, i) => React.createElement(UI, { key: i, gameState, setGameState }))
        );
    }

    function bootReact() {
        if (window.__BOOTED__) return;
        window.__BOOTED__ = true;
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(Game));
    }

    // ======================= 5. ЗАПУСК =======================
    loadAll();
    
    setTimeout(() => {
        if (!window.__BOOTED__) {
            console.warn('Loading timed out, forcing boot...');
            bootReact();
        }
    }, 3000);

})();
