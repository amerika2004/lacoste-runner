window.GameEvents = window.GameEvents || {
    listeners: {},
    on(event, cb) { if (!this.listeners[event]) this.listeners[event] = []; this.listeners[event].push(cb); },
    emit(event, data) { if (this.listeners[event]) this.listeners[event].forEach(cb => { try { cb(data); } catch(e) { console.error(e); } }); }
};
window.PackUIs = window.PackUIs || [];

/* ==================================================================
   PACK 2 — Power-ups, Inventory System, Weather
   v2.0 — reduced-motion, vibration, SFX, defensive guards
   ================================================================== */
(function () {
    'use strict';

    const PREFERS_REDUCED_MOTION = (() => {
        try { return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false; }
        catch { return false; }
    })();

    const P2_CONFIG = (window.GAME_CONFIG && window.GAME_CONFIG.pack2) || {
        powerups: {
            spawnChance: 0.05,
            types: {
                shield: { emoji: '🛡️', duration: 0,    color: '#00FFFF' },
                magnet: { emoji: '🧲', duration: 5000, color: '#FF0000' },
                sprint: { emoji: '⚡', duration: 3000, color: '#FFD700' },
                slowmo: { emoji: '⏳', duration: 3000, color: '#0080FF' },
            },
        },
        weather: {
            changeDistance: 400,
            combinations: [
                { id: 'clear', label: '☀️', rain: false, fog: false, storm: false, tint: 'rgba(0,0,0,0)' },
            ],
        },
    };

    // Defensive defaults
    if (!P2_CONFIG.weather.changeDistance) P2_CONFIG.weather.changeDistance = 400;
    if (!Array.isArray(P2_CONFIG.weather.combinations) || !P2_CONFIG.weather.combinations.length) {
        P2_CONFIG.weather.combinations = [{ id: 'clear', label: '☀️', rain: false, fog: false, storm: false, tint: 'rgba(0,0,0,0)' }];
    }

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
        pickupAudios: {},
        shieldBreakAudio: null,
        settings: null,
        uiListeners: [],
        reducedMotion: PREFERS_REDUCED_MOTION,
    };

    window.Pack2State = Pack2State;

    // === AUDIO ===
    function initAudio() {
        for (const [key, data] of Object.entries(P2_CONFIG.powerups.types)) {
            if (data.sound && !Pack2State.powerupAudios[key]) {
                try {
                    const a = new Audio(data.sound); a.preload = 'auto'; a.volume = 0.7;
                    Pack2State.powerupAudios[key] = a;
                } catch (e) {}
            }
        }
        // Fallback SFX (пока не заданы в конфиге — реюзаем общие):
        if (!Pack2State.pickupAudios.shield)      { try { const a = new Audio('source/sounds/milestone.wav'); a.preload = 'auto'; Pack2State.pickupAudios.shield = a; } catch (e) {} }
        if (!Pack2State.pickupAudios.magnet)      { try { const a = new Audio('source/sounds/eat.wav'); a.preload = 'auto'; Pack2State.pickupAudios.magnet = a; } catch (e) {} }
        if (!Pack2State.pickupAudios.sprint)      { try { const a = new Audio('source/sounds/jump.wav'); a.preload = 'auto'; Pack2State.pickupAudios.sprint = a; } catch (e) {} }
        if (!Pack2State.pickupAudios.slowmo)      { try { const a = new Audio('source/sounds/eat.wav'); a.preload = 'auto'; Pack2State.pickupAudios.slowmo = a; } catch (e) {} }
        if (!Pack2State.shieldBreakAudio)         { try { const a = new Audio('source/sounds/splash.wav'); a.preload = 'auto'; Pack2State.shieldBreakAudio = a; } catch (e) {} }
        if (!Pack2State.rainAudio)                { try { Pack2State.rainAudio = new Audio('source/sounds/rain_loop.mp3'); Pack2State.rainAudio.loop = true; Pack2State.rainAudio.preload = 'auto'; } catch (e) {} }
        if (!Pack2State.thunderAudio)             { try { Pack2State.thunderAudio = new Audio('source/sounds/thunder.wav'); Pack2State.thunderAudio.preload = 'auto'; } catch (e) {} }
    }
    initAudio();

    function playSound(audio, rate = 1.0, volumeMult = 1.0) {
        const s = Pack2State.settings;
        if (!audio || !s || !s.soundEnabled) return;
        try {
            audio.currentTime = 0;
            audio.playbackRate = Math.max(0.5, Math.min(2.0, rate));
            audio.volume = Math.max(0, Math.min(1,
                (s.sfxVolume ?? 0.7) * (s.masterVolume ?? 1.0) * volumeMult
            ));
            audio.play().catch(() => {});
        } catch (e) {}
    }

    function vibrate(pattern) {
        const s = Pack2State.settings;
        if (s && s.vibrateEnabled === false) return;
        if (Pack2State.reducedMotion) {
            if (Array.isArray(pattern)) pattern = pattern.map(v => Math.min(20, v));
            else if (typeof pattern === 'number') pattern = Math.min(20, pattern);
        }
        if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
    }

    function updateUI() {
        Pack2State.uiListeners.forEach(fn => {
            try { fn(); } catch (e) {}
        });
    }

    // === WEATHER ===
    function changeWeather(forceId = null) {
        if (!forceId && !Pack2State.settings?.weatherEnabled) return;

        let newWeather;
        if (forceId) {
            newWeather = P2_CONFIG.weather.combinations.find(w => w.id === forceId)
                || P2_CONFIG.weather.combinations[0];
        } else {
            const combos = P2_CONFIG.weather.combinations;
            // Исключаем текущую погоду (если возможно)
            const pool = combos.length > 1
                ? combos.filter(w => w.id !== Pack2State.currentWeather.id)
                : combos;
            newWeather = pool[Math.floor(Math.random() * pool.length)];
        }

        const prevId = Pack2State.currentWeather?.id;
        Pack2State.currentWeather = newWeather;
        Pack2State.rainParticles = [];
        Pack2State.splashParticles = [];
        Pack2State.lightningTimer = 0;

        // Rain ambience
        if (Pack2State.rainAudio) {
            if (newWeather.rain) {
                Pack2State.rainAudio.play().catch(() => {});
                Pack2State.rainAudio.volume = Math.max(0, Math.min(1,
                    (Pack2State.settings?.ambientVolume ?? 0.25)
                    * (Pack2State.settings?.masterVolume ?? 1.0) * 0.5
                ));
            } else {
                Pack2State.rainAudio.pause();
            }
        }

        if (prevId && prevId !== newWeather.id) {
            window.GameEvents.emit('pack2_toast', { text: `🌦️ ${newWeather.label || newWeather.id}`, type: 'info' });
            vibrate(10);
        }
    }

    // === POWERUP ===
    function usePowerup(type) {
        if (!Pack2State.inventory[type] || Pack2State.inventory[type] <= 0) return false;
        if (type !== 'shield' && Pack2State.activePowerups[type] > Date.now()) return false;

        Pack2State.inventory[type]--;

        // Sync with Pack4 (persistent inventory)
        if (window.Pack4State && window.Pack4State.inventory) {
            if ((window.Pack4State.inventory[type] || 0) > 0) {
                window.Pack4State.inventory[type]--;
                try { localStorage.setItem('lacosteInventory', JSON.stringify(window.Pack4State.inventory)); } catch (e) {}
                if (window.Pack4State.uiListeners) window.Pack4State.uiListeners.forEach(fn => { try { fn(); } catch (e) {} });
            }
        }

        if (type === 'shield') {
            Pack2State.hasShield = true;
            playSound(Pack2State.powerupAudios.shield || Pack2State.pickupAudios.shield, 1.2, 1.0);
            vibrate([15, 30, 15]);
        } else {
            const pData = P2_CONFIG.powerups.types[type];
            Pack2State.activePowerups[type] = Date.now() + (pData?.duration || 3000);
            playSound(Pack2State.powerupAudios[type], 1.2, 1.0);
            vibrate(20);
        }
        updateUI();
        return true;
    }

    // Scoped key handler
    window.addEventListener('keydown', (e) => {
        // Игнорируем при вводе в input/textarea/contenteditable
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

        if (e.code === 'Digit1') usePowerup('shield');
        if (e.code === 'Digit2') usePowerup('magnet');
        if (e.code === 'Digit3') usePowerup('sprint');
        if (e.code === 'Digit4') usePowerup('slowmo');
    });

    // === LIFECYCLE ===
    window.GameEvents.on('start', (data) => {
        initAudio();
        Pack2State.settings = data?.settings || Pack2State.settings;

        // Inventory from Pack4 (persistent)
        const p4inv = (window.Pack4State && window.Pack4State.inventory) || {};
        Pack2State.inventory = {
            shield: p4inv.shield || 0,
            magnet: p4inv.magnet || 0,
            sprint: p4inv.sprint || 0,
            slowmo: p4inv.slowmo || 0,
        };

        // START_SHIELD buff
        if (window.Pack4State && window.Pack4State.boughtBuffs?.includes('start_shield')) {
            Pack2State.inventory.shield += 1;
        }

        Pack2State.activePowerups = { magnet: 0, sprint: 0, slowmo: 0 };
        Pack2State.hasShield = false;
        Pack2State.lastWeatherChange = 0;
        Pack2State.lightningActive = false;
        Pack2State.lightningTimer = 0;
        changeWeather('clear');
        updateUI();
    });

    // === TICK ===
    window.GameEvents.on('tick', (data) => {
        if (data.settings) Pack2State.settings = data.settings;
        if (data.timeOfDay) Pack2State.timeOfDay = data.timeOfDay;

        // Powerup expiry
        let uiChanged = false;
        if (Pack2State.activePowerups.magnet && Date.now() > Pack2State.activePowerups.magnet) { Pack2State.activePowerups.magnet = 0; uiChanged = true; }
        if (Pack2State.activePowerups.sprint && Date.now() > Pack2State.activePowerups.sprint) { Pack2State.activePowerups.sprint = 0; uiChanged = true; }
        if (Pack2State.activePowerups.slowmo && Date.now() > Pack2State.activePowerups.slowmo) { Pack2State.activePowerups.slowmo = 0; uiChanged = true; }
        if (uiChanged) updateUI();

        // Weather advance
        if (Pack2State.settings?.weatherEnabled && data.distance !== undefined) {
            const step = P2_CONFIG.weather.changeDistance;
            const nextWeatherDist = Math.floor(data.distance / step) * step;
            if (nextWeatherDist > Pack2State.lastWeatherChange && nextWeatherDist > 0) {
                Pack2State.lastWeatherChange = nextWeatherDist;
                changeWeather();
            }
        }

        // Lightning (only in storm)
        if (Pack2State.currentWeather.storm) {
            Pack2State.lightningTimer += (data.delta ?? 16.6);
            if (Pack2State.lightningTimer > 8000 + Math.random() * 7000) {
                Pack2State.lightningTimer = 0;
                Pack2State.lightningActive = true;
                if (window.RenderEngine && !Pack2State.reducedMotion) {
                    window.RenderEngine.flash('255,255,255', 0.8);
                    window.RenderEngine.shake(15, 30);
                }
                playSound(Pack2State.thunderAudio, 1.0, 1.2);
                vibrate([80, 40, 80]);
                setTimeout(() => { Pack2State.lightningActive = false; }, 150);
            }
        }
    });

    // === EVENTS ===
    window.GameEvents.on('powerup_collect', (data) => {
        if (!data || Pack2State.inventory[data.kind] === undefined) return;
        Pack2State.inventory[data.kind] = (Pack2State.inventory[data.kind] || 0) + 1;

        playSound(Pack2State.pickupAudios[data.kind], 1.4, 0.8);
        vibrate(15);

        if (window.RenderEngine && !Pack2State.reducedMotion) {
            const color = P2_CONFIG.powerups.types[data.kind]?.color || '#FFFFFF';
            window.RenderEngine.spawnParticles(data.x || 100, data.y || 400, 20, {
                colors: [color, '#FFFFFF'], speed: 5, life: 30, size: 3, gravity: 0.1,
            });
        }
        updateUI();
    });

    window.GameEvents.on('shield_break', (data) => {
        Pack2State.hasShield = false;
        playSound(Pack2State.shieldBreakAudio, 0.9, 1.0);
        vibrate([20, 40, 20]);

        if (window.RenderEngine && !Pack2State.reducedMotion) {
            window.RenderEngine.spawnParticles((data?.x || 100) + 50, (data?.y || 400) + 50, 40, {
                colors: ['#00FFFF', '#FFFFFF'], speed: 8, life: 30, size: 4, gravity: 0.1,
            });
            window.RenderEngine.shake(8, 15);
            window.RenderEngine.flash('0,255,255', 0.4);
        }
        updateUI();
    });

    window.GameEvents.on('gameover', () => {
        Pack2State.activePowerups = { magnet: 0, sprint: 0, slowmo: 0 };
        Pack2State.hasShield = false;
        if (Pack2State.rainAudio) Pack2State.rainAudio.pause();
        Pack2State.rainParticles = [];
        Pack2State.splashParticles = [];
        Pack2State.lightningActive = false;
        updateUI();
    });

    // === RENDER ===
    window.GameEvents.on('render_frame', ({ ctx, player }) => {
        if (!ctx) return;
        const W = ctx.canvas.width;
        const H = ctx.canvas.height;
        const weather = Pack2State.currentWeather || { rain: false, fog: false, storm: false, tint: 'rgba(0,0,0,0)' };
        const reduced = Pack2State.reducedMotion;

        // --- Shield bubble ---
        if (Pack2State.hasShield && player && !player.isFallingIntoPit) {
            ctx.save();
            const cx = player.x + player.w / 2;
            const cy = player.y + player.h / 2;
            const baseRadius = Math.max(player.w, player.h) * 0.65;
            const radius = reduced ? baseRadius : baseRadius + Math.sin(Date.now() / 150) * 8;
            const grad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
            grad.addColorStop(0, 'rgba(0, 255, 255, 0.0)');
            grad.addColorStop(0.6, 'rgba(0, 255, 255, 0.2)');
            grad.addColorStop(1, 'rgba(0, 255, 255, 0.9)');
            ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = grad; ctx.fill();
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)'; ctx.stroke();
            if (!reduced) {
                ctx.beginPath();
                ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.15, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.fill();
            }
            ctx.restore();
        }

        // --- Active powerup tints ---
        if (Pack2State.activePowerups.slowmo && Pack2State.activePowerups.slowmo > Date.now()) {
            ctx.fillStyle = 'rgba(0, 128, 255, 0.15)';
            ctx.fillRect(0, 0, W, H);
        }
        if (Pack2State.activePowerups.sprint && Pack2State.activePowerups.sprint > Date.now()) {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.05)';
            ctx.fillRect(0, 0, W, H);
            if (!reduced && window.RenderEngine && player && Math.random() > 0.5) {
                window.RenderEngine.spawnParticles(player.x, player.y + player.h / 2, 1, {
                    colors: ['#FFD700', '#FFFFFF'], speed: 5, life: 20, size: 3, gravity: 0,
                });
            }
        }
        if (Pack2State.activePowerups.magnet && Pack2State.activePowerups.magnet > Date.now() && player && !reduced) {
            ctx.save();
            const cx = player.x + player.w / 2;
            const cy = player.y + player.h / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 150 + Math.sin(Date.now() / 100) * 20, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }

        // --- Rain ---
        if (weather.rain) {
            const groundY = H * 0.8;
            const maxDrops = reduced ? 40 : 150;
            const spawnPerFrame = reduced ? 1 : 3;

            if (Pack2State.rainParticles.length < maxDrops) {
                for (let i = 0; i < spawnPerFrame; i++) {
                    Pack2State.rainParticles.push({
                        x: Math.random() * W,
                        y: -20 - Math.random() * 100,
                        speed: 22 + Math.random() * 10,
                        length: 20 + Math.random() * 20,
                        alpha: 0.8 + Math.random() * 0.2,
                    });
                }
            }

            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(200, 240, 255, 0.9)';
            ctx.lineWidth = 2.5;

            for (let i = Pack2State.rainParticles.length - 1; i >= 0; i--) {
                const p = Pack2State.rainParticles[i];
                p.y += p.speed;
                p.x -= p.speed * 0.15;

                if (p.y > groundY + Math.random() * 30) {
                    if (!reduced) {
                        for (let j = 0; j < 2; j++) {
                            Pack2State.splashParticles.push({
                                x: p.x,
                                y: groundY + Math.random() * 20,
                                vx: (Math.random() - 0.5) * 6,
                                vy: -Math.random() * 4,
                                life: 20 + Math.random() * 10,
                                maxLife: 30,
                                size: 2 + Math.random() * 2,
                            });
                        }
                    }
                    p.y = -20 - Math.random() * 100;
                    p.x = Math.random() * W + 50;
                }

                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + p.speed * 0.2, p.y + p.length);
                ctx.stroke();
            }

            if (!reduced) {
                ctx.fillStyle = 'rgba(200, 240, 255, 0.7)';
                for (let i = Pack2State.splashParticles.length - 1; i >= 0; i--) {
                    const s = Pack2State.splashParticles[i];
                    s.x += s.vx; s.y += s.vy; s.vy += 0.6; s.life--;
                    if (s.life <= 0) { Pack2State.splashParticles.splice(i, 1); continue; }
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, s.size * (s.life / s.maxLife), 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
        } else {
            Pack2State.rainParticles = [];
            Pack2State.splashParticles = [];
        }

        // --- Fog ---
        if (weather.fog && !reduced) {
            const fogGrad = ctx.createLinearGradient(W * 0.1, 0, W, 0);
            fogGrad.addColorStop(0, 'rgba(200, 210, 220, 0.0)');
            fogGrad.addColorStop(0.6, 'rgba(200, 210, 220, 0.5)');
            fogGrad.addColorStop(1, 'rgba(200, 210, 220, 0.95)');
            ctx.fillStyle = fogGrad;
            ctx.fillRect(0, 0, W, H);

            const vigGrad = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.8);
            vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
            vigGrad.addColorStop(1, 'rgba(180, 190, 200, 0.4)');
            ctx.fillStyle = vigGrad;
            ctx.fillRect(0, 0, W, H);
        } else if (weather.fog && reduced) {
            // Мягкая однотонная дымка без градиента
            ctx.fillStyle = 'rgba(200, 210, 220, 0.35)';
            ctx.fillRect(0, 0, W, H);
        }

        // --- Tint ---
        if (weather.tint && weather.tint !== 'rgba(0,0,0,0)') {
            ctx.fillStyle = weather.tint;
            ctx.fillRect(0, 0, W, H);
        }
    });

    // === UI ===
    function Pack2UI({ gameState }) {
        const [, forceUpdate] = React.useReducer(x => x + 1, 0);
        React.useEffect(() => {
            const listener = () => forceUpdate();
            Pack2State.uiListeners.push(listener);
            return () => {
                Pack2State.uiListeners = Pack2State.uiListeners.filter(l => l !== listener);
            };
        }, []);

        if (gameState !== 'playing') return null;

        const renderSlot = (kind, icon, key) => {
            const count = Pack2State.inventory[kind] || 0;
            const active = Pack2State.activePowerups[kind] > Date.now();
            const isShieldOn = kind === 'shield' && Pack2State.hasShield;
            const cls = [
                'inv-btn',
                count > 0 ? 'active' : '',
                active || isShieldOn ? 'in-use' : '',
            ].filter(Boolean).join(' ');
            return React.createElement('button', {
                key: kind,
                className: cls,
                onClick: () => usePowerup(kind),
            },
                React.createElement('span', { className: 'inv-icon' }, icon),
                React.createElement('span', { className: 'inv-count' }, count),
                React.createElement('span', { className: 'inv-key' }, key)
            );
        };

        return React.createElement('div', { className: 'pack2-inventory' },
            renderSlot('shield', '🛡️', '1'),
            renderSlot('magnet', '🧲', '2'),
            renderSlot('sprint', '⚡', '3'),
            renderSlot('slowmo', '⏳', '4')
        );
    }

    if (window.PackUIs) { window.PackUIs.push(Pack2UI); } else { window.PackUIs = [Pack2UI]; }

    console.log('%c🌪️ PACK 2 (Inventory & Weather v2) loaded', 'color:#00FFFF;font-weight:bold;font-size:14px');
})();
