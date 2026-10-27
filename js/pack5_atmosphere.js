/* ==================================================================
   PACK 5 — ATMOSPHERE (Погода, Тосты, Прогресс-бар биома)
   ================================================================== */
(function () {
    'use strict';

    const { useState, useEffect } = React;

    // === СОСТОЯНИЕ ===
    const AtmoState = {
        weather: 'clear',
        biomeProgress: 0,
        toasts: [],
        rainParticles: [],
        lightningTimer: 0,
        _warned: false,
        _lastPhase: 0,
    };

    window.AtmoState = AtmoState;

    // === ТИПЫ ПОГОДЫ ===
    const WEATHER = {
        clear: { emoji: '☀️', label: 'Clear', weight: 55 },
        rain:  { emoji: '🌧️', label: 'Rain',  weight: 20 },
        fog:   { emoji: '🌫️', label: 'Fog',   weight: 15 },
        storm: { emoji: '⛈️', label: 'Storm', weight: 10 },
    };

    function pickWeather() {
        const total = Object.values(WEATHER).reduce((s, w) => s + w.weight, 0);
        let r = Math.random() * total;
        for (const [key, w] of Object.entries(WEATHER)) {
            r -= w.weight;
            if (r <= 0) return key;
        }
        return 'clear';
    }

    function addToast(msg, type = 'info') {
        const id = Date.now() + Math.random();
        AtmoState.toasts.push({ id, msg, type });
        window.GameEvents.emit('ui_toast_added');
        
        setTimeout(() => {
            AtmoState.toasts = AtmoState.toasts.filter(t => t.id !== id);
            window.GameEvents.emit('ui_toast_added');
        }, 2500);
    }

    // === СОБЫТИЯ ===
    window.GameEvents.on('game_start', () => {
        AtmoState.weather = 'clear';
        AtmoState.biomeProgress = 0;
        AtmoState.rainParticles = [];
        AtmoState.toasts = [];
        AtmoState._warned = false;
        AtmoState._lastPhase = 0;
        
        setTimeout(() => addToast('🏁 До смены погоды 500м', 'info'), 1000);
    });

    window.GameEvents.on('world_tick', (data) => {
        AtmoState.biomeProgress = data.distance % 500;

        // Предупреждение за 50м
        if (AtmoState.biomeProgress > 450 && AtmoState.biomeProgress < 460 && !AtmoState._warned) {
            AtmoState._warned = true;
            addToast('⚠️ Смена погоды через 50м', 'info');
        }
        if (AtmoState.biomeProgress < 10) AtmoState._warned = false;

        // Смена погоды
        const phase = Math.floor(data.distance / 500);
        if (phase > AtmoState._lastPhase) {
            AtmoState._lastPhase = phase;
            const newWeather = pickWeather();
            if (newWeather !== AtmoState.weather) {
                AtmoState.weather = newWeather;
                const w = WEATHER[newWeather];
                addToast(`${w.emoji} ${w.label}`, newWeather === 'storm' ? 'danger' : 'info');
            }
        }

        // Дождь
        if (AtmoState.weather === 'rain' || AtmoState.weather === 'storm') {
            for (let i = 0; i < 3; i++) {
                AtmoState.rainParticles.push({
                    x: Math.random() * 1200, y: -10,
                    vx: -1 + Math.random() * 2,
                    vy: 10 + Math.random() * 5,
                    life: 60
                });
            }
        }

        // Молнии
        if (AtmoState.weather === 'storm') {
            AtmoState.lightningTimer++;
            if (AtmoState.lightningTimer > 400 && Math.random() < 0.05) {
                AtmoState.lightningTimer = 0;
                if (window.RenderEngine) window.RenderEngine.flash('255,255,255', 0.6);
                setTimeout(() => addToast('⚡ Молния!', 'danger'), 100);
            }
        }

        // Обновление капель
        AtmoState.rainParticles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
        AtmoState.rainParticles = AtmoState.rainParticles.filter(p => p.life > 0 && p.y < 700);
    });

    // === РЕНДЕР ДОЖДЯ ===
    window.GameEvents.on('render_frame', (e) => {
        const ctx = e.ctx;
        if (!ctx) return;
        if (AtmoState.weather === 'rain' || AtmoState.weather === 'storm') {
            ctx.save();
            ctx.strokeStyle = AtmoState.weather === 'storm' ? 'rgba(150,180,255,0.6)' : 'rgba(180,200,255,0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            AtmoState.rainParticles.forEach(p => {
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2);
            });
            ctx.stroke();
            ctx.restore();
        }
    });

    // === UI ===
    function AtmoUI({ gameState }) {
        const [toasts, setToasts] = useState([]);
        const [weather, setWeather] = useState(AtmoState.weather);
        const [progress, setProgress] = useState(0);

        useEffect(() => {
            const update = () => {
                setToasts([...AtmoState.toasts]);
                setWeather(AtmoState.weather);
                setProgress(AtmoState.biomeProgress);
            };
            window.GameEvents.on('ui_toast_added', update);
            const interval = setInterval(update, 150); // Обновляем прогресс-бар
            return () => clearInterval(interval);
        }, []);

        return React.createElement(React.Fragment, null,
            // Тосты
            React.createElement('div', { className: 'pack2-toast-container' },
                toasts.map(t => React.createElement('div', { key: t.id, className: `pack2-toast ${t.type}` }, t.msg))
            ),

            // Иконка погоды и прогресс-бар (только в игре)
            (gameState === 'playing') ? React.createElement(React.Fragment, null,
                // Иконка
                React.createElement('div', {
                    style: { position: 'absolute', top: '30%', right: '2%', zIndex: 8, fontSize: 'clamp(24px, 4vmin, 34px)', filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.8))' }
                }, WEATHER[weather].emoji),

                // Прогресс-бар
                React.createElement('div', {
                    style: { position: 'absolute', bottom: '2%', left: '50%', transform: 'translateX(-50%)', width: 'min(60%, 500px)', zIndex: 6, pointerEvents: 'none' }
                },
                    React.createElement('div', { style: { textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '10px', color: 'rgba(255,255,255,0.7)', letterSpacing: '2px', marginBottom: '3px' } },
                        `До смены погоды: ${Math.max(0, Math.ceil(500 - progress))}м`
                    ),
                    React.createElement('div', { style: { height: '4px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', overflow: 'hidden' } },
                        React.createElement('div', { style: { width: `${(progress / 500) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #00FF41, #00FFFF, #FF007F)', boxShadow: '0 0 10px rgba(0,255,200,0.6)' } })
                    )
                )
            ) : null
        );
    }

    if (window.PackUIs) window.PackUIs.push(AtmoUI);
    else window.PackUIs = [AtmoUI];

    console.log('%c🌧️ [Pack 5] Atmosphere loaded', 'color:#00FFFF;font-weight:bold');
})();
