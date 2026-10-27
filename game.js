/**
 * LACOSTE RUNNER — CORE ENGINE & LOADER
 */
(function() {
    'use strict';

    // 1. Шина событий
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

    window.PackUIs = [];
    
    // 2. Заглушка рендера (плагины перезапишут её)
    window.RenderEngine = {
        init: function(ref) { this.canvas = ref.current; this.ctx = this.canvas.getContext('2d'); },
        setQuality: function() {},
        shake: function() {},
        flash: function() {},
        update: function() {},
        render: function() {}
    };

    // 3. Загрузчик плагинов
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
            console.warn('manifest.json not found', e);
        }

        for (const src of modules) {
            await loadScript(src);
        }

        console.log('%c🚀 All modules ready! Booting React...', 'color:#00FF41;font-weight:bold');
        bootReact();
    }

    // 4. React-движок
    const { useState, useEffect, useRef } = React;

    function Game() {
        const [gameState, setGameState] = useState('menu');
        const canvasRef = useRef(null);
        const requestRef = useRef();

        useEffect(() => {
            if (window.RenderEngine) window.RenderEngine.init(canvasRef);
        }, []);

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

        useEffect(() => {
            const kd = (e) => window.GameEvents.emit('input_keydown', e);
            const ku = (e) => window.GameEvents.emit('input_keyup', e);
            window.addEventListener('keydown', kd);
            window.addEventListener('keyup', ku);
            return () => {
                window.removeEventListener('keydown', kd);
                window.removeEventListener('keyup', ku);
            };
        }, []);

        // Встроенное меню (чтобы игра точно запустилась)
        const BuiltInUI = () => {
            return React.createElement(React.Fragment, null,
                gameState === 'menu' ? React.createElement('div', { className: 'menu-overlay' },
                    React.createElement('h1', { className: 'title' }, 'LACOSTE RUNNER'),
                    React.createElement('button', { className: 'btn btn-start', onClick: () => {
                        setGameState('playing');
                        window.GameEvents.emit('game_start', { character: 'crocodile', background: 'default' });
                    }}, 'START')
                ) : null,
                gameState === 'gameover' ? React.createElement('div', { className: 'menu-overlay' },
                    React.createElement('h1', { style: { color: 'red' } }, 'BUSTED'),
                    React.createElement('button', { className: 'btn btn-start', onClick: () => setGameState('menu') }, 'MENU')
                ) : null
            );
        };

        const uis = Array.isArray(window.PackUIs) ? window.PackUIs : [];

        return React.createElement('div', { id: 'game-container' },
            React.createElement('canvas', { ref: canvasRef, width: 1200, height: 600 }),
            React.createElement(BuiltInUI, { gameState, setGameState }),
            uis.map((UI, i) => React.createElement(UI, { key: i, gameState, setGameState }))
        );
    }

    function bootReact() {
        if (window.__BOOTED__) return;
        window.__BOOTED__ = true;
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(Game));
    }

    // 5. Старт
    loadAll();
    
    setTimeout(() => {
        if (!window.__BOOTED__) {
            console.warn('Loading timed out, forcing boot...');
            bootReact();
        }
    }, 3000);

})();
