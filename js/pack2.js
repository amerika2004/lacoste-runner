window.GameEvents = window.GameEvents || {
    listeners: {},
    on(event, cb) { if (!this.listeners[event]) this.listeners[event] = []; this.listeners[event].push(cb); },
    emit(event, data) { if (this.listeners[event]) this.listeners[event].forEach(cb => { try { cb(data); } catch(e) { console.error(e); } }); }
};
window.PackUIs = window.PackUIs || [];

/* ==================================================================
   PACK 2 — Power-ups, Inventory System, Weather
   ================================================================== */
(function () {
    'use strict';

    const P2_CONFIG = (window.GAME_CONFIG && window.GAME_CONFIG.pack2) || {
        powerups: { spawnChance: 0.05, types: { shield: { emoji: '🛡️', duration: 0, color: '#00FFFF' }, magnet: { emoji: '🧲', duration: 5000, color: '#FF0000' }, sprint: { emoji: '⚡', duration: 3000, color: '#FFD700' }, slowmo: { emoji: '⏳', duration: 3000, color: '#0080FF' } } },
        weather: { combinations: [{ id: 'clear', label: '☀️', rain: false, fog: false, storm: false, tint: 'rgba(0,0,0,0)' }] }
    };

    const Pack2State = {
        inventory: { shield: 0, magnet: 0, sprint: 0, slowmo: 0 }, 
        activePowerups: { magnet: 0, sprint: 0, slowmo: 0 }, 
        hasShield: false,
        currentWeather: P2_CONFIG.weather.combinations[0],
        lastWeatherChange: 0,
        timeOfDay: 'day',
        rainParticles: [],
        splashParticles: [],
        lightningTimer: 0,
        lightningActive: false,
        rainAudio: null,
        thunderAudio: null,
        powerupAudios: {},
        settings: null,
        uiListeners: [],
    };

    window.Pack2State = Pack2State;

    function initAudio() {
        for (const [key, data] of Object.entries(P2_CONFIG.powerups.types)) {
            if (data.sound && !Pack2State.powerupAudios[key]) {
                const a = new Audio(data.sound); a.preload = 'auto'; Pack2State.powerupAudios[key] = a;
            }
        }
        if (!Pack2State.rainAudio) { Pack2State.rainAudio = new Audio('source/sounds/rain_loop.mp3'); Pack2State.rainAudio.loop = true; Pack2State.rainAudio.preload = 'auto'; }
        if (!Pack2State.thunderAudio) { Pack2State.thunderAudio = new Audio('source/sounds/thunder.wav'); Pack2State.thunderAudio.preload = 'auto'; }
    }

    function playSound(audio, rate = 1.0) {
        if (audio && Pack2State.settings?.soundEnabled) {
            audio.currentTime = 0; audio.playbackRate = rate;
            audio.volume = (Pack2State.settings.sfxVolume || 0.7) * (Pack2State.settings.masterVolume || 1.0);
            audio.play().catch(() => {});
        }
    }

    function updateUI() { Pack2State.uiListeners.forEach(fn => fn()); }

    function changeWeather(forceId = null) {
        if (!Pack2State.settings?.weatherEnabled) return;
        let newWeather;
        if (forceId) {
            newWeather = P2_CONFIG.weather.combinations.find(w => w.id === forceId) || P2_CONFIG.weather.combinations[0];
        } else {
            const combos = P2_CONFIG.weather.combinations;
            newWeather = combos[Math.floor(Math.random() * combos.length)];
        }
        Pack2State.currentWeather = newWeather;
        Pack2State.rainParticles = []; Pack2State.splashParticles = [];

        if (Pack2State.rainAudio) {
            if (newWeather.rain) {
                Pack2State.rainAudio.play().catch(() => {});
                Pack2State.rainAudio.volume = (Pack2State.settings.ambientVolume || 0.25) * (Pack2State.settings.masterVolume || 1.0) * 0.5;
            } else {
                Pack2State.rainAudio.pause();
            }
        }
    }

    function usePowerup(type) {
        if (!Pack2State.inventory[type] || Pack2State.inventory[type] <= 0) return;
        if (type !== 'shield' && Pack2State.activePowerups[type] > Date.now()) return;

        Pack2State.inventory[type]--;
        
        // Синхронизация с базой данных магазина
        if (window.Pack4State && window.Pack4State.inventory) {
            window.Pack4State.inventory[type]--;
            if (window.Pack4State.inventory[type] < 0) window.Pack4State.inventory[type] = 0;
            localStorage.setItem('lacosteInventory', JSON.stringify(window.Pack4State.inventory));
        }

        if (type === 'shield') {
            Pack2State.hasShield = true;
        } else {
            const pData = P2_CONFIG.powerups.types[type];
            Pack2State.activePowerups[type] = Date.now() + pData.duration;
        }
        playSound(Pack2State.powerupAudios[type]);
        updateUI();
    }

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Digit1') usePowerup('shield');
        if (e.code === 'Digit2') usePowerup('magnet');
        if (e.code === 'Digit3') usePowerup('sprint');
    });

    window.GameEvents.on('start', (data) => {
        initAudio();
        Pack2State.settings = data.settings;
        
        // ИНИЦИАЛИЗАЦИЯ ИНВЕНТАРЯ ИЗ МАГАЗИНА
        if (window.Pack4State && window.Pack4State.inventory) {
            Pack2State.inventory = { 
                shield: window.Pack4State.inventory.shield || 0,
                magnet: window.Pack4State.inventory.magnet || 0,
                sprint: window.Pack4State.inventory.sprint || 0,
                slowmo: window.Pack4State.inventory.slowmo || 0
            };
        } else {
            Pack2State.inventory = { shield: 0, magnet: 0, sprint: 0, slowmo: 0 };
        }

        // Стартовый щит от купленного бафа
        if (window.Pack4State && window.Pack4State.boughtBuffs?.includes('start_shield')) {
            Pack2State.inventory.shield++;
        }

        Pack2State.activePowerups = { magnet: 0, sprint: 0, slowmo: 0 };
        Pack2State.hasShield = false;
        Pack2State.lastWeatherChange = 0;
        Pack2State.lightningActive = false;
        
        changeWeather('clear');
        updateUI();
    });

    window.GameEvents.on('tick', (data) => {
        if (data.settings) Pack2State.settings = data.settings;
        if (data.timeOfDay) Pack2State.timeOfDay = data.timeOfDay;

        let uiChanged = false;
        if (Pack2State.activePowerups.magnet && Date.now() > Pack2State.activePowerups.magnet) { Pack2State.activePowerups.magnet = 0; uiChanged = true; }
        if (Pack2State.activePowerups.sprint && Date.now() > Pack2State.activePowerups.sprint) { Pack2State.activePowerups.sprint = 0; uiChanged = true; }
        if (Pack2State.activePowerups.slowmo && Date.now() > Pack2State.activePowerups.slowmo) { Pack2State.activePowerups.slowmo = 0; uiChanged = true; }
        if (uiChanged) updateUI();

        if (Pack2State.settings?.weatherEnabled && data.distance !== undefined) {
            const nextWeatherDist = Math.floor(data.distance / P2_CONFIG.weather.changeDistance) * P2_CONFIG.weather.changeDistance;
            if (nextWeatherDist > Pack2State.lastWeatherChange && nextWeatherDist > 0) {
                Pack2State.lastWeatherChange = nextWeatherDist;
                changeWeather();
            }
        }

        if (Pack2State.currentWeather.storm) {
            Pack2State.lightningTimer += data.delta || 16.6;
            if (Pack2State.lightningTimer > 8000 + Math.random() * 7000) {
                Pack2State.lightningTimer = 0;
                Pack2State.lightningActive = true;
                if (window.RenderEngine) { window.RenderEngine.flash('255,255,255', 0.8); window.RenderEngine.shake(15, 30); }
                playSound(Pack2State.thunderAudio);
                setTimeout(() => { Pack2State.lightningActive = false; }, 150);
            }
        }
    });

    window.GameEvents.on('powerup_collect', (data) => {
        const pData = P2_CONFIG.powerups.types[data.kind];
        if (!pData) return;

        // SLOW-MO АКТИВИРУЕТСЯ СРАЗУ
        if (data.kind === 'slowmo') {
            Pack2State.activePowerups.slowmo = Date.now() + pData.duration;
            playSound(Pack2State.powerupAudios['slowmo']);
            if (window.RenderEngine) {
                window.RenderEngine.spawnParticles(data.x, data.y, 25, { colors: [pData.color, '#FFFFFF'], speed: 6, life: 35, size: 3, gravity: 0.1 });
                window.RenderEngine.flash('0,128,255', 0.2);
            }
            window.GameEvents.emit('pack3_toast', { text: '⏳ SLOW-MO ACTIVATED', type: 'info' });
            updateUI();
            return;
        }

        if (Pack2State.inventory[data.kind] !== undefined) {
            Pack2State.inventory[data.kind]++;
            if (window.RenderEngine) { window.RenderEngine.spawnParticles(data.x, data.y, 20, { colors: [pData.color, '#FFFFFF'], speed: 5, life: 30, size: 3, gravity: 0.1 }); }
            updateUI();
        }
    });

    window.GameEvents.on('shield_break', (data) => {
        Pack2State.hasShield = false;
        if (window.RenderEngine) {
            window.RenderEngine.spawnParticles(data.x + 50, data.y + 50, 40, { colors: ['#00FFFF', '#FFFFFF'], speed: 8, life: 30, size: 4, gravity: 0.1 });
            window.RenderEngine.shake(8, 15); window.RenderEngine.flash('0,255,255', 0.4);
        }
        updateUI();
    });

    window.GameEvents.on('gameover', () => {
        Pack2State.activePowerups = { magnet: 0, sprint: 0, slowmo: 0 };
        Pack2State.hasShield = false;
        if (Pack2State.rainAudio) Pack2State.rainAudio.pause();
        updateUI();
    });

    window.GameEvents.on('render_frame', ({ ctx, player }) => {
        const W = ctx.canvas.width; const H = ctx.canvas.height;
        const weather = Pack2State.currentWeather;
        
        if (Pack2State.hasShield && player && !player.isFallingIntoPit) {
            ctx.save();
            const pCenterX = player.x + player.w / 2;
            const pCenterY = player.y + player.h / 2;
            const baseRadius = Math.max(player.w, player.h) * 0.65;
            const radius = baseRadius + Math.sin(Date.now() / 150) * 8;
            const grad = ctx.createRadialGradient(pCenterX, pCenterY, radius * 0.2, pCenterX, pCenterY, radius);
            grad.addColorStop(0, 'rgba(0, 255, 255, 0.0)');
            grad.addColorStop(0.6, 'rgba(0, 255, 255, 0.2)');
            grad.addColorStop(1, 'rgba(0, 255, 255, 0.9)');
            ctx.beginPath(); ctx.arc(pCenterX, pCenterY, radius, 0, Math.PI * 2);
            ctx.fillStyle = grad; ctx.fill();
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)'; ctx.stroke();
            ctx.restore();
        }

        if (Pack2State.activePowerups.slowmo && Pack2State.activePowerups.slowmo > Date.now()) {
            ctx.fillStyle = 'rgba(0, 128, 255, 0.15)'; ctx.fillRect(0, 0, W, H);
        }
        if (Pack2State.activePowerups.sprint && Pack2State.activePowerups.sprint > Date.now()) {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.05)'; ctx.fillRect(0, 0, W, H);
            if (window.RenderEngine && Math.random() > 0.5 && player) {
                window.RenderEngine.spawnParticles(player.x, player.y + player.h / 2, 1, { colors: ['#FFD700', '#FFFFFF'], speed: 5, life: 20, size: 3, gravity: 0 });
            }
        }
        if (Pack2State.activePowerups.magnet && Pack2State.activePowerups.magnet > Date.now() && player) {
            ctx.save(); const pCenterX = player.x + player.w / 2; const pCenterY = player.y + player.h / 2;
            ctx.beginPath(); ctx.arc(pCenterX, pCenterY, 150 + Math.sin(Date.now()/100)*20, 0, Math.PI*2);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        }

        if (weather.rain) {
            const groundY = H * 0.8;
            if (Pack2State.rainParticles.length < 150) {
                for(let i=0; i<3; i++) {
                    Pack2State.rainParticles.push({ x: Math.random() * W, y: -20 - Math.random() * 100, speed: 22 + Math.random() * 10, length: 20 + Math.random() * 20, alpha: 0.8 + Math.random() * 0.2 });
                }
            }
            ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(200, 240, 255, 0.9)'; ctx.lineWidth = 2.5;
            for (let i = Pack2State.rainParticles.length - 1; i >= 0; i--) {
                const p = Pack2State.rainParticles[i];
                p.y += p.speed; p.x -= p.speed * 0.15;
                if (p.y > groundY + (Math.random() * 30)) {
                    for(let j=0; j<2; j++) {
                        Pack2State.splashParticles.push({ x: p.x, y: groundY + Math.random() * 20, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 4, life: 20 + Math.random() * 10, maxLife: 30, size: 2 + Math.random() * 2 });
                    }
                    p.y = -20 - Math.random() * 100; p.x = Math.random() * W + 50; 
                }
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.speed * 0.2, p.y + p.length); ctx.stroke();
            }
            ctx.fillStyle = 'rgba(200, 240, 255, 0.7)';
            for (let i = Pack2State.splashParticles.length - 1; i >= 0; i--) {
                const s = Pack2State.splashParticles[i];
                s.x += s.vx; s.y += s.vy; s.vy += 0.6; s.life--;
                if (s.life <= 0) { Pack2State.splashParticles.splice(i, 1); continue; }
                ctx.beginPath(); ctx.arc(s.x, s.y, s.size * (s.life / s.maxLife), 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        } else {
            Pack2State.rainParticles = []; Pack2State.splashParticles = [];
        }

        if (weather.fog) {
            const fogGrad = ctx.createLinearGradient(W * 0.1, 0, W, 0);
            fogGrad.addColorStop(0, 'rgba(200, 210, 220, 0.0)');
            fogGrad.addColorStop(0.6, 'rgba(200, 210, 220, 0.5)');
            fogGrad.addColorStop(1, 'rgba(200, 210, 220, 0.95)');
            ctx.fillStyle = fogGrad; ctx.fillRect(0, 0, W, H);
            const vigGrad = ctx.createRadialGradient(W/2, H/2, H*0.4, W/2, H/2, H*0.8);
            vigGrad.addColorStop(0, 'rgba(0,0,0,0)'); vigGrad.addColorStop(1, 'rgba(180, 190, 200, 0.4)');
            ctx.fillStyle = vigGrad; ctx.fillRect(0, 0, W, H);
        }

        if (weather.tint && weather.tint !== 'rgba(0,0,0,0)') {
            ctx.fillStyle = weather.tint; ctx.fillRect(0, 0, W, H);
        }
    });

    function Pack2UI({ gameState }) {
        const [, forceUpdate] = React.useReducer(x => x + 1, 0);
        React.useEffect(() => {
            const listener = () => forceUpdate();
            Pack2State.uiListeners.push(listener);
            return () => { Pack2State.uiListeners = Pack2State.uiListeners.filter(l => l !== listener); };
        }, []);
        if (gameState !== 'playing') return null;

        return React.createElement('div', { className: 'pack2-inventory' },
            React.createElement('button', { className: `inv-btn ${Pack2State.inventory.shield > 0 ? 'active' : ''}`, onClick: () => usePowerup('shield') },
                React.createElement('span', { className: 'inv-icon' }, '🛡️'),
                React.createElement('span', { className: 'inv-count' }, Pack2State.inventory.shield),
                React.createElement('span', { className: 'inv-key' }, '1')
            ),
            React.createElement('button', { className: `inv-btn ${Pack2State.inventory.magnet > 0 ? 'active' : ''}`, onClick: () => usePowerup('magnet') },
                React.createElement('span', { className: 'inv-icon' }, '🧲'),
                React.createElement('span', { className: 'inv-count' }, Pack2State.inventory.magnet),
                React.createElement('span', { className: 'inv-key' }, '2')
            ),
            React.createElement('button', { className: `inv-btn ${Pack2State.inventory.sprint > 0 ? 'active' : ''}`, onClick: () => usePowerup('sprint') },
                React.createElement('span', { className: 'inv-icon' }, '⚡'),
                React.createElement('span', { className: 'inv-count' }, Pack2State.inventory.sprint),
                React.createElement('span', { className: 'inv-key' }, '3')
            )
        );
    }

    if (window.PackUIs) { window.PackUIs.push(Pack2UI); } else { window.PackUIs = [Pack2UI]; }
    console.log('%c🌪️ PACK 2 (Inventory & Weather) loaded', 'color:#00FFFF;font-weight:bold;font-size:14px');
})();
