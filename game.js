const { useState, useEffect, useRef, useCallback } = React;

// === ПЛАГИННАЯ ИНФРАСТРУКТУРА ===
window.GameEvents = window.GameEvents || {
    listeners: {},
    on(event, cb) { if (!this.listeners[event]) this.listeners[event] = []; this.listeners[event].push(cb); },
    emit(event, data) { if (this.listeners[event]) this.listeners[event].forEach(cb => { try { cb(data); } catch(e) { console.error(e); } }); }
};
window.PackUIs = window.PackUIs || [];
window.GameBoot = window.GameBoot || {
    triggered: false, callbacks: [],
    onReady(cb) { if (this.triggered) { try { cb(); } catch(e){ console.error(e); } return; } this.callbacks.push(cb); },
    trigger() { if (this.triggered) return; this.triggered = true; this.callbacks.forEach(cb => { try { cb(); } catch(e){ console.error(e); } }); this.callbacks = []; }
};

const DEFAULT_CONFIG = { /* ... */ };
const CONFIG = (window.GAME_CONFIG && window.GAME_CONFIG.physics) ? window.GAME_CONFIG : DEFAULT_CONFIG;
const FLIP_CROC = false;
const GRAVITY = CONFIG.physics.gravity ?? 0.75;
const JUMP_FORCE = CONFIG.physics.jumpForce ?? -10.5;
const HOLD_THRUST = CONFIG.physics.holdThrust ?? 0.45;
const GROUND_Y = CONFIG.physics.groundY ?? 530;
const BASE_SPEED = CONFIG.physics.baseSpeed ?? 4.0;
const SPEED_MULTIPLIER = CONFIG.physics.speedMultiplier ?? 0.8;
const DEFAULT_SETTINGS = CONFIG.defaultSettings;

// === ХЕЛПЕРЫ ПРОКАЧКИ / СКИНОВ ===
function getStat(charId, statName) {
    const char = CONFIG.characters?.[charId];
    const base = (char?.stats?.[statName]) ?? 1.0;
    const lvl = window.Pack4State?.upgrades?.[charId]?.[statName] || 0;
    return base + lvl * 0.05;
}

function getSkinFilter(characterId, skinId) {
    const char = CONFIG.characters?.[characterId];
    const skin = char?.skins?.find(s => s.id === skinId);
    if (!skin) return null;
    const tier = CONFIG.pack4?.skinTiers?.[skin.tier];
    return tier?.filter || null;
}

// === РЕНДЕР ДВИЖОК ===
const RenderEngine = (function () {
    const QUALITY = { low: { parallax: false, bloom: false, particles: false, shake: false, trail: false, vignette: false, flash: false, maxParticles: 0 }, medium: { parallax: true, bloom: false, particles: true, shake: true, trail: false, vignette: false, flash: true, maxParticles: 200 }, high: { parallax: true, bloom: true, particles: true, shake: true, trail: true, vignette: true, flash: true, maxParticles: 500 } };
    const state = { quality: 'high', config: QUALITY.high, particles: [], shakeTime: 0, shakeIntensity: 0, flashAlpha: 0, flashColor: '255,0,0', time: 0, trail: [], cache: { vignetteCanvas: null, particleSprite: null } };
    function makeVignette(width, height) { const c = document.createElement('canvas'); c.width = width; c.height = height; const ctx = c.getContext('2d'); const g = ctx.createRadialGradient(width/2, height/2, Math.min(width,height)*0.3, width/2, height/2, Math.max(width,height)*0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.65)'); ctx.fillStyle = g; ctx.fillRect(0, 0, width, height); return c; }
    function makeParticleSprite() { const c = document.createElement('canvas'); c.width = c.height = 16; const ctx = c.getContext('2d'); const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,200,100,0.6)'); g.addColorStop(1, 'rgba(255,100,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 16); return c; }
    return {
        setQuality(q) { state.quality = q; state.config = QUALITY[q] || QUALITY.high; if (!state.config.particles) state.particles = []; },
        reset() { state.particles = []; state.shakeTime = 0; state.shakeIntensity = 0; state.flashAlpha = 0; state.trail = []; },
        spawnParticles(x, y, count, opts = {}) { if (!state.config.particles) return; const colors = opts.colors || ['#FF007F', '#00FFFF', '#FFD700', '#FFFFFF']; const speed = opts.speed || 6; for (let i = 0; i < count && state.particles.length < state.config.maxParticles; i++) { const a = Math.random() * Math.PI * 2; const v = Math.random() * speed + 1; state.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: opts.life || 40, maxLife: opts.life || 40, size: (opts.size || 4) * (0.6 + Math.random() * 0.8), color: colors[Math.floor(Math.random() * colors.length)], gravity: opts.gravity != null ? opts.gravity : 0.15, rot: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.3, shape: opts.shape || 'circle' }); } },
        shake(intensity = 8, duration = 20) { if (!state.config.shake) return; state.shakeIntensity = Math.max(state.shakeIntensity, intensity); state.shakeTime = Math.max(state.shakeTime, duration); },
        flash(color = '255,0,0', alpha = 0.5) { if (!state.config.flash) return; state.flashAlpha = alpha; state.flashColor = color; },
        pushTrail(x, y, w, h, img) { if (!state.config.trail || !img) return; state.trail.push({ x, y, w, h, img, life: 12, maxLife: 12 }); if (state.trail.length > 8) state.trail.shift(); },
        update() { state.time++; for (let i = state.particles.length - 1; i >= 0; i--) { const p = state.particles[i]; p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.vx *= 0.98; p.life--; p.rot += p.rotSpeed; if (p.life <= 0) state.particles.splice(i, 1); } if (state.shakeTime > 0) { state.shakeTime--; if (state.shakeTime === 0) state.shakeIntensity = 0; } if (state.flashAlpha > 0) state.flashAlpha = Math.max(0, state.flashAlpha - 0.05); for (let i = state.trail.length - 1; i >= 0; i--) { state.trail[i].life--; if (state.trail[i].life <= 0) state.trail.splice(i, 1); } },
        draw(ctx, canvas, scene) {
            const { config } = state; const W = canvas.width, H = canvas.height;
            let shakeX = 0, shakeY = 0;
            if (config.shake && state.shakeTime > 0) { const k = state.shakeTime / 20; shakeX = (Math.random() - 0.5) * state.shakeIntensity * k; shakeY = (Math.random() - 0.5) * state.shakeIntensity * k; }
            ctx.save(); ctx.translate(shakeX, shakeY);

            const { bg, bgNext, transitionAlpha } = scene;
            const drawBg = (img, alpha) => {
                if (img && img.complete && img.naturalWidth > 0) {
                    ctx.globalAlpha = alpha;
                    const scale = H / img.naturalHeight; const exactWidth = Math.ceil(img.naturalWidth * scale);
                    if (config.parallax) { ctx.globalAlpha = 0.5 * alpha; let farOffset = Math.floor((bg.offset * 0.4) % exactWidth); if (farOffset > 0) farOffset -= exactWidth; for (let i = farOffset; i < W; i += exactWidth) ctx.drawImage(img, i, -10, exactWidth, H + 20); }
                    ctx.globalAlpha = alpha;
                    let offset = Math.floor(bg.offset % exactWidth); if (offset > 0) offset -= exactWidth; for (let i = offset; i < W; i += exactWidth) ctx.drawImage(img, i, 0, exactWidth, H);
                    ctx.globalAlpha = 1;
                }
            };

            if (transitionAlpha > 0 && bgNext) {
                drawBg(bg.img, 1 - transitionAlpha); drawBg(bgNext.img, transitionAlpha);
            } else {
                if (bg.img && bg.img.complete && bg.img.naturalWidth > 0) {
                    const scale = H / bg.img.naturalHeight; const exactWidth = Math.ceil(bg.img.naturalWidth * scale);
                    if (config.parallax) { ctx.globalAlpha = 0.5; let farOffset = Math.floor((bg.offset * 0.4) % exactWidth); if (farOffset > 0) farOffset -= exactWidth; for (let i = farOffset; i < W; i += exactWidth) ctx.drawImage(bg.img, i, -10, exactWidth, H + 20); ctx.globalAlpha = 1; }
                    let offset = Math.floor(bg.offset % exactWidth); if (offset > 0) offset -= exactWidth; for (let i = offset; i < W; i += exactWidth) ctx.drawImage(bg.img, i, 0, exactWidth, H);
                } else { ctx.fillStyle = bg.fallbackColor; ctx.fillRect(0, 0, W, H); }
            }

            if (scene.pitOverlay && scene.pitOverlay.img && scene.pitOverlay.img.complete) ctx.drawImage(scene.pitOverlay.img, scene.pitOverlay.x, scene.pitOverlay.y, scene.pitOverlay.w, scene.pitOverlay.h);
            if (config.trail) { state.trail.forEach(t => { const a = (t.life / t.maxLife) * 0.4; ctx.save(); ctx.globalAlpha = a; ctx.drawImage(t.img, t.x, t.y, t.w, t.h); ctx.restore(); }); }
            const p = scene.player;
            if (p.img && p.img.complete && p.img.naturalWidth > 0) {
                ctx.save(); let fallAngle = 0, yOffset = 0, flyTilt = 0; let chewScale = 1.0;
                if (p.skinFilter) ctx.filter = p.skinFilter;
                if (p.isEating) chewScale = 1.0 + Math.sin(Date.now() / 80) * 0.05;
                if (p.isBarrelFlying) flyTilt = p.tilt;
                if (p.isTripping) { const fallProgress = Math.min(1, p.tripTimer / 15); const standProgress = Math.max(0, (p.tripTimer - 40) / 80); const flatAmount = fallProgress * (1 - standProgress); let dir = p.isBarrelTrip ? (FLIP_CROC ? 1 : -1) : (FLIP_CROC ? -1 : 1); fallAngle = dir * (Math.PI / 2) * flatAmount; yOffset = -((p.w - p.h) / 2) * flatAmount; if (Math.floor(p.tripTimer / 10) % 2 === 1) ctx.globalAlpha = 0.5; }
                const centerX = p.x + p.w / 2; const centerY = p.y + p.h / 2 + (p.isJumping ? 0 : (p.isTripping ? yOffset : p.bob));
                ctx.translate(centerX, centerY); ctx.rotate(p.tilt + fallAngle + flyTilt); if (FLIP_CROC) ctx.scale(-1, 1);
                const dW = p.w * chewScale, dH = p.h * chewScale; ctx.drawImage(p.img, -dW / 2, -dH / 2, dW, dH); ctx.restore();
            } else { ctx.fillStyle = 'red'; ctx.fillRect(p.x, p.y, p.w, p.h); }
            ctx.save(); ctx.globalAlpha = 1.0; ctx.textBaseline = 'bottom';
            scene.foods.forEach(f => { ctx.font = `40px Arial`; ctx.fillText(f.emoji, f.x, f.y + f.h); }); ctx.restore();
            const { images, pickImg } = scene;
            scene.obstacles.forEach(obs => {
                if (scene.isPitDeath && scene.pitTarget === obs) return;
                let img = null, fallback = '#888';
                if (obs.type === 'puddle') { img = pickImg(images.puddleImg, images.puddleNightImg); fallback = 'rgba(0,150,255,0.5)'; }
                else if (obs.type === 'pit') { img = pickImg(images.pitImg, images.pitNightImg); fallback = 'black'; }
                else if (obs.type === 'rock') { img = pickImg(images.rockImg, images.rockNightImg); fallback = '#888'; }
                else if (obs.type === 'barrel') { img = pickImg(images.barrelImg, images.barrelNightImg); fallback = '#c97b2a'; }
                else if (obs.type === 'cactus') { img = pickImg(images.cactusImg, images.cactusNightImg); fallback = '#2e8b3a'; }
                if (img && img.complete && img.naturalWidth > 0) ctx.drawImage(img, obs.x, obs.y, obs.w, obs.h);
                else { ctx.fillStyle = fallback; ctx.fillRect(obs.x, obs.y, obs.w, obs.h); }
            });
            scene.explosions.forEach(expl => {
                const progress = expl.timer / expl.maxTimer; const scale = 1 + progress * 0.5; const alpha = 1 - progress; const size = expl.size * scale; const x = expl.x - size / 2, y = expl.y - size / 2;
                if (images.explosionImg.current && images.explosionImg.current.complete) { ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(images.explosionImg.current, x, y, size, size); ctx.restore(); }
                else { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = 'orange'; ctx.beginPath(); ctx.arc(expl.x, expl.y, size / 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'yellow'; ctx.beginPath(); ctx.arc(expl.x, expl.y, size / 4, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
            });
            if (config.particles) {
                if (!state.cache.particleSprite) state.cache.particleSprite = makeParticleSprite();
                const sprite = state.cache.particleSprite;
                state.particles.forEach(pt => {
                    const a = pt.life / pt.maxLife; ctx.save(); ctx.globalAlpha = a;
                    if (pt.shape === 'circle') { ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * a, 0, Math.PI * 2); ctx.fill(); }
                    else if (pt.shape === 'leaf') { ctx.translate(pt.x, pt.y); ctx.rotate(pt.rot); ctx.fillStyle = pt.color; ctx.beginPath(); ctx.ellipse(0, 0, pt.size, pt.size * 0.5, 0, 0, Math.PI * 2); ctx.fill(); }
                    else if (pt.shape === 'spark') { ctx.drawImage(sprite, pt.x - pt.size, pt.y - pt.size, pt.size * 2, pt.size * 2); }
                    ctx.restore();
                });
            }
            if (config.bloom) {
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                scene.obstacles.forEach(obs => { if (obs.type === 'barrel') { const cx = obs.x + obs.w / 2, cy = obs.y + obs.h / 2; const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, obs.w * 1.5); grad.addColorStop(0, 'rgba(255,150,50,0.3)'); grad.addColorStop(1, 'rgba(255,150,50,0)'); ctx.fillStyle = grad; ctx.fillRect(cx - obs.w * 1.5, cy - obs.w * 1.5, obs.w * 3, obs.w * 3); } });
                scene.foods.forEach(f => { if (f.emoji === '🎋') { const cx = f.x + f.w / 2, cy = f.y + f.h / 2; const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30); grad.addColorStop(0, 'rgba(120,255,120,0.35)'); grad.addColorStop(1, 'rgba(120,255,120,0)'); ctx.fillStyle = grad; ctx.fillRect(cx - 30, cy - 30, 60, 60); } });
                ctx.restore();
            }
            if (config.vignette) { if (!state.cache.vignetteCanvas || state.cache.vignetteCanvas.width !== W) state.cache.vignetteCanvas = makeVignette(W, H); ctx.drawImage(state.cache.vignetteCanvas, 0, 0); }
            if (state.flashAlpha > 0) { ctx.fillStyle = `rgba(${state.flashColor},${state.flashAlpha})`; ctx.fillRect(0, 0, W, H); }
            if (scene.deathFade != null) { ctx.fillStyle = `rgba(0,0,0,${scene.deathFade})`; ctx.fillRect(0, 0, W, H); }
            ctx.restore();
        },
    };
})();

window.RenderEngine = RenderEngine;
const CHARACTERS = CONFIG.characters;
const BACKGROUNDS = CONFIG.biomes;

function Game() {
    const [gameState, setGameState] = useState('menu');
    const [timeOfDay, setTimeOfDay] = useState(() => localStorage.getItem('lacosteTimeOfDay') || 'day');
    const [background, setBackground] = useState(() => { const saved = localStorage.getItem('lacosteBackground'); return (saved && BACKGROUNDS[saved]) ? saved : Object.keys(BACKGROUNDS)[0]; });
    const [character, setCharacter] = useState(() => { const saved = localStorage.getItem('lacosteCharacter'); return (saved && CHARACTERS[saved]) ? saved : Object.keys(CHARACTERS)[0]; });

    const [currentSkins, setCurrentSkins] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('lacosteCurrentSkins') || '{}');
            if (saved && Object.keys(saved).length > 0) return saved;
        } catch {}
        const result = {};
        Object.keys(CHARACTERS).forEach(id => { result[id] = CHARACTERS[id].skins?.[0]?.id || 'default'; });
        const old = localStorage.getItem('lacosteSkin') || 'default';
        if (old === 'gold') result.crocodile = 'croc_gold';
        if (old === 'red') result.panda = 'panda_gold';
        return result;
    });
    const currentSkin = currentSkins[character] || CHARACTERS[character]?.skins?.[0]?.id || 'default';

    useEffect(() => {
        localStorage.setItem('lacosteCurrentSkins', JSON.stringify(currentSkins));
        localStorage.setItem('lacosteSkin', currentSkin || 'default');
    }, [currentSkins, currentSkin]);

    // === Konami через свайпы для мобильных ===
    useEffect(() => {
        const KONAMI_SWIPES = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right'];
        const KONAMI_DURATION = CONFIG.pack4?.secrets?.konami?.duration || 10000;
        const SWIPE_THRESHOLD = 40;
        const MAX_DURATION  = 800;
        const RESET_AFTER   = 2000;

        const seqRef = { current: [] };
        let startX = 0, startY = 0, startT = 0;
        let skipped = false;
        let resetTimer = null;

        const resetSeq = () => { seqRef.current = []; };
        const scheduleReset = () => { clearTimeout(resetTimer); resetTimer = setTimeout(resetSeq, RESET_AFTER); };

        const onStart = (e) => {
            const target = e.target;
            skipped = !!(target.closest('button') || target.closest('input') || target.closest('textarea') || target.closest('.ms-nav') || target.closest('.ms-tabs') || target.closest('.ms-char-tabs'));
            if (skipped) return;
            const t = e.touches[0];
            startX = t.clientX;
            startY = t.clientY;
            startT = Date.now();
        };

        const onEnd = (e) => {
            if (skipped) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;
            const dt = Date.now() - startT;
            if (dt > MAX_DURATION) { resetSeq(); return; }

            let dir = null;
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) dir = dx > 0 ? 'right' : 'left';
            else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SWIPE_THRESHOLD) dir = dy > 0 ? 'down' : 'up';
            if (!dir) return;

            seqRef.current.push(dir);
            if (seqRef.current.length > KONAMI_SWIPES.length) seqRef.current.shift();
            scheduleReset();

            if (navigator.vibrate) navigator.vibrate(8);

            if (seqRef.current.length === KONAMI_SWIPES.length && seqRef.current.every((d, i) => d === KONAMI_SWIPES[i])) {
                resetSeq();
                clearTimeout(resetTimer);
                if (window.Pack4State) {
                    window.Pack4State.cheatInvincible = Date.now() + KONAMI_DURATION;
                    window.GameEvents.emit('pack4_toast', { text: '🔱 CHEAT ACTIVATED! 10s INVINCIBILITY', type: 'danger' });
                    if (window.RenderEngine) {
                        window.RenderEngine.flash('0,255,255', 0.5);
                        window.RenderEngine.shake(15, 25);
                    }
                    if (navigator.vibrate) navigator.vibrate([60, 40, 60, 40, 100]);
                } else {
                    console.warn('[Konami] sequence matched but Pack4State missing');
                }
            }
        };

        const onCancel = () => { resetSeq(); };

        document.addEventListener('touchstart', onStart, { passive: true });
        document.addEventListener('touchend', onEnd, { passive: true });
        document.addEventListener('touchcancel', onCancel, { passive: true });
        return () => {
            clearTimeout(resetTimer);
            document.removeEventListener('touchstart', onStart);
            document.removeEventListener('touchend', onEnd);
            document.removeEventListener('touchcancel', onCancel);
        };
    }, []);

    // === Слушаем смену скина из Shop ===
    useEffect(() => {
        const handler = (data) => setCurrentSkins(prev => ({ ...prev, [data.charId]: data.skinId }));
        window.GameEvents.on('pack4_skins_updated', handler);
        return () => {
            if (window.GameEvents.listeners['pack4_skins_updated']) {
                window.GameEvents.listeners['pack4_skins_updated'] = window.GameEvents.listeners['pack4_skins_updated'].filter(cb => cb !== handler);
            }
        };
    }, []);

    const [score, setScore] = useState(0);
    const [speedDisplay, setSpeedDisplay] = useState(1.0);
    const [powerDisplay, setPowerDisplay] = useState(1.0);
    const [health, setHealth] = useState(6);
    const [highScore, setHighScore] = useState(() => Math.max(0, parseInt(localStorage.getItem('lacosteHighScore')) || 0));
    const [coins, setCoins] = useState(() => Math.max(0, parseInt(localStorage.getItem('lacosteCoins')) || 0));

    const [settings, setSettings] = useState(() => {
        try { const saved = JSON.parse(localStorage.getItem('lacosteSettings') || '{}'); return { ...DEFAULT_SETTINGS, ...saved }; } catch { return { ...DEFAULT_SETTINGS }; }
    });

    const scoreRef = useRef(0);
    useEffect(() => { scoreRef.current = score; }, [score]);

    // SHARE
    useEffect(() => {
        const handler = () => {
            const dist = Math.floor(scoreRef.current) || highScore;
            const url = `${location.origin}${location.pathname}?record=${dist}`;
            const text = `Я пробежал ${dist}м в Lacoste Runner! 🐊 Побей мой рекорд!`;
            if (navigator.share) {
                navigator.share({ title: 'Lacoste Runner', text, url }).catch(() => {});
            } else if (navigator.clipboard) {
                navigator.clipboard.writeText(`${text} ${url}`)
                    .then(() => window.GameEvents.emit('pack4_toast', { text: '📋 Ссылка скопирована!', type: 'success' }))
                    .catch(() => { prompt('Скопируйте ссылку:', url); });
            } else {
                prompt('Скопируйте ссылку:', url);
            }
            if (navigator.vibrate) navigator.vibrate(10);
        };
        window.GameEvents.on('show_share', handler);
        return () => {
            if (window.GameEvents.listeners['show_share']) {
                window.GameEvents.listeners['show_share'] = window.GameEvents.listeners['show_share'].filter(cb => cb !== handler);
            }
        };
    }, [highScore]);

    // Character sync
    useEffect(() => {
        const handler = (data) => {
            if (data?.charId && CHARACTERS[data.charId] && data.charId !== character) {
                setCharacter(data.charId);
            }
        };
        window.GameEvents.on('pack4_character_changed', handler);
        return () => {
            if (window.GameEvents.listeners['pack4_character_changed']) {
                window.GameEvents.listeners['pack4_character_changed'] = window.GameEvents.listeners['pack4_character_changed'].filter(cb => cb !== handler);
            }
        };
    }, [character]);

    // Forward pack1/pack2 toasts
    useEffect(() => {
        const forward = (d) => window.GameEvents.emit('pack4_toast', d);
        window.GameEvents.on('pack1_toast', forward);
        window.GameEvents.on('pack2_toast', forward);
        return () => {
            ['pack1_toast', 'pack2_toast'].forEach(ev => {
                if (window.GameEvents.listeners[ev]) {
                    window.GameEvents.listeners[ev] = window.GameEvents.listeners[ev].filter(cb => cb !== forward);
                }
            });
        };
    }, []);

    // Auto-pause
    useEffect(() => {
        const onHide = () => { if (document.hidden && gameState === 'playing') setGameState('paused'); };
        document.addEventListener('visibilitychange', onHide);
        return () => document.removeEventListener('visibilitychange', onHide);
    }, [gameState]);

    // beforeunload
    useEffect(() => {
        if (gameState !== 'playing') return;
        const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [gameState]);

    // Coins sync
    useEffect(() => {
        const handleCoinsUpdate = () => setCoins(Math.max(0, parseInt(localStorage.getItem('lacosteCoins')) || 0));
        window.GameEvents.on('pack4_coins_updated', handleCoinsUpdate);
        return () => {
            if (window.GameEvents.listeners['pack4_coins_updated']) {
                window.GameEvents.listeners['pack4_coins_updated'] = window.GameEvents.listeners['pack4_coins_updated'].filter(cb => cb !== handleCoinsUpdate);
            }
        };
    }, []);

    useEffect(() => { localStorage.setItem('lacosteSettings', JSON.stringify(settings)); RenderEngine.setQuality(settings.graphics); }, [settings]);
    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    const canvasRef = useRef(null);
    const requestRef = useRef();

    const timeOfDayRef = useRef(timeOfDay);
    const backgroundRef = useRef(background);
    const groundYRef = useRef(GROUND_Y + (BACKGROUNDS[background]?.groundOffset || 0));

    useEffect(() => { timeOfDayRef.current = timeOfDay; localStorage.setItem('lacosteTimeOfDay', timeOfDay); }, [timeOfDay]);
    useEffect(() => { backgroundRef.current = background; localStorage.setItem('lacosteBackground', background); const bg = BACKGROUNDS[background] || BACKGROUNDS[Object.keys(BACKGROUNDS)[0]]; groundYRef.current = GROUND_Y + (bg.groundOffset || 0); }, [background]);

    const walkFramesRef = useRef([]);
    const currentFrameRef = useRef(0);
    const lastFrameTimeRef = useRef(0);

    const eatFramesRef = useRef([]);
    const eatFrameIdxRef = useRef(0);
    const isEatingRef = useRef(false);
    const eatTimerRef = useRef(0);
    const eatSpeedFactorRef = useRef(1.0);

    useEffect(() => {
        localStorage.setItem('lacosteCharacter', character);
        window.__gameSetCharacter = setCharacter;
        walkFramesRef.current = []; currentFrameRef.current = 0; eatFramesRef.current = []; eatFrameIdxRef.current = 0; isEatingRef.current = false; eatTimerRef.current = 0; eatSpeedFactorRef.current = 1.0;
        const char = CHARACTERS[character] || CHARACTERS[Object.keys(CHARACTERS)[0]];
        for (let i = 1; i <= char.frameCount; i++) { const img = new Image(); img.src = `${char.folder}/${i}.png`; walkFramesRef.current.push(img); }
        if (char.eatFolder && char.eatFrameCount) { for (let i = 1; i <= char.eatFrameCount; i++) { const img = new Image(); img.src = `${char.eatFolder}/${i}.png`; eatFramesRef.current.push(img); } }
    }, [character]);

    const pitAudioRef = useRef(null); const pitAudioEndedRef = useRef(false); const barrelAudioRef = useRef(null); const splashAudioRef = useRef(null); const nightAmbientRef = useRef(null); const dayAmbientRef = useRef(null);

    useEffect(() => {
        const pitAudio = new Audio('source/sounds/fall_in_pit.wav'); pitAudio.preload = 'auto'; pitAudioRef.current = pitAudio;
        const barrelAudio = new Audio('source/sounds/barrel_explosion.wav'); barrelAudio.preload = 'auto'; barrelAudioRef.current = barrelAudio;
        const splashAudio = new Audio('source/sounds/splash.wav'); splashAudio.preload = 'auto'; splashAudio.playbackRate = 1.2; splashAudioRef.current = splashAudio;
        const nightAmbient = new Audio('source/sounds/night_forest.mp3'); nightAmbient.loop = true; nightAmbient.preload = 'auto'; nightAmbientRef.current = nightAmbient;
        const dayAmbient = new Audio('source/sounds/forest_day.wav'); dayAmbient.loop = true; dayAmbient.preload = 'auto'; dayAmbientRef.current = dayAmbient;
        return () => { pitAudio.pause(); pitAudio.src = ''; barrelAudio.pause(); barrelAudio.src = ''; splashAudio.pause(); splashAudio.src = ''; nightAmbient.pause(); nightAmbient.src = ''; dayAmbient.pause(); dayAmbient.src = ''; };
    }, []);

    useEffect(() => {
        const s = settings;
        [pitAudioRef, barrelAudioRef, splashAudioRef].forEach(ref => { if (ref.current) ref.current.volume = s.soundEnabled ? s.sfxVolume * s.masterVolume : 0; });
        [nightAmbientRef, dayAmbientRef].forEach(ref => { if (ref.current) ref.current.volume = s.soundEnabled ? s.ambientVolume * s.masterVolume : 0; });
        if (nightAmbientRef.current) { if (!s.soundEnabled) nightAmbientRef.current.pause(); else if (timeOfDayRef.current === 'night' && gameState === 'playing') nightAmbientRef.current.play().catch(() => {}); }
        if (dayAmbientRef.current) { if (!s.soundEnabled) dayAmbientRef.current.pause(); else if (timeOfDayRef.current === 'day' && gameState === 'playing') dayAmbientRef.current.play().catch(() => {}); }
    }, [settings]);

    useEffect(() => {
        const nightAudio = nightAmbientRef.current; const dayAudio = dayAmbientRef.current; if (!nightAudio || !dayAudio) return;
        if (!settingsRef.current.soundEnabled) { nightAudio.pause(); dayAudio.pause(); return; }
        if (timeOfDay === 'night') { if (gameState === 'playing') nightAudio.play().catch(() => {}); dayAudio.pause(); }
        else { if (gameState === 'playing') dayAudio.play().catch(() => {}); nightAudio.pause(); }
    }, [timeOfDay, settings.soundEnabled, gameState]);

    useEffect(() => {
        const isPaused = gameState === 'paused' || gameState === 'menu' || gameState === 'gameover';
        if (isPaused) { if (pitAudioRef.current) pitAudioRef.current.pause(); if (barrelAudioRef.current) barrelAudioRef.current.pause(); if (splashAudioRef.current) splashAudioRef.current.pause(); if (nightAmbientRef.current) nightAmbientRef.current.pause(); if (dayAmbientRef.current) dayAmbientRef.current.pause(); }
        else { if (settingsRef.current.soundEnabled && gameState === 'playing') { if (timeOfDayRef.current === 'night' && nightAmbientRef.current) nightAmbientRef.current.play().catch(() => {}); else if (timeOfDayRef.current === 'day' && dayAmbientRef.current) dayAmbientRef.current.play().catch(() => {}); } }
    }, [gameState]);

    const initChar = CHARACTERS[character] || CHARACTERS[Object.keys(CHARACTERS)[0]];
    const initGroundY = GROUND_Y + (BACKGROUNDS[background]?.groundOffset || 0);
    const playerRef = useRef({ x: 100, y: initGroundY - initChar.baseHeight, width: initChar.baseWidth, height: initChar.baseHeight, velocityY: 0, isJumping: false, isHoldingJump: false, jumpMult: 1.0, tilt: 0, bob: 0, foodEaten: 0, foodTarget: 1, skinFilter: null });

    const obstaclesRef = useRef([]);
    const foodsRef = useRef([]);
    const explosionsRef = useRef([]);

    const distanceRef = useRef(0);
    const spawnTimerRef = useRef(0);
    const foodTimerRef = useRef(0);
    const bgOffsetRef = useRef(0);
    const spawnCooldownRef = useRef(0);

    const healthRef = useRef(6);
    const isTrippingRef = useRef(false);
    const tripTimerRef = useRef(0);
    const speedPenaltyRef = useRef(1.0);

    const isBarrelTripRef = useRef(false);
    const pendingBarrelDamageRef = useRef(false);
    const isBarrelFlyingRef = useRef(false);
    const barrelFlyVelocityYRef = useRef(0);

    const isFallingIntoPitRef = useRef(false);
    const pitTargetRef = useRef(null);
    const pitFallTimerRef = useRef(0);
    const pitVelocityRef = useRef(0);
    const isPitDeathDelayRef = useRef(false);
    const pitDeathDelayTimerRef = useRef(0);

    const biomeTransitionRef = useRef({ active: false, nextBiome: null, alpha: 0 });

    // === FIX #3: защита от двойного gameover ===
    const isGameOverRef = useRef(false);
    // === FIX #11: точный счётчик еды за забег ===
    const totalFoodEatenRef = useRef(0);

    const puddleImg = useRef(new Image()); const puddleNightImg = useRef(new Image());
    const rockImg = useRef(new Image()); const rockNightImg = useRef(new Image());
    const pitImg = useRef(new Image()); const pitNightImg = useRef(new Image());
    const barrelImg = useRef(new Image()); const barrelNightImg = useRef(new Image());
    const cactusImg = useRef(new Image()); const cactusNightImg = useRef(new Image());
    const explosionImg = useRef(new Image());

    const backgroundImagesRef = useRef({});
    useEffect(() => {
        Object.values(BACKGROUNDS).forEach(bg => { const day = new Image(); day.src = bg.dayImg; const night = new Image(); night.src = bg.nightImg; backgroundImagesRef.current[bg.id] = { day, night }; });
        if (CONFIG.pack3 && CONFIG.pack3.biomes) {
            CONFIG.pack3.biomes.forEach(bg => { const day = new Image(); day.src = bg.dayImg; const night = new Image(); night.src = bg.nightImg; backgroundImagesRef.current[bg.id] = { day, night }; });
        }
    }, []);
    useEffect(() => {
        puddleImg.current.src = 'source/puddle.png'; puddleNightImg.current.src = 'source/puddle_n.png';
        rockImg.current.src = 'source/rock.png'; rockNightImg.current.src = 'source/rock_n.png';
        pitImg.current.src = 'source/pit.png'; pitNightImg.current.src = 'source/pit_n.png';
        barrelImg.current.src = 'source/barrel.png'; barrelNightImg.current.src = 'source/barrel_n.png';
        cactusImg.current.src = 'source/cactus.png'; cactusNightImg.current.src = 'source/cactus_n.png';
        explosionImg.current.src = 'source/explosion.png';
    }, []);

    const calculateJumpMultiplier = (playerHeight, gameSpeed, penalty = 1.0) => {
        const char = CHARACTERS[character] || CHARACTERS[Object.keys(CHARACTERS)[0]];
        const sizeFactor = Math.sqrt(playerHeight / char.baseHeight);
        const speedFactor = 1 + (gameSpeed - 1) * 0.10;
        const statJump = getStat(character, 'jump');
        return Math.max(1.0, sizeFactor * speedFactor * penalty * statJump);
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch((err) => console.warn("Fullscreen error:", err)); if (screen.orientation && screen.orientation.lock) { screen.orientation.lock('landscape').catch((err) => console.warn("Orientation lock error:", err)); } }
        else { if (document.exitFullscreen) document.exitFullscreen(); }
    };

    // === FIX #1: комбо полностью управляется Pack1State — локальный comboRef удалён ===
    const konamiRef = useRef([]);

    // === FIX #14: resetGame доступен из замыканий через ref ===
    const resetGameRef = useRef(null);

    const handleKeyDown = useCallback((e) => {
        // === FIX #6: не перехватываем клавиши в полях ввода ===
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

        // === FIX #5: Konami — только стрелки, Space не загрязняет буфер ===
        const KONAMI_CODE = CONFIG.pack4?.secrets?.konami?.code || [];
        if (KONAMI_CODE.includes(e.code)) {
            konamiRef.current.push(e.code);
            if (konamiRef.current.length > KONAMI_CODE.length) konamiRef.current.shift();
            if (JSON.stringify(konamiRef.current) === JSON.stringify(KONAMI_CODE)) {
                if (window.Pack4State) {
                    window.Pack4State.cheatInvincible = Date.now() + (CONFIG.pack4.secrets.konami.duration || 10000);
                    window.GameEvents.emit('pack4_toast', { text: '🔱 CHEAT ACTIVATED! 10s INVINCIBILITY', type: 'danger' });
                    konamiRef.current = [];
                }
            }
        }

        if (e.code === 'Escape') { e.preventDefault(); if (isFallingIntoPitRef.current || isPitDeathDelayRef.current) return; if (gameState === 'playing') setGameState('paused'); else if (gameState === 'paused') setGameState('playing'); return; }
        if (e.code === 'KeyN') { e.preventDefault(); setTimeOfDay(prev => prev === 'day' ? 'night' : 'day'); return; }

        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            // === FIX #7: из меню/геймовера запускаем resetGame(), а не просто playing ===
            if (gameState === 'menu' || gameState === 'gameover') { resetGameRef.current && resetGameRef.current(); return; }
            if (gameState === 'playing' && !playerRef.current.isJumping && !isTrippingRef.current && !isFallingIntoPitRef.current && !isPitDeathDelayRef.current && !isBarrelFlyingRef.current && !isEatingRef.current) {
                const p = playerRef.current;
                const baseMult = 1.0 + Math.floor(distanceRef.current / 100) * 0.04;
                p.jumpMult = calculateJumpMultiplier(p.height, baseMult, speedPenaltyRef.current);
                p.velocityY = JUMP_FORCE * p.jumpMult; p.isJumping = true; p.isHoldingJump = true;
                // FIX #1: комбо инкрементит Pack1 на событии jump
                window.GameEvents.emit('jump', { x: p.x + p.width / 2, y: p.y });
                RenderEngine.spawnParticles(p.x + p.width / 2, p.y + p.height, 6, { colors: ['#FFFFFF', '#AAAAAA'], speed: 2, life: 20, size: 2, gravity: 0.1 });
            }
        }
    }, [gameState, character]);
    const handleKeyUp = useCallback((e) => {
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (e.code === 'Space' || e.code === 'ArrowUp') playerRef.current.isHoldingJump = false;
    }, []);
    useEffect(() => { window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp); return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); }; }, [handleKeyDown, handleKeyUp]);

    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const shouldSkipTouch = (target) =>
            target.closest('.game-btn') || target.closest('.btn') || target.closest('.char-btn') ||
            target.closest('.settings-panel') || target.closest('.settings-open-btn') ||
            target.closest('.pack2-inventory') || target.closest('.pack3-ui') || target.closest('.ms-overlay') ||
            target.closest('input') || target.closest('textarea') || target.closest('button');

        const handleTouchStart = (e) => {
            if (shouldSkipTouch(e.target)) return;
            e.preventDefault(); if (gameState !== 'playing') return;
            if (playerRef.current.isJumping || isTrippingRef.current || isFallingIntoPitRef.current || isPitDeathDelayRef.current || isBarrelFlyingRef.current || isEatingRef.current) return;
            const p = playerRef.current; const baseMult = 1.0 + Math.floor(distanceRef.current / 100) * 0.04;
            p.jumpMult = calculateJumpMultiplier(p.height, baseMult, speedPenaltyRef.current); p.velocityY = JUMP_FORCE * p.jumpMult; p.isJumping = true; p.isHoldingJump = true;
            window.GameEvents.emit('jump', { x: p.x + p.width / 2, y: p.y });
            RenderEngine.spawnParticles(p.x + p.width / 2, p.y + p.height, 6, { colors: ['#FFFFFF', '#AAAAAA'], speed: 2, life: 20, size: 2, gravity: 0.1 });
        };
        const handleTouchEnd = (e) => { if (shouldSkipTouch(e.target)) return; if (gameState !== 'playing') return; e.preventDefault(); playerRef.current.isHoldingJump = false; };
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
        return () => { canvas.removeEventListener('touchstart', handleTouchStart); canvas.removeEventListener('touchend', handleTouchEnd); canvas.removeEventListener('touchcancel', handleTouchEnd); };
    }, [gameState, character]);

    const resetGame = () => {
        const char = CHARACTERS[character] || CHARACTERS[Object.keys(CHARACTERS)[0]]; const gy = groundYRef.current;

        let startHp = 6;
        if (window.Pack4State && window.Pack4State.boughtBuffs?.includes('start_hp')) startHp = 8;

        const skinFilter = getSkinFilter(character, currentSkin);

        playerRef.current = { x: 100, y: gy - char.baseHeight, width: char.baseWidth, height: char.baseHeight, velocityY: 0, isJumping: false, isHoldingJump: false, jumpMult: 1.0, tilt: 0, bob: 0, foodEaten: 0, foodTarget: 1, skinFilter };
        obstaclesRef.current = []; foodsRef.current = []; explosionsRef.current = []; distanceRef.current = 0; spawnTimerRef.current = 0; foodTimerRef.current = 0; bgOffsetRef.current = 0; currentFrameRef.current = 0; spawnCooldownRef.current = 0;
        healthRef.current = startHp; setHealth(startHp);
        isTrippingRef.current = false; tripTimerRef.current = 0; speedPenaltyRef.current = 1.0; isBarrelTripRef.current = false; pendingBarrelDamageRef.current = false; isBarrelFlyingRef.current = false; barrelFlyVelocityYRef.current = 0; isFallingIntoPitRef.current = false; pitTargetRef.current = null; pitFallTimerRef.current = 0; pitVelocityRef.current = 0; isPitDeathDelayRef.current = false; pitDeathDelayTimerRef.current = 0;
        isEatingRef.current = false; eatTimerRef.current = 0; eatFrameIdxRef.current = 0; eatSpeedFactorRef.current = 1.0; pitAudioEndedRef.current = false;

        // === FIX #4/#14: очищаем флаги и refs ===
        isGameOverRef.current = false;
        totalFoodEatenRef.current = 0;
        konamiRef.current = [];

        if (pitAudioRef.current) { pitAudioRef.current.pause(); pitAudioRef.current.currentTime = 0; }

        biomeTransitionRef.current = { active: false, nextBiome: null, alpha: 0 };

        RenderEngine.reset(); setScore(0); setSpeedDisplay(1.0); setPowerDisplay(1.0); setGameState('playing');

        if (window.Pack4State) {
            window.Pack4State.reviveUsed = false;
        }

        // FIX #1: комбо сбросится в Pack1 на 'start' (и 'start_combo' подхватится там же)
        window.GameEvents.emit('start', { character, background, timeOfDay, settings: settingsRef.current });
    };
    resetGameRef.current = resetGame;

    const handleGameOver = () => {
        // === FIX #3: защита от двойного вызова ===
        if (isGameOverRef.current) return;
        isGameOverRef.current = true;

        RenderEngine.reset(); if (pitAudioRef.current) pitAudioRef.current.pause(); setGameState('gameover');
        if (Math.floor(distanceRef.current) > highScore) { const newHigh = Math.floor(distanceRef.current); setHighScore(newHigh); localStorage.setItem('lacosteHighScore', newHigh); }

        const stats = JSON.parse(localStorage.getItem('lacostePlayerStats') || '{}');
        stats.totalRuns = (stats.totalRuns || 0) + 1;
        stats.totalDistance = (stats.totalDistance || 0) + Math.floor(distanceRef.current);
        stats.totalJumps = (stats.totalJumps || 0) + (window.Pack3State?.runStats?.jumps || 0);
        // === FIX #11: точный счётчик съеденной еды ===
        stats.totalFood = (stats.totalFood || 0) + totalFoodEatenRef.current;
        localStorage.setItem('lacostePlayerStats', JSON.stringify(stats));

        window.GameEvents.emit('gameover', { distance: Math.floor(distanceRef.current), health: healthRef.current, character, background, timeOfDay });
    };

    const applyDamage = (type) => {
        healthRef.current -= 1;
        setHealth(healthRef.current);

        // Emit hit ДО проверки смерти, чтобы паки увидели финальный удар
        window.GameEvents.emit('hit', {
            health: healthRef.current,
            type,
            playerX: playerRef.current.x + playerRef.current.width / 2,
            playerY: playerRef.current.y + playerRef.current.height / 2,
            distance: Math.floor(distanceRef.current),
        });

        if (healthRef.current <= 0) {
            if (window.Pack4State && window.Pack4State.boughtBuffs?.includes('revive') && !window.Pack4State.reviveUsed) {
                window.Pack4State.reviveUsed = true;
                healthRef.current = 3; setHealth(3);
                RenderEngine.flash('255,0,255', 0.8); RenderEngine.shake(20, 30);
                window.GameEvents.emit('pack4_toast', { text: '💖 SECOND CHANCE ACTIVATED!', type: 'success' });
                RenderEngine.spawnParticles(playerRef.current.x + playerRef.current.width / 2, playerRef.current.y + playerRef.current.height / 2, 50, { colors: ['#FF007F', '#FFFFFF'], speed: 8, life: 40, size: 4, gravity: 0.1 });
                return false;
            } else {
                handleGameOver();
                return true;
            }
        }
        return false;
    };

    const handleHit = (index, type) => {
        if (isTrippingRef.current || isGameOverRef.current) return;
        if (window.Pack4State && window.Pack4State.cheatInvincible > Date.now()) { obstaclesRef.current.splice(index, 1); RenderEngine.flash('0,255,255', 0.3); return; }
        if (window.Pack2State && window.Pack2State.hasShield) { window.Pack2State.hasShield = false; obstaclesRef.current.splice(index, 1); window.GameEvents.emit('shield_break', { x: playerRef.current.x, y: playerRef.current.y }); return; }

        obstaclesRef.current.splice(index, 1);

        // === FIX #9/#10: сначала визуал + звук + emit hit, потом — смерть ===
        if (type === 'puddle' && splashAudioRef.current && settingsRef.current.soundEnabled) { splashAudioRef.current.currentTime = 0; splashAudioRef.current.playbackRate = 1.2; splashAudioRef.current.play().catch(e => console.warn("Audio blocked", e)); }
        RenderEngine.flash('255,0,0', 0.4); RenderEngine.shake(6, 12);
        RenderEngine.spawnParticles(playerRef.current.x + playerRef.current.width / 2, playerRef.current.y + playerRef.current.height / 2, 15, { colors: ['#FF007F', '#FFFFFF'], speed: 4, life: 25, size: 3, gravity: 0.15 });

        const died = applyDamage(type);
        if (died) return;

        isTrippingRef.current = true; tripTimerRef.current = 0; isBarrelTripRef.current = false;
        const p = playerRef.current; p.y = groundYRef.current - p.height; p.velocityY = 0; p.isJumping = false; p.tilt = 0;
        speedPenaltyRef.current = speedPenaltyRef.current * 0.65;
    };

    const handleBarrelHit = (index) => {
        if (isTrippingRef.current || isBarrelFlyingRef.current || isGameOverRef.current) return;
        if (window.Pack4State && window.Pack4State.cheatInvincible > Date.now()) { obstaclesRef.current.splice(index, 1); RenderEngine.flash('0,255,255', 0.3); return; }

        const obs = obstaclesRef.current[index]; if (!obs) return; const canvas = canvasRef.current; const p = playerRef.current;
        explosionsRef.current.push({ x: obs.x + obs.width / 2, y: obs.y + obs.height / 2, size: obs.height * 6, timer: 0, maxTimer: 30 });
        if (barrelAudioRef.current && settingsRef.current.soundEnabled) { barrelAudioRef.current.currentTime = 0; barrelAudioRef.current.play().catch(e => console.warn("Audio blocked", e)); }
        RenderEngine.spawnParticles(obs.x + obs.width / 2, obs.y + obs.height / 2, 30, { colors: ['#FF007F', '#FFD700', '#FFAA00', '#FFFFFF'], speed: 8, life: 40, size: 5, gravity: 0.2, shape: 'circle' });
        RenderEngine.shake(12, 20); RenderEngine.flash('255,150,0', 0.3);
        window.GameEvents.emit('barrel_hit', { x: obs.x, y: obs.y });

        obstaclesRef.current.splice(index, 1); obstaclesRef.current = obstaclesRef.current.filter(o => (o.x + o.width) > p.x && o.x < canvas.width); foodsRef.current = foodsRef.current.filter(f => f.x < canvas.width);

        if (window.Pack2State && window.Pack2State.hasShield) {
            window.Pack2State.hasShield = false;
            window.GameEvents.emit('shield_break', { x: p.x, y: p.y });
            spawnCooldownRef.current = 90; spawnTimerRef.current = 0;
            return;
        }

        spawnCooldownRef.current = 90; spawnTimerRef.current = 0; isBarrelFlyingRef.current = true; isBarrelTripRef.current = true; barrelFlyVelocityYRef.current = -20; p.velocityY = 0; p.isJumping = false; p.isHoldingJump = false; p.tilt = 0;
    };

    const updateLogic = () => {
        const canvas = canvasRef.current; const p = playerRef.current;
        const char = CHARACTERS[character] || CHARACTERS[Object.keys(CHARACTERS)[0]]; const gy = groundYRef.current;

        let currentBgConfig = BACKGROUNDS[backgroundRef.current] || BACKGROUNDS[Object.keys(BACKGROUNDS)[0]];
        if (settingsRef.current.biomesEnabled && window.Pack3State && window.Pack3State.currentBiome) { currentBgConfig = window.Pack3State.currentBiome; }

                const diffMult = SPEED_MULTIPLIER + Math.floor(distanceRef.current / 500) * 0.05;
        let slowmoFactor = 1.0;
        if ((window.Pack2State?.activePowerups?.slowmo || 0) > Date.now()) slowmoFactor = 0.5;
        let sprintFactor = 1.0;
        if ((window.Pack2State?.activePowerups?.sprint || 0) > Date.now()) sprintFactor = 1.3;

        const currentSpeed = Math.max(
            BASE_SPEED * 0.4,
            (BASE_SPEED + distanceRef.current * 0.001) * diffMult
                * speedPenaltyRef.current * slowmoFactor * sprintFactor
        );

        distanceRef.current += currentSpeed * 0.5;
        bgOffsetRef.current += currentSpeed * 0.5;

        // FIX #8: speedPenalty восстанавливается со временем
        if (speedPenaltyRef.current < 1.0 && !isTrippingRef.current && !isBarrelFlyingRef.current) {
            speedPenaltyRef.current = Math.min(1.0, speedPenaltyRef.current + 0.001);
        }

        // HUD-дисплеи
        setScore(Math.floor(distanceRef.current));
        setSpeedDisplay(prev => {
            const next = Math.round((BASE_SPEED + distanceRef.current * 0.001) * 10) / 10;
            return Math.abs(prev - next) < 0.1 ? prev : next;
        });
        setPowerDisplay(prev => {
            const pw = Math.round((window.Pack1State?.comboMult || 1) * 10) / 10;
            return Math.abs(prev - pw) < 0.1 ? prev : pw;
        });

        // === EATING timer ===
        if (isEatingRef.current) {
            eatTimerRef.current++;
            if (eatTimerRef.current > 30) {
                isEatingRef.current = false;
                eatFrameIdxRef.current = 0;
                eatTimerRef.current = 0;
            }
        }

        // === TRIPPING timer ===
        if (isTrippingRef.current) {
            tripTimerRef.current++;
            if (tripTimerRef.current > 120) {
                isTrippingRef.current = false;
                isBarrelTripRef.current = false;
            }
        }

        // === BARREL FLY ===
        if (isBarrelFlyingRef.current) {
            p.velocityY += 0.7;
            p.y += barrelFlyVelocityYRef.current;
            barrelFlyVelocityYRef.current += 0.7;
            p.tilt += 0.08;

            if (p.y >= gy - p.height) {
                p.y = gy - p.height;
                p.tilt = 0;
                p.velocityY = 0;
                barrelFlyVelocityYRef.current = 0;
                isBarrelFlyingRef.current = false;
                isBarrelTripRef.current = false;
                pendingBarrelDamageRef.current = true;
            }
        } else if (p.isJumping) {
            // === JUMP PHYSICS ===
            p.velocityY += GRAVITY;
            if (p.isHoldingJump && p.velocityY < 0) p.velocityY += HOLD_THRUST;
            p.y += p.velocityY;

            if (p.y >= gy - p.height) {
                p.y = gy - p.height;
                p.velocityY = 0;
                p.isJumping = false;
                p.isHoldingJump = false;
                window.GameEvents.emit('land', {});
            }
        } else if (!isTrippingRef.current) {
            p.bob = Math.sin(Date.now() / 100) * 2;
            p.y = gy - p.height;
        }

        // === PENDING BARREL DAMAGE (FIX #9/#10) ===
        if (pendingBarrelDamageRef.current) {
            pendingBarrelDamageRef.current = false;
            const died = applyDamage('barrel');
            if (!died && !isGameOverRef.current) {
                isTrippingRef.current = true;
                tripTimerRef.current = 0;
                isBarrelTripRef.current = false;
                speedPenaltyRef.current = speedPenaltyRef.current * 0.65;
            }
        }

        // === SPAWN OBSTACLES (FIX #spawnTimer: инвертированная логика) ===
        spawnTimerRef.current++;
        if (spawnCooldownRef.current > 0) {
            spawnCooldownRef.current--;
        } else {
            // FIX: быстрее игра → чаще спавн (было наоборот)
            const spawnRate = Math.max(45, 140 - currentSpeed * 8) + Math.random() * 40;
            if (spawnTimerRef.current > spawnRate) {
                spawnTimerRef.current = 0;
                const types = currentBgConfig.obstacleTypes || ['barrel', 'rock', 'cactus', 'puddle', 'pit'];
                const type = types[Math.floor(Math.random() * types.length)];
                const obsDefs = {
                    barrel: { w: 60,  h: 80 },
                    rock:   { w: 80,  h: 60 },
                    cactus: { w: 50,  h: 90 },
                    puddle: { w: 140, h: 30 },
                    pit:    { w: 150, h: 60 },
                };
                const def = obsDefs[type];
                if (def) {
                    obstaclesRef.current.push({
                        type,
                        x: canvas.width + 50,
                        y: type === 'pit' ? gy : gy - def.h,
                        w: def.w,
                        h: def.h,
                        width: def.w,
                        height: def.h,
                    });
                }
            }
        }

        // === SPAWN FOOD ===
        foodTimerRef.current++;
        if (foodTimerRef.current > 60 + Math.random() * 80) {
            foodTimerRef.current = 0;
            const foodsPool = char.foodEmojis || ['🍗'];
            const emoji = foodsPool[Math.floor(Math.random() * foodsPool.length)];
            foodsRef.current.push({
                x: canvas.width + 50,
                y: gy - 80 - Math.random() * 180,
                w: 40, h: 40, emoji, type: 'regular',
            });
        }

        // === MOVE OBSTACLES ===
        for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
            const obs = obstaclesRef.current[i];
            obs.x -= currentSpeed;
            if (obs.x + (obs.w || obs.width) < -200) obstaclesRef.current.splice(i, 1);
        }

        // === MOVE FOOD (+ magnet) ===
        const magnetActive = (window.Pack2State?.activePowerups?.magnet || 0) > Date.now();
        for (let i = foodsRef.current.length - 1; i >= 0; i--) {
            const f = foodsRef.current[i];
            f.x -= currentSpeed;
            if (magnetActive && f.x < canvas.width && f.x > 0) {
                const dx = (p.x + p.width / 2) - (f.x + f.w / 2);
                const dy = (p.y + p.height / 2) - (f.y + f.h / 2);
                const dist = Math.hypot(dx, dy);
                if (dist > 1 && dist < 250) {
                    f.x += (dx / dist) * 6;
                    f.y += (dy / dist) * 6;
                }
            }
            if (f.x + f.w < -100) foodsRef.current.splice(i, 1);
        }

        // === MOVE EXPLOSIONS ===
        for (let i = explosionsRef.current.length - 1; i >= 0; i--) {
            const e = explosionsRef.current[i];
            e.timer++;
            if (e.timer > e.maxTimer) explosionsRef.current.splice(i, 1);
        }

        // === FOOD COLLISION (FIX #11: точный счётчик) ===
        const pHitbox = {
            x: p.x + p.width * 0.15, y: p.y + p.height * 0.15,
            w: p.width * 0.7, h: p.height * 0.7,
        };
        for (let i = foodsRef.current.length - 1; i >= 0; i--) {
            const f = foodsRef.current[i];
            if (pHitbox.x < f.x + f.w && pHitbox.x + pHitbox.w > f.x
                && pHitbox.y < f.y + f.h && pHitbox.y + pHitbox.h > f.y) {
                foodsRef.current.splice(i, 1);
                totalFoodEatenRef.current++;
                p.foodEaten++;
                if (char.eatFrameCount > 0) {
                    isEatingRef.current = true;
                    eatTimerRef.current = 0;
                    eatFrameIdxRef.current = 0;
                }
                window.GameEvents.emit('eat', {
                    x: f.x + f.w / 2, y: f.y + f.h / 2,
                    pack1Type: f.type || 'regular',
                    foodType: f.emoji,
                });
            }
        }

        // === OBSTACLE COLLISION ===
        const pBox = {
            x: p.x + p.width * 0.2, y: p.y + p.height * 0.15,
            w: p.width * 0.6, h: p.height * 0.8,
        };
        for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
            const obs = obstaclesRef.current[i];
            const obsW = obs.w || obs.width;
            const obsH = obs.h || obs.height;
            const oBox = { x: obs.x + 5, y: obs.y + 5, w: obsW - 10, h: obsH - 10 };

            if (pBox.x < oBox.x + oBox.w && pBox.x + pBox.w > oBox.x
                && pBox.y < oBox.y + oBox.h && pBox.y + pBox.h > oBox.y) {

                if (obs.type === 'pit') {
                    if (!p.isJumping && !isTrippingRef.current) {
                        isFallingIntoPitRef.current = true;
                        pitTargetRef.current = obs;
                        pitFallTimerRef.current = 0;
                        p.velocityY = 0;
                        p.isJumping = false;
                        p.isHoldingJump = false;
                        if (pitAudioRef.current && settingsRef.current.soundEnabled) {
                            pitAudioRef.current.currentTime = 0;
                            pitAudioRef.current.play().catch(() => {});
                        }
                    }
                } else if (obs.type === 'barrel') {
                    handleBarrelHit(i);
                } else {
                    handleHit(i, obs.type);
                }
                break;
            }
        }

        // === BIOME TRANSITION ===
        if (settingsRef.current.biomesEnabled && window.Pack3State?.nextBiome) {
            const trans = biomeTransitionRef.current;
            if (!trans.active) {
                trans.active = true;
                trans.nextBiome = window.Pack3State.nextBiome;
                trans.alpha = 0;
            } else {
                trans.alpha = Math.min(1, trans.alpha + 0.02);
                if (trans.alpha >= 1) {
                    window.Pack3State.currentBiome = trans.nextBiome;
                    window.Pack3State.nextBiome = null;
                    trans.active = false;
                    trans.alpha = 0;
                    trans.nextBiome = null;
                }
            }
        }
    };

    // === СБОРКА СЦЕНЫ ДЛЯ РЕНДЕРА ===
    const describeScene = () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const p = playerRef.current;
        const isNight = timeOfDayRef.current === 'night';

        let currentBgConfig = BACKGROUNDS[backgroundRef.current] || BACKGROUNDS[Object.keys(BACKGROUNDS)[0]];
        if (settingsRef.current.biomesEnabled && window.Pack3State?.currentBiome) {
            currentBgConfig = window.Pack3State.currentBiome;
        }

        const bgCache = backgroundImagesRef.current;
        const bgImgs = bgCache[currentBgConfig?.id] || bgCache[backgroundRef.current] || {};
        const bgImg = isNight ? bgImgs.night : bgImgs.day;

        const trans = biomeTransitionRef.current;
        let bgNextImg = null, transitionAlpha = 0;
        if (trans.active && trans.nextBiome && bgCache[trans.nextBiome.id]) {
            const nextImgs = bgCache[trans.nextBiome.id];
            bgNextImg = isNight ? nextImgs.night : nextImgs.day;
            transitionAlpha = trans.alpha;
        }

        // Спрайт персонажа (walk / eat)
        let playerImg = null;
        if (isEatingRef.current && eatFramesRef.current.length > 0) {
            playerImg = eatFramesRef.current[eatFrameIdxRef.current % eatFramesRef.current.length];
            if (eatTimerRef.current % 4 === 0) {
                eatFrameIdxRef.current = (eatFrameIdxRef.current + 1) % eatFramesRef.current.length;
            }
        } else if (walkFramesRef.current.length > 0) {
            const now = Date.now();
            if (now - lastFrameTimeRef.current > 100) {
                lastFrameTimeRef.current = now;
                currentFrameRef.current = (currentFrameRef.current + 1) % walkFramesRef.current.length;
            }
            playerImg = walkFramesRef.current[currentFrameRef.current];
        }

        const pickImg = (day, night) => isNight ? night : day;

        // Pit overlay
        let pitOverlay = null;
        if (isFallingIntoPitRef.current && pitTargetRef.current) {
            const pit = pitTargetRef.current;
            pitOverlay = {
                img: pickImg(pitImg.current, pitNightImg.current),
                x: pit.x, y: pit.y,
                w: pit.w || pit.width, h: pit.h || pit.height,
            };
        }

        // FIX #4: deathFade — таймер, не аудио
        let deathFade = null;
        if (isPitDeathDelayRef.current) {
            deathFade = Math.min(1, pitDeathDelayTimerRef.current / 180);
        }

        const player = {
            x: p.x, y: p.y, w: p.width, h: p.height,
            img: playerImg,
            tilt: p.tilt || 0, bob: p.bob || 0,
            isJumping: p.isJumping,
            isTripping: isTrippingRef.current,
            tripTimer: tripTimerRef.current,
            isBarrelTrip: isBarrelTripRef.current,
            isBarrelFlying: isBarrelFlyingRef.current,
            isEating: isEatingRef.current,
            isFallingIntoPit: isFallingIntoPitRef.current,
            skinFilter: getSkinFilter(character, currentSkin),
        };

        return {
            bg: { img: bgImg, offset: bgOffsetRef.current, fallbackColor: isNight ? '#1a1a2a' : '#3a5a4a' },
            bgNext: bgNextImg ? { img: bgNextImg } : null,
            transitionAlpha,
            pitOverlay,
            player,
            foods: foodsRef.current,
            obstacles: obstaclesRef.current,
            explosions: explosionsRef.current,
            images: {
                puddleImg: puddleImg.current, puddleNightImg: puddleNightImg.current,
                rockImg: rockImg.current, rockNightImg: rockNightImg.current,
                pitImg: pitImg.current, pitNightImg: pitNightImg.current,
                barrelImg: barrelImg.current, barrelNightImg: barrelNightImg.current,
                cactusImg: cactusImg.current, cactusNightImg: cactusNightImg.current,
                explosionImg: explosionImg,
                pickImg,
            },
            isPitDeath: isPitDeathDelayRef.current,
            pitTarget: pitTargetRef.current,
            deathFade,
        };
    };

    // === ИГРОВОЙ ЦИКЛ (FIX #2: tick эмитится ЗДЕСЬ, а не в updateLogic) ===
    const lastLoopTimeRef = useRef(0);

    const gameLoop = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            requestRef.current = requestAnimationFrame(gameLoop);
            return;
        }

        if (gameState === 'playing' || gameState === 'paused') {
            if (gameState === 'playing') updateLogic();

            RenderEngine.update();

            const ctx = canvas.getContext('2d');
            const scene = describeScene();
            if (scene) {
                RenderEngine.draw(ctx, canvas, scene);

                window.GameEvents.emit('render_frame', {
                    ctx,
                    player: {
                        x: playerRef.current.x,
                        y: playerRef.current.y,
                        w: playerRef.current.width,
                        h: playerRef.current.height,
                        isFallingIntoPit: isFallingIntoPitRef.current,
                    },
                });
            }

            if (gameState === 'playing') {
                const now = performance.now();
                const delta = lastLoopTimeRef.current ? now - lastLoopTimeRef.current : 16.6;
                lastLoopTimeRef.current = now;

                window.GameEvents.emit('tick', {
                    distance: distanceRef.current,
                    health: healthRef.current,
                    combo: window.Pack1State?.combo || 0,
                    timeOfDay: timeOfDayRef.current,
                    settings: settingsRef.current,
                    delta,
                });
            }
        } else if (gameState === 'gameover') {
            // Один финальный кадр — на случай deathFade / анимаций
            RenderEngine.update();
            const ctx = canvas.getContext('2d');
            const scene = describeScene();
            if (scene) RenderEngine.draw(ctx, canvas, scene);
        }

        requestRef.current = requestAnimationFrame(gameLoop);
    }, [gameState, character, currentSkin]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(gameLoop);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [gameLoop]);

    // Ресайз канваса
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resize = () => {
            const parent = canvas.parentElement;
            if (parent && parent.clientWidth > 0) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
            } else {
                canvas.width = 1280;
                canvas.height = 720;
            }
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    // === МЕНЮ-ТАБ ===
    const [menuTab, setMenuTab] = useState('play');

    // === JSX ===
    return React.createElement('div', { className: `game-container state-${gameState}` },
        React.createElement('canvas', {
            ref: canvasRef,
            className: 'game-canvas',
            style: { display: 'block', width: '100%', height: '100%' },
        }),

        // --- HUD ---
        (gameState === 'playing' || gameState === 'paused') && React.createElement('div', { className: 'game-hud' },
            React.createElement('div', { className: 'hud-left' },
                React.createElement('div', { className: 'hud-score' }, `${score}m`),
                React.createElement('div', { className: 'hud-coins' }, `💰 ${coins}`)
            ),
            React.createElement('div', { className: 'hud-center' },
                React.createElement('div', { className: 'hud-hearts' },
                    Array.from({ length: Math.max(0, health) }).map((_, i) =>
                        React.createElement('span', { key: i, className: 'heart' }, '❤️')
                    )
                )
            ),
            React.createElement('div', { className: 'hud-right' },
                React.createElement('div', { className: 'hud-stat' }, `⚡ ${speedDisplay.toFixed(1)}`),
                React.createElement('div', { className: 'hud-stat' }, `🔥 x${powerDisplay.toFixed(1)}`),
                React.createElement('button', {
                    className: 'hud-btn',
                    onClick: () => setGameState('paused'),
                    onTouchStart: (e) => e.stopPropagation(),
                }, '⏸')
            )
        ),

        // --- MENU ---
        gameState === 'menu' && React.createElement('div', { className: 'menu-overlay' },
            menuTab === 'play' && React.createElement('div', { className: 'menu-panel' },
                React.createElement('h1', { className: 'menu-title' }, '🐊 LACOSTE RUNNER'),
                React.createElement('div', { className: 'menu-subtitle' }, `Рекорд: ${highScore}m`),
                React.createElement('button', {
                    className: 'main-btn',
                    onClick: () => resetGame(),
                }, '▶ ИГРАТЬ'),
                React.createElement('div', { className: 'menu-tabs' },
                    React.createElement('button', { className: 'menu-tab', onClick: () => setMenuTab('shop') }, '🛒 МАГАЗИН'),
                    React.createElement('button', { className: 'menu-tab', onClick: () => setMenuTab('promo') }, '🎁 ПРОМО'),
                    React.createElement('button', { className: 'menu-tab', onClick: () => setMenuTab('leaderboard') }, '🏆 РЕЙТИНГ'),
                    React.createElement('button', {
                        className: 'menu-tab',
                        onClick: () => window.GameEvents.emit('show_achievements'),
                    }, '🏅 ДОСТИЖЕНИЯ')
                ),
                React.createElement('div', { className: 'menu-hint' },
                    React.createElement('span', {}, 'SPACE / TAP — Прыжок'),
                    React.createElement('span', {}, 'N — День/Ночь'),
                    React.createElement('span', {}, 'ESC — Пауза')
                )
            ),
            menuTab === 'shop' && React.createElement('div', { className: 'menu-panel' },
                React.createElement('button', { className: 'back-btn', onClick: () => setMenuTab('play') }, '← НАЗАД'),
                window.Pack4Render?.shop ? React.createElement(window.Pack4Render.shop) : null
            ),
            menuTab === 'promo' && React.createElement('div', { className: 'menu-panel' },
                React.createElement('button', { className: 'back-btn', onClick: () => setMenuTab('play') }, '← НАЗАД'),
                window.Pack4Render?.promo ? React.createElement(window.Pack4Render.promo) : null
            ),
            menuTab === 'leaderboard' && React.createElement('div', { className: 'menu-panel' },
                React.createElement('button', { className: 'back-btn', onClick: () => setMenuTab('play') }, '← НАЗАД'),
                window.Pack4Render?.leaderboard ? React.createElement(window.Pack4Render.leaderboard) : null
            )
        ),

        // --- PAUSE ---
        gameState === 'paused' && React.createElement('div', { className: 'pause-overlay' },
            React.createElement('h2', { className: 'pause-title' }, '⏸ ПАУЗА'),
            React.createElement('button', {
                className: 'main-btn',
                onClick: () => setGameState('playing'),
            }, '▶ ПРОДОЛЖИТЬ'),
            React.createElement('button', {
                className: 'main-btn secondary',
                onClick: () => { setGameState('menu'); setMenuTab('play'); },
            }, '🏠 В МЕНЮ'),
            React.createElement('button', {
                className: 'main-btn secondary',
                onClick: () => toggleFullscreen(),
            }, '⛶ ПОЛНЫЙ ЭКРАН')
        ),

        // --- GAMEOVER ---
        gameState === 'gameover' && React.createElement('div', { className: 'gameover-overlay' },
            React.createElement('h2', { className: 'gameover-title' }, 'GAME OVER'),
            React.createElement('div', { className: 'gameover-score' }, `${score}m`),
            React.createElement('div', { className: 'gameover-best' }, `Рекорд: ${highScore}m`),
            React.createElement('button', {
                className: 'main-btn',
                onClick: () => resetGame(),
            }, '🔄 ЗАНОВО'),
            React.createElement('button', {
                className: 'main-btn secondary',
                onClick: () => window.GameEvents.emit('show_share'),
            }, '📤 ПОДЕЛИТЬСЯ'),
            React.createElement('button', {
                className: 'main-btn secondary',
                onClick: () => { setGameState('menu'); setMenuTab('play'); },
            }, '🏠 В МЕНЮ')
        ),

        // --- PACK UIs (рендерятся поверх канваса) ---
        (window.PackUIs || []).map((UIComponent, i) =>
            React.createElement(UIComponent, { key: `pack-ui-${i}`, gameState })
        )
    );
}
