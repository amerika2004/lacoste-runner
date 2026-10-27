/* ==================================================================
   PACK 2 — Statistics, Toasts, Power-ups, Weather
   Обновлено под window.GameEvents
   ================================================================== */
(function () {
    'use strict';

    // -------------------- STATE --------------------
    const Pack2State = {
        sessionStats: {
            distance: 0, foodCollected: 0, obstaclesPassed: 0,
            damageTaken: 0, comboMax: 0, powerupsCollected: 0,
            time: 0,
        },
        totalRecord: parseInt(localStorage.getItem('lacosteTotalRecord') || '0'),
        weather: 'clear',
        biomeIndex: 0,
        biomeDistance: 0,
        powerupActive: null,
        powerupExpiresAt: 0,
        notifications: [],
        statsSnapshot: null,
        timeSinceLastDamage: 0,
        lastDistance: 0,
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

    // Экспортируем toast для других пакетов (например, pack3)
    window.Pack2Hooks = { toast };

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
        shield:  { emoji: '🛡️', label: 'Shield',  duration: 0 },
        magnet:  { emoji: '🧲', label: 'Magnet',  duration: 5000 },
        slowmo:  { emoji: '⏳', label: 'Slow-mo', duration: 3000 },
        sprint:  { emoji: '⚡', label: 'Sprint',  duration: 3000 },
    };

    function isPowerupActive(kind) {
        return Pack2State.powerupActive === kind && performance.now() < Pack2State.powerupExpiresAt;
    }

    function activatePowerup(kind) {
        Pack2State.powerupActive = kind;
        Pack2State.powerupExpiresAt = POWERUPS[kind].duration > 0
            ? performance.now() + POWERUPS[kind].duration
            : Infinity;
        toast(`${POWERUPS[kind].emoji} ${POWERUPS[kind].label}!`, 'success', 1800);
        Pack2State.sessionStats.powerupsCollected++;
    }

    // -------------------- EVENTS --------------------
    window.GameEvents.on('start', (data) => {
        Pack2State.sessionStats = {
            distance: 0, foodCollected: 0, obstaclesPassed: 0,
            damageTaken: 0, comboMax: 0, powerupsCollected: 0,
            time: 0,
        };
        Pack2State.biomeIndex = 0;
        Pack2State.biomeDistance = 0;
        Pack2State.runStartTime = performance.now();
        Pack2State.powerupActive = null;
        Pack2State.statsSnapshot = null;
        changeWeather('clear', true);
        
        setTimeout(() => toast(`🏁 До смены биома 500м`, 'info', 2500), 800);
    });

    window.GameEvents.on('tick', (data) => {
        Pack2State.sessionStats.distance = data.distance;
        Pack2State.sessionStats.time = Math.floor((performance.now() - Pack2State.runStartTime) / 1000);
        if (data.foodEaten > Pack2State.sessionStats.foodCollected) {
            Pack2State.sessionStats.foodCollected = data.foodEaten;
        }

        if (Pack2State.powerupActive && performance.now() >= Pack2State.powerupExpiresAt) {
            Pack2State.powerupActive = null;
        }

        // Магнит
        if (isPowerupActive('magnet') && data.player) {
            data.foods.forEach(food => {
                const dx = (data.player.x + data.player.width / 2) - (food.x + food.width / 2);
                const dy = (data.player.y + data.player.height / 2) - (food.y + food.height / 2);
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 200) {
                    food.x += dx * 0.15;
                    food.y += dy * 0.15;
                }
            });
        }

        // Прогресс биома (каждые 500м)
        const newBiomeIndex = Math.floor(data.distance / 500);
        Pack2State.biomeDistance = data.distance - (newBiomeIndex * 500);
        
        if (newBiomeIndex > Pack2State.biomeIndex) {
            Pack2State.biomeIndex = newBiomeIndex;
            const newWeather = pickRandomWeather();
            changeWeather(newWeather, false);
            toast(`🌍 Зона ${Pack2State.biomeIndex + 1}!`, 'success', 2200);
        } else if (data.distance > 0 && Pack2State.biomeDistance > 450 && Pack2State.biomeDistance < 460) {
            // Одноразовое уведомление за 50м до смены
            if (!Pack2State._warnedBiome) {
                Pack2State._warnedBiome = true;
                toast(`⚠️ Смена зоны через 50м`, 'info', 1800);
            }
        }
        if (Pack2State.biomeDistance < 10) Pack2State._warnedBiome = false;

        // Power-up события (шанс спавна 0.5% на тик)
        if (!Pack2State.powerupActive && Math.random() < 0.002) {
            const kinds = Object.keys(POWERUPS);
            activatePowerup(kinds[Math.floor(Math.random() * kinds.length)]);
        }
    });

    window.GameEvents.on('eat', (data) => {
        Pack2State.sessionStats.foodCollected++;
    });

    window.GameEvents.on('hit', (data) => {
        if (isPowerupActive('shield')) {
            toast('🛡️ Щит поглотил удар!', 'success', 1500);
            Pack2State.powerupActive = null;
            // Восстанавливаем здоровье
            if (window.GameRefs && window.GameRefs.health) {
                window.GameRefs.health.current = Math.min(6, window.GameRefs.health.current + 1);
            }
            return;
        }
        Pack2State.sessionStats.damageTaken++;
        Pack2State.timeSinceLastDamage = 0;
        Pack2State._weatherFlash = 0.6;
    });

    window.GameEvents.on('barrel_hit', () => {
        if (isPowerupActive('shield')) {
            toast('🛡️ Щит поглотил взрыв!', 'success', 1500);
            Pack2State.powerupActive = null;
            return;
        }
        Pack2State.sessionStats.damageTaken++;
    });

    window.GameEvents.on('gameover', (data) => {
        Pack2State.sessionStats.distance = data.distance;
        Pack2State.sessionStats.comboMax = data.combo || 1;
        
        let isNewRecord = false;
        if (data.distance > Pack2State.totalRecord) {
            Pack2State.totalRecord = data.distance;
            localStorage.setItem('lacosteTotalRecord', data.distance.toString());
            isNewRecord = true;
        }

        Pack2State.statsSnapshot = {
            ...Pack2State.sessionStats,
            isNewRecord,
            totalRecord: Pack2State.totalRecord,
        };
        Pack2State.powerupActive = null;
    });

    // -------------------- REACT UI --------------------
    function ToastContainer() {
        const [toasts, setToasts] = React.useState([]);
        React.useEffect(() => {
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

    function PowerupBadge() {
        const [active, setActive] = React.useState(null);
        React.useEffect(() => {
            const id = setInterval(() => {
                if (Pack2State.powerupActive && performance.now() < Pack2State.powerupExpiresAt) {
                    setActive(Pack2State.powerupActive);
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
        const [weather, setWeather] = React.useState(Pack2State.weather);
        React.useEffect(() => {
            const id = setInterval(() => setWeather(Pack2State.weather), 200);
            return () => clearInterval(id);
        }, []);
        const w = WEATHER_TYPES[weather];
        return React.createElement('div', { className: 'pack2-weather-hud' }, w.emoji);
    }

    function BiomeBar() {
        const [progress, setProgress] = React.useState(0);
        React.useEffect(() => {
            const id = setInterval(() => {
                const p = Math.min(100, (Pack2State.biomeDistance / 500) * 100);
                setProgress(p);
            }, 150);
            return () => clearInterval(id);
        }, []);
        return React.createElement('div', { className: 'pack2-biome-bar' },
            React.createElement('div', { className: 'pack2-biome-label' }, `До смены зоны: ${Math.max(0, Math.ceil(500 - Pack2State.biomeDistance))}м`),
            React.createElement('div', { className: 'pack2-biome-track' },
                React.createElement('div', { className: 'pack2-biome-fill', style: { width: `${progress}%` } })
            )
        );
    }

    // -------------------- MAIN UI WRAPPER --------------------
    function Pack2UI({ gameState }) {
        const [showStats, setShowStats] = React.useState(false);
        const [snapshot, setSnapshot] = React.useState(null);

        React.useEffect(() => {
            if (gameState === 'gameover' && Pack2State.statsSnapshot) {
                setSnapshot(Pack2State.statsSnapshot);
                setShowStats(true);
            } else if (gameState !== 'gameover') {
                setShowStats(false);
            }
        }, [gameState]);

        const weatherClass = Pack2State.weather === 'rain' ? 'rain' : Pack2State.weather === 'fog' ? 'fog' : Pack2State.weather === 'storm' ? 'storm' : '';

        return React.createElement(React.Fragment, null,
            React.createElement(ToastContainer),
            gameState === 'playing' && weatherClass ? React.createElement('div', { className: `pack2-weather-overlay ${weatherClass}` }) : null,
            gameState === 'playing' ? React.createElement(React.Fragment, null,
                React.createElement(PowerupBadge),
                React.createElement(WeatherHud),
                React.createElement(BiomeBar)
            ) : null,
            showStats ? React.createElement(StatsOverlay, { snapshot, onClose: () => setShowStats(false) }) : null
        );
    }

    if (window.PackUIs) {
        window.PackUIs.push(Pack2UI);
    } else {
        window.PackUIs = [Pack2UI];
    }

    console.log('%c⚡ PACK 2 loaded', 'color:#FF007F;font-weight:bold;font-size:14px');
})();
