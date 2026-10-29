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
        activePowerup: null, 
        hasShield: false,
        currentWeather: 'clear',
        lastWeatherChange: 0,
        weatherParticles: [], 
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
        for (const [key, data] of Object.entries(P2_CONFIG.powerups.types)) {
            if (data.sound && !Pack2State.powerupAudios[key]) {
                const a = new Audio(data.sound); a.preload = 'auto'; Pack2State.powerupAudios[key] = a;
            }
        }
        if (!Pack2State.rainAudio) { Pack2State.rainAudio = new Audio('source/sounds/rain_loop.mp3'); Pack2State.rainAudio.loop = true; Pack2State.rainAudio.preload = 'auto'; }
        if (!Pack2State.thunderAudio) { Pack2State.thunderAudio = new Audio('source/sounds/thunder.wav'); Pack2State.thunderAudio.preload = 'auto'; }
        
        if (Pack2State.musicAudios.length === 0 && P2_CONFIG.music.layers.length > 0) {
            P2_CONFIG.music.layers.forEach((layer) => {
                const a = new Audio(layer.file);
                a.loop = true;
                a.preload = 'auto';
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
                newWeather = 'rain'; 
            }
        }
        
        Pack2State.currentWeather = newWeather;
        window.GameEvents.emit('weather_changed', { weather: newWeather });

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
        
        changeWeather('clear');

        Pack2State.musicAudios.forEach((a, i) => { a.currentTime = 0; a.volume = i === 0 ? 0.2 : 0; a.play().catch(() => {}); });
    });

    window.GameEvents.on('tick', (data) => {
        if (data.settings) Pack2State.settings = data.settings;

        if (Pack2State.activePowerup && Date.now() > Pack2State.activePowerup.endTime) {
            Pack2State.activePowerup = null;
        }

        if (Pack2State.settings?.weatherEnabled && data.distance !== undefined) {
            const nextWeatherDist = Math.floor(data.distance / P2_CONFIG.weather.changeDistance) * P2_CONFIG.weather.changeDistance;
            if (nextWeatherDist > Pack2State.lastWeatherChange && nextWeatherDist > 0) {
                Pack2State.lastWeatherChange = nextWeatherDist;
                changeWeather();
            }
        }

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

        if (Pack2State.settings?.dynamicMusicEnabled && Pack2State.musicAudios.length > 0) {
            const dist = data.distance || 0;
            const tempoRate = 1.0 + Math.min(dist / P2_CONFIG.music.tempoDistance, 1.0) * (P2_CONFIG.music.maxTempoRate - 1.0);
            Pack2State.musicAudios.forEach(a => { a.playbackRate = tempoRate; });

            P2_CONFIG.music.layers.forEach((layer, index) => {
                const audio = Pack2State.musicAudios[index];
                if (!audio) return;
                const targetVolume = dist >= layer.minDistance ? 0.2 : 0; 
                if (audio.volume !== targetVolume) {
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
            Pack2State.activePowerup = null; 
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
    window.GameEvents.on('render_frame', ({ ctx, player }) => {
        const W = ctx.canvas.width; const H = ctx.canvas.height;
        
        // 1. Щит (Динамическая аура, следующая за игроком)
        if (Pack2State.hasShield && player) {
            ctx.save();
            
            // Вычисляем центр игрока
            const pCenterX = player.x + player.w / 2;
            const pCenterY = player.y + player.h / 2;
            
            // Радиус зависит от размера персонажа + пульсация для "жизни"
            const baseRadius = Math.max(player.w, player.h) * 0.65;
            const pulse = Math.sin(Date.now() / 150) * 8;
            const radius = baseRadius + pulse;
            
            // Создаем сферический градиент (прозрачный в центре, яркий по краям)
            const grad = ctx.createRadialGradient(pCenterX, pCenterY, radius * 0.2, pCenterX, pCenterY, radius);
            grad.addColorStop(0, 'rgba(0, 255, 255, 0.0)'); // Полностью прозрачный центр, чтобы видеть персонажа
            grad.addColorStop(0.6, 'rgba(0, 255, 255, 0.2)');
            grad.addColorStop(0.9, 'rgba(0, 255, 255, 0.6)');
            grad.addColorStop(1, 'rgba(0, 255, 255, 0.9)');
            
            ctx.beginPath();
            ctx.arc(pCenterX, pCenterY, radius, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            
            // Четкий контур щита
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
            ctx.stroke();
            
            // Добавляем блик для объема
            ctx.beginPath();
            ctx.arc(pCenterX - radius * 0.3, pCenterY - radius * 0.3, radius * 0.15, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fill();
            
            ctx.restore();
        }

        // 2. Slow-mo / Sprint (Оверлеи)
        if (Pack2State.activePowerup?.type === 'slowmo') {
            ctx.fillStyle = 'rgba(0, 0, 255, 0.2)'; ctx.fillRect(0, 0, W, H);
        } else if (Pack2State.activePowerup?.type === 'sprint') {
            if (window.RenderEngine && Math.random() > 0.5) {
                // Искры летят за игроком (примерная позиция для искр)
                const sparkX = player ? player.x : 180;
                const sparkY = player ? player.y + player.h / 2 : H - 100;
                window.RenderEngine.spawnParticles(sparkX, sparkY, 1, { colors: ['#FFD700', '#FFFFFF'], speed: 5, life: 20, size: 3, gravity: 0 });
            }
        }

        // 3. Погода
        if (Pack2State.currentWeather === 'rain' || Pack2State.currentWeather === 'storm') {
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

    // === UI КОМПОНЕНТ ===
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
            React.createElement('div', { style: { position: 'absolute', top: '60px', left: '20px', fontSize: '24px', textShadow: '2px 2px 0 #000' } }, 
                `Погода: ${weatherIcons[weather] || '❓'}`
            ),
            (activeData || hasShield) && React.createElement('div', { style: { position: 'absolute', top: '100px', right: '20px', background: 'rgba(0,0,0,0.6)', padding: '10px', borderRadius: '10px', border: `2px solid ${hasShield ? '#00FFFF' : activeData.color}`, color: 'white', fontWeight: 'bold' } },
                hasShield ? '🛡️ ЩИТ АКТИВЕН' : `${activeData.emoji} ${timeLeft}s`
            )
        );
    }

    if (window.PackUIs) { window.PackUIs.push(Pack2UI); } else { window.PackUIs = [Pack2UI]; }

    console.log('%c🌪️ PACK 2 (Atmosphere & Power-ups) loaded', 'color:#00FFFF;font-weight:bold;font-size:14px');
})();
