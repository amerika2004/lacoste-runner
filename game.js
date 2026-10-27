const { useState, useEffect, useRef } = React;

// 1. Шина событий
window.GameEvents = {
    listeners: {},
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    },
    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(cb => { try { cb(data); } catch (e) { console.error(e); } });
    }
};

window.PackUIs = [];

// 2. Движок рендера
window.RenderEngine = {
    init(ref) { this.canvas = ref.current; this.ctx = this.canvas.getContext('2d'); },
    setQuality(q) { this.quality = q; },
    shake(i, d) { if (this.quality === 'low') return; this.shakeTime = d; },
    flash(c, a) { if (this.quality === 'low') return; this.flashColor = c; this.flashAlpha = a; },
    update() {
        if (this.shakeTime > 0) this.shakeTime--;
        if (this.flashAlpha > 0) this.flashAlpha -= 0.05;
    },
    render(scene) {
        if (!this.ctx) return;
        const { ctx, canvas } = this;
        const W = canvas.width, H = canvas.height;
        
        ctx.clearRect(0, 0, W, H);
        ctx.save();
        
        if (this.shakeTime > 0) {
            ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
        }
        
        // Фон
        if (scene.bg && scene.bg.img && scene.bg.img.complete) {
            const scale = H / scene.bg.img.naturalHeight;
            const w = scene.bg.img.naturalWidth * scale;
            let offset = (scene.bg.offset || 0) % w;
            if (offset > 0) offset -= w;
            for (let i = offset; i < W; i += w) ctx.drawImage(scene.bg.img, i, 0, w, H);
        } else {
            ctx.fillStyle = scene.bg?.color || '#111';
            ctx.fillRect(0, 0, W, H);
        }

        // Игрок
        if (scene.player && scene.player.img && scene.player.img.complete) {
            ctx.save();
            ctx.translate(scene.player.x + scene.player.w / 2, scene.player.y + scene.player.h / 2);
            ctx.rotate(scene.player.tilt || 0);
            ctx.drawImage(scene.player.img, -scene.player.w / 2, -scene.player.h / 2, scene.player.w, scene.player.h);
            ctx.restore();
        }

        // Препятствия
        if (scene.obstacles) {
            scene.obstacles.forEach(o => {
                if (o.img && o.img.complete) ctx.drawImage(o.img, o.x, o.y, o.w, o.h);
                else { ctx.fillStyle = '#888'; ctx.fillRect(o.x, o.y, o.w, o.h); }
            });
        }

        // Еда
        if (scene.foods) {
            ctx.textBaseline = 'bottom';
            scene.foods.forEach(f => {
                ctx.font = '40px Arial';
                ctx.fillText(f.emoji, f.x, f.y + f.h);
            });
        }

        ctx.restore();
        
        if (this.flashAlpha > 0) {
            ctx.fillStyle = `rgba(${this.flashColor},${this.flashAlpha})`;
            ctx.fillRect(0, 0, W, H);
        }
    }
};

// 3. React-обертка
function Game() {
    const [gameState, setGameState] = useState('menu');
    const canvasRef = useRef(null);
    const requestRef = useRef();
    const lastTimeRef = useRef(0);
    const accumRef = useRef(0);

    useEffect(() => {
        window.RenderEngine.init(canvasRef);
    }, []);

    // Цикл
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
                while (accumRef.current >= FRAME && loops < 5) {
                    window.GameEvents.emit('tick');
                    window.RenderEngine.update();
                    accumRef.current -= FRAME;
                    loops++;
                }
                
                window.GameEvents.emit('render_frame', { ctx: canvasRef.current.getContext('2d') });
                requestRef.current = requestAnimationFrame(loop);
            };
            requestRef.current = requestAnimationFrame(loop);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [gameState]);

    // Ввод
    useEffect(() => {
        const onKeyDown = (e) => window.GameEvents.emit('input_keydown', e);
        const onKeyUp = (e) => window.GameEvents.emit('input_keyup', e);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    return React.createElement('div', { id: 'game-container' },
        React.createElement('canvas', { ref: canvasRef, width: 1200, height: 600 }),
        window.PackUIs.map((UI, i) => React.createElement(UI, { key: i, gameState, setGameState }))
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(Game));
