/* ==================================================================
   PACK 2 — Atmosphere, Power-ups, Weather (Visual Overhaul)
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
        timeOfDay: 'day',
        
        // Погодные системы
        rainParticles: [],
        splashParticles: [],
        lightningTimer: 0,
        lightningActive: false,
        
        musicAudios: [],
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
        
        // Сброс частиц при смене погоды
        Pack2State.rainParticles = [];
        Pack2State.splashParticles = [];

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
        Pack2State.lightningActive = false;
        
        changeWeather('clear');
        Pack2State.musicAudios.forEach((a, i) => { a.currentTime = 0; a.volume = i === 0 ? 0.2 : 0; a.play().catch(() => {}); });
    });

    window.GameEvents.on('tick', (data) => {
        if (data.settings) Pack2State.settings = data.settings;
        if (data.timeOfDay) Pack2State.timeOfDay = data.timeOfDay;

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

    // === РЕНДЕР (ВИЗУАЛЬНЫЕ ЭФФЕКТЫ) ===
    window.GameEvents.on('render_frame', ({ ctx, player, obstacles }) => {
        const W = ctx.canvas.width; const H = ctx.canvas.height;
        
        // 1. Щит
        if (Pack2State.hasShield && player) {
            ctx.save();
            const pCenterX = player.x + player.w / 2;
            const pCenterY = player.y + player.h / 2;
            const baseRadius = Math.max(player.w, player.h) * 0.65;
            const pulse = Math.sin(Date.now() / 150) * 8;
            const radius = baseRadius + pulse;
            
            const grad = ctx.createRadialGradient(pCenterX, pCenterY, radius * 0.2, pCenterX, pCenterY, radius);
            grad.addColorStop(0, 'rgba(0, 255, 255, 0.0)');
            grad.addColorStop(0.6, 'rgba(0, 255, 255, 0.2)');
            grad.addColorStop(0.9, 'rgba(0, 255, 255, 0.6)');
            grad.addColorStop(1, 'rgba(0, 255, 255, 0.9)');
            
            ctx.beginPath(); ctx.arc(pCenterX, pCenterY, radius, 0, Math.PI * 2);
            ctx.fillStyle = grad; ctx.fill();
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)'; ctx.stroke();
            
            // Блик
            ctx.beginPath(); ctx.arc(pCenterX - radius * 0.3, pCenterY - radius * 0.3, radius * 0.15, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.fill();
            ctx.restore();
        }

        // 2. Slow-mo / Sprint (Оверлеи)
        if (Pack2State.activePowerup?.type === 'slowmo') {
            ctx.fillStyle = 'rgba(0, 0, 255, 0.2)'; ctx.fillRect(0, 0, W, H);
        } else if (Pack2State.activePowerup?.type === 'sprint' && window.RenderEngine && Math.random() > 0.5) {
            const sparkX = player ? player.x : 180;
            const sparkY = player ? player.y + player.h / 2 : H - 100;
            window.RenderEngine.spawnParticles(sparkX, sparkY, 1, { colors: ['#FFD700', '#FFFFFF'], speed: 5, life: 20, size: 3, gravity: 0 });
        }

        // 3. ДОЖДЬ И БРЫЗГИ
        if (Pack2State.currentWeather === 'rain' || Pack2State.currentWeather === 'storm') {
            const groundY = H * 0.8; // Условная линия земли (нижняя часть экрана)

            // Спавн капель (если их мало)
            if (Pack2State.rainParticles.length < 150) {
                for(let i=0; i<3; i++) {
                    Pack2State.rainParticles.push({
                        x: Math.random() * W,
                        y: -20 - Math.random() * 100,
                        speed: 15 + Math.random() * 10,
                        length: 15 + Math.random() * 20,
                        alpha: 0.3 + Math.random() * 0.4
                    });
                }
            }

            // Движение и отрисовка капель
            ctx.lineCap = 'round';
            for (let i = Pack2State.rainParticles.length - 1; i >= 0; i--) {
                const p = Pack2State.rainParticles[i];
                p.y += p.speed;
                p.x -= p.speed * 0.15; // Ветер

                // Если капля упала на землю
                if (p.y > groundY + (Math.random() * 50)) {
                    // Создаем брызги (разлетаются в стороны)
                    for(let j=0; j<3; j++) {
                        Pack2State.splashParticles.push({
                            x: p.x, y: groundY + Math.random() * 20,
                            vx: (Math.random() - 0.5) * 6,
                            vy: -Math.random() * 3,
                            life: 15 + Math.random() * 10,
                            maxLife: 25,
                            size: 1 + Math.random() * 2
                        });
                    }
                    // Респавн капли наверху
                    p.y = -20 - Math.random() * 100;
                    p.x = Math.random() * W + 50; 
                }

                // Отрисовка капли
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + p.speed * 0.2, p.y + p.length);
                ctx.strokeStyle = `rgba(180, 220, 255, ${p.alpha})`;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // Отрисовка брызг
            for (let i = Pack2State.splashParticles.length - 1; i >= 0; i--) {
                const s = Pack2State.splashParticles[i];
                s.x += s.vx;
                s.y += s.vy;
                s.vy += 0.5; // Гравитация для брызг
                s.life--;

                if (s.life <= 0) {
                    Pack2State.splashParticles.splice(i, 1);
                    continue;
                }

                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size * (s.life / s.maxLife), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(180, 220, 255, ${(s.life / s.maxLife) * 0.6})`;
                ctx.fill();
            }
        } else {
            Pack2State.rainParticles = [];
            Pack2State.splashParticles = [];
        }

        // 4. ТУМАН (Скрывает обзор)
        if (Pack2State.currentWeather === 'fog') {
            // Градиент слева направо: слева прозрачно, справа густой туман
            const fogGrad = ctx.createLinearGradient(W * 0.2, 0, W, 0);
            fogGrad.addColorStop(0, 'rgba(200, 210, 220, 0.0)');
            fogGrad.addColorStop(0.6, 'rgba(200, 210, 220, 0.4)');
            fogGrad.addColorStop(1, 'rgba(200, 210, 220, 0.9)');
            ctx.fillStyle = fogGrad;
            ctx.fillRect(0, 0, W, H);
            
            // Легкая дымка по краям
            const vignetteGrad = ctx.createRadialGradient(W/2, H/2, H*0.4, W/2, H/2, H*0.8);
            vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
            vignetteGrad.addColorStop(1, 'rgba(180, 190, 200, 0.4)');
            ctx.fillStyle = vignetteGrad;
            ctx.fillRect(0, 0, W, H);
        }
    });

    // === UI КОМПОНЕНТ (Иконки погоды и паверапов) ===
    function Pack2UI({ gameState }) {
        const [active, setActive] = React.useState(null);
        const [weather, setWeather] = React.useState('clear');
        const [hasShield, setHasShield] = React.useState(false);
        const [timeOfDay, setTimeOfDay] = React.useState('day');

        React.useEffect(() => {
            const interval = setInterval(() => {
                setActive(Pack2State.activePowerup);
                setHasShield(Pack2State.hasShield);
                setWeather(Pack2State.currentWeather);
                setTimeOfDay(Pack2State.timeOfDay);
            }, 100);
            return () => clearInterval(interval);
        }, []);

        if (gameState !== 'playing') return null;

        const weatherIcons = { clear: '☀️', rain: '🌧️', fog: '🌫️', storm: '⛈️' };
        const timeIcon = timeOfDay === 'night' ? '🌙' : '☀️';
        const activeData = active ? P2_CONFIG.powerups.types[active.type] : null;
        const timeLeft = active ? Math.max(0, Math.ceil((active.endTime - Date.now()) / 1000)) : 0;

        return React.createElement(React.Fragment, null,
            // Верхний правый угол (Погода и Время)
            React.createElement('div', { className: 'hud-right', style: { top: '50px', right: '20px', display: 'flex', gap: '10px', fontSize: '24px' } }, 
                React.createElement('span', { title: 'Time' }, timeIcon),
                React.createElement('span', { title: 'Weather' }, weatherIcons[weather] || '❓')
            ),
            // Центр (Активный паверап)
            (activeData || hasShield) && React.createElement('div', { className: 'pack2-powerup-badge' },
                hasShield ? '🛡️' : `${activeData.emoji} ${timeLeft}s`
            )
        );
    }

    if (window.PackUIs) { window.PackUIs.push(Pack2UI); } else { window.PackUIs = [Pack2UI]; }

    console.log('%c🌪️ PACK 2 (Atmosphere & Power-ups) loaded', 'color:#00FFFF;font-weight:bold;font-size:14px');
})();
