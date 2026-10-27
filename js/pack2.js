/* ==================================================================
   PACK 2 — Statistics, Toasts, Controls, Power-ups, Weather
   Подключается после game.js. Использует window.Pack2Hooks + window.Pack2UI.
   ================================================================== */
(function () {
    'use strict';

    const { useState, useEffect, useRef, useCallback } = React;

    // -------------------- STATE --------------------
    const Pack2State = {
        sessionStats: {
            distance: 0, foodCollected: 0, obstaclesPassed: 0,
            damageTaken: 0, comboMax: 0, powerupsCollected: 0,
            time: 0, // в секундах
        },
        totalRecord: parseInt(localStorage.getItem('lacosteTotalRecord') || '0'),
        weather: 'clear', // 'clear' | 'rain' | 'fog' | 'storm'
        biomeIndex: 0,
        biomeDistance: 0,
        biomeGoal: 500,
        powerupActive: null, // { kind, expiresAt }
        powerupExpiresAt: 0,
        notifications: [],
        statsSnapshot: null,
        controlsDismissed: false,
        weatherParticles: [],
        timeSinceLastDamage: 0,
        lastDistance: 0,
        damageFlash: 0,
        runStartTime: 0,
    };

    // -------------------- TOASTS --------------------
    const toastListeners = [];
    function toast(msg, type = 'info', duration = 2200) {
        const id = Date.now() + Math.random();
        const item = { id, msg, type };
        Pack2State.notifications.push(item);
        toastListeners.forEach(fn => fn([...Pack2State.notifications]));
        setTimeout(() => {
            Pack2State.notifications = Pack2State.notifications.filter(n => n.id !== id);
            toastListeners.forEach(fn => fn([...Pack2State.notifications]));
        }, duration);
    }

    // -------------------- WEATHER --------------------
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
    function changeWeather(newWeather, silent) {
        if (Pack2State.weather === newWeather) return;
        Pack2State.weather = newWeather;
        if (!silent) {
            const w = WEATHER_TYPES[newWeather];
            toast(`${w.emoji} ${w.label}`, newWeather === 'storm' ? 'danger' : 'info', 2500);
        }
    }

    // -------------------- POWER-UPS --------------------
    const POWERUPS = {
        shield:  { emoji: '🛡️', label: 'Shield',  duration: 0,      color: '#00BFFF' }, // 0 = до первого удара
        magnet:  { emoji: '🧲', label: 'Magnet',  duration: 5000,   color: '#FF00FF' },
        slowmo:  { emoji: '⏳', label: 'Slow-mo', duration: 3000,   color: '#0080FF' },
        sprint:  { emoji: '⚡', label: 'Sprint',  duration: 3000,   color: '#FFD700' },
    };
    const POWERUP_WEIGHTS = { shield: 30, magnet: 25, slowmo: 25, sprint: 20 };
    function pickRandomPowerup() {
        const total = Object.values(POWERUP_WEIGHTS).reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (const [key, w] of Object.entries(POWERUP_WEIGHTS)) {
            r -= w;
            if (r <= 0) return key;
        }
        return 'shield';
    }
    function activatePowerup(kind) {
        Pack2State.powerupActive = kind;
        Pack2State.powerupExpiresAt = POWERUPS[kind].duration > 0
            ? performance.now() + POWERUPS[kind].duration
            : Infinity;
        toast(`${POWERUPS[kind].emoji} ${POWERUPS[kind].label}!`, 'success', 1800);
    }
    function isPowerupActive(kind) {
        return Pack2State.powerupActive === kind && performance.now() < Pack2State.powerupExpiresAt;
    }
    function tickPowerup() {
        if (Pack2State.powerupActive && performance.now() >= Pack2State.powerupExpiresAt) {
            Pack2State.powerupActive = null;
        }
    }

    // -------------------- SESSION STATS --------------------
    function resetSessionStats() {
        Pack2State.sessionStats = {
            distance: 0, foodCollected: 0, obstaclesPassed: 0,
            damageTaken: 0, comboMax: 0, powerupsCollected: 0,
            time: 0,
        };
        Pack2State.runStartTime = performance.now();
        Pack2State.timeSinceLastDamage = 0;
        Pack2State.damageFlash = 0;
    }

    function updateTotalRecord(distance) {
        if (distance > Pack2State.totalRecord) {
            Pack2State.totalRecord = distance;
            localStorage.setItem('lacosteTotalRecord', distance.toString());
            return true;
        }
        return false;
    }

    // -------------------- HOOKS --------------------
    window.Pack2Hooks = {
        onGameStart: (data) => {
            resetSessionStats();
            Pack2State.biomeIndex = 0;
            Pack2State.biomeDistance = 0;
            Pack2State.biomeGoal = 500;
            Pack2State.weatherParticles = [];
            Pack2State.controlsDismissed = false;
            // Начинаем с чистого неба
            changeWeather('clear', true);
            // Через 0.8 сек показываем первый тост-подсказку
            setTimeout(() => {
                toast(`🏁 До смены биома ${Pack2State.biomeGoal}м`, 'info', 2500);
            }, 800);
        },

        onGameOver: (data) => {
            const elapsed = (performance.now() - Pack2State.runStartTime) / 1000;
            Pack2State.sessionStats.distance = data.distance;
            Pack2State.sessionStats.time = Math.floor(elapsed);
            Pack2State.sessionStats.comboMax = data.combo;
            const isNewRecord = updateTotalRecord(data.distance);
            Pack2State.statsSnapshot = {
                ...Pack2State.sessionStats,
                character: data.character,
                background: data.background,
                timeOfDay: data.timeOfDay,
                isNewRecord,
                totalRecord: Pack2State.totalRecord,
            };
            Pack2State.powerupActive = null;
        },

        onTick: (data) => {
            // Обновление дистанции
            Pack2State.sessionStats.distance = data.distance;
            Pack2State.sessionStats.time = Math.floor((performance.now() - Pack2State.runStartTime) / 1000);

            // Комбо
            if (data.combo !== undefined) {
                if (data.combo > Pack2State.sessionStats.comboMax) Pack2State.sessionStats.comboMax = data.combo;
            }

            // Power-up истечение
            tickPowerup();

            // Slow-mo / Sprint эффекты (визуально в drawHooks)
            // (Реальное замедление делает игра сама — мы только визуал + бейдж)

            // Магнит: притягиваем еду
            if (isPowerupActive('magnet')) {
                const magnetRadius = 200;
                const p = data.player;
                data.foods.forEach(food => {
                    const dx = (p.x + p.width / 2) - (food.x + food.width / 2);
                    const dy = (p.y + p.height / 2) - (food.y + food.height / 2);
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < magnetRadius) {
                        food.x += dx * 0.15;
                        food.y += dy * 0.15;
                    }
                });
            }

            // Погодные эффекты
            const weather = Pack2State.weather;
            if (weather === 'rain' || weather === 'storm') {
                // Дождь: шанс спотыкания на луже +10% (упрощённо: спавним частицы)
                // Частицы капель
                if (data.distance > Pack2State.lastDistance + 2) {
                    Pack2State.lastDistance = data.distance;
                    for (let i = 0; i < 3; i++) {
                        Pack2State.weatherParticles.push({
                            x: Math.random() * 1200,
                            y: -10,
                            vy: 8 + Math.random() * 4,
                            vx: (weather === 'storm' ? -2 : -1) + Math.random() * 2,
                            life: 60,
                            maxLife: 60,
                            kind: 'rain',
                        });
                    }
                }
            }
            if (weather === 'fog') {
                // Туман: визуальный overlay (в Pack2UI)
            }
            if (weather === 'storm') {
                // Молния раз в 8-15 сек
                if (!Pack2State._lightningNext) Pack2State._lightningNext = performance.now() + 8000 + Math.random() * 7000;
                if (performance.now() > Pack2State._lightningNext) {
                    Pack2State._lightningNext = performance.now() + 8000 + Math.random() * 7000;
                    Pack2State._lightningFlash = 1.0;
                    toast('⚡ Гроза!', 'danger', 1200);
                }
            }
            if (Pack2State._lightningFlash > 0) {
                Pack2State._lightningFlash = Math.max(0, Pack2State._lightningFlash - 0.06);
            }

            // Обновление частиц
            Pack2State.weatherParticles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.life--;
            });
            Pack2State.weatherParticles = Pack2State.weatherParticles.filter(p => p.life > 0 && p.y < 700);

            // Биом прогресс
            const prevBiomeDist = Pack2State.biomeDistance;
            Pack2State.biomeDistance = data.distance - Pack2State.biomeIndex * 500;
            if (data.distance >= (Pack2State.biomeIndex + 1) * 500) {
                Pack2State.biomeIndex++;
                Pack2State.biomeGoal = 500;
                // Смена погоды на новом биоме
                const newWeather = pickRandomWeather();
                changeWeather(newWeather, false);
                toast(`🌍 Биом ${Pack2State.biomeIndex + 1}!`, 'success', 2200);
            } else if (prevBiomeDist < 450 && Pack2State.biomeDistance >= 450) {
                // За 50м до смены биома
                toast(`⚠️ Биом через 50м`, 'info', 1800);
            }
        },

        onFoodEaten: (food) => {
            Pack2State.sessionStats.foodCollected++;
            if (food.type === 'golden') toast('⭐ +50', 'success', 1000);
            if (food.type === 'rare') toast('💎 +2 HP', 'success', 1000);
            if (food.type === 'poison') {
                Pack2State.damageFlash = 0.6;
                toast('☠ Отравлен!', 'danger', 1500);
            }
        },

        onObstacleHit: (obs) => {
            Pack2State.sessionStats.damageTaken++;
            Pack2State.timeSinceLastDamage = 0;
            if (isPowerupActive('shield')) {
                toast('🛡️ Щит поглотил удар!', 'success', 1500);
                Pack2State.powerupActive = null;
            } else {
                Pack2State.damageFlash = 0.6;
            }
        },

        onBarrelHit: () => {
            Pack2State.sessionStats.damageTaken++;
            Pack2State.damageFlash = 0.6;
        },

        onPitFall: () => {
            Pack2State.damageFlash = 0.8;
        },

        // Используется в Pack2UI для отрисовки погоды/частиц
        getWeatherParticles: () => Pack2State.weatherParticles,
        getState: () => Pack2State,
    };

    // -------------------- REACT UI --------------------
    function ToastContainer() {
        const [toasts, setToasts] = useState([]);
        useEffect(() => {
            toastListeners.push(setToasts);
            return () => {
                const idx = toastListeners.indexOf(setToasts);
                if (idx >= 0) toastListeners.splice(idx, 1);
            };
        }, []);
        return React.createElement('div', { className: 'pack2-toast-container' },
            toasts.map(t => React.createElement('div', { key: t.id, className: `pack2-toast ${t.type}` }, t.msg))
        );
    }

    function StatsOverlay({ snapshot, onClose }) {
        if (!snapshot) return null;
        const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        const card = (icon, label, value, extraClass) => React.createElement('div', { className: `pack2-stat-card ${extraClass || ''}` },
            React.createElement('span', { className: 'pack2-stat-icon' }, icon),
            React.createElement('div', { className: 'pack2-stat-content' },
                React.createElement('span', { className: 'pack2-stat-label' }, label),
                React.createElement('span', { className: 'pack2-stat-value' }, value)
            )
        );
        return React.createElement('div', { className: 'pack2-stats-overlay' },
            React.createElement('div', { className: 'pack2-stats-panel' },
                React.createElement('div', { className: 'pack2-stats-title' }, snapshot.isNewRecord ? '🏆 NEW RECORD!' : '📊 SESSION STATS'),
                React.createElement('div', { className: 'pack2-stats-subtitle' },
                    snapshot.isNewRecord ? 'Личный рекорд побит!' : 'Результаты забега'
                ),
                React.createElement('div', { className: 'pack2-stats-grid' },
                    card('📏', 'Дистанция', `${snapshot.distance} м`),
                    card('⏱️', 'Время', formatTime(snapshot.time)),
                    card('🍽️', 'Съедено', snapshot.foodCollected),
                    card('🔥', 'Макс. комбо', `x${snapshot.comboMax}`),
                    card('💥', 'Урона', snapshot.damageTaken),
                    card('🎁', 'Power-ups', snapshot.powerupsCollected),
                    card('🏅', 'Общий рекорд', `${snapshot.totalRecord} м`, snapshot.isNewRecord ? 'record' : '')
                ),
                React.createElement('div', { className: 'pack2-controls-actions' },
                    React.createElement('button', { className: 'pack2-controls-btn primary', onClick: onClose }, 'Закрыть')
                )
            )
        );
    }

    function ControlsScreen({ onClose }) {
        const isTouch = 'ontouchstart' in window;
        return React.createElement('div', { className: 'pack2-controls-overlay' },
            React.createElement('div', { className: 'pack2-controls-panel' },
                React.createElement('div', { className: 'pack2-controls-title' }, '🎮 Управление'),
                React.createElement('div', { className: 'pack2-controls-subtitle', style: { textAlign: 'center', color: '#aaa', fontSize: '12px', marginBottom: '12px', letterSpacing: '2px' } }, 'Нажми «Понятно» чтобы начать'),

                // PC
                React.createElement('div', { className: 'pack2-controls-section' },
                    React.createElement('h4', null, '🖥️ ПК'),
                    React.createElement('div', { className: 'pack2-controls-row' },
                        React.createElement('span', { className: 'pack2-key' }, 'Space'),
                        React.createElement('span', { className: 'pack2-controls-desc' }, 'Прыжок (удерживай = высокий)')
                    ),
                    React.createElement('div', { className: 'pack2-controls-row' },
                        React.createElement('span', { className: 'pack2-key' }, '↑'),
                        React.createElement('span', { className: 'pack2-controls-desc' }, 'Альтернатива: прыжок')
                    ),
                    React.createElement('div', { className: 'pack2-controls-row' },
                        React.createElement('span', { className: 'pack2-key' }, 'Esc'),
                        React.createElement('span', { className: 'pack2-controls-desc' }, 'Пауза / продолжить')
                    ),
                    React.createElement('div', { className: 'pack2-controls-row' },
                        React.createElement('span', { className: 'pack2-key' }, 'N'),
                        React.createElement('span', { className: 'pack2-controls-desc' }, 'День / ночь')
                    )
                ),

                // Mobile
                React.createElement('div', { className: 'pack2-controls-section' },
                    React.createElement('h4', null, '📱 Телефон'),
                    React.createElement('div', { className: 'pack2-controls-row' },
                        React.createElement('span', { className: 'pack2-key' }, '👆 Тап'),
                        React.createElement('span', { className: 'pack2-controls-desc' }, 'Прыжок')
                    ),
                    React.createElement('div', { className: 'pack2-controls-row' },
                        React.createElement('span', { className: 'pack2-key' }, '👆 Долгое'),
                        React.createElement('span', { className: 'pack2-controls-desc' }, 'Высокий прыжок')
                    ),
                    React.createElement('div', { className: 'pack2-controls-row' },
                        React.createElement('span', { className: 'pack2-key' }, '⏸️'),
                        React.createElement('span', { className: 'pack2-controls-desc' }, 'Пауза (правый нижний угол)')
                    )
                ),

                React.createElement('div', { className: 'pack2-controls-actions' },
                    React.createElement('button', { className: 'pack2-controls-btn primary', onClick: onClose }, '✅ Понятно, играем!')
                )
            )
        );
    }

    function PowerupBadge() {
        const [active, setActive] = useState(null);
        useEffect(() => {
            const id = setInterval(() => {
                const s = Pack2State;
                if (s.powerupActive && performance.now() < s.powerupExpiresAt) {
                    setActive(s.powerupActive);
                } else {
                    setActive(null);
                }
            }, 100);
            return () => clearInterval(id);
        }, []);
        if (!active) return null;
        const p = POWERUPS[active];
        return React.createElement('div', { className: `pack2-powerup-badge ${active}` },
            React.createElement('span', null, p.emoji),
            React.createElement('span', null, p.label)
        );
    }

    function WeatherHud() {
        const [weather, setWeather] = useState(Pack2State.weather);
        useEffect(() => {
            const id = setInterval(() => setWeather(Pack2State.weather), 200);
            return () => clearInterval(id);
        }, []);
        const w = WEATHER_TYPES[weather];
        return React.createElement('div', { className: 'pack2-weather-hud' }, w.emoji);
    }

    function BiomeBar() {
        const [progress, setProgress] = useState(0);
        const [goal, setGoal] = useState(500);
        useEffect(() => {
            const id = setInterval(() => {
                const s = Pack2State;
                const p = Math.min(100, (s.biomeDistance / 500) * 100);
                setProgress(p);
                setGoal(500 - s.biomeDistance);
            }, 150);
            return () => clearInterval(id);
        }, []);
        return React.createElement('div', { className: 'pack2-biome-bar' },
            React.createElement('div', { className: 'pack2-biome-label' }, `До биома: ${Math.max(0, Math.ceil(goal))}м`),
            React.createElement('div', { className: 'pack2-biome-track' },
                React.createElement('div', { className: 'pack2-biome-fill', style: { width: `${progress}%` } })
            )
        );
    }

    // -------------------- MAIN UI WRAPPER --------------------
    window.Pack2UI = function ({ gameState, distanceRef }) {
        const [showControls, setShowControls] = useState(false);
        const [showStats, setShowStats] = useState(false);
        const [snapshot, setSnapshot] = useState(null);

        // Controls screen — при первом старте игры
        useEffect(() => {
            if (gameState === 'playing' && !Pack2State.controlsDismissed) {
                setShowControls(true);
                Pack2State.controlsDismissed = true;
            }
        }, [gameState]);

        // Stats — при смерти
        useEffect(() => {
            if (gameState === 'gameover' && Pack2State.statsSnapshot) {
                setSnapshot(Pack2State.statsSnapshot);
                setShowStats(true);
            } else if (gameState !== 'gameover') {
                setShowStats(false);
                setSnapshot(null);
            }
        }, [gameState]);

        const weatherClass = Pack2State.weather === 'rain' ? 'rain'
            : Pack2State.weather === 'fog' ? 'fog'
            : Pack2State.weather === 'storm' ? 'storm' : '';

        return React.createElement(React.Fragment, null,
            // Погодный overlay
            weatherClass ? React.createElement('div', { className: `pack2-weather-overlay ${weatherClass}` }) : null,

            // Тосты (всегда)
            React.createElement(ToastContainer),

            // HUD power-up и погода (только в игре)
            gameState === 'playing' ? React.createElement(React.Fragment, null,
                React.createElement(PowerupBadge),
                React.createElement(WeatherHud),
                React.createElement(BiomeBar)
            ) : null,

            // Controls (первый старт)
            showControls ? React.createElement(ControlsScreen, { onClose: () => setShowControls(false) }) : null,

            // Stats (после смерти)
            showStats ? React.createElement(StatsOverlay, { snapshot, onClose: () => setShowStats(false) }) : null
        );
    };

    // -------------------- WEATHER PARTICLES (canvas overlay) --------------------
    // Вызывается из RenderEngine? Нет — рендерим частицы поверх канваса через отдельный элемент.
    // Простое решение: клиентский div с CSS-частицами (дождь), а для грома — вспышка.
    // Если хочешь рендерить на канвасе — скажи, добавим хук в RenderEngine.draw.

    // Для простоты: дождь на CSS через JS-инъекцию span-ов
    // (реализовано в Pack2UI через weatherParticles, но проще — оставим CSS-эффект)

    console.log('%c⚡ PACK 2 loaded', 'color:#FF007F;font-weight:bold;font-size:14px');
})();
