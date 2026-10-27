const { useState, useEffect, useRef } = React;

// 1. Шина событий
window.GameEvents = (function () {
    const listeners = {};
    return {
        on: (event, cb) => { (listeners[event] = listeners[event] || []).push(cb); },
        emit: (event, data) => { if (listeners[event]) listeners[event].forEach(cb => { try { cb(data); } catch(e){ console.error(e); } }); }
    };
})();

// 2. Заглушка рендера
window.RenderEngine = {
    init(ref) { this.canvas = ref.current; this.ctx = this.canvas.getContext('2d'); },
    shake() {}, flash() {}, update() {},
    render() {}
};

// 3. Контейнер UI
window.PackUIs = [];

function Game() {
    const [gameState, setGameState] = useState('menu');
    const canvasRef = useRef(null);
    const requestRef = useRef();

    useEffect(() => { window.RenderEngine.init(canvasRef); }, []);

    useEffect(() => {
        if (gameState === 'playing') {
            const loop = () => {
                window.GameEvents.emit('tick');
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
        return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
    }, []);

    // ВСТРОЕННЫЙ UI (на случай, если плагины не сработают)
    const BuiltInUI = ({ gameState, setGameState }) => {
        return React.createElement(React.Fragment, null,
            gameState === 'menu' ? React.createElement('div', { className: 'menu-overlay' },
                React.createElement('h1', { className: 'title' }, 'LACOSTE RUNNER'),
                React.createElement('button', { className: 'btn btn-start', onClick: () => {
                    setGameState('playing');
                    window.GameEvents.emit('game_start', { character: 'crocodile', background: 'default' });
                }}, 'START (Built-in)')
            ) : null,
            gameState === 'gameover' ? React.createElement('div', { className: 'menu-overlay' },
                React.createElement('h1', { style: { color: 'red' } }, 'BUSTED'),
                React.createElement('button', { className: 'btn btn-start', onClick: () => setGameState('menu') }, 'MENU')
            ) : null
        );
    };

    // Собираем UI: если плагины есть — берем их. Нет — берем BuiltInUI.
    const uis = Array.isArray(window.PackUIs) ? window.PackUIs : [];
    
    // Всегда добавляем BuiltInUI, чтобы меню точно было (если не хотим дублирования, уберем его позже)
    const allUis = [BuiltInUI, ...uis];

    return React.createElement('div', { id: 'game-container' },
        React.createElement('canvas', { ref: canvasRef, width: 1200, height: 600 }),
        // ПРИНУДИТЕЛЬНЫЙ РЕНДЕР ВСЕХ UI
        allUis.map((UI, i) => {
            try {
                return React.createElement(UI, { key: i, gameState, setGameState });
            } catch (e) {
                console.error('UI Crash:', e);
                return null;
            }
        })
    );
}

// 4. Ожидание загрузки плагинов
function boot() {
    if (window.__GAME_BOOTED__) return;
    window.__GAME_BOOTED__ = true;

    console.log('🚀 Bootstrapping React...');
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(Game));
}

// Проверка готовности каждые 200мс
const interval = setInterval(() => {
    if (window.__MODULES_READY__) {
        clearInterval(interval);
        boot();
    }
}, 200);

// Если через 3 секунды ничего не загрузилось (ошибка fetch), запускаем игру всё равно
setTimeout(() => {
    if (!window.__GAME_BOOTED__) {
        clearInterval(interval);
        console.warn('Modules timed out, forcing boot...');
        boot();
    }
}, 3000);
