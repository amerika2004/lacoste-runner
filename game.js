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

// === CONFIG ===
const CONFIG = (window.GAME_CONFIG && window.GAME_CONFIG.physics) ? window.GAME_CONFIG : {
    physics: { gravity: 0.75, jumpForce: -10.5, holdThrust: 0.45, groundY: 530, baseSpeed: 4.0, speedMultiplier: 0.8 },
    defaultSettings: { sfxVolume: 0.7, ambientVolume: 0.25, masterVolume: 1.0, soundEnabled: true, graphics: 'high', comboEnabled: true, comboVisualsEnabled: true, weatherEnabled: true, dynamicMusicEnabled: true, biomesEnabled: true, achievementsEnabled: true, dailyGoalsEnabled: true, hudScale: 1.0, hudOpacity: 0.8 },
    characters: {}, biomes: {}, pack2: {}, pack3: {}, pack4: {}
};
const FLIP_CROC = false;
const GRAVITY = CONFIG.physics.gravity ?? 0.75;
const JUMP_FORCE = CONFIG.physics.jumpForce ?? -10.5;
const HOLD_THRUST = CONFIG.physics.holdThrust ?? 0.45;
const GROUND_Y = CONFIG.physics.groundY ?? 530;
const BASE_SPEED = CONFIG.physics.baseSpeed ?? 4.0;
const SPEED_MULTIPLIER = CONFIG.physics.speedMultiplier ?? 0.8;
const DEFAULT_SETTINGS = CONFIG.defaultSettings;

// === ХЕЛПЕРЫ СТАТОВ (учитывают прокачку) ===
function getStat(charId, statName) {
    const char = CONFIG.characters?.[charId];
    const base = (char?.stats?.[statName]) ?? 1.0;
    const lvl = window.Pack4State?.upgrades?.[charId]?.[statName] || 0;
    return base + lvl * 0.05;
}
function getUpgradeLevel(charId, statName) {
    return window.Pack4State?.upgrades?.[charId]?.[statName] || 0;
}
function isSkinOwned(skinId) {
    if (skinId === 'default') return true;
    return Array.isArray(window.Pack4State?.unlockedSkins) && window.Pack4State.unlockedSkins.includes(skinId);
}

// === РЕНДЕР ДВИЖОК ===
const RenderEngine = (function () {
    const QUALITY = {
        low:    { parallax: false, bloom: false, particles: false, shake: false, trail: false, vignette: false, flash: false, maxParticles: 0 },
        medium: { parallax: true,  bloom: false, particles: true,  shake: true,  trail: false, vignette: false, flash: true,  maxParticles: 200 },
        high:   { parallax: true,  bloom: true,  particles: true,  shake: true,  trail: true,  vignette: true,  flash: true,  maxParticles: 500 }
    };
    const state = { quality: 'high', config: QUALITY.high, particles: [], shakeTime: 0, shakeIntensity: 0, flashAlpha: 0, flashColor: '255,0,0', time: 0, trail: [], cache: { vignetteCanvas: null, particleSprite: null } };
    function makeVignette(width, height) { const c = document.createElement('canvas'); c.width = width; c.height = height; const ctx = c.getContext('2d'); const g = ctx.createRadialGradient(width/2, height/2, Math.min(width,height)*0.3, width/2, height/2, Math.max(width,height)*0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.65)'); ctx.fillStyle = g; ctx.fillRect(0, 0, width, height); return c; }
    function makeParticleSprite() { const c = document.createElement('canvas'); c.width = c.height = 16; const ctx = c.getContext('2d'); const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,200,100,0.6)'); g.addColorStop(1, 'rgba(255,100,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 16); return c; }
    return {
        setQuality(q) { state.quality = q; state.config = QUALITY[q] || QUALITY.high; if (!state.config.particles) state.particles = []; },
        reset() { state.particles = []; state.shakeTime = 0; state.shakeIntensity = 0; state.flashAlpha = 0; state.trail = []; },
        spawnParticles(x, y, count, opts = {}) {
            if (!state.config.particles) return;
            const colors = opts.colors || ['#FF007F', '#00FFFF', '#FFD700', '#FFFFFF'];
            const speed = opts.speed || 6;
            for (let i = 0; i < count && state.particles.length < state.config.maxParticles; i++) {
                const a = Math.random() * Math.PI * 2; const v = Math.random() * speed + 1;
                state.particles.push({ x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v - 1, life: opts.life || 40, maxLife: opts.life || 40, size: (opts.size||4)*(0.6+Math.random()*0.8), color: colors[Math.floor(Math.random()*colors.length)], gravity: opts.gravity != null ? opts.gravity : 0.15, rot: Math.random()*Math.PI*2, rotSpeed: (Math.random()-0.5)*0.3, shape: opts.shape || 'circle' });
            }
        },
        shake(intensity = 8, duration = 20) { if (!state.config.shake) return; state.shakeIntensity = Math.max(state.shakeIntensity, intensity); state.shakeTime = Math.max(state.shakeTime, duration); },
        flash(color = '255,0,0', alpha = 0.5) { if (!state.config.flash) return; state.flashAlpha = alpha; state.flashColor = color; },
        pushTrail(x, y, w, h, img) { if (!state.config.trail || !img) return; state.trail.push({ x, y, w, h, img, life: 12, maxLife: 12 }); if (state.trail.length > 8) state.trail.shift(); },
        update() {
            state.time++;
            for (let i = state.particles.length - 1; i >= 0; i--) { const p = state.particles[i]; p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.vx *= 0.98; p.life--; p.rot += p.rotSpeed; if (p.life <= 0) state.particles.splice(i, 1); }
            if (state.shakeTime > 0) { state.shakeTime--; if (state.shakeTime === 0) state.shakeIntensity = 0; }
            if (state.flashAlpha > 0) state.flashAlpha = Math.max(0, state.flashAlpha - 0.05);
            for (let i = state.trail.length - 1; i >= 0; i--) { state.trail[i].life--; if (state.trail[i].life <= 0) state.trail.splice(i, 1); }
        },
        draw(ctx, canvas, scene) {
            const { config } = state; const W = canvas.width, H = canvas.height;
            let shakeX = 0, shakeY = 0;
            if (config.shake && state.shakeTime > 0) { const k = state.shakeTime / 20; shakeX = (Math.random()-0.5)*state.shakeIntensity*k; shakeY = (Math.random()-0.5)*state.shakeIntensity*k; }
            ctx.save(); ctx.translate(shakeX, shakeY);

            const { bg, bgNext, transitionAlpha } = scene;
            const drawBg = (img, alpha) => {
                if (!img || !img.complete || img.naturalWidth === 0) return;
                ctx.globalAlpha = alpha;
                const scale = H / img.naturalHeight; const exactWidth = Math.ceil(img.naturalWidth * scale);
                if (config.parallax) { ctx.globalAlpha = 0.5 * alpha; let farOffset = Math.floor((bg.offset*0.4) % exactWidth); if (farOffset > 0) farOffset -= exactWidth; for (let i = farOffset; i < W; i += exactWidth) ctx.drawImage(img, i, -10, exactWidth, H + 20); }
                ctx.globalAlpha = alpha;
                let offset = Math.floor(bg.offset % exactWidth); if (offset > 0) offset -= exactWidth;
                for (let i = offset; i < W; i += exactWidth) ctx.drawImage(img, i, 0, exactWidth, H);
                ctx.globalAlpha = 1;
            };

            if (transitionAlpha > 0 && bgNext) { drawBg(bg.img, 1 - transitionAlpha); drawBg(bgNext.img, transitionAlpha); }
            else if (bg.img && bg.img.complete && bg.img.naturalWidth > 0) { drawBg(bg.img, 1); }
            else { ctx.fillStyle = bg.fallbackColor; ctx.fillRect(0, 0, W, H); }

            if (scene.pitOverlay && scene.pitOverlay.img && scene.pitOverlay.img.complete) ctx.drawImage(scene.pitOverlay.img, scene.pitOverlay.x, scene.pitOverlay.y, scene.pitOverlay.w, scene.pitOverlay.h);
            if (config.trail) { state.trail.forEach(t => { const a = (t.life/t.maxLife)*0.4; ctx.save(); ctx.globalAlpha = a; ctx.drawImage(t.img, t.x, t.y, t.w, t.h); ctx.restore(); }); }

            const p = scene.player;
            if (p.img && p.img.complete && p.img.naturalWidth > 0) {
                ctx.save(); let fallAngle = 0, yOffset = 0, flyTilt = 0; let chewScale = 1.0;
                if (p.skinColor) {
                    if (p.skinColor === '#FFD700') ctx.filter = 'sepia(1) saturate(5) hue-rotate(5deg) brightness(1.2)';
                    else if (p.skinColor === '#FF4500') ctx.filter = 'sepia(1) saturate(5) hue-rotate(330deg) brightness(1.1)';
                }
                if (p.isEating) chewScale = 1.0 + Math.sin(Date.now()/80)*0.05;
                if (p.isBarrelFlying) flyTilt = p.tilt;
                if (p.isTripping) {
                    const fallProgress = Math.min(1, p.tripTimer/15);
                    const standProgress = Math.max(0, (p.tripTimer-40)/80);
                    const flatAmount = fallProgress * (1 - standProgress);
                    const dir = p.isBarrelTrip ? (FLIP_CROC ? 1 : -1) : (FLIP_CROC ? -1 : 1);
                    fallAngle = dir * (Math.PI/2) * flatAmount;
                    yOffset = -((p.w - p.h)/2) * flatAmount;
                    if (Math.floor(p.tripTimer/10) % 2 === 1) ctx.globalAlpha = 0.5;
                }
                const centerX = p.x + p.w/2;
                const centerY = p.y + p.h/2 + (p.isJumping ? 0 : (p.isTripping ? yOffset : p.bob));
                ctx.translate(centerX, centerY); ctx.rotate(p.tilt + fallAngle + flyTilt);
                if (FLIP_CROC) ctx.scale(-1, 1);
                const dW = p.w * chewScale, dH = p.h * chewScale;
                ctx.drawImage(p.img, -dW/2, -dH/2, dW, dH);
                ctx.restore();
            } else { ctx.fillStyle = 'red'; ctx.fillRect(p.x, p.y, p.w, p.h); }

            ctx.save(); ctx.globalAlpha = 1.0; ctx.textBaseline = 'bottom';
            scene.foods.forEach(f => { ctx.font = `40px Arial`; ctx.fillText(f.emoji, f.x, f.y + f.h); });
            ctx.restore();

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
                const progress = expl.timer / expl.maxTimer; const scale = 1 + progress*0.5; const alpha = 1 - progress;
                const size = expl.size * scale; const x = expl.x - size/2, y = expl.y - size/2;
                if (images.explosionImg.current && images.explosionImg.current.complete) { ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(images.explosionImg.current, x, y, size, size); ctx.restore(); }
                else { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = 'orange'; ctx.beginPath(); ctx.arc(expl.x, expl.y, size/2, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = 'yellow'; ctx.beginPath(); ctx.arc(expl.x, expl.y, size/4, 0, Math.PI*2); ctx.fill(); ctx.restore(); }
            });

            if (config.particles) {
                if (!state.cache.particleSprite) state.cache.particleSprite = makeParticleSprite();
                const sprite = state.cache.particleSprite;
                state.particles.forEach(pt => {
                    const a = pt.life / pt.maxLife; ctx.save(); ctx.globalAlpha = a;
                    if (pt.shape === 'circle') { ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size*a, 0, Math.PI*2); ctx.fill(); }
                    else if (pt.shape === 'leaf') { ctx.translate(pt.x, pt.y); ctx.rotate(pt.rot); ctx.fillStyle = pt.color; ctx.beginPath(); ctx.ellipse(0, 0, pt.size, pt.size*0.5, 0, 0, Math.PI*2); ctx.fill(); }
                    else if (pt.shape === 'spark') { ctx.drawImage(sprite, pt.x - pt.size, pt.y - pt.size, pt.size*2, pt.size*2); }
                    ctx.restore();
                });
            }

            if (config.bloom) {
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                scene.obstacles.forEach(obs => { if (obs.type === 'barrel') { const cx = obs.x+obs.w/2, cy = obs.y+obs.h/2; const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, obs.w*1.5); grad.addColorStop(0, 'rgba(255,150,50,0.3)'); grad.addColorStop(1, 'rgba(255,150,50,0)'); ctx.fillStyle = grad; ctx.fillRect(cx-obs.w*1.5, cy-obs.w*1.5, obs.w*3, obs.w*3); } });
                scene.foods.forEach(f => { if (f.emoji === '🎋') { const cx = f.x+f.w/2, cy = f.y+f.h/2; const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30); grad.addColorStop(0, 'rgba(120,255,120,0.35)'); grad.addColorStop(1, 'rgba(120,255,120,0)'); ctx.fillStyle = grad; ctx.fillRect(cx-30, cy-30, 60, 60); } });
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

const CHARACTERS = CONFIG.characters || {};
const BACKGROUNDS = CONFIG.biomes || {};

// === GAME COMPONENT ===
function Game() {
    // ----- UI state -----
    const [gameState, setGameState] = useState('menu');
    const [timeOfDay, setTimeOfDay] = useState(() => localStorage.getItem('lacosteTimeOfDay') || 'day');
    const [background, setBackground] = useState(() => {
        const saved = localStorage.getItem('lacosteBackground');
        return (saved && BACKGROUNDS[saved]) ? saved : Object.keys(BACKGROUNDS)[0];
    });
    const [character, setCharacter] = useState(() => {
        const saved = localStorage.getItem('lacosteCharacter');
        return (saved && CHARACTERS[saved]) ? saved : Object.keys(CHARACTERS)[0];
    });
    const [currentSkin, setCurrentSkin] = useState(() => localStorage.getItem('lacosteSkin') || 'default');

    const [score, setScore] = useState(0);
    const [speedDisplay, setSpeedDisplay] = useState(1.0);
    const [powerDisplay, setPowerDisplay] = useState(1.0);
    const [health, setHealth] = useState(6);
    const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('lacosteHighScore')) || 0);
    const [coins, setCoins] = useState(() => parseInt(localStorage.getItem('lacosteCoins')) || 0);

    const [settings, setSettings] = useState(() => {
        try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('lacosteSettings') || '{}') }; }
        catch { return { ...DEFAULT_SETTINGS }; }
    });
    const [showSettings, setShowSettings] = useState(false);
    const [showCustomization, setShowCustomization] = useState(false);
    const [customTab, setCustomTab] = useState('characters'); // characters | skins | upgrades
    const [, forceCustomUpdate] = React.useReducer(x => x + 1, 0);

    // ---- Combo ----
    const comboRef = useRef(0);
    const comboMultRef = useRef(1);

    // ---- Settings persistence ----
    useEffect(() => {
        localStorage.setItem('lacosteSettings', JSON.stringify(settings));
        RenderEngine.setQuality(settings.graphics);
    }, [settings]);
    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    // ---- Coins sync from shop ----
    useEffect(() => {
        const sync = () => setCoins(parseInt(localStorage.getItem('lacosteCoins')) || 0);
        window.GameEvents.on('pack4_coins_updated', sync);
        return () => {
            if (window.GameEvents.listeners['pack4_coins_updated']) {
                window.GameEvents.listeners['pack4_coins_updated'] = window.GameEvents.listeners['pack4_coins_updated'].filter(cb => cb !== sync);
            }
        };
    }, []);

    // ---- refs ----
    const canvasRef = useRef(null);
    const requestRef = useRef();
    const timeOfDayRef = useRef(timeOfDay);
    const backgroundRef = useRef(background);
    const groundYRef = useRef(GROUND_Y + (BACKGROUNDS[background]?.groundOffset || 0));

    useEffect(() => { timeOfDayRef.current = timeOfDay; localStorage.setItem('lacosteTimeOfDay', timeOfDay); }, [timeOfDay]);
    useEffect(() => {
        backgroundRef.current = background;
        localStorage.setItem('lacosteBackground', background);
        const bg = BACKGROUNDS[background] || BACKGROUNDS[Object.keys(BACKGROUNDS)[0]];
        groundYRef.current = GROUND_Y + (bg.groundOffset || 0);
    }, [background]);

    // ---- frames ----
    const walkFramesRef = useRef([]);
    const currentFrameRef = useRef(0);
    const lastFrameTimeRef = useRef(0);
    const eatFramesRef = useRef([]);
    const eatFrameIdxRef = useRef(0);
    const isEatingRef = useRef(false);
    const eatTimerRef = useRef(0);
    const eatSpeedFactorRef = useRef(1.0);

    // Load frames on character/skin change
    useEffect(() => {
        localStorage.setItem('lacosteCharacter', character);
        localStorage.setItem('lacosteSkin', currentSkin);
        walkFramesRef.current = []; currentFrameRef.current = 0;
        eatFramesRef.current = []; eatFrameIdxRef.current = 0;
        isEatingRef.current = false; eatTimerRef.current = 0; eatSpeedFactorRef.current = 1.0;
        const char = CHARACTERS[character] || CHARACTERS[Object.keys(CHARACTERS)[0]];
        if (!char) return;
        for (let i = 1; i <= (char.frameCount || 1); i++) {
            const img = new Image(); img.src = `${char.folder}/${i}.png`; walkFramesRef.current.push(img);
        }
        if (char.eatFolder && char.eatFrameCount) {
            for (let i = 1; i <= char.eatFrameCount; i++) {
                const img = new Image(); img.src = `${char.eatFolder}/${i}.png`; eatFramesRef.current.push(img);
            }
        }
    }, [character, currentSkin]);

    // ---- audio ----
    const pitAudioRef = useRef(null); const pitAudioEndedRef = useRef(false);
    const barrelAudioRef = useRef(null); const splashAudioRef = useRef(null);
    const nightAmbientRef = useRef(null); const dayAmbientRef = useRef(null);

    useEffect(() => {
        const pit = new Audio('source/sounds/fall_in_pit.wav'); pit.preload = 'auto'; pitAudioRef.current = pit;
        const barrel = new Audio('source/sounds/barrel_explosion.wav'); barrel.preload = 'auto'; barrelAudioRef.current = barrel;
        const splash = new Audio('source/sounds/splash.wav'); splash.preload = 'auto'; splash.playbackRate = 1.2; splashAudioRef.current = splash;
        const night = new Audio('source/sounds/night_forest.mp3'); night.loop = true; night.preload = 'auto'; nightAmbientRef.current = night;
        const day = new Audio('source/sounds/forest_day.wav'); day.loop = true; day.preload = 'auto'; dayAmbientRef.current = day;
        return () => { [pit, barrel, splash, night, day].forEach(a => { a.pause(); a.src = ''; }); };
    }, []);

    useEffect(() => {
        const s = settings;
        [pitAudioRef, barrelAudioRef, splashAudioRef].forEach(r => { if (r.current) r.current.volume = s.soundEnabled ? s.sfxVolume * s.masterVolume : 0; });
        [nightAmbientRef, dayAmbientRef].forEach(r => { if (r.current) r.current.volume = s.soundEnabled ? s.ambientVolume * s.masterVolume : 0; });
    }, [settings]);

    // ---- player and world refs ----
    const initChar = CHARACTERS[character] || CHARACTERS[Object.keys(CHARACTERS)[0]] || { baseWidth: 165, baseHeight: 110, stats: { speed: 1, jump: 1, luck: 1 } };
    const initGroundY = GROUND_Y + (BACKGROUNDS[background]?.groundOffset || 0);
    const playerRef = useRef({ x: 100, y: initGroundY - initChar.baseHeight, w: initChar.baseWidth, h: initChar.baseHeight, velocityY: 0, isJumping: false, isHoldingJump: false, jumpMult: 1.0, tilt: 0, bob: 0, foodEaten: 0, foodTarget: 1 });

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

    // image refs
    const puddleImg = useRef(new Image()); const puddleNightImg = useRef(new Image());
    const rockImg = useRef(new Image()); const rockNightImg = useRef(new Image());
    const pitImg = useRef(new Image()); const pitNightImg = useRef(new Image());
    const barrelImg = useRef(new Image()); const barrelNightImg = useRef(new Image());
    const cactusImg = useRef(new Image()); const cactusNightImg = useRef(new Image());
    const explosionImg = useRef(new Image());
    const backgroundImagesRef = useRef({});

    useEffect(() => {
        Object.values(BACKGROUNDS).forEach(bg => {
            const day = new Image(); day.src = bg.dayImg;
            const night = new Image(); night.src = bg.nightImg;
            backgroundImagesRef.current[bg.id] = { day, night };
        });
        if (CONFIG.pack3 && CONFIG.pack3.biomes) {
            CONFIG.pack3.biomes.forEach(bg => {
                const day = new Image(); day.src = bg.dayImg;
                const night = new Image(); night.src = bg.nightImg;
                backgroundImagesRef.current[bg.id] = { day, night };
            });
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

    // === STATS (с учётом прокачки) ===
    const calculateJumpMultiplier = (playerHeight, gameSpeed, penalty = 1.0) => {
        const char = CHARACTERS[character] || CHARACTERS[Object.keys(CHARACTERS)[0]];
        const sizeFactor = Math.sqrt(playerHeight / (char?.baseHeight || 110));
        const speedFactor = 1 + (gameSpeed - 1) * 0.10;
        const statJump = getStat(character, 'jump');
        return Math.max(1.0, sizeFactor * speedFactor * penalty * statJump);
    };
    const getSpeedStat = () => getStat(character, 'speed');
    const getLuckStat = () => getStat(character, 'luck');

    // === COMBO ===
    const resetCombo = () => { comboRef.current = 0; comboMultRef.current = 1; window.GameEvents.emit('combo_changed', { mult: 0, count: 0 }); };
    const addCombo = () => {
        comboRef.current++;
        let mult = 1;
        if (comboRef.current >= 20) mult = 10;
        else if (comboRef.current >= 10) mult = 5;
        else if (comboRef.current >= 5) mult = 3;
        else if (comboRef.current >= 3) mult = 2;
        comboMultRef.current = mult;
        window.GameEvents.emit('combo_changed', { mult: comboRef.current, count: comboRef.current });
    };

    // === KEYBOARD ===
    const konamiRef = useRef([]);
    const handleKeyDown = useCallback((e) => {
        konamiRef.current.push(e.code);
        if (konamiRef.current.length > 10) konamiRef.current.shift();
        const konamiCode = (CONFIG.pack4?.secrets?.konami?.code) || ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];
        if (JSON.stringify(konamiRef.current) === JSON.stringify(konamiCode)) {
            if (window.Pack4State) {
                window.Pack4State.cheatInvincible = Date.now() + ((CONFIG.pack4?.secrets?.konami?.duration) || 10000);
                window.GameEvents.emit('pack4_toast', { text: '🔱 CHEAT ACTIVATED! 10s INVINCIBILITY', type: 'danger' });
                konamiRef.current = [];
            }
        }
        if (e.code === 'Escape') {
            e.preventDefault();
            if (showSettings) { setShowSettings(false); return; }
            if (showCustomization) { setShowCustomization(false); return; }
            if (isFallingIntoPitRef.current || isPitDeathDelayRef.current) return;
            if (gameState === 'playing') setGameState('paused');
            else if (gameState === 'paused') setGameState('playing');
            return;
        }
        if (e.code === 'KeyN') { e.preventDefault(); setTimeOfDay(p => p === 'day' ? 'night' : 'day'); return; }
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            if (gameState === 'menu') setGameState('playing');
            else if (gameState === 'gameover') resetGame();
            else if (gameState === 'playing' && !playerRef.current.isJumping && !isTrippingRef.current && !isFallingIntoPitRef.current && !isPitDeathDelayRef.current && !isBarrelFlyingRef.current && !isEatingRef.current) {
                const p = playerRef.current;
                const baseMult = 1.0 + Math.floor(distanceRef.current / 100) * 0.04;
                p.jumpMult = calculateJumpMultiplier(p.h, baseMult, speedPenaltyRef.current);
                p.velocityY = JUMP_FORCE * p.jumpMult; p.isJumping = true; p.isHoldingJump = true; addCombo();
                window.GameEvents.emit('jump', { x: p.x + p.w/2, y: p.y });
                RenderEngine.spawnParticles(p.x + p.w/2, p.y + p.h, 6, { colors: ['#FFFFFF','#AAAAAA'], speed: 2, life: 20, size: 2, gravity: 0.1 });
            }
        }
    }, [gameState, character, showSettings, showCustomization]);
    const handleKeyUp = useCallback((e) => { if (e.code === 'Space' || e.code === 'ArrowUp') playerRef.current.isHoldingJump = false; }, []);
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, [handleKeyDown, handleKeyUp]);

    // === TOUCH ===
    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const isUI = (t) => t.closest && (t.closest('.game-btn') || t.closest('.btn') || t.closest('.char-btn') || t.closest('.settings-panel') || t.closest('.settings-open-btn') || t.closest('.pack2-inventory') || t.closest('.pack3-ui') || t.closest('.customization-panel') || t.closest('.pack4-overlay') || t.closest('.customization-overlay'));
        const handleTouchStart = (e) => {
            if (isUI(e.target)) return;
            e.preventDefault();
            if (gameState !== 'playing') return;
            if (playerRef.current.isJumping || isTrippingRef.current || isFallingIntoPitRef.current || isPitDeathDelayRef.current || isBarrelFlyingRef.current || isEatingRef.current) return;
            const p = playerRef.current;
            const baseMult = 1.0 + Math.floor(distanceRef.current / 100) * 0.04;
            p.jumpMult = calculateJumpMultiplier(p.h, baseMult, speedPenaltyRef.current);
            p.velocityY = JUMP_FORCE * p.jumpMult; p.isJumping = true; p.isHoldingJump = true; addCombo();
            window.GameEvents.emit('jump', { x: p.x + p.w/2, y: p.y });
            RenderEngine.spawnParticles(p.x + p.w/2, p.y + p.h, 6, { colors: ['#FFFFFF','#AAAAAA'], speed: 2, life: 20, size: 2, gravity: 0.1 });
        };
        const handleTouchEnd = (e) => { if (isUI(e.target)) return; if (gameState !== 'playing') return; e.preventDefault(); playerRef.current.isHoldingJump = false; };
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
        return () => { canvas.removeEventListener('touchstart', handleTouchStart); canvas.removeEventListener('touchend', handleTouchEnd); canvas.removeEventListener('touchcancel', handleTouchEnd); };
    }, [gameState, character]);

    // === RESET GAME (со стартовыми баффами) ===
    const resetGame = () => {
        const char = CHARACTERS[character] || CHARACTERS[Object.keys(CHARACTERS)[0]];
        const gy = groundYRef.current;
        const skinData = char.skins?.find(s => s.id === currentSkin);
        const skinColor = skinData?.color || null;

        // стартовые HP + баффы
        let startHp = 6;
        if (window.Pack4State?.boughtBuffs?.includes('start_hp')) startHp = 8;

        playerRef.current = {
            x: 100, y: gy - char.baseHeight, w: char.baseWidth, h: char.baseHeight,
            velocityY: 0, isJumping: false, isHoldingJump: false, jumpMult: 1.0,
            tilt: 0, bob: 0, foodEaten: 0, foodTarget: 1, skinColor
        };
        obstaclesRef.current = []; foodsRef.current = []; explosionsRef.current = [];
        distanceRef.current = 0; spawnTimerRef.current = 0; foodTimerRef.current = 0;
        bgOffsetRef.current = 0; currentFrameRef.current = 0; spawnCooldownRef.current = 0;
        healthRef.current = startHp; setHealth(startHp);
        isTrippingRef.current = false; tripTimerRef.current = 0; speedPenaltyRef.current = 1.0;
        isBarrelTripRef.current = false; pendingBarrelDamageRef.current = false;
        isBarrelFlyingRef.current = false; barrelFlyVelocityYRef.current = 0;
        isFallingIntoPitRef.current = false; pitTargetRef.current = null;
        pitFallTimerRef.current = 0; pitVelocityRef.current = 0;
        isPitDeathDelayRef.current = false; pitDeathDelayTimerRef.current = 0;
        isEatingRef.current = false; eatTimerRef.current = 0; eatFrameIdxRef.current = 0; eatSpeedFactorRef.current = 1.0;
        if (pitAudioRef.current) { pitAudioRef.current.pause(); pitAudioRef.current.currentTime = 0; }
        biomeTransitionRef.current = { active: false, nextBiome: null, alpha: 0 };
        resetCombo(); RenderEngine.reset();
        setScore(0); setSpeedDisplay(1.0); setPowerDisplay(1.0); setGameState('playing');

        if (window.Pack4State) {
            window.Pack4State.reviveUsed = false;
            if (window.Pack4State.boughtBuffs?.includes('start_combo')) {
                comboRef.current = 5; comboMultRef.current = 3;
                window.GameEvents.emit('combo_changed', { mult: 3, count: 5 });
            }
        }

        window.GameEvents.emit('start', {
            character, background, timeOfDay,
            settings: settingsRef.current
        });
    };

    // === GAME OVER ===
    const handleGameOver = () => {
        RenderEngine.reset();
        if (pitAudioRef.current) pitAudioRef.current.pause();
        setGameState('gameover');
        if (Math.floor(distanceRef.current) > highScore) {
            const newHigh = Math.floor(distanceRef.current);
            setHighScore(newHigh);
            localStorage.setItem('lacosteHighScore', newHigh);
        }
        const stats = JSON.parse(localStorage.getItem('lacostePlayerStats') || '{}');
        stats.totalRuns = (stats.totalRuns || 0) + 1;
        stats.totalDistance = (stats.totalDistance || 0) + Math.floor(distanceRef.current);
        stats.totalJumps = (stats.totalJumps || 0) + (window.Pack3State?.runStats?.jumps || 0);
        stats.totalFood = (stats.totalFood || 0) + playerRef.current.foodEaten;
        localStorage.setItem('lacostePlayerStats', JSON.stringify(stats));
        window.GameEvents.emit('gameover', { distance: Math.floor(distanceRef.current), health: healthRef.current, character, background, timeOfDay });
    };

    // === HIT HANDLER ===
    const handleHit = (index, type) => {
        if (isTrippingRef.current) return;
        if (window.Pack4State?.cheatInvincible > Date.now()) { obstaclesRef.current.splice(index, 1); RenderEngine.flash('0,255,255', 0.3); return; }
        if (window.Pack2State?.hasShield) {
            window.Pack2State.hasShield = false;
            obstaclesRef.current.splice(index, 1);
            window.GameEvents.emit('shield_break', { x: playerRef.current.x, y: playerRef.current.y });
            return;
        }
        obstaclesRef.current.splice(index, 1);
        healthRef.current -= 1; setHealth(healthRef.current);
        if (healthRef.current <= 0) {
            if (window.Pack4State?.boughtBuffs?.includes('revive') && !window.Pack4State.reviveUsed) {
                window.Pack4State.reviveUsed = true;
                healthRef.current = 3; setHealth(3);
                RenderEngine.flash('255,0,255', 0.8); RenderEngine.shake(20, 30);
                window.GameEvents.emit('pack4_toast', { text: '💖 SECOND CHANCE ACTIVATED!', type: 'success' });
                RenderEngine.spawnParticles(playerRef.current.x + playerRef.current.w/2, playerRef.current.y + playerRef.current.h/2, 50, { colors: ['#FF007F','#FFFFFF'], speed: 8, life: 40, size: 4, gravity: 0.1 });
            } else { handleGameOver(); return; }
        }
        if (type === 'puddle' && splashAudioRef.current && settingsRef.current.soundEnabled) { splashAudioRef.current.currentTime = 0; splashAudioRef.current.play().catch(() => {}); }
        RenderEngine.flash('255,0,0', 0.4); RenderEngine.shake(6, 12);
        RenderEngine.spawnParticles(playerRef.current.x + playerRef.current.w/2, playerRef.current.y + playerRef.current.h/2, 15, { colors: ['#FF007F','#FFFFFF'], speed: 4, life: 25, size: 3, gravity: 0.15 });
        resetCombo();
        window.GameEvents.emit('hit', { type });
    };

    // === GAME LOOP ===
    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let lastTime = performance.now();

        const loop = (now) => {
            const delta = Math.min(50, now - lastTime); lastTime = now;
            if (gameState === 'playing') updateGame(delta);
            drawGame(ctx);
            RenderEngine.update();
            requestRef.current = requestAnimationFrame(loop);
        };
        requestRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(requestRef.current);
    }, [gameState, character, background, timeOfDay, currentSkin]);

    const updateGame = (delta) => {
        const p = playerRef.current; if (!p) return;
        const char = CHARACTERS[character];
        const speedStat = getSpeedStat();
        const luckStat = getLuckStat();
        const startSpeedBuff = window.Pack4State?.boughtBuffs?.includes('start_speed') ? 1.05 : 1.0;
        const baseMult = 1.0 + Math.floor(distanceRef.current / 100) * 0.04;
        const gameSpeed = (BASE_SPEED * speedStat * startSpeedBuff) / BASE_SPEED; // effective multiplier

        // === PHYSICS ===
        if (!p.isJumping && !isTrippingRef.current && !isBarrelFlyingRef.current && !isFallingIntoPitRef.current && !isEatingRef.current) {
            // walking bob
            p.bob = Math.sin(Date.now() / 120) * 3;
        } else {
            p.bob = 0;
        }

        if (p.isHoldingJump && p.velocityY < 0) { p.velocityY += HOLD_THRUST; }

        p.velocityY += GRAVITY;
        p.y += p.velocityY;
        const gy = groundYRef.current;
        if (p.y + p.h >= gy) {
            if (isFallingIntoPitRef.current) {
                // handled elsewhere
            } else {
                p.y = gy - p.h; p.velocityY = 0;
                if (p.isJumping) { p.isJumping = false; p.jumpMult = 1.0; }
            }
        }

        // === SPEED → distance ===
        const speedRate = SPEED_MULTIPLIER * speedStat * startSpeedBuff * baseMult;
        distanceRef.current += speedRate;
        setSpeedDisplay(speedStat);
        setPowerDisplay(startSpeedBuff);
        setScore(Math.floor(distanceRef.current));
        bgOffsetRef.current += speedRate * 1.2;

        // === SPAWN OBSTACLES ===
        spawnTimerRef.current -= delta;
        spawnCooldownRef.current -= delta;
        if (spawnTimerRef.current <= 0 && spawnCooldownRef.current <= 0) {
            const biomesList = CONFIG.pack3?.biomes || [];
            const currentBiome = biomesList.reduce((acc, b) => (distanceRef.current >= b.distance ? b : acc), biomesList[0]);
            const types = currentBiome?.obstacleTypes || ['barrel','rock','cactus','puddle','pit'];
            const type = types[Math.floor(Math.random() * types.length)];
            let w = 60, h = 60, y = gy - 60;
            if (type === 'puddle') { w = 80; h = 25; y = gy - 25; }
            else if (type === 'pit') { w = 80; h = 30; y = gy; }
            else if (type === 'barrel') { w = 50; h = 60; }
            else if (type === 'rock') { w = 70; h = 50; }
            else if (type === 'cactus') { w = 40; h = 70; y = gy - 70; }
            obstaclesRef.current.push({ x: canvasRef.current.width + 60, y, w, h, type });
            spawnTimerRef.current = 900 + Math.random() * 900;
        }

        // === SPAWN FOOD ===
        foodTimerRef.current -= delta;
        if (foodTimerRef.current <= 0) {
            const char = CHARACTERS[character];
            const emojis = char?.foodEmojis || ['🍗'];
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            foodsRef.current.push({ x: canvasRef.current.width + 60, y: gy - 120 - Math.random() * 80, w: 40, h: 40, emoji });
            foodTimerRef.current = 1200 + Math.random() * 1400 / luckStat;
        }

        // === MOVE & COLLIDE ===
        obstaclesRef.current = obstaclesRef.current.filter(obs => {
            obs.x -= speedRate * 2.2;
            // collision
            if (obs.x < p.x + p.w && obs.x + obs.w > p.x && obs.y < p.y + p.h && obs.y + obs.h > p.y) {
                if (obs.type === 'pit') {
                    // handled: if player above pit, start falling
                    if (!p.isJumping && !isFallingIntoPitRef.current) {
                        isFallingIntoPitRef.current = true; pitTargetRef.current = obs;
                        pitVelocityRef.current = 0;
                    }
                } else if (!p.isJumping && !isTrippingRef.current) {
                    handleHit(obstaclesRef.current.indexOf(obs), obs.type);
                }
            }
            return obs.x > -200;
        });

        foodsRef.current = foodsRef.current.filter(f => {
            f.x -= speedRate * 2.2;
            // magnet
            if (window.Pack2State?.activePowerups?.magnet > Date.now()) {
                const dx = (p.x + p.w/2) - (f.x + f.w/2);
                const dy = (p.y + p.h/2) - (f.y + f.h/2);
                f.x += dx * 0.06; f.y += dy * 0.06;
            }
            if (f.x < p.x + p.w && f.x + f.w > p.x && f.y < p.y + p.h && f.y + f.h > p.y) {
                p.foodEaten++; setHealth(h => h);
                addCombo();
                window.GameEvents.emit('eat', { x: f.x, y: f.y });
                RenderEngine.spawnParticles(f.x + f.w/2, f.y + f.h/2, 8, { colors: ['#FFD700','#FFFFFF'], speed: 3, life: 20, size: 3, gravity: 0.1 });
                return false;
            }
            return f.x > -100;
        });

        // === PIT FALL ===
        if (isFallingIntoPitRef.current && pitTargetRef.current) {
            pitVelocityRef.current += 0.9;
            p.y += pitVelocityRef.current;
            p.tilt += 0.05;
            if (!pitAudioEndedRef.current && pitAudioRef.current) {
                pitAudioRef.current.play().catch(() => {});
                pitAudioEndedRef.current = true;
            }
            if (p.y > canvasRef.current.height + 100) {
                handleGameOver();
            }
        }
    };

    const drawGame = (ctx) => {
        const canvas = canvasRef.current; if (!canvas) return;
        const W = canvas.width, H = canvas.height;
        if (W === 0 || H === 0) return;

        // Frames
        const char = CHARACTERS[character];
        const frames = walkFramesRef.current;
        if (frames.length > 0) {
            const now = Date.now();
            if (now - lastFrameTimeRef.current > 80) {
                currentFrameRef.current = (currentFrameRef.current + 1) % frames.length;
                lastFrameTimeRef.current = now;
            }
            playerRef.current.img = frames[currentFrameRef.current];
        }

        const bg = BACKGROUNDS[background] || BACKGROUNDS[Object.keys(BACKGROUNDS)[0]];
        const bgImgs = backgroundImagesRef.current[bg?.id] || {};
        const bgImg = timeOfDay === 'day' ? bgImgs.day : bgImgs.night;

        // biome transition (disabled for now — only default biome)
        const scene = {
            player: playerRef.current,
            obstacles: obstaclesRef.current,
            foods: foodsRef.current,
            explosions: explosionsRef.current,
            bg: { img: bgImg, offset: bgOffsetRef.current, fallbackColor: timeOfDay === 'day' ? '#87CEEB' : '#0b1020' },
            bgNext: null,
            transitionAlpha: 0,
            images: { puddleImg: puddleImg.current, puddleNightImg: puddleNightImg.current, pitImg: pitImg.current, pitNightImg: pitNightImg.current, rockImg: rockImg.current, rockNightImg: rockNightImg.current, barrelImg: barrelImg.current, barrelNightImg: barrelNightImg.current, cactusImg: cactusImg.current, cactusNightImg: cactusNightImg.current, explosionImg },
            pickImg: (day, night) => timeOfDay === 'day' ? day : night,
            isPitDeath: false, pitTarget: pitTargetRef.current,
            deathFade: isFallingIntoPitRef.current ? Math.min(0.8, pitFallTimerRef.current / 60) : null
        };
        RenderEngine.draw(ctx, canvas, scene);
        window.GameEvents.emit('render_frame', { ctx, player: playerRef.current });
    };

    // === CUSTOMIZATION UI ===
    const renderCharacterList = () => Object.entries(CHARACTERS).map(([id, c]) =>
        React.createElement('div', {
            key: id,
            className: `char-card ${character === id ? 'selected' : ''}`,
            onClick: () => { setCharacter(id); localStorage.setItem('lacosteCharacter', id); forceCustomUpdate(); }
        },
            React.createElement('div', { className: 'char-emoji' }, c.emoji || '🐾'),
            React.createElement('div', { className: 'char-name' }, c.name || id),
            React.createElement('div', { className: 'char-stats' },
                `⚡${(c.stats?.speed ?? 1).toFixed(2)}  🦘${(c.stats?.jump ?? 1).toFixed(2)}  🍀${(c.stats?.luck ?? 1).toFixed(2)}`
            )
        )
    );

    const renderSkinList = () => {
        const char = CHARACTERS[character]; if (!char) return null;
        const skins = char.skins || [{ id: 'default', name: 'Original', price: 0 }];
        return skins.map(skin => {
            const owned = isSkinOwned(skin.id) || skin.price === 0;
            const active = currentSkin === skin.id;
            return React.createElement('div', {
                key: skin.id,
                className: `skin-card ${active ? 'selected' : ''} ${owned ? 'owned' : 'locked'}`,
                onClick: () => {
                    if (owned) {
                        setCurrentSkin(skin.id); localStorage.setItem('lacosteSkin', skin.id);
                    } else if (window.Pack4State) {
                        // попытка покупки через Pack4 (скины в магазине)
                        const price = skin.price || 0;
                        if (window.Pack4State.coins < price) {
                            window.GameEvents.emit('pack4_toast', { text: '❌ Not enough coins!', type: 'danger' });
                            return;
                        }
                        window.Pack4State.coins -= price;
                        if (!window.Pack4State.unlockedSkins.includes(skin.id)) window.Pack4State.unlockedSkins.push(skin.id);
                        localStorage.setItem('lacosteCoins', window.Pack4State.coins);
                        localStorage.setItem('lacosteSkins', JSON.stringify(window.Pack4State.unlockedSkins));
                        window.GameEvents.emit('pack4_coins_updated');
                        window.GameEvents.emit('pack4_toast', { text: '✅ Skin unlocked!', type: 'success' });
                        setCoins(window.Pack4State.coins);
                        setCurrentSkin(skin.id); localStorage.setItem('lacosteSkin', skin.id);
                    }
                    forceCustomUpdate();
                }
            },
                React.createElement('div', { className: 'skin-icon' }, skin.id === 'gold' ? '👑' : skin.id === 'red' ? '🔴' : '🎨'),
                React.createElement('div', { className: 'skin-name' }, skin.name),
                React.createElement('div', { className: 'skin-status' }, active ? '✅ EQUIPPED' : owned ? 'EQUIP' : `💰 ${skin.price}`)
            );
        });
    };

    const renderUpgradeList = () => {
        const char = CHARACTERS[character]; if (!char) return null;
        const stats = [
            { id: 'speed', name: 'Speed', icon: '⚡', base: char.stats?.speed ?? 1.0, price: 500 },
            { id: 'jump',  name: 'Jump',  icon: '🦘', base: char.stats?.jump  ?? 1.0, price: 500 },
            { id: 'luck',  name: 'Luck',  icon: '🍀', base: char.stats?.luck  ?? 1.0, price: 500 },
        ];
        return stats.map(stat => {
            const lvl = getUpgradeLevel(character, stat.id);
            const current = stat.base + lvl * 0.05;
            return React.createElement('div', { key: stat.id, className: 'upgrade-row' },
                React.createElement('div', { className: 'upgrade-info' },
                    React.createElement('span', { className: 'upgrade-icon' }, stat.icon),
                    React.createElement('span', { className: 'upgrade-name' }, stat.name),
                    React.createElement('span', { className: 'upgrade-level' }, `Lv.${lvl}`)
                ),
                React.createElement('div', { className: 'upgrade-bar' },
                    React.createElement('span', null, `Base: ${stat.base.toFixed(2)}`),
                    React.createElement('span', null, '→'),
                    React.createElement('span', { className: 'upgrade-current' }, current.toFixed(2))
                ),
                React.createElement('button', {
                    className: 'upgrade-buy-btn',
                    onClick: () => {
                        if (window.Pack4State) {
                            window.Pack4State.buyUpgrade(character, stat.id, stat.price);
                            setCoins(parseInt(localStorage.getItem('lacosteCoins')) || 0);
                            forceCustomUpdate();
                        }
                    }
                }, `💰 ${stat.price}`)
            );
        });
    };

    const renderCustomization = () => {
        if (!showCustomization) return null;
        return React.createElement('div', { className: 'customization-overlay' },
            React.createElement('div', { className: 'customization-panel' },
                React.createElement('div', { className: 'custom-header' },
                    React.createElement('div', { className: 'custom-title' }, '✨ CUSTOMIZATION'),
                    React.createElement('div', { className: 'custom-coins' }, `💰 ${coins}`),
                    React.createElement('button', { className: 'modal-close', onClick: () => setShowCustomization(false) }, '✕')
                ),
                React.createElement('div', { className: 'custom-tabs' },
                    ['characters', 'skins', 'upgrades'].map(tab =>
                        React.createElement('button', {
                            key: tab,
                            className: `custom-tab ${customTab === tab ? 'active' : ''}`,
                            onClick: () => setCustomTab(tab)
                        },
                            tab === 'characters' ? '🐊 Characters' : tab === 'skins' ? '🎨 Skins' : '📈 Upgrades'
                        )
                    )
                ),
                React.createElement('div', { className: 'custom-content' },
                    customTab === 'characters' && React.createElement('div', { className: 'grid' }, renderCharacterList()),
                    customTab === 'skins'      && React.createElement('div', { className: 'grid' }, renderSkinList()),
                    customTab === 'upgrades'   && React.createElement('div', { className: 'list' }, renderUpgradeList())
                )
            )
        );
    };

    // === UI ===
    const qualityClass = `quality-${settings.graphics}`;
    return React.createElement('div', { className: `game-root ${qualityClass}` },
        React.createElement('canvas', {
            ref: canvasRef,
            width: window.innerWidth, height: window.innerHeight,
            className: 'game-canvas'
        }),
        // Top HUD
        gameState === 'playing' && React.createElement('div', { className: 'hud-top' },
            React.createElement('div', { className: 'hud-score' }, `${score}m`),
            React.createElement('div', { className: 'hud-health' }, '❤️'.repeat(Math.max(0, health))),
            React.createElement('div', { className: 'hud-coins' }, `💰 ${coins}`)
        ),
        // Menu
        gameState === 'menu' && React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'menu-panel' },
                React.createElement('div', { className: 'menu-title' }, '🐊 LACOSTE RUNNER'),
                React.createElement('div', { className: 'menu-buttons' },
                    React.createElement('button', { className: 'game-btn primary', onClick: () => resetGame() }, '▶ PLAY'),
                    React.createElement('button', { className: 'game-btn', onClick: () => { setShowCustomization(true); forceCustomUpdate(); } }, '🎨 CUSTOMIZE'),
                    React.createElement('button', { className: 'game-btn', onClick: () => window.GameEvents.emit('show_shop') }, '🛒 SHOP'),
                    React.createElement('button', { className: 'game-btn', onClick: () => window.GameEvents.emit('show_leaderboard') }, '🏅 LEADERBOARD'),
                    React.createElement('button', { className: 'game-btn', onClick: () => setShowSettings(true) }, '⚙️ SETTINGS')
                ),
                React.createElement('div', { className: 'menu-stats' },
                    `🏆 Best: ${highScore}m  💰 ${coins}`
                )
            )
        ),
        // Paused
        gameState === 'paused' && React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'menu-panel' },
                React.createElement('div', { className: 'menu-title' }, '⏸️ PAUSED'),
                React.createElement('button', { className: 'game-btn primary', onClick: () => setGameState('playing') }, '▶ RESUME'),
                React.createElement('button', { className: 'game-btn', onClick: () => setShowSettings(true) }, '⚙️ SETTINGS'),
                React.createElement('button', { className: 'game-btn', onClick: () => setGameState('menu') }, '🏠 MENU')
            )
        ),
        // Game Over
        gameState === 'gameover' && React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'menu-panel' },
                React.createElement('div', { className: 'menu-title' }, '💀 GAME OVER'),
                React.createElement('div', { className: 'gameover-score' }, `${score}m`),
                React.createElement('div', { className: 'menu-stats' }, `🏆 Best: ${highScore}m`),
                React.createElement('button', { className: 'game-btn primary', onClick: () => resetGame() }, '🔁 PLAY AGAIN'),
                React.createElement('button', { className: 'game-btn', onClick: () => { setGameState('menu'); window.GameEvents.emit('show_shop'); } }, '🛒 SHOP'),
                React.createElement('button', { className: 'game-btn', onClick: () => window.GameEvents.emit('show_share', { score }) }, '📸 SHARE'),
                React.createElement('button', { className: 'game-btn', onClick: () => setGameState('menu') }, '🏠 MENU')
            )
        ),
        // Settings
        showSettings && React.createElement('div', { className: 'customization-overlay' },
            React.createElement('div', { className: 'settings-panel' },
                React.createElement('div', { className: 'custom-header' },
                    React.createElement('div', { className: 'custom-title' }, '⚙️ SETTINGS'),
                    React.createElement('button', { className: 'modal-close', onClick: () => setShowSettings(false) }, '✕')
                ),
                React.createElement('label', null, '🔊 Sound'),
                React.createElement('input', { type: 'checkbox', checked: settings.soundEnabled, onChange: e => setSettings(s => ({ ...s, soundEnabled: e.target.checked })) }),
                React.createElement('label', null, 'SFX Volume'),
                React.createElement('input', { type: 'range', min: 0, max: 1, step: 0.05, value: settings.sfxVolume, onChange: e => setSettings(s => ({ ...s, sfxVolume: parseFloat(e.target.value) })) }),
                React.createElement('label', null, 'Ambient Volume'),
                React.createElement('input', { type: 'range', min: 0, max: 1, step: 0.05, value: settings.ambientVolume, onChange: e => setSettings(s => ({ ...s, ambientVolume: parseFloat(e.target.value) })) }),
                React.createElement('label', null, 'Graphics'),
                React.createElement('select', { value: settings.graphics, onChange: e => setSettings(s => ({ ...s, graphics: e.target.value })) },
                    React.createElement('option', { value: 'low' }, 'Low'),
                    React.createElement('option', { value: 'medium' }, 'Medium'),
                    React.createElement('option', { value: 'high' }, 'High')
                ),
                React.createElement('button', { className: 'game-btn primary', onClick: () => setShowSettings(false) }, '✓ DONE')
            )
        ),
        // Customization (Characters/Skins/Upgrades)
        renderCustomization(),
        // Pack UIs
        window.PackUIs.map((UI, i) => React.createElement(UI, { key: i, gameState, score, character, currentSkin, coins }))
    );
}

// === BOOT ===
window.GameBoot.trigger();
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Game));
