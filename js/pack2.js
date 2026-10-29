/* ==================================================================
   PACK 2 — Atmosphere & Tactical Depth
   Power-ups, Weather, Dynamic Music
   ================================================================== */
(function () {
    'use strict';

    const P2_CONFIG = (window.GAME_CONFIG && window.GAME_CONFIG.pack2) || {
        powerups: { spawnChance: 0.05, types: { shield: { emoji: '🛡️', duration: 0 }, magnet: { emoji: '🧲', duration: 5000 }, slowmo: { emoji: '⏳', duration: 3000 }, sprint: { emoji: '⚡', duration: 3000 } } },
        weather: { types: ['clear', 'rain', 'fog', 'storm'], changeDistance: 1000, stormChance: 0.1 },
        music: { layers: [], maxTempoRate: 1.15, tempoDistance: 2000 }
    };

    const Pack2State = {
        activePowerup: null, // { type, endTime }
        hasShield: false,
        currentWeather: 'clear',
        lastWeatherChange: 0,
        weatherParticles: [], // Для дождя
        lightningTimer: 0,
        lightningActive: false,
        musicAudios: [],
        currentMusicLayer: 0,
        rainAudio: null,
        thunderAudio: null,
        powerupAudios: {},
        settings: null,
    };

    window.Pack2State = Pack2State;

    // === АУДИО ===
    function initAudio() {
        // Звуки паверапов
        for (const [key, data] of Object.entries(P2_CONFIG.powerups.types)) {
            if (data.sound && !Pack2State.powerupAudios[key]) {
                const a = new Audio(data.sound); a.preload = 'auto'; Pack2State.powerupAudios[key] = a;
            }
        }
        // Погода
        if (!Pack2State.rainAudio) { Pack2State.rainAudio = new Audio('source/sounds/rain_loop.mp3'); Pack2State.rainAudio.loop = true; Pack2State.rainAudio.preload = 'auto'; }
        if (!Pack2State.thunderAudio) { Pack2State.thunderAudio = new Audio('source/sounds/thunder.wav'); Pack2State.thunderAudio.preload = 'auto'; }
        
        // Музыка (слои)
        if (Pack2State.musicAudios.length === 0 && P2_CONFIG.music.layers.length > 0) {
            P2_CONFIG.music.layers.forEach((layer, index) => {
                const a = new Audio(layer.file);
                a.loop = true;
                a.preload = 'auto';
                // Начинаем играть сразу, но глушим громкость
                a.volume = 0; 
                Pack2State.musicAudios.push(a);
            });
        }
    }

    function playSound(audio, rate = 1.0) {
        if (audio && Pack2State.settings?.soundEnabled) {
            audio.currentTime = 0;
            audio.playbackRate = rate;
            audio.volume = (Pack2State.settings.sfxVolume || 0.7) * (Pack2State.settings.masterVolume || 1.0);
            audio.play().catch(() => {});
        }
    }

    // === ПОГОДА ===
    function changeWeather(forceWeather = null) {
        if (!Pack2State.settings?.weatherEnabled) return;
        
        let newWeather = forceWeather;
        if (!newWeather) {
            const types = P2_CONFIG.weather.types;
            newWeather = types[Math.floor(Math.random() * types.length)];
            if (newWeather === 'storm' && Math.random() > P2_CONFIG.weather.stormChance) {
                newWeather = 'rain'; // Если не прокнула гроза, будет дождь
            }
        }
        
        Pack2State.currentWeather = newWeather;
        window.GameEvents.emit('weather_changed', { weather: newWeather });

        // Управление звуком дождя
        if (Pack2State.rainAudio) {
            if (newWeather === 'rain' || newWeather === 'storm') {
                Pack2State.rainAudio.play().catch(() => {});
                Pack2State.rainAudio.volume = (Pack2State.settings.ambientVolume || 0.25) * (Pack2State.settings.masterVolume || 1.0) * 0.5;
            } else {
                Pack2State.rainAudio.pause();
            }
        }
    }

    // === ПОДПИСКА НА СОБЫТИЯ ===
    window.GameEvents.on('start', (data) => {
        initAudio();
        Pack2State.settings = data.settings;
        Pack2State.activePowerup = null;
        Pack2State.hasShield = false;
        Pack2State.lastWeatherChange = 0;
        Pack2State.weatherParticles = [];
        Pack2State.lightningActive = false;
        
        changeWeather('clear'); // Всегда начинаем с ясной погоды

        // Сброс музыки
        Pack2State.musicAudios.forEach((a, i) => { a.currentTime = 0; a.volume = i === 0 ? 0.2 : 0; a.play().catch(() => {}); });
    });

    window.GameEvents.on('tick', (data) => {
        if (data.settings) Pack2State.settings = data.settings;

        // 1. Проверка времени паверапа
        if (Pack2State.activePowerup && Pack2State.activePowerup.duration > 0) {
            if (Date.now() > Pack2State.activePowerup.endTime) {
                Pack2State.activePowerup = null;
            }
        }

        // 2. Смена погоды по дистанции
        if (Pack2State.settings?.weatherEnabled && data.distance !== undefined) {
            const nextWeatherDist = Math.floor(data.distance / P2_CONFIG.weather.changeDistance) * P2_CONFIG.weather.changeDistance;
            if (nextWeatherDist > Pack2State.lastWeatherChange && nextWeatherDist > 0) {
                Pack2State.lastWeatherChange = nextWeatherDist;
                changeWeather();
            }
        }

        // 3. Молнии при грозе
        if (Pack2State.currentWeather === 'storm') {
            Pack2State.lightningTimer += data.delta || 16.6;
            if (Pack2State.lightningTimer > 8000 + Math.random() * 7000) {
                Pack2State.lightningTimer = 0;
                Pack2State.lightningActive = true;
                if (window.RenderEngine) { window.RenderEngine.flash('255,255,255', 0.8); window.RenderEngine.shake(15, 30); }
                playSound(Pack2State.thunderAudio);
                setTimeout(() => { Pack2State.lightningActive = false; }, 150);
            }
        }

        // 4. Динамическая музыка (Слои и темп)
        if (Pack2State.settings?.dynamicMusicEnabled && Pack2State.musicAudios.length > 0) {
            const dist = data.distance || 0;
            // Темп
            const tempoRate = 1.0 + Math.min(dist / P2_CONFIG.music.tempoDistance, 1.0) * (P2_CONFIG.music.maxTempoRate - 1.0);
            Pack2State.musicAudios.forEach(a => { a.playbackRate = tempoRate; });

            // Слои
            P2_CONFIG.music.layers.forEach((layer, index) => {
                const audio = Pack2State.musicAudios[index];
                if (!audio) return;
                const targetVolume = dist >= layer.minDistance ? 0.2 : 0; // 0.2 - базовая громкость
                if (audio.volume !== targetVolume) {
                    // Плавное затухание
                    audio.volume += (targetVolume - audio.volume) * 0.05;
                }
            });
        }
    });

    window.GameEvents.on('powerup_collect', (data) => {
        const pData = P2_CONFIG.powerups.types[data.kind];
        if (!pData) return;

        playSound(Pack2State.powerupAudios[data.kind]);

        if (data.kind === 'shield') {
            Pack2State.hasShield = true;
            Pack2State.activePowerup = null; // Щит не имеет таймера
        } else {
            Pack2State.activePowerup = { type: data.kind, endTime: Date.now() + pData.duration };
        }

        if (window.RenderEngine) {
            window.RenderEngine.spawnParticles(data.x, data.y, 30, { colors: [pData.color, '#FFFFFF'], speed: 5, life: 40, size: 4, gravity: 0.1 });
            window.RenderEngine.flash(pData.color.replace('#', ''), 0.3);
        }
    });

    window.GameEvents.on('shield_break', (data) => {
        Pack2State.hasShield = false;
        if (window.RenderEngine) {
            window.RenderEngine.spawnParticles(data.x + 50, data.y + 50, 40, { colors: ['#00FFFF', '#FFFFFF'], speed: 8, life: 30, size: 4, gravity: 0.1 });
            window.RenderEngine.shake(8, 15);
            window.RenderEngine.flash('0,255,255', 0.4);
        }
    });

    window.GameEvents.on('gameover', () => {
        Pack2State.activePowerup = null;
        Pack2State.hasShield = false;
        Pack2State.musicAudios.forEach(a => a.pause());
        if (Pack2State.rainAudio) Pack2State.rainAudio.pause();
    });

    window.GameEvents.on('paused', () => {
        Pack2State.musicAudios.forEach(a => a.pause());
        if (Pack2State.rainAudio) Pack2State.rainAudio.pause();
    });

    // === РЕНДЕР ===
    window.GameEvents.on('render_frame', ({ ctx }) => {
        const W = ctx.canvas.width; const H = ctx.canvas.height;
        const p = window.Pack1State ? { x: 100, y: 400 } : { x: 100, y: 400 }; // Заглушка, если Pack1State нет
        // Для точного позиционирования ауры нужны координаты игрока.
        // В game.js они есть в scene, но плагин их не получает.
        // Поэтому мы будем рисовать оверлеи на весь экран, а ауру - в фиксированном месте (или ждем обновления).
        
        // 1. Щит (Аура вокруг игрока) - приблизительно
        if (Pack2State.hasShield) {
            ctx.save();
            const auraX = 180; const auraY = H - 150; // Примерная позиция игрока
            const grad = ctx.createRadialGradient(auraX, auraY, 0, auraX, auraY, 100);
            grad.addColorStop(0, 'rgba(0, 255, 255, 0.1)');
            grad.addColorStop(1, 'rgba(0, 255, 255, 0.6)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(auraX, auraY, 80 + Math.sin(Date.now() / 200) * 10, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        // 2. Магнит (Кольца)
        if (Pack2State.activePowerup?.type === 'magnet') {
            ctx.save();
            const auraX = 180; const auraY = H - 150;
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(auraX, auraY, 150 + Math.sin(Date.now() / 100) * 20, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }

        // 3. Slow-mo / Sprint (Оверлеи)
        if (Pack2State.activePowerup?.type === 'slowmo') {
            ctx.fillStyle = 'rgba(0, 0, 255, 0.2)'; ctx.fillRect(0, 0, W, H);
        } else if (Pack2State.activePowerup?.type === 'sprint') {
            // Желтые искры за персонажем
            if (window.RenderEngine && Math.random() > 0.5) {
                window.RenderEngine.spawnParticles(180, H - 100, 1, { colors: ['#FFD700', '#FFFFFF'], speed: 5, life: 20, size: 3, gravity: 0 });
            }
        }

        // 4. Погода
        if (Pack2State.currentWeather === 'rain' || Pack2State.currentWeather === 'storm') {
            // Рисуем капли (упрощенно, через линии)
            ctx.strokeStyle = 'rgba(150, 200, 255, 0.4)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 50; i++) {
                const rx = Math.random() * W; const ry = Math.random() * H;
                ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 5, ry + 20); ctx.stroke();
            }
        } else if (Pack2State.currentWeather === 'fog') {
            ctx.fillStyle = 'rgba(150, 150, 150, 0.3)';
            ctx.fillRect(0, 0, W, H);
        }
    });

    // === UI КОМПОНЕНТ (HUD для паверапов и погоды) ===
    function Pack2UI({ gameState }) {
        const [active, setActive] = React.useState(null);
        const [weather, setWeather] = React.useState('clear');
        const [hasShield, setHasShield] = React.useState(false);

        React.useEffect(() => {
            const interval = setInterval(() => {
                setActive(Pack2State.activePowerup);
                setHasShield(Pack2State.hasShield);
                setWeather(Pack2State.currentWeather);
            }, 100);
            return () => clearInterval(interval);
        }, []);

        if (gameState !== 'playing') return null;

        const weatherIcons = { clear: '☀️', rain: '🌧️', fog: '🌫️', storm: '⛈️' };
        const activeData = active ? P2_CONFIG.powerups.types[active.type] : null;
        const timeLeft = active ? Math.max(0, Math.ceil((active.endTime - Date.now()) / 1000)) : 0;

        return React.createElement(React.Fragment, null,
            // Индикатор погоды в левом верхнем углу
            React.createElement('div', { style: { position: 'absolute', top: '60px', left: '20px', fontSize: '24px', textShadow: '2px 2px 0 #000' } }, 
                `Погода: ${weatherIcons[weather] || '❓'}`
            ),
            // Индикатор паверапа справа
            (activeData || hasShield) && React.createElement('div', { style: { position: 'absolute', top: '100px', right: '20px', background: 'rgba(0,0,0,0.6)', padding: '10px', borderRadius: '10px', border: `2px solid ${hasShield ? '#00FFFF' : activeData.color}`, color: 'white', fontWeight: 'bold' } },
                hasShield ? '🛡️ ЩИТ АКТИВЕН' : `${activeData.emoji} ${timeLeft}s`
            )
        );
    }

    if (window.PackUIs) { window.PackUIs.push(Pack2UI); } else { window.PackUIs = [Pack2UI]; }

    console.log('%c🌪️ PACK 2 (Atmosphere & Power-ups) loaded', 'color:#00FFFF;font-weight:bold;font-size:14px');
})();
