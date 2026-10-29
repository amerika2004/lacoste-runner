const { useState, useEffect, useRef, useCallback } = React;

// === ПЛАГИННАЯ ИНФРАСТРУКТУРА (Инициализация) ===
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

// === ЗАЩИТА ОТ ОТСУТСТВИЯ CONFIG.JS ===
const DEFAULT_CONFIG = {
    physics: { gravity: 0.75, jumpForce: -10.5, holdThrust: 0.45, groundY: 530, baseSpeed: 4.0, speedMultiplier: 0.8 },
    defaultSettings: { sfxVolume: 0.7, ambientVolume: 0.25, masterVolume: 1.0, soundEnabled: true, graphics: 'high', comboEnabled: true, comboVisualsEnabled: true, weatherEnabled: true, dynamicMusicEnabled: true, biomesEnabled: true, achievementsEnabled: true, dailyGoalsEnabled: true },
    combo: { decayTimeMs: 3000, tiers: [{ threshold: 3, mult: 2, emoji: '😎', color: '#00FFFF' }], sadEmoji: '😢', sadColor: '#888888' },
    pack2: { powerups: { spawnChance: 0.05, types: {} }, weather: { changeDistance: 1000 }, music: { layers: [], maxTempoRate: 1.15, tempoDistance: 2000 } },
    pack3: { biomes: [], music: { layers: [] }, achievements: [] },
    pack4: { economy: {}, shop: {}, missions: [], secrets: {} },
    characters: {
        crocodile: { id: 'crocodile', name: 'Crocodile', emoji: '🐊', folder: 'source/characters/crocodile', frameCount: 12, baseWidth: 165.4, baseHeight: 110.3, foodEmojis: ['🍗', '🍔', '🍕', '🥩'], eatEmoji: null, eatFolder: null, eatFrameCount: 0, eatDuration: 0 },
        panda: { id: 'panda', name: 'Panda', emoji: '🐼', folder: 'source/characters/panda', frameCount: 20, baseWidth: 160, baseHeight: 120, foodEmojis: ['🎋'], eatEmoji: '🎋', eatFolder: 'source/characters/panda/eating', eatFrameCount: 8, eatDuration: 4.0 }
    },
    biomes: {
        default: { id: 'default', name: 'Forest', emoji: '🌳', dayImg: 'source/landscape.jpg', nightImg: 'source/landscape_n.jpg', groundOffset: 0, obstacleTypes: ['barrel', 'rock', 'cactus', 'puddle', 'pit'], foodEmojis: null },
        cartoon: { id: 'cartoon', name: 'Cartoon', emoji: '🌲', dayImg: 'source/cartoon_forest.png', nightImg: 'source/cartoon_forest_n.png', groundOffset: 30, obstacleTypes: ['rock', 'puddle', 'pit'], foodEmojis: ['🎋'] }
    }
};

const CONFIG = (window.GAME_CONFIG && window.GAME_CONFIG.physics) ? window.GAME_CONFIG : DEFAULT_CONFIG;
const FLIP_CROC = false; 
const GRAVITY = CONFIG.physics.gravity ?? 0.75;        
const JUMP_FORCE = CONFIG.physics.jumpForce ?? -10.5;    
const HOLD_THRUST = CONFIG.physics.holdThrust ?? 0.45;    
const GROUND_Y = CONFIG.physics.groundY ?? 530; 
const BASE_SPEED = CONFIG.physics.baseSpeed ?? 4.0; 
const SPEED_MULTIPLIER = CONFIG.physics.speedMultiplier ?? 0.8;
const DEFAULT_SETTINGS = CONFIG.defaultSettings;

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
    
    const [score, setScore] = useState(0);
    const [speedDisplay, setSpeedDisplay] = useState(1.0); 
    const [powerDisplay, setPowerDisplay] = useState(1.0);
    const [health, setHealth] = useState(6);
    const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('lacosteHighScore')) || 0);

    const [settings, setSettings] = useState(() => {
        try { const saved = JSON.parse(localStorage.getItem('lacosteSettings') || '{}'); return { ...DEFAULT_SETTINGS, ...saved }; } catch { return { ...DEFAULT_SETTINGS }; }
    });
    const [showSettings, setShowSettings] = useState(false);

    const comboRef = useRef(0);
    const comboMultRef = useRef(1);

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
        const isPaused = gameState === 'paused' || showSettings || gameState === 'menu' || gameState === 'gameover';
        if (isPaused) { if (pitAudioRef.current) pitAudioRef.current.pause(); if (barrelAudioRef.current) barrelAudioRef.current.pause(); if (splashAudioRef.current) splashAudioRef.current.pause(); if (nightAmbientRef.current) nightAmbientRef.current.pause(); if (dayAmbientRef.current) dayAmbientRef.current.pause(); }
        else { if (settingsRef.current.soundEnabled && gameState === 'playing') { if (timeOfDayRef.current === 'night' && nightAmbientRef.current) nightAmbientRef.current.play().catch(() => {}); else if (timeOfDayRef.current === 'day' && dayAmbientRef.current) dayAmbientRef.current.play().catch(() => {}); } }
    }, [gameState, showSettings]);
    
    const initChar = CHARACTERS[character] || CHARACTERS[Object.keys(CHARACTERS)[0]];
    const initGroundY = GROUND_Y + (BACKGROUNDS[background]?.groundOffset || 0);
    const playerRef = useRef({ x: 100, y: initGroundY - initChar.baseHeight, width: initChar.baseWidth, height: initChar.baseHeight, velocityY: 0, isJumping: false, isHoldingJump: false, jumpMult: 1.0, tilt: 0, bob: 0, foodEaten: 0, foodTarget: 1 });
    
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
        return Math.max(1.0, sizeFactor * speedFactor * penalty);
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch((err) => console.warn("Fullscreen error:", err)); if (screen.orientation && screen.orientation.lock) { screen.orientation.lock('landscape').catch((err) => console.warn("Orientation lock error:", err)); } }
        else { if (document.exitFullscreen) document.exitFullscreen(); }
    };

    const resetCombo = () => { comboRef.current = 0; comboMultRef.current = 1; window.GameEvents.emit('combo_changed', { mult: 0, count: 0 }); };
    const addCombo = () => { comboRef.current++; let mult = 1; if (comboRef.current >= 8) mult = 5; else if (comboRef.current >= 5) mult = 3; else if (comboRef.current >= 3) mult = 2; comboMultRef.current = mult; window.GameEvents.emit('combo_changed', { mult: comboRef.current, count: comboRef.current }); };

    const konamiRef = useRef([]);
    const handleKeyDown = useCallback((e) => {
        konamiRef.current.push(e.code);
        if (konamiRef.current.length > 10) konamiRef.current.shift();
        if (JSON.stringify(konamiRef.current) === JSON.stringify(CONFIG.pack4.secrets.konami.code)) {
            if (window.Pack4State) {
                window.Pack4State.cheatInvincible = Date.now() + CONFIG.pack4.secrets.konami.duration;
                window.GameEvents.emit('pack4_toast', { text: '🔱 CHEAT ACTIVATED! 10s INVINCIBILITY', type: 'danger' });
                konamiRef.current = [];
            }
        }

        if (e.code === 'Escape') { e.preventDefault(); if (showSettings) { setShowSettings(false); return; } if (isFallingIntoPitRef.current || isPitDeathDelayRef.current) return; if (gameState === 'playing') setGameState('paused'); else if (gameState === 'paused') setGameState('playing'); return; }
        if (e.code === 'KeyN') { e.preventDefault(); setTimeOfDay(prev => prev === 'day' ? 'night' : 'day'); return; }
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            if (gameState === 'menu') setGameState('playing');
            else if (gameState === 'gameover') resetGame();
            else if (gameState === 'playing' && !playerRef.current.isJumping && !isTrippingRef.current && !isFallingIntoPitRef.current && !isPitDeathDelayRef.current && !isBarrelFlyingRef.current && !isEatingRef.current) {
                const p = playerRef.current;
                const baseMult = 1.0 + Math.floor(distanceRef.current / 100) * 0.04;
                p.jumpMult = calculateJumpMultiplier(p.height, baseMult, speedPenaltyRef.current);
                p.velocityY = JUMP_FORCE * p.jumpMult; p.isJumping = true; p.isHoldingJump = true; addCombo();
                window.GameEvents.emit('jump', { x: p.x + p.width / 2, y: p.y });
                RenderEngine.spawnParticles(p.x + p.width / 2, p.y + p.height, 6, { colors: ['#FFFFFF', '#AAAAAA'], speed: 2, life: 20, size: 2, gravity: 0.1 });
            }
        }
    }, [gameState, character, showSettings]);
    const handleKeyUp = useCallback((e) => { if (e.code === 'Space' || e.code === 'ArrowUp') playerRef.current.isHoldingJump = false; }, []);
    useEffect(() => { window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp); return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); }; }, [handleKeyDown, handleKeyUp]);

    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const handleTouchStart = (e) => {
            if (e.target.closest('.game-btn') || e.target.closest('.btn') || e.target.closest('.char-btn') || e.target.closest('.settings-panel') || e.target.closest('.settings-open-btn') || e.target.closest('.pack2-inventory') || e.target.closest('.pack3-ui')) return;
            e.preventDefault(); if (gameState !== 'playing') return;
            if (playerRef.current.isJumping || isTrippingRef.current || isFallingIntoPitRef.current || isPitDeathDelayRef.current || isBarrelFlyingRef.current || isEatingRef.current) return;
            const p = playerRef.current; const baseMult = 1.0 + Math.floor(distanceRef.current / 100) * 0.04;
            p.jumpMult = calculateJumpMultiplier(p.height, baseMult, speedPenaltyRef.current); p.velocityY = JUMP_FORCE * p.jumpMult; p.isJumping = true; p.isHoldingJump = true; addCombo();
            window.GameEvents.emit('jump', { x: p.x + p.width / 2, y: p.y });
            RenderEngine.spawnParticles(p.x + p.width / 2, p.y + p.height, 6, { colors: ['#FFFFFF', '#AAAAAA'], speed: 2, life: 20, size: 2, gravity: 0.1 });
        };
        const handleTouchEnd = (e) => { if (e.target.closest('.game-btn') || e.target.closest('.btn') || e.target.closest('.char-btn') || e.target.closest('.settings-panel') || e.target.closest('.settings-open-btn') || e.target.closest('.pack2-inventory') || e.target.closest('.pack3-ui')) return; if (gameState !== 'playing') return; e.preventDefault(); playerRef.current.isHoldingJump = false; };
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false }); canvas.addEventListener('touchend', handleTouchEnd, { passive: false }); canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
        return () => { canvas.removeEventListener('touchstart', handleTouchStart); canvas.removeEventListener('touchend', handleTouchEnd); canvas.removeEventListener('touchcancel', handleTouchEnd); };
    }, [gameState, character]);

    const resetGame = () => {
        const char = CHARACTERS[character] || CHARACTERS[Object.keys(CHARACTERS)[0]]; const gy = groundYRef.current;
        
        let startHp = 6;
        if (window.Pack4State && window.Pack4State.boughtBuffs?.includes('start_hp')) startHp = 8;
        
        playerRef.current = { x: 100, y: gy - char.baseHeight, width: char.baseWidth, height: char.baseHeight, velocityY: 0, isJumping: false, isHoldingJump: false, jumpMult: 1.0, tilt: 0, bob: 0, foodEaten: 0, foodTarget: 1 };
        obstaclesRef.current = []; foodsRef.current = []; explosionsRef.current = []; distanceRef.current = 0; spawnTimerRef.current = 0; foodTimerRef.current = 0; bgOffsetRef.current = 0; currentFrameRef.current = 0; spawnCooldownRef.current = 0;
        healthRef.current = startHp; setHealth(startHp);
        isTrippingRef.current = false; tripTimerRef.current = 0; speedPenaltyRef.current = 1.0; isBarrelTripRef.current = false; pendingBarrelDamageRef.current = false; isBarrelFlyingRef.current = false; barrelFlyVelocityYRef.current = 0; isFallingIntoPitRef.current = false; pitTargetRef.current = null; pitFallTimerRef.current = 0; pitVelocityRef.current = 0; isPitDeathDelayRef.current = false; pitDeathDelayTimerRef.current = 0;
        isEatingRef.current = false; eatTimerRef.current = 0; eatFrameIdxRef.current = 0; eatSpeedFactorRef.current = 1.0; pitAudioEndedRef.current = false;
        if (pitAudioRef.current) { pitAudioRef.current.pause(); pitAudioRef.current.currentTime = 0; }
        
        biomeTransitionRef.current = { active: false, nextBiome: null, alpha: 0 };
        
        resetCombo(); RenderEngine.reset(); setScore(0); setSpeedDisplay(1.0); setPowerDisplay(1.0); setGameState('playing');
        
        if (window.Pack4State && window.Pack4State.boughtBuffs?.includes('start_shield')) {
            window.Pack2State.inventory.shield++;
            window.Pack2State.uiListeners.forEach(fn => fn());
        }

        window.GameEvents.emit('start', { character, background, timeOfDay, settings: settingsRef.current });
    };

    const handleGameOver = () => {
        RenderEngine.reset(); if (pitAudioRef.current) pitAudioRef.current.pause(); setGameState('gameover');
        if (Math.floor(distanceRef.current) > highScore) { const newHigh = Math.floor(distanceRef.current); setHighScore(newHigh); localStorage.setItem('lacosteHighScore', newHigh); }
        window.GameEvents.emit('gameover', { distance: Math.floor(distanceRef.current), health: healthRef.current, character, background, timeOfDay });
    };

    const handleHit = (index, type) => {
        if (isTrippingRef.current) return;
        
        if (window.Pack4State && window.Pack4State.cheatInvincible > Date.now()) {
            obstaclesRef.current.splice(index, 1);
            RenderEngine.flash('0,255,255', 0.3);
            return;
        }

        if (window.Pack2State && window.Pack2State.hasShield) {
            window.Pack2State.hasShield = false;
            obstaclesRef.current.splice(index, 1); 
            window.GameEvents.emit('shield_break', { x: playerRef.current.x, y: playerRef.current.y });
            return; 
        }

        obstaclesRef.current.splice(index, 1);
        healthRef.current -= 1; setHealth(healthRef.current);
        if (type === 'puddle' && splashAudioRef.current && settingsRef.current.soundEnabled) { splashAudioRef.current.currentTime = 0; splashAudioRef.current.playbackRate = 1.2; splashAudioRef.current.play().catch(e => console.warn("Audio blocked", e)); }
        RenderEngine.flash('255,0,0', 0.4); RenderEngine.shake(6, 12);
        RenderEngine.spawnParticles(playerRef.current.x + playerRef.current.width / 2, playerRef.current.y + playerRef.current.height / 2, 15, { colors: ['#FF007F', '#FFFFFF'], speed: 4, life: 25, size: 3, gravity: 0.15 });
        resetCombo();
        window.GameEvents.emit('hit', { health: healthRef.current, type, playerX: playerRef.current.x + playerRef.current.width / 2, playerY: playerRef.current.y + playerRef.current.height / 2, distance: Math.floor(distanceRef.current) });
        if (healthRef.current <= 0) { handleGameOver(); return; }
        isTrippingRef.current = true; tripTimerRef.current = 0; isBarrelTripRef.current = false;
        const p = playerRef.current; p.y = groundYRef.current - p.height; p.velocityY = 0; p.isJumping = false; p.tilt = 0;
        speedPenaltyRef.current = speedPenaltyRef.current * 0.65;
    };

    const handleBarrelHit = (index) => {
        if (isTrippingRef.current || isBarrelFlyingRef.current) return;
        
        if (window.Pack4State && window.Pack4State.cheatInvincible > Date.now()) {
            obstaclesRef.current.splice(index, 1);
            RenderEngine.flash('0,255,255', 0.3);
            return;
        }

        const obs = obstaclesRef.current[index]; if (!obs) return; const canvas = canvasRef.current; const p = playerRef.current;
        
        explosionsRef.current.push({ x: obs.x + obs.width / 2, y: obs.y + obs.height / 2, size: obs.height * 6, timer: 0, maxTimer: 30 });
        if (barrelAudioRef.current && settingsRef.current.soundEnabled) { barrelAudioRef.current.currentTime = 0; barrelAudioRef.current.play().catch(e => console.warn("Audio blocked", e)); }
        RenderEngine.spawnParticles(obs.x + obs.width / 2, obs.y + obs.height / 2, 30, { colors: ['#FF007F', '#FFD700', '#FFAA00', '#FFFFFF'], speed: 8, life: 40, size: 5, gravity: 0.2, shape: 'circle' });
        RenderEngine.shake(12, 20); RenderEngine.flash('255,150,0', 0.3); resetCombo(); window.GameEvents.emit('barrel_hit', { x: obs.x, y: obs.y });
        
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
        if (window.Pack3State && window.Pack3State.currentBiome) {
            currentBgConfig = window.Pack3State.currentBiome;
        }

        const diffMult = SPEED_MULTIPLIER; const gfxQuality = settingsRef.current.graphics;

        let pack2SpeedMult = 1.0;
        if (window.Pack2State && window.Pack2State.activePowerups) {
            if (window.Pack2State.activePowerups.slowmo) pack2SpeedMult *= 0.5;
            if (window.Pack2State.activePowerups.sprint) pack2SpeedMult *= 1.5;
        }
        
        let pack4SpeedMult = 1.0;
        if (window.Pack4State && window.Pack4State.boughtBuffs?.includes('start_speed')) pack4SpeedMult = 1.05;

        if (settingsRef.current.biomesEnabled && window.Pack3State && window.Pack3State.nextBiome && !biomeTransitionRef.current.active) {
            biomeTransitionRef.current = { active: true, nextBiome: window.Pack3State.nextBiome, alpha: 0 };
            window.Pack3State.nextBiome = null;
        }

        if (biomeTransitionRef.current.active) {
            biomeTransitionRef.current.alpha += 0.02;
            if (biomeTransitionRef.current.alpha >= 1) {
                biomeTransitionRef.current.active = false;
                if (window.Pack3State) {
                    window.Pack3State.currentBiome = biomeTransitionRef.current.nextBiome;
                    window.Pack3State.currentBgConfig = biomeTransitionRef.current.nextBiome;
                }
                biomeTransitionRef.current.alpha = 0;
            }
        }

        if (isEatingRef.current) {
            eatTimerRef.current++;
            if (eatFramesRef.current.length > 0) { const totalFrames = (char.eatDuration || 4) * 60; const framesPerStep = totalFrames / eatFramesRef.current.length; eatFrameIdxRef.current = Math.min(eatFramesRef.current.length - 1, Math.floor(eatTimerRef.current / framesPerStep)); }
            if (eatTimerRef.current < 12) eatSpeedFactorRef.current = 1 - eatTimerRef.current / 12; else eatSpeedFactorRef.current = 0;
            const eatSpeedFactor = eatSpeedFactorRef.current;
            const baseSpeedMultEat = 1.0 + Math.floor(distanceRef.current / 100) * 0.04; const effectiveSpeedMultEat = Math.max(1.0, baseSpeedMultEat * speedPenaltyRef.current);
            const currentSpeedEat = BASE_SPEED * effectiveSpeedMultEat * diffMult * eatSpeedFactor * pack2SpeedMult * pack4SpeedMult;
            distanceRef.current += currentSpeedEat * 0.03; setScore(Math.floor(distanceRef.current)); setSpeedDisplay(eatSpeedFactor > 0.01 ? (effectiveSpeedMultEat * diffMult * eatSpeedFactor * pack2SpeedMult * pack4SpeedMult).toFixed(2) : "0.00"); bgOffsetRef.current -= currentSpeedEat;
            obstaclesRef.current.forEach(o => { o.x -= currentSpeedEat; }); obstaclesRef.current = obstaclesRef.current.filter(o => o.x + o.width > 0); foodsRef.current.forEach(f => { f.x -= currentSpeedEat; }); foodsRef.current = foodsRef.current.filter(f => f.x + f.width > 0);
            explosionsRef.current.forEach(e => e.timer++); explosionsRef.current = explosionsRef.current.filter(e => e.timer < e.maxTimer);
            p.isJumping = false; p.velocityY = 0; p.y = gy - p.height; p.tilt = 0; p.bob = Math.sin(Date.now() / 150) * 3;
            const particleEvery = gfxQuality === 'low' ? 15 : gfxQuality === 'medium' ? 9 : 6;
            if (eatTimerRef.current % particleEvery === 0) { RenderEngine.spawnParticles(p.x + p.width / 2 + (Math.random() - 0.5) * p.width * 0.3, p.y + p.height * 0.3, 1, { colors: ['#4CAF50', '#8BC34A'], speed: 2, life: 45, size: 3, gravity: 0.15, shape: 'leaf' }); }
            const eatDurationFrames = (char.eatDuration || 4) * 60;
            if (eatTimerRef.current >= eatDurationFrames) { isEatingRef.current = false; eatTimerRef.current = 0; eatFrameIdxRef.current = 0; currentFrameRef.current = 0; lastFrameTimeRef.current = Date.now(); spawnTimerRef.current = 0; spawnCooldownRef.current = 90; }
            return;
        } else { eatSpeedFactorRef.current = Math.min(1, eatSpeedFactorRef.current + 0.083); }
        
        if (isFallingIntoPitRef.current) {
            pitFallTimerRef.current++; pitVelocityRef.current += 0.2; p.y += pitVelocityRef.current;
            if (p.y > gy + 30 || pitFallTimerRef.current > 400) {
                isFallingIntoPitRef.current = false; isPitDeathDelayRef.current = true; pitDeathDelayTimerRef.current = 0; pitAudioEndedRef.current = false;
                const a = pitAudioRef.current;
                if (a && settingsRef.current.soundEnabled) { a.currentTime = 0; a.onended = () => { pitAudioEndedRef.current = true; }; a.onerror = () => { pitAudioEndedRef.current = true; }; a.play().catch(() => { pitAudioEndedRef.current = true; }); } else { pitAudioEndedRef.current = true; }
            }
            return;
        }
        
        if (isPitDeathDelayRef.current) {
            pitDeathDelayTimerRef.current++;
            const audioDone = pitAudioEndedRef.current || !pitAudioRef.current || !settingsRef.current.soundEnabled; const fallbackDone = pitDeathDelayTimerRef.current > 600; const minDelayPassed = pitDeathDelayTimerRef.current > 20;
            if ((audioDone && minDelayPassed) || fallbackDone) { isPitDeathDelayRef.current = false; handleGameOver(); return; }
            return;
        }
        
        if (isBarrelFlyingRef.current) {
            barrelFlyVelocityYRef.current += GRAVITY; p.y += barrelFlyVelocityYRef.current; p.tilt = Math.max(p.tilt - 0.03, -0.4);
            const backSpeed = 10 * diffMult; bgOffsetRef.current += backSpeed;
            obstaclesRef.current.forEach(o => { o.x += backSpeed; }); foodsRef.current.forEach(f => { f.x += backSpeed; });
            setSpeedDisplay("REVERSE");
            if (p.y >= gy - p.height) { p.y = gy - p.height; isBarrelFlyingRef.current = false; barrelFlyVelocityYRef.current = 0; isTrippingRef.current = true; tripTimerRef.current = 0; pendingBarrelDamageRef.current = true; p.tilt = 0; }
            explosionsRef.current.forEach(e => e.timer++); explosionsRef.current = explosionsRef.current.filter(e => e.timer < e.maxTimer);
            return;
        }
        
        if (isTrippingRef.current) {
            tripTimerRef.current++;
            if (pendingBarrelDamageRef.current && tripTimerRef.current >= 15) { pendingBarrelDamageRef.current = false; healthRef.current -= 1; setHealth(healthRef.current); speedPenaltyRef.current = speedPenaltyRef.current * 0.65; if (healthRef.current <= 0) { handleGameOver(); return; } }
            if (tripTimerRef.current > 120) { isTrippingRef.current = false; tripTimerRef.current = 0; }
        }
        
        explosionsRef.current.forEach(e => e.timer++); explosionsRef.current = explosionsRef.current.filter(e => e.timer < e.maxTimer);

        const baseSpeedMult = 1.0 + Math.floor(distanceRef.current / 100) * 0.04;
        const effectiveSpeedMult = Math.max(1.0, baseSpeedMult * speedPenaltyRef.current);
        
        let currentSpeed = 0;
        if (!isTrippingRef.current) {
            currentSpeed = BASE_SPEED * effectiveSpeedMult * diffMult * eatSpeedFactorRef.current * pack2SpeedMult * pack4SpeedMult;
            setSpeedDisplay((effectiveSpeedMult * diffMult * eatSpeedFactorRef.current * pack2SpeedMult * pack4SpeedMult).toFixed(2));
            distanceRef.current += (currentSpeed * 0.03); setScore(Math.floor(distanceRef.current)); bgOffsetRef.current -= currentSpeed;
        } else { setSpeedDisplay("0.00"); }

        const currentPower = calculateJumpMultiplier(p.height, baseSpeedMult, speedPenaltyRef.current); setPowerDisplay(currentPower.toFixed(2));

        if (window.Pack2State && window.Pack2State.activePowerups && window.Pack2State.activePowerups.magnet) {
            foodsRef.current.forEach(f => {
                const dx = (p.x + p.width/2) - (f.x + f.width/2);
                const dy = (p.y + p.height/2) - (f.y + f.height/2);
                const dist = Math.hypot(dx, dy);
                if (dist < 300) { f.x += dx * 0.1; f.y += dy * 0.1; }
            });
        }

        if (p.isJumping) {
            p.velocityY += GRAVITY; if (p.isHoldingJump) p.velocityY -= HOLD_THRUST * p.jumpMult;
            p.y += p.velocityY; p.tilt = p.velocityY * 0.025; p.tilt = Math.max(-0.35, Math.min(0.35, p.tilt)); 
            if (p.y <= 0) { p.y = 0; if (p.velocityY < 0) p.velocityY = 0; }
            if (p.y >= gy - p.height) { 
                p.y = gy - p.height; p.velocityY = 0; p.isJumping = false; p.tilt = 0; 
                window.GameEvents.emit('land', { x: p.x + p.width / 2, y: p.y + p.height });
            }
        } else if (!isTrippingRef.current) { p.bob = Math.sin(Date.now() / 80) * 2.5; p.tilt = 0; }

        if (!p.isJumping && !isTrippingRef.current) {
            const now = Date.now(); const frameDelay = Math.max(30, 100 - (currentSpeed * 5)); 
            if (now - lastFrameTimeRef.current > frameDelay) {
                currentFrameRef.current = (currentFrameRef.current + 1) % char.frameCount; lastFrameTimeRef.current = now;
                const frames = walkFramesRef.current; const idx = frames.length > 0 ? currentFrameRef.current % frames.length : 0; const trailImg = frames[idx];
                if (trailImg && !isEatingRef.current) RenderEngine.pushTrail(p.x, p.y, p.width, p.height, trailImg);
            }
        }

        if (!isTrippingRef.current) {
            if (spawnCooldownRef.current > 0) { spawnCooldownRef.current--; spawnTimerRef.current = 0; } 
            else {
                spawnTimerRef.current += (currentSpeed / BASE_SPEED);
                let gapOk = true; for (let obs of obstaclesRef.current) { if (obs.x + obs.width > canvas.width - 350) { gapOk = false; break; } }
                if (gapOk && spawnTimerRef.current > Math.max(70, 140 - currentSpeed * 3) + Math.random() * 40) {
                    const types = currentBgConfig.obstacleTypes || ['barrel', 'rock', 'cactus', 'puddle', 'pit']; const randomType = types[Math.floor(Math.random() * types.length)];
                    let width = 40, height = 40, yOffset = 0;
                    if (randomType === 'rock') { width = 120; height = 120; yOffset = 30; } if (randomType === 'cactus') { width = 70; height = 110; } if (randomType === 'barrel') { width = 50; height = 60; } if (randomType === 'puddle') { width = 120; height = 120; yOffset = 30; } if (randomType === 'pit') { width = 140; height = 90; yOffset = 40; }
                    const powerTier = Math.max(0, Math.floor((currentPower - 1.0) / 0.3)); const maxScale = 1.0 + powerTier * 0.15; const scale = 1.0 + Math.random() * (maxScale - 1.0); width *= scale; height *= scale; yOffset *= scale;
                    obstaclesRef.current.push({ x: canvas.width, y: gy - height + yOffset, width: width, height: height, type: randomType }); spawnTimerRef.current = 0;
                }
            }

            const foodList = currentBgConfig.foodEmojis || char.foodEmojis || ['🍗', '🍔', '🍕', '🥩']; const foodMult = char.eatFolder ? 3.0 : 1.0;
            foodTimerRef.current += (currentSpeed / BASE_SPEED);
            if (foodTimerRef.current > (100 + Math.random() * 80) * foodMult) { 
                let isSafeToSpawn = true; for (let obs of obstaclesRef.current) { if (obs.x + obs.width > canvas.width - 300) { isSafeToSpawn = false; break; } }
                if (isSafeToSpawn) {
                    const isPowerup = Math.random() < (CONFIG.pack2.powerups.spawnChance || 0.05);
                    if (isPowerup) {
                        const kinds = Object.keys(CONFIG.pack2.powerups.types);
                        const kind = kinds[Math.floor(Math.random() * kinds.length)];
                        const pData = CONFIG.pack2.powerups.types[kind];
                        foodsRef.current.push({ x: canvas.width, y: gy - 100, width: 40, height: 40, emoji: pData.emoji, isPowerup: true, kind });
                    } else {
                        const randomFood = foodList[Math.floor(Math.random() * foodList.length)]; const foodY = Math.random() > 0.5 ? gy - 80 : gy - 40;
                        foodsRef.current.push({ x: canvas.width, y: foodY, width: 40, height: 40, emoji: randomFood });
                    }
                    foodTimerRef.current = 0; 
                }
            }
        }

        obstaclesRef.current.forEach(obs => { obs.x -= currentSpeed; }); obstaclesRef.current = obstaclesRef.current.filter(obs => obs.x + obs.width > 0);
        foodsRef.current.forEach(food => { food.x -= currentSpeed; }); foodsRef.current = foodsRef.current.filter(food => food.x + food.width > 0);

        if (!isTrippingRef.current) {
            for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
                let obs = obstaclesRef.current[i];
                const hitboxX = p.x + p.width * 0.6; const hitboxY = p.y + p.height * 0.4; const hitboxWidth = p.width * 0.25; const hitboxHeight = p.height * 0.4; 
                let obsHitboxX = obs.x + 10; let obsHitboxWidth = obs.width - 20; let obsHitboxY = obs.y + 5; let obsHitboxHeight = obs.height - 5;
                if (obs.type === 'puddle') { obsHitboxY = obs.y + obs.height * 0.5; obsHitboxHeight = obs.height * 0.5; } 
                else if (obs.type === 'rock') { obsHitboxY = obs.y + obs.height * 0.2; obsHitboxHeight = obs.height * 0.8; } 
                else if (obs.type === 'pit') { const pitHitboxW = obs.width * 0.5; const pitHitboxH = obs.height * 0.5; obsHitboxX = obs.x + (obs.width - pitHitboxW) / 2 + obs.width * 0.35; obsHitboxWidth = pitHitboxW; obsHitboxY = obs.y + (obs.height - pitHitboxH) / 2; obsHitboxHeight = pitHitboxH; } 
                else if (obs.type === 'cactus') { const pad = obs.width * 0.3; obsHitboxX = obs.x + pad; obsHitboxWidth = obs.width - pad * 2; }

                if (hitboxX < obsHitboxX + obsHitboxWidth && hitboxX + hitboxWidth > obsHitboxX && hitboxY < obsHitboxY + obsHitboxHeight && hitboxY + hitboxHeight > obsHitboxY) {
                    if (obs.type === 'pit') {
                        if (window.Pack4State && window.Pack4State.cheatInvincible > Date.now()) { obstaclesRef.current.splice(i, 1); RenderEngine.flash('0,255,255', 0.3); break; }
                        if (window.Pack2State && window.Pack2State.hasShield) {
                            window.Pack2State.hasShield = false;
                            window.GameEvents.emit('shield_break', { x: p.x, y: p.y });
                            p.isJumping = true; p.velocityY = JUMP_FORCE * 1.2; 
                            obstaclesRef.current.splice(i, 1); 
                            RenderEngine.shake(8, 15);
                            break;
                        }
                        isFallingIntoPitRef.current = true; pitTargetRef.current = obs; pitFallTimerRef.current = 0; pitVelocityRef.current = 0; p.velocityY = 0; p.isJumping = false; p.isHoldingJump = false;
                        RenderEngine.spawnParticles(obs.x + obs.width / 2, gy, 20, { colors: ['#FF007F', '#FFD700', '#888888'], speed: 4, life: 30, size: 3, gravity: 0.2 }); RenderEngine.shake(10, 15); return;
                    } else if (obs.type === 'barrel') { handleBarrelHit(i); break; } 
                    else { handleHit(i, obs.type); break; }
                }
            }
        }

        foodsRef.current = foodsRef.current.filter(food => {
            const hitboxX = p.x + 20; const hitboxY = p.y + 20; const hitboxWidth = p.width - 40; const hitboxHeight = p.height - 20;
            if (hitboxX < food.x + food.width && hitboxX + hitboxWidth > food.x && hitboxY < food.y + food.height && hitboxY + hitboxHeight > food.y) {
                
                if (food.isPowerup) {
                    window.GameEvents.emit('powerup_collect', { kind: food.kind, x: food.x, y: food.y });
                    return false;
                }

                const isEatTrigger = char.eatEmoji && food.emoji === char.eatEmoji && !isTrippingRef.current;
                p.foodEaten++;
                if (p.foodEaten >= p.foodTarget) {
                    p.width += 2; p.height += 1.3; p.y = gy - p.height; p.foodEaten = 0; p.foodTarget = p.foodTarget + 1;
                    healthRef.current = Math.min(6, healthRef.current + 1); setHealth(healthRef.current);
                    RenderEngine.spawnParticles(p.x + p.width / 2, p.y + p.height / 2, 12, { colors: ['#FFD700', '#FFFFFF'], speed: 3, life: 30, size: 3, gravity: 0.1 });
                }
                if (isEatTrigger) { isEatingRef.current = true; eatTimerRef.current = 0; eatFrameIdxRef.current = 0; p.y = gy - p.height; p.velocityY = 0; p.isJumping = false; p.isHoldingJump = false; p.tilt = 0; p.bob = 0; }
                window.GameEvents.emit('eat', { type: 'normal', emoji: food.emoji });
                return false; 
            }
            return true;
        });

        window.GameEvents.emit('tick', { delta: 16.6, distance: distanceRef.current, health: healthRef.current, settings: settingsRef.current, timeOfDay: timeOfDayRef.current, combo: comboRef.current });
    };

    const describeScene = () => {
        const char = CHARACTERS[character] || CHARACTERS[Object.keys(CHARACTERS)[0]]; const gy = groundYRef.current;
        
        let bgConfig = BACKGROUNDS[backgroundRef.current] || BACKGROUNDS[Object.keys(BACKGROUNDS)[0]];
        if (settings.biomesEnabled && window.Pack3State && window.Pack3State.currentBiome) {
            bgConfig = window.Pack3State.currentBiome;
        }
        
        const bgImages = backgroundImagesRef.current[bgConfig.id] || { day: new Image(), night: new Image() };
        
        let bgNextImg = null;
        let transitionAlpha = 0;
        if (biomeTransitionRef.current.active && biomeTransitionRef.current.nextBiome) {
            const nextBgConfig = biomeTransitionRef.current.nextBiome;
            const nextImgs = backgroundImagesRef.current[nextBgConfig.id] || { day: new Image(), night: new Image() };
            bgNextImg = timeOfDayRef.current === 'night' ? nextImgs.night : nextImgs.day;
            transitionAlpha = biomeTransitionRef.current.alpha;
        }

        let charImg;
        if (isEatingRef.current && eatFramesRef.current.length > 0) charImg = eatFramesRef.current[eatFrameIdxRef.current % eatFramesRef.current.length];
        else { const frames = walkFramesRef.current; const idx = frames.length > 0 ? currentFrameRef.current % frames.length : 0; charImg = frames[idx]; }
        const pickImg = (dayImg, nightImg) => timeOfDayRef.current === 'night' ? nightImg.current : dayImg.current;
        
        return {
            bg: { img: timeOfDayRef.current === 'night' ? bgImages.night : bgImages.day, offset: bgOffsetRef.current, fallbackColor: timeOfDayRef.current === 'night' ? '#0a0512' : '#1a0b2e' },
            bgNext: bgNextImg ? { img: bgNextImg } : null,
            transitionAlpha: transitionAlpha,
            groundY: gy,
            player: { x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.width, h: playerRef.current.height, tilt: playerRef.current.tilt, bob: playerRef.current.bob, isJumping: playerRef.current.isJumping, img: charImg, isEating: isEatingRef.current, isTripping: isTrippingRef.current, tripTimer: tripTimerRef.current, isBarrelTrip: isBarrelTripRef.current, isBarrelFlying: isBarrelFlyingRef.current, isFallingIntoPit: isFallingIntoPitRef.current },
            obstacles: obstaclesRef.current.map(o => ({ x: o.x, y: o.y, w: o.width, h: o.height, type: o.type })),
            foods: foodsRef.current.map(f => ({ x: f.x, y: f.y, w: f.width, h: f.height, emoji: f.emoji, isPowerup: f.isPowerup })),
            explosions: explosionsRef.current.map(e => ({ x: e.x, y: e.y, size: e.size, timer: e.timer, maxTimer: e.maxTimer })),
            pitOverlay: (isFallingIntoPitRef.current || isPitDeathDelayRef.current) && pitTargetRef.current ? { x: pitTargetRef.current.x, y: pitTargetRef.current.y, w: pitTargetRef.current.width, h: pitTargetRef.current.height, img: pickImg(pitImg, pitNightImg) } : null,
            isPitDeath: isFallingIntoPitRef.current || isPitDeathDelayRef.current, pitTarget: pitTargetRef.current,
            deathFade: isPitDeathDelayRef.current ? Math.min(1, (pitAudioRef.current && isFinite(pitAudioRef.current.duration) && pitAudioRef.current.duration > 0.1 && settingsRef.current.soundEnabled) ? pitAudioRef.current.currentTime / pitAudioRef.current.duration : pitDeathDelayTimerRef.current / 180) : null,
            images: { puddleImg, puddleNightImg, rockImg, rockNightImg, pitImg, pitNightImg, barrelImg, barrelNightImg, cactusImg, cactusNightImg, explosionImg }, pickImg,
        };
    };

    const lastTimeRef = useRef(0); const accumulatorRef = useRef(0);
    useEffect(() => {
        if (gameState === 'playing') {
            lastTimeRef.current = performance.now(); accumulatorRef.current = 0;
            const gameLoop = (time) => {
                if (gameState !== 'playing') return;
                let deltaTime = time - lastTimeRef.current; lastTimeRef.current = time; if (deltaTime > 250) deltaTime = 250; accumulatorRef.current += deltaTime;
                const FRAME_TIME = 1000 / 60; let loops = 0;
                while (accumulatorRef.current >= FRAME_TIME && loops < 5) {
                    updateLogic(); RenderEngine.update();
                    accumulatorRef.current -= FRAME_TIME; loops++;
                }
                if (gameState !== 'playing') return;
                const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); const scene = describeScene(); RenderEngine.draw(ctx, canvas, scene);
                window.GameEvents.emit('render_frame', { ctx, player: scene.player });
                requestRef.current = requestAnimationFrame(gameLoop);
            };
            requestRef.current = requestAnimationFrame(gameLoop);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [gameState, character, background]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const rec = params.get('record');
        if (rec) {
            alert(`🎉 Ваш друг поделился рекордом: ${rec}м! Побейте его!`);
        }
    }, []);

    const startGame = () => resetGame();
    const formatScore = (num) => num.toString().padStart(5, '0');
    const getHearts = () => { let h = []; for (let i = 0; i < 4; i++) { if (health >= (i + 1) * 2) h.push('❤️'); else if (health === i * 2 + 1) h.push('💔'); else h.push('🖤'); } return h.join(''); };

    const renderCharacterPanel = () => React.createElement('div', { className: 'char-panel' }, 
        Object.values(CHARACTERS).map(char => React.createElement('button', { 
            key: char.id, 
            className: `char-btn ${character === char.id ? 'active' : ''}`, 
            onClick: () => setCharacter(char.id) 
        }, 
            React.createElement('span', { className: 'char-emoji' }, char.emoji || '❓'), 
            React.createElement('span', { className: 'char-name' }, char.name)
        ))
    );

    const renderBackgroundPanel = () => React.createElement('div', { className: 'settings', style: { marginBottom: '20px' } }, 
        Object.values(BACKGROUNDS).map(bg => React.createElement('button', { 
            key: bg.id, 
            className: `btn ${background === bg.id ? 'active' : ''}`, 
            onClick: () => setBackground(bg.id) 
        }, `${bg.emoji} ${bg.name}`))
    );

    return React.createElement('div', { id: 'game-container' },
        
        (gameState === 'playing' || gameState === 'paused') ? React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'hud-left' }, 
                React.createElement('span', { style: { letterSpacing: '2px' } }, getHearts()),
                React.createElement('span', { style: { fontSize: '16px', color: 'var(--fh-text-muted)' } }, `🍗 ${playerRef.current.foodEaten}/${playerRef.current.foodTarget}`)
            ),
            React.createElement('div', { className: 'hud-right' }, 
                React.createElement('span', { style: { color: 'var(--fh-accent)' } }, `${speedDisplay === 'REVERSE' ? '◄◄' : speedDisplay} KM/H`),
                React.createElement('span', null, `${formatScore(score)} M`),
                React.createElement('span', null, `HI: ${formatScore(highScore)} M`)
            )
        ) : null,

        React.createElement('canvas', { ref: canvasRef, width: 1200, height: 600 }),

        gameState === 'playing' ? React.createElement(React.Fragment, null,
            React.createElement('button', { id: 'btn-fullscreen', className: 'game-btn', onClick: toggleFullscreen }, '⛶'),
            React.createElement('button', { id: 'btn-pause', className: 'game-btn', onClick: () => setGameState('paused') }, '❚❚')
        ) : null,
        
        gameState === 'menu' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title' }, 'LACOSTE', React.createElement('br'), 'RUNNER'),
            React.createElement('div', { className: 'subtitle' }, 'VICE CITY EDITION'),

            renderCharacterPanel(),
            renderBackgroundPanel(),

            React.createElement('div', { className: 'settings' }, 
                React.createElement('button', { className: `btn ${timeOfDay === 'day' ? 'active' : ''}`, onClick: () => setTimeOfDay('day') }, '☀️ Day'), 
                React.createElement('button', { className: `btn ${timeOfDay === 'night' ? 'active' : ''}`, onClick: () => setTimeOfDay('night') }, '🌙 Night')
            ),

            React.createElement('div', { style: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', justifyContent: 'center' } }, 
                React.createElement('button', { className: 'btn', onClick: toggleFullscreen }, '⛶ Fullscreen'), 
                React.createElement('button', { className: 'btn', onClick: () => window.GameEvents.emit('show_achievements') }, '🏆 Achievements'),
                React.createElement('button', { className: 'btn', onClick: () => window.GameEvents.emit('show_shop') }, '🛒 Shop'),
                React.createElement('button', { className: 'btn', onClick: () => window.GameEvents.emit('show_leaderboard') }, '🏅 Leaderboard')
            ),

            React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'START ESCAPE'),
            React.createElement('button', { className: 'btn', onClick: () => setShowSettings(true), style: { marginTop: '20px', background: 'transparent' } }, '⚙ SETTINGS'),
            
            React.createElement('div', { style: { marginTop: '20px', color: 'var(--fh-text-muted)', fontSize: '12px', fontFamily: 'Montserrat' } }, 
                React.createElement('p', null, 'Space / Tap — jump, HOLD — high jump!'),
                React.createElement('p', null, 'Eat food to grow stronger. Avoid pits.')
            )
        ) : null,

        gameState === 'paused' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title', style: { fontSize: '48px' } }, 'PAUSED'),
            React.createElement('div', { style: { display: 'flex', gap: '15px', marginTop: '20px' } },
                React.createElement('button', { className: 'btn btn-start', onClick: () => setGameState('playing') }, 'RESUME'),
                React.createElement('button', { className: 'btn', onClick: () => resetGame() }, 'RESTART'),
                React.createElement('button', { className: 'btn', onClick: () => setGameState('menu') }, 'MENU')
            )
        ) : null,
        
        gameState === 'gameover' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title', style: { color: '#FF3333', filter: 'none', background: 'none', WebkitTextFillColor: '#FF3333', fontSize: '60px' } }, 'BUSTED'),
            React.createElement('div', { className: 'subtitle', style: { marginBottom: '30px' } }, 'The employees caught you'),
            
            React.createElement('div', { style: { fontSize: '32px', fontFamily: 'Rajdhani', fontWeight: 'bold', marginBottom: '20px' } }, 
                `${Math.floor(score)} M`, 
                React.createElement('span', { style: { fontSize: '18px', color: 'var(--fh-text-muted)', marginLeft: '10px' } }, `(HI: ${highScore} M)`)
            ),

            React.createElement('div', { style: { display: 'flex', gap: '15px', marginBottom: '30px' } },
                React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'TRY AGAIN'),
                React.createElement('button', { className: 'btn', onClick: () => setGameState('menu') }, 'MENU'),
                React.createElement('button', { className: 'btn', onClick: () => window.GameEvents.emit('show_share') }, '📸 SHARE')
            )
        ) : null,

        showSettings && React.createElement('div', { className: 'settings-overlay' },
            React.createElement('div', { className: 'settings-panel' },
                React.createElement('div', { className: 'settings-header' }, 
                    React.createElement('div', { className: 'settings-title' }, 'SETTINGS'), 
                    React.createElement('button', { className: 'settings-close', onClick: () => setShowSettings(false) }, '✕')
                ),
                
                React.createElement('div', { className: 'settings-section' },
                    React.createElement('div', { className: 'settings-section-title' }, 'Graphics'),
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'Quality'), 
                        React.createElement('div', { className: 'segmented' }, ['low', 'medium', 'high'].map(q => 
                            React.createElement('button', { key: q, className: settings.graphics === q ? 'active' : '', onClick: () => setSettings(s => ({ ...s, graphics: q })) }, q.toUpperCase())
                        ))
                    )
                ),

                React.createElement('div', { className: 'settings-section' },
                    React.createElement('div', { className: 'settings-section-title' }, 'Gameplay Features'),
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'Combo System'), 
                        React.createElement('button', { className: `setting-toggle ${settings.comboEnabled ? 'on' : ''}`, onClick: () => setSettings(s => ({ ...s, comboEnabled: !s.comboEnabled })) })
                    ),
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'Weather Effects'), 
                        React.createElement('button', { className: `setting-toggle ${settings.weatherEnabled ? 'on' : ''}`, onClick: () => setSettings(s => ({ ...s, weatherEnabled: !s.weatherEnabled })) })
                    ),
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'Dynamic Biomes'), 
                        React.createElement('button', { className: `setting-toggle ${settings.biomesEnabled ? 'on' : ''}`, onClick: () => setSettings(s => ({ ...s, biomesEnabled: !s.biomesEnabled })) })
                    ),
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'Dynamic Music'), 
                        React.createElement('button', { className: `setting-toggle ${settings.dynamicMusicEnabled ? 'on' : ''}`, onClick: () => setSettings(s => ({ ...s, dynamicMusicEnabled: !s.dynamicMusicEnabled })) })
                    ),
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'Achievements'), 
                        React.createElement('button', { className: `setting-toggle ${settings.achievementsEnabled ? 'on' : ''}`, onClick: () => setSettings(s => ({ ...s, achievementsEnabled: !s.achievementsEnabled })) })
                    ),
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'Daily Goals'), 
                        React.createElement('button', { className: `setting-toggle ${settings.dailyGoalsEnabled ? 'on' : ''}`, onClick: () => setSettings(s => ({ ...s, dailyGoalsEnabled: !s.dailyGoalsEnabled })) })
                    )
                ),

                React.createElement('div', { className: 'settings-section' },
                    React.createElement('div', { className: 'settings-section-title' }, 'Audio'),
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'Sound'), 
                        React.createElement('button', { className: `setting-toggle ${settings.soundEnabled ? 'on' : ''}`, onClick: () => setSettings(s => ({ ...s, soundEnabled: !s.soundEnabled })) })
                    ),
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'Master Volume'), 
                        React.createElement('input', { type: 'range', min: 0, max: 100, value: Math.round(settings.masterVolume * 100), onChange: (e) => setSettings(s => ({ ...s, masterVolume: Number(e.target.value) / 100 })), className: 'setting-slider' }),
                        React.createElement('span', { className: 'setting-value' }, `${Math.round(settings.masterVolume * 100)}%`)
                    ),
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'SFX'), 
                        React.createElement('input', { type: 'range', min: 0, max: 100, value: Math.round(settings.sfxVolume * 100), onChange: (e) => setSettings(s => ({ ...s, sfxVolume: Number(e.target.value) / 100 })), className: 'setting-slider' }),
                        React.createElement('span', { className: 'setting-value' }, `${Math.round(settings.sfxVolume * 100)}%`)
                    ),
                    React.createElement('div', { className: 'setting-row' }, 
                        React.createElement('span', { className: 'setting-label' }, 'Ambient'), 
                        React.createElement('input', { type: 'range', min: 0, max: 100, value: Math.round(settings.ambientVolume * 100), onChange: (e) => setSettings(s => ({ ...s, ambientVolume: Number(e.target.value) / 100 })), className: 'setting-slider' }),
                        React.createElement('span', { className: 'setting-value' }, `${Math.round(settings.ambientVolume * 100)}%`)
                    )
                ),

                React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '10px' } },
                    React.createElement('button', { className: 'btn', onClick: () => setSettings({ ...DEFAULT_SETTINGS }) }, 'RESET DEFAULTS')
                )
            )
        ),
        
        ...(window.PackUIs || []).map((UI, i) => React.createElement(UI, { key: 'plugin-' + i, gameState, setGameState, score }))
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
window.__bootGame = function () { if (window.__GAME_STARTED__) return; window.__GAME_STARTED__ = true; root.render(React.createElement(Game)); };
if (!window.__LOADER_ACTIVE__) { window.__bootGame(); }
