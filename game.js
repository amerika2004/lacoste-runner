/**
 * ==================================================================
 * LACOSTE RUNNER — CORE ENGINE (v3.0)
 * Ждёт загрузки плагинов, затем запускает React.
 * ==================================================================
 */

// 1. Шина событий
window.GameEvents = (function () {
    const listeners = {};
    return {
        on: (event, cb) => { (listeners[event] = listeners[event] || []).push(cb); },
        emit: (event, data) => { if (listeners[event]) listeners[event].forEach(cb => cb(data)); }
    };
})();

// 2. Рендер-движок
window.RenderEngine = (function () {
    let canvas, ctx;
    return {
        init(ref) { canvas = ref.current; ctx = canvas.getContext('2d'); },
        clear() { if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); },
        shake() {}, // Заглушка (если нужно — реализуем позже)
        flash() {}, // Заглушка
        update() {}
    };
})();

// 3. Контейнер для UI
window.PackUIs = window.PackUIs || [];

// 4. React-обертка (Движок)
const { useState, useEffect, useRef } = React;

function Game() {
    const [gameState, setGameState] = useState('menu');
    const canvasRef = useRef(null);
    const requestRef = useRef();
    const lastTimeRef = useRef(0);
    const accumRef = useRef(0);

    // Инициализация контекста
    useEffect(() => {
        window.RenderEngine.init(canvasRef);
    }, []);

    // Главный цикл
    useEffect(() => {
        if (gameState === 'playing') {
            lastTimeRef.current = performance.now();
            const loop = (time) => {
                if (gameState !== 'playing') return;
                
                let dt = time - lastTimeRef.current;
                lastTimeRef.current = time;
                if (dt > 250) dt = 250;
                accumRef.current += dt;

                const FRAME = 1000 / 60;
                let loops = 0;
                
                // Обновляем логику 60 раз в секунду
                while (accumRef.current >= FRAME && loops < 5) {
                    window.GameEvents.emit('tick');
                    window.RenderEngine.update();
                    accumRef.current -= FRAME;
                    loops++;
                }

                // Отрисовка (каждый кадр)
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
        const kd = (e) => window.GameEvents.emit('input_keydown', e);
        const ku = (e) => window.GameEvents.emit('input_keyup', e);
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup', ku);
        return () => {
            window.removeEventListener('keydown', kd);
            window.removeEventListener('keyup', ku);
        };
    }, []);

    // Если UI не загрузились (пусто), показываем заглушку
    if (!window.PackUIs || window.PackUIs.length === 0) {
        return React.createElement('div', { 
            style: { color: 'white', padding: 50, background: 'black', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' } 
        }, '⏳ Загрузка модулей... (Проверь консоль)');
    }

    // Рендер игры + всех UI-плагинов
    return React.createElement('div', { id: 'game-container' },
        React.createElement('canvas', { ref: canvasRef, width: 1200, height: 600 }),
        window.PackUIs.map((UI, i) => React.createElement(UI, { key: i, gameState, setGameState }))
    );
}

// 5. ОЖИДАНИЕ ЗАГРУЗКИ ВСЕХ ПЛАГИНОВ
// Мы проверяем каждые 100 мс, загрузились ли все модули (по флагу в loader.js)
// Если загрузились — запускаем React.

function bootReact() {
    if (window.__GAME_BOOTED__) return;
    window.__GAME_BOOTED__ = true;
    console.log('🚀 Bootstrapping React...');
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(Game));
}

// Запуск
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Даём loader.js время на инициализацию
        const checkInterval = setInterval(() => {
            if (window.__MODULES_READY__) {
                clearInterval(checkInterval);
                bootReact();
            }
        }, 100);
    });
} else {
    const checkInterval = setInterval(() => {
        if (window.__MODULES_READY__) {
            clearInterval(checkInterval);
            bootReact();
        }
    }, 100);
}
