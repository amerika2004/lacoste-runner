/**
 * ==================================================================
 * LACOSTE RUNNER — CORE ENGINE (v1.0.0)
 * Модульная архитектура с поддержкой плагинов.
 * Отвечает только за: цикл, рендер (Canvas API), ввод, загрузку ассетов.
 * Вся игровая логика вынесена в модули js/pack*.js
 * ==================================================================
 */

const { useState, useEffect, useRef, useCallback } = React;

// ======================= EVENT BUS (Ядро) =======================
window.GameEvents = (function () {
    const listeners = {};
    return {
        on(event, callback) {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(callback);
        },
        off(event, callback) {
            if (!listeners[event]) return;
            listeners[event] = listeners[event].filter(cb => cb !== callback);
        },
        emit(event, data) {
            if (!listeners[event]) return;
            listeners[event].forEach(cb => {
                try { cb(data); } catch (e) { console.error(`[EventBus] Error in '${event}':`, e); }
            });
        }
    };
})();

// ======================= ASSET MANAGER =======================
window.AssetManager = (function () {
    const images = {};
    const sounds = {};
    return {
        loadImage(key, src) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => { images[key] = img; resolve(img); };
                img.onerror = () => { console.warn(`Failed to load image: ${src}`); resolve(null); };
                img.src = src;
            });
        },
        getImage(key) { return images[key] || null; },
        loadSound(key, src) {
            const audio = new Audio(src);
            audio.preload = 'auto';
            sounds[key] = audio;
            return audio;
        },
        getSound(key) { return sounds[key] || null; },
        setGlobalVolume(volume) {
            Object.values(sounds).forEach(s => s.volume = volume);
        }
    };
})();

// ======================= RENDER ENGINE =======================
window.RenderEngine = (function () {
    const state = {
        canvas: null,
        ctx: null,
        width: 1200,
        height: 600,
        shakeTime: 0,
        shakeIntensity: 0,
        flashAlpha: 0,
        flashColor: '255,0,0',
        quality: 'high',
    };

    function makeVignette(w, h) {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.3, w/2, h/2, Math.max(w,h)*0.7);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.65)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); return c;
    }
    let vignetteCache = null;

    return {
        init(canvasRef) {
            state.canvas = canvasRef.current;
            state.ctx = state.canvas.getContext('2d');
            state.width = state.canvas.width;
            state.height = state.canvas.height;
        },
        setQuality(q) { state.quality = q; },
        shake(intensity = 8, duration = 20) {
            if (state.quality === 'low') return;
            state.shakeIntensity = Math.max(state.shakeIntensity, intensity);
            state.shakeTime = Math.max(state.shakeTime, duration);
        },
        flash(color = '255,0,0', alpha = 0.5) {
            if (state.quality === 'low') return;
            state.flashAlpha = alpha;
            state.flashColor = color;
        },
        update(dt) {
            if (state.shakeTime > 0) { state.shakeTime--; if (state.shakeTime === 0) state.shakeIntensity = 0; }
            if (state.flashAlpha > 0) state.flashAlpha = Math.max(0, state.flashAlpha - 0.05);
        },
        draw(scene) {
            const ctx = state.ctx;
            const W = state.width, H = state.height;
            if (!ctx) return;

            let shakeX = 0, shakeY = 0;
            if (state.shakeTime > 0) {
                const k = state.shakeTime / 20;
                shakeX = (Math.random() - 0.5) * state.shakeIntensity * k;
                shakeY = (Math.random() - 0.5) * state.shakeIntensity * k;
            }

            ctx.clearRect(0, 0, W, H);
            ctx.save();
            ctx.translate(shakeX, shakeY);

            // Отрисовка сцены (передаётся из плагинов)
            if (scene && scene.background) {
                ctx.drawImage(scene.background, 0, 0, W, H); // Упрощённый фон
            }
            
            // Плагины сами рисуют свои объекты через GameEvents.emit('render_custom', ctx)
            window.GameEvents.emit('render_custom', ctx);

            // Пост-эффекты
            if (state.quality !== 'low' && (state.flashAlpha > 0)) {
                ctx.fillStyle = `rgba(${state.flashColor},${state.flashAlpha})`;
                ctx.fillRect(0, 0, W, H);
            }
            if (state.quality === 'high') {
                if (!vignetteCache) vignetteCache = makeVignette(W, H);
                ctx.drawImage(vignetteCache, 0, 0);
            }
            ctx.restore();
        }
    };
})();

// ======================= GAME (React Wrapper) =======================
function Game() {
    const [gameState, setGameState] = useState('menu');
    const [settings, setSettings] = useState(() => {
        try {
            const s = JSON.parse(localStorage.getItem('lacosteSettings') || '{}');
            return { graphics: 'high', emojiStyle: 'apple', comboEnabled: true, ...s };
        } catch { return { graphics: 'high', emojiStyle: 'apple', comboEnabled: true }; }
    });

    const canvasRef = useRef(null);
    const requestRef = useRef();
    const lastTimeRef = useRef(0);
    const accumulatorRef = useRef(0);

    // Инициализация движка
    useEffect(() => {
        RenderEngine.init(canvasRef);
        RenderEngine.setQuality(settings.graphics);
        document.body.className = `emoji-${settings.emojiStyle}`;
    }, [settings]);

    // Система ввода (Клавиатура)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Escape') {
                if (gameState === 'playing') setGameState('paused');
                else if (gameState === 'paused') setGameState('playing');
                return;
            }
            window.GameEvents.emit('input_keydown', { code: e.code, preventDefault: () => e.preventDefault() });
        };

        const handleKeyUp = (e) => {
            window.GameEvents.emit('input_keyup', { code: e.code });
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameState]);

    // Система ввода (Тач)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleTouch = (e, type) => {
            if (e.target.closest('.btn') || e.target.closest('.game-btn')) return;
            e.preventDefault();
            window.GameEvents.emit(`input_touch_${type}`, { touches: e.touches });
        };

        canvas.addEventListener('touchstart', (e) => handleTouch(e, 'start'), { passive: false });
        canvas.addEventListener('touchend', (e) => handleTouch(e, 'end'), { passive: false });
        canvas.addEventListener('touchcancel', (e) => handleTouch(e, 'end'), { passive: false });

        return () => {
            canvas.removeEventListener('touchstart', handleTouch);
            canvas.removeEventListener('touchend', handleTouch);
            canvas.removeEventListener('touchcancel', handleTouch);
        };
    }, []);

    // Игровой цикл (Fixed Timestep)
    useEffect(() => {
        if (gameState === 'playing') {
            lastTimeRef.current = performance.now();
            accumulatorRef.current = 0;

            const loop = (time) => {
                if (gameState !== 'playing') return;

                let delta = time - lastTimeRef.current;
                lastTimeRef.current = time;
                if (delta > 250) delta = 250; // Защита от лагов
                accumulatorRef.current += delta;

                const FRAME_TIME = 1000 / 60;
                let loops = 0;

                // Обновление логики 60 раз в секунду
                while (accumulatorRef.current >= FRAME_TIME && loops < 5) {
                    window.GameEvents.emit('tick', { dt: FRAME_TIME / 1000 });
                    RenderEngine.update(FRAME_TIME);
                    accumulatorRef.current -= FRAME_TIME;
                    loops++;
                }

                // Отрисовка
                window.GameEvents.emit('render_tick', {});
                requestRef.current = requestAnimationFrame(loop);
            };

            requestRef.current = requestAnimationFrame(loop);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [gameState]);

    // API для запуска игры (передаётся в меню)
    const startGame = () => {
        setGameState('playing');
        window.GameEvents.emit('game_start', {});
    };

    const pauseGame = () => {
        setGameState('paused');
        window.GameEvents.emit('game_pause', {});
    };

    const resumeGame = () => {
        setGameState('playing');
        window.GameEvents.emit('game_resume', {});
    };

    // Рендер базового React-каркаса
    return React.createElement('div', { id: 'game-container' },
        
        // Canvas для движка
        React.createElement('canvas', { ref: canvasRef, width: 1200, height: 600 }),
        
        // Игровые кнопки (пауза/фуллскрин) - выводим только во время игры
        gameState === 'playing' ? React.createElement(React.Fragment, null,
            React.createElement('button', { id: 'btn-pause', className: 'game-btn', onClick: pauseGame }, '❚❚')
        ) : null,

        // Базовый оверлей паузы (плагины могут его переопределить)
        gameState === 'paused' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title' }, 'PAUSED'),
            React.createElement('button', { className: 'btn btn-start', onClick: resumeGame }, 'Resume')
        ) : null,

        // Контейнер для всех UI-плагинов (HUD, меню, магазины)
        // Сами плагины решают, что рендерить в зависимости от gameState
        window.PackUIs && window.PackUIs.map((UI, i) => React.createElement(UI, { key: i, gameState, startGame, pauseGame, resumeGame }))
    );
}

// ======================= BOOTSTRAP =======================
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(Game));
