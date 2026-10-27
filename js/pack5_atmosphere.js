/* ==================================================================
   PACK 5 — ATMOSPHERE (Погода, Тосты, Прогресс биома)
   ================================================================== */
(function () {
    'use strict';

    const { useState, useEffect } = React;

    // === СОСТОЯНИЕ ===
    const AtmoState = {
        weather: 'clear', // 'clear', 'rain', 'fog', 'storm'
        distance: 0,
        biomeGoal: 500,   // Смена погоды каждые 500м
        biomeProgress: 0,
        toasts: [],
        
        // Для дождя
        rainParticles: [],
        lightningTimer: 0,
    };

    // Экспортируем для рендера
    window.AtmoState = AtmoState;

    // === УТИЛИТЫ ===
    const WEATHER_TYPES = {
        clear: { emoji: '☀️', label: 'Clear', weight: 55 },
        rain:  { emoji: '🌧️', label: 'Rain',  weight: 20 },
        fog:   { emoji: '🌫️', label: 'Fog',   weight: 15 },
        storm: { emoji: '⛈️', label: 'Storm', weight: 10 },
    };

    function pickRandomWeather() {
        const total = Object.values(WEATHER_TYPES).reduce((s, w) => s + w.weight, 0);
        let r = Math.random() * total;
        for (const [key, w] of Object.entries(WEATHER_TYPES)) {
            r -= w.weight;
            if (r <= 0) return key;
        }
        return 'clear';
    }

    function addToast(msg, type = 'info') {
        const id = Date.now() + Math.random();
        AtmoState.toasts.push({ id, msg, type });
        window.GameEvents.emit('ui_toast_added'); // Триггер для обновления UI
        
        setTimeout(() => {
            AtmoState.toasts = AtmoState.toasts.filter(t => t.id !== id);
            window.GameEvents.emit('ui_toast_added');
        }, 2500);
    }

    // === СОБЫТИЯ ИГРЫ ===
    window.GameEvents.on('game_start', (data) => {
        AtmoState.weather = 'clear';
        AtmoState.distance = 0;
        AtmoState.biomeProgress = 0;
        AtmoState.rainParticles = [];
        AtmoState.toasts = [];
        
        setTimeout(() => addToast(`🏁 До смены погоды 500м`, 'info'), 1000);
    });

    window.GameEvents.on('world_tick', (data) => {
        AtmoState.distance = data.distance;
        
        // Логика смены погоды каждые 500м
        const currentPhase = Math.floor(data.distance / 500);
        const progressInPhase = data.distance % 500;
        AtmoState.biomeProgress = progressInPhase;

        // Уведомление за 50м до смены
        if (progressInPhase > 450 && progressInPhase < 460 && !AtmoState._warned) {
            AtmoState._warned = true;
            addToast(`⚠️ Смена погоды через 50м`, 'info');
        }
        if (progressInPhase < 10) AtmoState._warned = false;

        // Смена погоды
        if (progressInPhase < 5 && AtmoState._lastPhase !== currentPhase) {
            AtmoState._lastPhase = currentPhase;
            const newWeather = pickRandomWeather();
            if (newWeather !== AtmoState.weather) {
                AtmoState.weather = newWeather;
                const w = WEATHER_TYPES[newWeather];
                addToast(`${w.emoji} ${w.label}`, newWeather === 'storm' ? 'danger' : 'info');
            }
        }

        // Генерация дождя (визуальные частицы)
        if (AtmoState.weather === 'rain' || AtmoState.weather === 'storm') {
            for (let i = 0; i < 3; i++) {
                AtmoState.rainParticles.push({
                    x: Math.random() * 1200,
                    y: -10,
                    vx: (AtmoState.weather === 'storm' ? -2 : -1) + Math.random() * 2,
                    vy: 10 + Math.random() * 5,
                    life: 60
                });
            }
        }

        // Молнии при грозе
        if (AtmoState.weather === 'storm') {
            AtmoState.lightningTimer++;
            if (AtmoState.lightningTimer > 400 && Math.random() < 0.05) {
                AtmoState.lightningTimer = 0;
                window.RenderEngine.flash('255,255,255', 0.6);
                setTimeout(() => addToast('⚡ Молния!', 'danger'), 100);
            }
        }

        // Обновление частиц дождя
        AtmoState.rainParticles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
        });
        AtmoState.rainParticles = AtmoState.rainParticles.filter(p => p.life > 0 && p.y < 700);
    });

    // === РЕНДЕР ЧАСТИЦ ДОЖДЯ (Поверх Canvas) ===
    window.GameEvents.on('render_frame', (e) => {
        const ctx = e.ctx;
        if (!ctx) return;

        // Рисуем капли
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

    // === UI КОМПОНЕНТ ===
    function AtmoUI({ gameState }) {
        const [toasts, setToasts] = useState([]);
        const [weather, setWeather] = useState(AtmoState.weather);

        useEffect(() => {
            const handleUpdate = () => {
                setToasts([...AtmoState.toasts]);
                setWeather(AtmoState.weather);
            };
            window.GameEvents.on('ui_toast_added', handleUpdate);
            // Периодическое обновление для прогресс-бара
            const interval = setInterval(() => {
                setWeather(AtmoState.weather);
            }, 200);
            return () => clearInterval(interval);
        }, []);

        if (gameState !== 'playing' && gameState !== 'paused') {
            return React.createElement(React.Fragment, null,
                toasts.map(t => React.createElement('div', { key: t.id, className: `pack2-toast ${t.type}` }, t.msg))
            );
        }

        return React.createElement(React.Fragment, null,
            // Иконка погоды в HUD
            React.createElement('div', {
                style: {
                    position: 'absolute', top: '30%', right: '2%', zIndex: 8,
                    fontSize: 'clamp(24px, 4vmin, 34px)',
                    filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.8))',
                    animation: 'badgeFloat 3s ease-in-out infinite'
                }
            }, WEATHER_TYPES[weather].emoji),

            // Прогресс-бар до смены погоды
            React.createElement('div', {
                style: {
                    position: 'absolute', bottom: '2%', left: '50%', transform: 'translateX(-50%)',
                    width: 'min(60%, 500px)', zIndex: 6, pointerEvents: 'none'
                }
            },
                React.createElement('div', {
                    style: { textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '10px', color: 'rgba(255,255,255,0.7)', letterSpacing: '2px', marginBottom: '3px' }
                }, `До смены погоды: ${Math.max(0, Math.ceil(500 - AtmoState.biomeProgress))}м`),
                React.createElement('div', {
                    style: { height: '4px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)', overflow: 'hidden' }
                },
                    React.createElement('div', {
                        style: { width: `${(AtmoState.biomeProgress / 500) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #00FF41, #00FFFF, #FF007F)', boxShadow: '0 0 10px rgba(0,255,200,0.6)' }
                    })
                )
            ),

            // Тосты
            React.createElement('div', { className: 'pack2-toast-container' },
                toasts.map(t => React.createElement('div', { key: t.id, className: `pack2-toast ${t.type}` }, t.msg))
            )
        );
    }

    if (window.PackUIs) window.PackUIs.push(AtmoUI);
    else window.PackUIs = [AtmoUI];

    console.log('%c🌧️ [Pack 5] Atmosphere loaded', 'color:#00FFFF;font-weight:bold');
})();
