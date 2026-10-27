const { useState, useEffect, useRef, useCallback } = React;

const FLIP_CROC = false; 

const GRAVITY = 0.75;        
const JUMP_FORCE = -10.5;    
const HOLD_THRUST = 0.45;    

const GROUND_Y = 530; 
const BASE_SPEED = 4.0; 
const SPEED_MULTIPLIER = 1.5;

const DEFAULT_SETTINGS = {
    sfxVolume: 0.7, ambientVolume: 0.25, masterVolume: 1.0,
    soundEnabled: true, graphics: 'high',
    emojiStyle: 'apple',
    comboEnabled: true,
};

// ======================= EVENT BUS =======================
window.GameEvents = {
    listeners: {},
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    },
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => {
                try { cb(data); } catch (e) { console.error('EventBus error:', e); }
            });
        }
    }
};
window.PackUIs = window.PackUIs || [];

// ======================= RENDER ENGINE =======================
const RenderEngine = (function () {
    const QUALITY = {
        low:    { parallax: false, bloom: false, particles: false, shake: false, trail: false, vignette: false, flash: false, maxParticles: 0 },
        medium: { parallax: true,  bloom: false, particles: true,  shake: true,  trail: false, vignette: false, flash: true,  maxParticles: 200 },
        high:   { parallax: true,  bloom: true,  particles: true,  shake: true,  trail: true,  vignette: true,  flash: true,  maxParticles: 500 },
    };
    const state = { quality: 'high', config: QUALITY.high, particles: [], shakeTime: 0, shakeIntensity: 0, flashAlpha: 0, flashColor: '255,0,0', time: 0, trail: [], cache: { vignetteCanvas: null, particleSprite: null } };
    function makeVignette(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); const g = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.3, w/2, h/2, Math.max(w,h)*0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.65)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); return c; }
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
            const { config } = state;
            const W = canvas.width, H = canvas.height;
            let shakeX = 0, shakeY = 0;
            if (config.shake && state.shakeTime > 0) { const k = state.shakeTime / 20; shakeX = (Math.random() - 0.5) * state.shakeIntensity * k; shakeY = (Math.random() - 0.5) * state.shakeIntensity * k; }
            ctx.save();
            ctx.translate(shakeX, shakeY);

            const { bg } = scene;
            if (bg.img && bg.img.complete && bg.img.naturalWidth > 0) {
                const scale = H / bg.img.naturalHeight;
                const exactWidth = Math.ceil(bg.img.naturalWidth * scale);
                if (config.parallax) {
                    ctx.globalAlpha = 0.5;
                    let farOffset = Math.floor((bg.offset * 0.4) % exactWidth);
                    if (farOffset > 0) farOffset -= exactWidth;
                    for (let i = farOffset; i < W; i += exactWidth) ctx.drawImage(bg.img, i, -10, exactWidth, H + 20);
                    ctx.globalAlpha = 1;
                }
                let offset = Math.floor(bg.offset % exactWidth);
                if (offset > 0) offset -= exactWidth;
                for (let i = offset; i < W; i += exactWidth) ctx.drawImage(bg.img, i, 0, exactWidth, H);
            } else { ctx.fillStyle = bg.fallbackColor; ctx.fillRect(0, 0, W, H); }

            if (scene.pitOverlay && scene.pitOverlay.img && scene.pitOverlay.img.complete) {
                ctx.drawImage(scene.pitOverlay.img, scene.pitOverlay.x, scene.pitOverlay.y, scene.pitOverlay.w, scene.pitOverlay.h);
            }

            if (config.trail) {
                state.trail.forEach(t => { const a = (t.life / t.maxLife) * 0.4; ctx.save(); ctx.globalAlpha = a; ctx.drawImage(t.img, t.x, t.y, t.w, t.h); ctx.restore(); });
            }

            const p = scene.player;
            if (p.img && p.img.complete && p.img.naturalWidth > 0) {
                ctx.save();
                let fallAngle = 0, yOffset = 0, flyTilt = 0;
                let chewScale = 1.0;
                if (p.isEating) chewScale = 1.0 + Math.sin(Date.now() / 80) * 0.05;
                if (p.isBarrelFlying) flyTilt = p.tilt;
                if (p.isTripping) {
                    const fallProgress = Math.min(1, p.tripTimer / 15);
                    const standProgress = Math.max(0, (p.tripTimer - 40) / 80);
                    const flatAmount = fallProgress * (1 - standProgress);
                    let dir = p.isBarrelTrip ? (FLIP_CROC ? 1 : -1) : (FLIP_CROC ? -1 : 1);
                    fallAngle = dir * (Math.PI / 2) * flatAmount;
                    yOffset = -((p.w - p.h) / 2) * flatAmount;
                    if (Math.floor(p.tripTimer / 10) % 2 === 1) ctx.globalAlpha = 0.5;
                }
                const centerX = p.x + p.w / 2;
                const centerY = p.y + p.h / 2 + (p.isJumping ? 0 : (p.isTripping ? yOffset : p.bob));
                ctx.translate(centerX, centerY);
                ctx.rotate(p.tilt + fallAngle + flyTilt);
                if (FLIP_CROC) ctx.scale(-1, 1);
                const dW = p.w * chewScale, dH = p.h * chewScale;
                ctx.drawImage(p.img, -dW / 2, -dH / 2, dW, dH);
                ctx.restore();
            } else { ctx.fillStyle = 'red'; ctx.fillRect(p.x, p.y, p.w, p.h); }

            ctx.save();
            ctx.globalAlpha = 1.0;
            ctx.textBaseline = 'bottom';
            scene.foods.forEach(f => {
                let color = '#FFFFFF';
                if (f.type === 'golden') color = '#FFD700';
                else if (f.type === 'rare') color = '#00FFFF';
                else if (f.type === 'poison') color = '#8B00FF';
                ctx.shadowColor = color;
                ctx.shadowBlur = f.type !== 'normal' ? 12 : 0;
                ctx.font = `40px Arial`;
                ctx.fillText(f.emoji, f.x, f.y + f.h);
            });
            ctx.shadowBlur = 0;
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
                const progress = expl.timer / expl.maxTimer;
                const scale = 1 + progress * 0.5;
                const alpha = 1 - progress;
                const size = expl.size * scale;
                const x = expl.x - size / 2, y = expl.y - size / 2;
                if (images.explosionImg.current && images.explosionImg.current.complete) {
                    ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(images.explosionImg.current, x, y, size, size); ctx.restore();
                } else {
                    ctx.save(); ctx.globalAlpha = alpha;
                    ctx.fillStyle = 'orange'; ctx.beginPath(); ctx.arc(expl.x, expl.y, size / 2, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = 'yellow'; ctx.beginPath(); ctx.arc(expl.x, expl.y, size / 4, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                }
            });

            if (config.particles) {
                if (!state.cache.particleSprite) state.cache.particleSprite = makeParticleSprite();
                const sprite = state.cache.particleSprite;
                state.particles.forEach(pt => {
                    const a = pt.life / pt.maxLife;
                    ctx.save();
                    ctx.globalAlpha = a;
                    if (pt.shape === 'circle') { ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * a, 0, Math.PI * 2); ctx.fill(); }
                    else if (pt.shape === 'leaf') { ctx.translate(pt.x, pt.y); ctx.rotate(pt.rot); ctx.fillStyle = pt.color; ctx.beginPath(); ctx.ellipse(0, 0, pt.size, pt.size * 0.5, 0, 0, Math.PI * 2); ctx.fill(); }
                    else if (pt.shape === 'spark') { ctx.drawImage(sprite, pt.x - pt.size, pt.y - pt.size, pt.size * 2, pt.size * 2); }
                    ctx.restore();
                });
            }

            if (config.bloom) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                scene.obstacles.forEach(obs => {
                    if (obs.type === 'barrel') {
                        const cx = obs.x + obs.w / 2, cy = obs.y + obs.h / 2;
                        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, obs.w * 1.5);
                        grad.addColorStop(0, 'rgba(255,150,50,0.3)');
                        grad.addColorStop(1, 'rgba(255,150,50,0)');
                        ctx.fillStyle = grad; ctx.fillRect(cx - obs.w * 1.5, cy - obs.w * 1.5, obs.w * 3, obs.w * 3);
                    }
                });
                ctx.restore();
            }

            if (config.vignette) {
                if (!state.cache.vignetteCanvas || state.cache.vignetteCanvas.width !== W) state.cache.vignetteCanvas = makeVignette(W, H);
                ctx.drawImage(state.cache.vignetteCanvas, 0, 0);
            }

            if (state.flashAlpha > 0) {
                ctx.fillStyle = `rgba(${state.flashColor},${state.flashAlpha})`;
                ctx.fillRect(0, 0, W, H);
            }

            if (scene.deathFade != null) {
                ctx.fillStyle = `rgba(0,0,0,${scene.deathFade})`;
                ctx.fillRect(0, 0, W, H);
            }

            ctx.restore();
        },
    };
})();

// ======================= BACKGROUNDS / CHARACTERS =======================
const BACKGROUNDS = {
    default: { id: 'default', name: 'Forest', emoji: '🌳', dayImg: 'source/landscape.jpg', nightImg: 'source/landscape_n.jpg', groundOffset: 0, obstacleTypes: ['barrel', 'rock', 'cactus', 'puddle', 'pit'], foodEmojis: null },
    cartoon: { id: 'cartoon', name: 'Cartoon', emoji: '🌲', dayImg: 'source/cartoon_forest.png', nightImg: 'source/cartoon_forest_n.png', groundOffset: 30, obstacleTypes: ['rock', 'puddle', 'pit'], foodEmojis: ['🎋'] },
};

const CHARACTERS = {
    crocodile: { id: 'crocodile', name: 'Crocodile', emoji: '🐊', folder: 'source/characters/crocodile', frameCount: 12, baseWidth: 165.4, baseHeight: 110.3, foodEmojis: ['🍗', '🍔', '🍕', '🥩'] },
    panda: { id: 'panda', name: 'Panda', emoji: '🐼', folder: 'source/characters/panda', frameCount: 20, baseWidth: 160, baseHeight: 120, foodEmojis: ['🎋'], eatEmoji: '🎋', eatFolder: 'source/characters/panda/eating', eatFrameCount: 8, eatDuration: 4.0 },
};

const FOOD_TYPES = {
    normal:  { weight: 70, color: '#FFFFFF', emoji: null },
    golden:  { weight: 15, color: '#FFD700', emoji: '⭐', scoreBonus: 50 },
    rare:    { weight: 10, color: '#00FFFF', emoji: '💎', healBonus: 2 },
    poison:  { weight: 5,  color: '#8B00FF', emoji: '☠', speedPenalty: 0.1 },
};
function pickFoodType() {
    const r = Math.random() * 100;
    let acc = 0;
    for (const [key, val] of Object.entries(FOOD_TYPES)) { acc += val.weight; if (r < acc) return key; }
    return 'normal';
}

// ======================= UNIVERSAL UI WRAPPER =======================
// function AllPacksUI({ gameState }) {
//     const [uis, setUis] = React.useState([...window.PackUIs]);
//     React.useEffect(() => {
//         const id = setInterval(() => {
//             if (uis.length !== window.PackUIs.length) setUis([...window.PackUIs]);
//         }, 500);
//         return () => clearInterval(id);
//     }, [uis.length]);
//     return React.createElement(React.Fragment, null,
//         uis.map((UI, i) => React.createElement(UI, { key: i, gameState }))
//     );
// }

function Game() {
    const [gameState, setGameState] = useState('menu');
    const [timeOfDay, setTimeOfDay] = useState(() => localStorage.getItem('lacosteTimeOfDay') || 'day');
    const [background, setBackground] = useState(() => { const s = localStorage.getItem('lacosteBackground'); return (s && BACKGROUNDS[s]) ? s : 'default'; });
    const [character, setCharacter] = useState(() => { const s = localStorage.getItem('lacosteCharacter'); return (s && CHARACTERS[s]) ? s : 'crocodile'; });
    const [score, setScore] = useState(0);
    const [speedDisplay, setSpeedDisplay] = useState(1.0);
    const [powerDisplay, setPowerDisplay] = useState(1.0);
    const [health, setHealth] = useState(6);
    const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('lacosteHighScore')) || 0);

    const [settings, setSettings] = useState(() => {
        try {
            const s = JSON.parse(localStorage.getItem('lacosteSettings') || '{}');
            return { ...DEFAULT_SETTINGS, ...s, comboEnabled: s.comboEnabled !== false };
        } catch { return { ...DEFAULT_SETTINGS }; }
    });
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        localStorage.setItem('lacosteSettings', JSON.stringify(settings));
        RenderEngine.setQuality(settings.graphics);
        document.body.className = `emoji-${settings.emojiStyle}`;
    }, [settings]);

    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    const canvasRef = useRef(null);
    const requestRef = useRef();
    const timeOfDayRef = useRef(timeOfDay);
    const backgroundRef = useRef(background);
    const groundYRef = useRef(GROUND_Y + (BACKGROUNDS[background]?.groundOffset || 0));

    useEffect(() => { timeOfDayRef.current = timeOfDay; localStorage.setItem('lacosteTimeOfDay', timeOfDay); }, [timeOfDay]);
    useEffect(() => { backgroundRef.current = background; localStorage.setItem('lacosteBackground', background); const bg = BACKGROUNDS[background] || BACKGROUNDS.default; groundYRef.current = GROUND_Y + (bg.groundOffset || 0); }, [background]);

    const walkFramesRef = useRef([]); const currentFrameRef = useRef(0); const lastFrameTimeRef = useRef(0);
    const eatFramesRef = useRef([]); const eatFrameIdxRef = useRef(0); const isEatingRef = useRef(false); const eatTimerRef = useRef(0); const eatSpeedFactorRef = useRef(1.0);

    useEffect(() => {
        localStorage.setItem('lacosteCharacter', character);
        walkFramesRef.current = []; currentFrameRef.current = 0; eatFramesRef.current = []; eatFrameIdxRef.current = 0;
        isEatingRef.current = false; eatTimerRef.current = 0; eatSpeedFactorRef.current = 1.0;
        const char = CHARACTERS[character] || CHARACTERS.crocodile;
        for (let i = 1; i <= char.frameCount; i++) { const img = new Image(); img.src = `${char.folder}/${i}.png`; walkFramesRef.current.push(img); }
        if (char.eatFolder && char.eatFrameCount) { for (let i = 1; i <= char.eatFrameCount; i++) { const img = new Image(); img.src = `${char.eatFolder}/${i}.png`; eatFramesRef.current.push(img); } }
    }, [character]);

    // Audio (engine + ambient)
    const pitAudioRef = useRef(null); const pitAudioEndedRef = useRef(false);
    const barrelAudioRef = useRef(null); const splashAudioRef = useRef(null);
    const nightAmbientRef = useRef(null); const dayAmbientRef = useRef(null);

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
    }, [settings]);

    useEffect(() => {
        const isPaused = gameState === 'paused' || showSettings || gameState === 'menu' || gameState === 'gameover';
        if (isPaused) { if (pitAudioRef.current) pitAudioRef.current.pause(); if (barrelAudioRef.current) barrelAudioRef.current.pause(); if (splashAudioRef.current) splashAudioRef.current.pause(); if (nightAmbientRef.current) nightAmbientRef.current.pause(); if (dayAmbientRef.current) dayAmbientRef.current.pause(); }
        else if (settingsRef.current.soundEnabled && gameState === 'playing') { if (timeOfDayRef.current === 'night' && nightAmbientRef.current) nightAmbientRef.current.play().catch(() => {}); else if (timeOfDayRef.current === 'day' && dayAmbientRef.current) dayAmbientRef.current.play().catch(() => {}); }
    }, [gameState, showSettings]);

    useEffect(() => {
        const tryPlay = () => { if (!settingsRef.current.soundEnabled || gameState !== 'playing' || showSettings) return; if (timeOfDayRef.current === 'night') { const n = nightAmbientRef.current; if (n && n.paused) n.play().catch(() => {}); } else { const d = dayAmbientRef.current; if (d && d.paused) d.play().catch(() => {}); } };
        tryPlay(); window.addEventListener('pointerdown', tryPlay, { once: true }); window.addEventListener('keydown', tryPlay, { once: true });
        return () => { window.removeEventListener('pointerdown', tryPlay); window.removeEventListener('keydown', tryPlay); };
    }, []);

    const initChar = CHARACTERS[character] || CHARACTERS.crocodile;
    const initGroundY = GROUND_Y + (BACKGROUNDS[background]?.groundOffset || 0);
    const playerRef = useRef({ x: 100, y: initGroundY - initChar.baseHeight, width: initChar.baseWidth, height: initChar.baseHeight, velocityY: 0, isJumping: false, isHoldingJump: false, jumpMult: 1.0, tilt: 0, bob: 0, foodEaten: 0, foodTarget: 1 });
    const obstaclesRef = useRef([]); const foodsRef = useRef([]); const explosionsRef = useRef([]);
    const distanceRef = useRef(0); const spawnTimerRef = useRef(0); const foodTimerRef = useRef(0); const bgOffsetRef = useRef(0); const spawnCooldownRef = useRef(0);
    const healthRef = useRef(6); const isTrippingRef = useRef(false); const tripTimerRef = useRef(0); const speedPenaltyRef = useRef(1.0);
    const isBarrelTripRef = useRef(false); const pendingBarrelDamageRef = useRef(false); const isBarrelFlyingRef = useRef(false); const barrelFlyVelocityYRef = useRef(0);
    const isFallingIntoPitRef = useRef(false); const pitTargetRef = useRef(null); const pitFallTimerRef = useRef(0); const pitVelocityRef = useRef(0);
    const isPitDeathDelayRef = useRef(false); const pitDeathDelayTimerRef = useRef(0);
        // >>> ЭКСПОРТ ДЛЯ ПАКЕТОВ (больше game.js не трогаем)
    window.GameRefs = {
        player: playerRef,
        health: healthRef,
        obstacles: obstaclesRef,
        distance: distanceRef,
        speedPenalty: speedPenaltyRef
    };

    const puddleImg = useRef(new Image()); const puddleNightImg = useRef(new Image());
    const rockImg = useRef(new Image()); const rockNightImg = useRef(new Image());
    const pitImg = useRef(new Image()); const pitNightImg = useRef(new Image());
    const barrelImg = useRef(new Image()); const barrelNightImg = useRef(new Image());
    const cactusImg = useRef(new Image()); const cactusNightImg = useRef(new Image());
    const explosionImg = useRef(new Image());
    const backgroundImagesRef = useRef({});

    useEffect(() => { Object.values(BACKGROUNDS).forEach(bg => { const day = new Image(); day.src = bg.dayImg; const night = new Image(); night.src = bg.nightImg; backgroundImagesRef.current[bg.id] = { day, night }; }); }, []);
    useEffect(() => { puddleImg.current.src = 'source/puddle.png'; puddleNightImg.current.src = 'source/puddle_n.png'; rockImg.current.src = 'source/rock.png'; rockNightImg.current.src = 'source/rock_n.png'; pitImg.current.src = 'source/pit.png'; pitNightImg.current.src = 'source/pit_n.png'; barrelImg.current.src = 'source/barrel.png'; barrelNightImg.current.src = 'source/barrel_n.png'; cactusImg.current.src = 'source/cactus.png'; cactusNightImg.current.src = 'source/cactus_n.png'; explosionImg.current.src = 'source/explosion.png'; }, []);

    const calculateJumpMultiplier = (playerHeight, gameSpeed, penalty = 1.0) => { const char = CHARACTERS[character] || CHARACTERS.crocodile; const sizeFactor = Math.sqrt(playerHeight / char.baseHeight); const speedFactor = 1 + (gameSpeed - 1) * 0.10; return Math.max(1.0, sizeFactor * speedFactor * penalty); };
    const toggleFullscreen = () => { if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch((err) => console.warn("Fullscreen error:", err)); if (screen.orientation && screen.orientation.lock) { screen.orientation.lock('landscape').catch((err) => console.warn("Orientation lock error:", err)); } } else { if (document.exitFullscreen) document.exitFullscreen(); } };

    const doJump = (p) => {
        if (p.isJumping || isTrippingRef.current || isFallingIntoPitRef.current || isPitDeathDelayRef.current || isBarrelFlyingRef.current || isEatingRef.current) return;
        const baseMult = 1.0 + Math.floor(distanceRef.current / 100) * 0.04;
        p.jumpMult = calculateJumpMultiplier(p.height, baseMult, speedPenaltyRef.current);
        p.velocityY = JUMP_FORCE * p.jumpMult;
        p.isJumping = true; p.isHoldingJump = true;
        
        // >>> Отправляем событие прыжка (Pack 1 добавит комбо, звук, вибрацию)
        window.GameEvents.emit('jump');
        
        RenderEngine.spawnParticles(p.x + p.width / 2, p.y + p.height, 6, { colors: ['#FFFFFF', '#AAAAAA'], speed: 2, life: 20, size: 2, gravity: 0.1 });
    };

    const handleKeyDown = useCallback((e) => {
        if (e.code === 'Escape') { e.preventDefault(); if (showSettings) { setShowSettings(false); return; } if (isFallingIntoPitRef.current || isPitDeathDelayRef.current) return; if (gameState === 'playing') setGameState('paused'); else if (gameState === 'paused') setGameState('playing'); return; }
        if (e.code === 'KeyN') { e.preventDefault(); setTimeOfDay(prev => prev === 'day' ? 'night' : 'day'); return; }
        if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); if (gameState === 'menu') setGameState('playing'); else if (gameState === 'gameover') resetGame(); else if (gameState === 'playing') doJump(playerRef.current); }
    }, [gameState, character, showSettings]);

    const handleKeyUp = useCallback((e) => { if (e.code === 'Space' || e.code === 'ArrowUp') playerRef.current.isHoldingJump = false; }, []);
    useEffect(() => { window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp); return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); }; }, [handleKeyDown, handleKeyUp]);

    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const handleTouchStart = (e) => { if (e.target.closest('.game-btn') || e.target.closest('.btn') || e.target.closest('.char-btn') || e.target.closest('.settings-panel') || e.target.closest('.settings-open-btn')) return; e.preventDefault(); if (gameState !== 'playing') return; doJump(playerRef.current); };
        const handleTouchEnd = (e) => { if (e.target.closest('.game-btn') || e.target.closest('.btn') || e.target.closest('.char-btn') || e.target.closest('.settings-panel') || e.target.closest('.settings-open-btn')) return; if (gameState !== 'playing') return; e.preventDefault(); playerRef.current.isHoldingJump = false; };
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false }); canvas.addEventListener('touchend', handleTouchEnd, { passive: false }); canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
        return () => { canvas.removeEventListener('touchstart', handleTouchStart); canvas.removeEventListener('touchend', handleTouchEnd); canvas.removeEventListener('touchcancel', handleTouchEnd); };
    }, [gameState, character]);
        const resetGame = () => {
        const char = CHARACTERS[character] || CHARACTERS.crocodile; const gy = groundYRef.current;
        playerRef.current = { x: 100, y: gy - char.baseHeight, width: char.baseWidth, height: char.baseHeight, velocityY: 0, isJumping: false, isHoldingJump: false, jumpMult: 1.0, tilt: 0, bob: 0, foodEaten: 0, foodTarget: 1 };
        obstaclesRef.current = []; foodsRef.current = []; explosionsRef.current = [];
        distanceRef.current = 0; spawnTimerRef.current = 0; foodTimerRef.current = 0; bgOffsetRef.current = 0; currentFrameRef.current = 0; spawnCooldownRef.current = 0;
        healthRef.current = 6; setHealth(6); isTrippingRef.current = false; tripTimerRef.current = 0; speedPenaltyRef.current = 1.0;
        isBarrelTripRef.current = false; pendingBarrelDamageRef.current = false; isBarrelFlyingRef.current = false; barrelFlyVelocityYRef.current = 0;
        isFallingIntoPitRef.current = false; pitTargetRef.current = null; pitFallTimerRef.current = 0; pitVelocityRef.current = 0;
        isPitDeathDelayRef.current = false; pitDeathDelayTimerRef.current = 0;
        isEatingRef.current = false; eatTimerRef.current = 0; eatFrameIdxRef.current = 0; eatSpeedFactorRef.current = 1.0;
        
        pitAudioEndedRef.current = false; if (pitAudioRef.current) { pitAudioRef.current.pause(); pitAudioRef.current.currentTime = 0; }
        RenderEngine.reset(); setScore(0); setSpeedDisplay(1.0); setPowerDisplay(1.0); setGameState('playing');

        // >>> PACK EVENTS: старт
        window.GameEvents.emit('start', {
            character, background, timeOfDay,
            settings: settingsRef.current
        });
    };

    const handleGameOver = () => { 
        RenderEngine.reset(); 
        if (pitAudioRef.current) pitAudioRef.current.pause(); 
        setGameState('gameover'); 
        if (Math.floor(distanceRef.current) > highScore) { 
            const newHigh = Math.floor(distanceRef.current); 
            setHighScore(newHigh); localStorage.setItem('lacosteHighScore', newHigh); 
        }
        
        // >>> PACK EVENTS: смерть
        window.GameEvents.emit('gameover', {
            distance: Math.floor(distanceRef.current),
            score: Math.floor(distanceRef.current),
            health: healthRef.current,
            character, background, timeOfDay,
            foodEaten: playerRef.current.foodEaten,
        });
    };

    const handleHit = (index, type) => {
        if (isTrippingRef.current) return;
        obstaclesRef.current.splice(index, 1); healthRef.current -= 1; setHealth(healthRef.current);
        if (type === 'puddle' && splashAudioRef.current && settingsRef.current.soundEnabled) { splashAudioRef.current.currentTime = 0; splashAudioRef.current.playbackRate = 1.2; splashAudioRef.current.play().catch(() => {}); }
        
        // >>> PACK EVENTS: удар
        window.GameEvents.emit('hit', {
            playerX: playerRef.current.x + playerRef.current.width / 2,
            playerY: playerRef.current.y + playerRef.current.height / 2,
            type
        });

        if (healthRef.current <= 0) { handleGameOver(); return; }
        isTrippingRef.current = true; tripTimerRef.current = 0; isBarrelTripRef.current = false;
        const p = playerRef.current; p.y = groundYRef.current - p.height; p.velocityY = 0; p.isJumping = false; p.tilt = 0;
        speedPenaltyRef.current = speedPenaltyRef.current * 0.65;
    };

    const handleBarrelHit = (index) => {
        if (isTrippingRef.current || isBarrelFlyingRef.current) return;
        const obs = obstaclesRef.current[index]; if (!obs) return;
        const canvas = canvasRef.current; const p = playerRef.current;
        explosionsRef.current.push({ x: obs.x + obs.width / 2, y: obs.y + obs.height / 2, size: obs.height * 6, timer: 0, maxTimer: 30 });
        if (barrelAudioRef.current && settingsRef.current.soundEnabled) { barrelAudioRef.current.currentTime = 0; barrelAudioRef.current.play().catch(() => {}); }
        RenderEngine.spawnParticles(obs.x + obs.width / 2, obs.y + obs.height / 2, 30, { colors: ['#FF007F', '#FFD700', '#FFAA00', '#FFFFFF'], speed: 8, life: 40, size: 5, gravity: 0.2, shape: 'circle' });
        RenderEngine.shake(12, 20); RenderEngine.flash('255,150,0', 0.3);
        
        // >>> PACK EVENTS: взрыв бочки
        window.GameEvents.emit('barrel_hit');

        obstaclesRef.current.splice(index, 1); obstaclesRef.current = obstaclesRef.current.filter(o => (o.x + o.width) > p.x && o.x < canvas.width); foodsRef.current = foodsRef.current.filter(f => f.x < canvas.width);
        spawnCooldownRef.current = 90; spawnTimerRef.current = 0; isBarrelFlyingRef.current = true; isBarrelTripRef.current = true; barrelFlyVelocityYRef.current = -20;
        p.velocityY = 0; p.isJumping = false; p.isHoldingJump = false; p.tilt = 0;
    };

    const updateLogic = () => {
        const canvas = canvasRef.current; const p = playerRef.current; const char = CHARACTERS[character] || CHARACTERS.crocodile;
        const gy = groundYRef.current; const bgConfig = BACKGROUNDS[backgroundRef.current] || BACKGROUNDS.default;
        const diffMult = SPEED_MULTIPLIER; const gfxQuality = settingsRef.current.graphics;

        if (isEatingRef.current) {
            eatTimerRef.current++;
            if (eatFramesRef.current.length > 0) { const totalFrames = (char.eatDuration || 4) * 60; const framesPerStep = totalFrames / eatFramesRef.current.length; eatFrameIdxRef.current = Math.min(eatFramesRef.current.length - 1, Math.floor(eatTimerRef.current / framesPerStep)); }
            if (eatTimerRef.current < 12) eatSpeedFactorRef.current = 1 - eatTimerRef.current / 12; else eatSpeedFactorRef.current = 0;
            const eatSpeedFactor = eatSpeedFactorRef.current;
            const baseSpeedMultEat = 1.0 + Math.floor(distanceRef.current / 100) * 0.04;
            const effectiveSpeedMultEat = Math.max(1.0, baseSpeedMultEat * speedPenaltyRef.current);
            const currentSpeedEat = BASE_SPEED * effectiveSpeedMultEat * diffMult * eatSpeedFactor;
            distanceRef.current += currentSpeedEat * 0.03; setScore(Math.floor(distanceRef.current)); setSpeedDisplay(eatSpeedFactor > 0.01 ? (effectiveSpeedMultEat * diffMult * eatSpeedFactor).toFixed(2) : "0.00"); bgOffsetRef.current -= currentSpeedEat;
            obstaclesRef.current.forEach(o => { o.x -= currentSpeedEat; }); obstaclesRef.current = obstaclesRef.current.filter(o => o.x + o.width > 0);
            foodsRef.current.forEach(f => { f.x -= currentSpeedEat; }); foodsRef.current = foodsRef.current.filter(f => f.x + f.width > 0);
            explosionsRef.current.forEach(e => e.timer++); explosionsRef.current = explosionsRef.current.filter(e => e.timer < e.maxTimer);
            p.isJumping = false; p.velocityY = 0; p.y = gy - p.height; p.tilt = 0; p.bob = Math.sin(Date.now() / 150) * 3;
            const particleEvery = gfxQuality === 'low' ? 15 : gfxQuality === 'medium' ? 9 : 6;
            if (eatTimerRef.current % particleEvery === 0) RenderEngine.spawnParticles(p.x + p.width / 2 + (Math.random() - 0.5) * p.width * 0.3, p.y + p.height * 0.3, 1, { colors: ['#4CAF50', '#8BC34A'], speed: 2, life: 45, size: 3, gravity: 0.15, shape: 'leaf' });
            const eatDurationFrames = (char.eatDuration || 4) * 60;
            if (eatTimerRef.current >= eatDurationFrames) { isEatingRef.current = false; eatTimerRef.current = 0; eatFrameIdxRef.current = 0; currentFrameRef.current = 0; lastFrameTimeRef.current = Date.now(); spawnTimerRef.current = 0; spawnCooldownRef.current = 90; }
            return;
        } else { eatSpeedFactorRef.current = Math.min(1, eatSpeedFactorRef.current + 0.083); }

        if (isFallingIntoPitRef.current) {
            pitFallTimerRef.current++; pitVelocityRef.current += 0.2; p.y += pitVelocityRef.current;
            if (p.y > gy + 30 || pitFallTimerRef.current > 400) { isFallingIntoPitRef.current = false; isPitDeathDelayRef.current = true; pitDeathDelayTimerRef.current = 0; pitAudioEndedRef.current = false; const a = pitAudioRef.current; if (a && settingsRef.current.soundEnabled) { a.currentTime = 0; a.onended = () => { pitAudioEndedRef.current = true; }; a.onerror = () => { pitAudioEndedRef.current = true; }; a.play().catch(() => { pitAudioEndedRef.current = true; }); } else pitAudioEndedRef.current = true; }
            return;
        }
        if (isPitDeathDelayRef.current) {
            pitDeathDelayTimerRef.current++;
            const audioDone = pitAudioEndedRef.current || !pitAudioRef.current || !settingsRef.current.soundEnabled;
            if ((audioDone && pitDeathDelayTimerRef.current > 20) || pitDeathDelayTimerRef.current > 600) { isPitDeathDelayRef.current = false; handleGameOver(); return; }
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
            currentSpeed = BASE_SPEED * effectiveSpeedMult * diffMult * eatSpeedFactorRef.current;
            setSpeedDisplay((effectiveSpeedMult * diffMult * eatSpeedFactorRef.current).toFixed(2));
            
            // Множитель комбо приходит из Пакета 1
            let comboMult = 1;
            if (window.Pack1State && window.Pack1State.comboMult) comboMult = window.Pack1State.comboMult;
            
            distanceRef.current += (currentSpeed * 0.03 * comboMult);
            setScore(Math.floor(distanceRef.current)); bgOffsetRef.current -= currentSpeed;
        } else setSpeedDisplay("0.00");

        const currentPower = calculateJumpMultiplier(p.height, baseSpeedMult, speedPenaltyRef.current); setPowerDisplay(currentPower.toFixed(2));

        if (p.isJumping) {
            p.velocityY += GRAVITY; if (p.isHoldingJump) p.velocityY -= HOLD_THRUST * p.jumpMult;
            p.y += p.velocityY; p.tilt = p.velocityY * 0.025; p.tilt = Math.max(-0.35, Math.min(0.35, p.tilt));
            if (p.y <= 0) { p.y = 0; if (p.velocityY < 0) p.velocityY = 0; }
            if (p.y >= gy - p.height) { p.y = gy - p.height; p.velocityY = 0; p.isJumping = false; p.tilt = 0; }
        } else if (!isTrippingRef.current) { p.bob = Math.sin(Date.now() / 80) * 2.5; p.tilt = 0; }

        if (!p.isJumping && !isTrippingRef.current) {
            const now = Date.now(); const frameDelay = Math.max(30, 100 - (currentSpeed * 5));
            if (now - lastFrameTimeRef.current > frameDelay) { currentFrameRef.current = (currentFrameRef.current + 1) % char.frameCount; lastFrameTimeRef.current = now; const frames = walkFramesRef.current; const idx = frames.length > 0 ? currentFrameRef.current % frames.length : 0; const trailImg = frames[idx]; if (trailImg && !isEatingRef.current) RenderEngine.pushTrail(p.x, p.y, p.width, p.height, trailImg); }
        }

        if (!isTrippingRef.current) {
            if (spawnCooldownRef.current > 0) { spawnCooldownRef.current--; spawnTimerRef.current = 0; }
            else {
                spawnTimerRef.current += (currentSpeed / BASE_SPEED);
                let gapOk = true;
                for (let obs of obstaclesRef.current) { if (obs.x + obs.width > canvas.width - 350) { gapOk = false; break; } }
                if (gapOk && spawnTimerRef.current > Math.max(70, 140 - currentSpeed * 3) + Math.random() * 40) {
                    const types = bgConfig.obstacleTypes || ['barrel', 'rock', 'cactus', 'puddle', 'pit'];
                    const randomType = types[Math.floor(Math.random() * types.length)];
                    let width = 40, height = 40, yOffset = 0;
                    if (randomType === 'rock') { width = 120; height = 120; yOffset = 30; }
                    if (randomType === 'cactus') { width = 70; height = 110; }
                    if (randomType === 'barrel') { width = 50; height = 60; }
                    if (randomType === 'puddle') { width = 120; height = 120; yOffset = 30; }
                    if (randomType === 'pit') { width = 140; height = 90; yOffset = 40; }
                    const powerTier = Math.max(0, Math.floor((currentPower - 1.0) / 0.3));
                    const maxScale = 1.0 + powerTier * 0.15;
                    const scale = 1.0 + Math.random() * (maxScale - 1.0);
                    width *= scale; height *= scale; yOffset *= scale;
                    obstaclesRef.current.push({ x: canvas.width, y: gy - height + yOffset, width: width, height: height, type: randomType });
                    spawnTimerRef.current = 0;
                }
            }

            const foodList = bgConfig.foodEmojis || char.foodEmojis || ['🍗', '🍔', '🍕', '🥩'];
            const foodMult = char.eatFolder ? 3.0 : 1.0;
            foodTimerRef.current += (currentSpeed / BASE_SPEED);
            if (foodTimerRef.current > (100 + Math.random() * 80) * foodMult) {
                let isSafeToSpawn = true;
                for (let obs of obstaclesRef.current) { if (obs.x + obs.width > canvas.width - 300) { isSafeToSpawn = false; break; } }
                if (isSafeToSpawn) {
                    const randomFood = foodList[Math.floor(Math.random() * foodList.length)];
                    const foodType = pickFoodType();
                    const typeEmoji = FOOD_TYPES[foodType].emoji;
                    const finalEmoji = typeEmoji || randomFood;
                    const foodY = Math.random() > 0.5 ? gy - 80 : gy - 40;
                    foodsRef.current.push({ x: canvas.width, y: foodY, width: 40, height: 40, emoji: finalEmoji, type: foodType, baseEmoji: randomFood });
                    foodTimerRef.current = 0;
                }
            }
        }

        obstaclesRef.current.forEach(obs => { obs.x -= currentSpeed; }); obstaclesRef.current = obstaclesRef.current.filter(obs => obs.x + obs.width > 0);
        foodsRef.current.forEach(food => { food.x -= currentSpeed; }); foodsRef.current = foodsRef.current.filter(food => food.x + food.width > 0);

        if (!isTrippingRef.current) {
            for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
                let obs = obstaclesRef.current[i];
                const hitboxX = p.x + p.width * 0.6; const hitboxY = p.y + p.height * 0.4;
                const hitboxWidth = p.width * 0.25; const hitboxHeight = p.height * 0.4;
                let obsHitboxX = obs.x + 10; let obsHitboxWidth = obs.width - 20; let obsHitboxY = obs.y + 5; let obsHitboxHeight = obs.height - 5;
                if (obs.type === 'puddle') { obsHitboxY = obs.y + obs.height * 0.5; obsHitboxHeight = obs.height * 0.5; }
                else if (obs.type === 'rock') { obsHitboxY = obs.y + obs.height * 0.2; obsHitboxHeight = obs.height * 0.8; }
                else if (obs.type === 'pit') { const w = obs.width * 0.5, h = obs.height * 0.5; obsHitboxX = obs.x + (obs.width - w) / 2 + obs.width * 0.35; obsHitboxWidth = w; obsHitboxY = obs.y + (obs.height - h) / 2; obsHitboxHeight = h; }
                else if (obs.type === 'cactus') { const pad = obs.width * 0.3; obsHitboxX = obs.x + pad; obsHitboxWidth = obs.width - pad * 2; }
                if (hitboxX < obsHitboxX + obsHitboxWidth && hitboxX + hitboxWidth > obsHitboxX && hitboxY < obsHitboxY + obsHitboxHeight && hitboxY + hitboxHeight > obsHitboxY) {
                    if (obs.type === 'pit') { isFallingIntoPitRef.current = true; pitTargetRef.current = obs; pitFallTimerRef.current = 0; pitVelocityRef.current = 0; p.velocityY = 0; p.isJumping = false; p.isHoldingJump = false; RenderEngine.spawnParticles(obs.x + obs.width / 2, gy, 20, { colors: ['#FF007F', '#FFD700', '#888888'], speed: 4, life: 30, size: 3, gravity: 0.2 }); RenderEngine.shake(10, 15); return; }
                    else if (obs.type === 'barrel') { handleBarrelHit(i); break; }
                    else { handleHit(i, obs.type); break; }
                }
            }
        }

        foodsRef.current = foodsRef.current.filter(food => {
            const hitboxX = p.x + 20; const hitboxY = p.y + 20; const hitboxWidth = p.width - 40; const hitboxHeight = p.height - 20;
            if (hitboxX < food.x + food.width && hitboxX + hitboxWidth > food.x && hitboxY < food.y + food.height && hitboxY + hitboxHeight > food.y) {
                const isEatTrigger = char.eatEmoji && food.baseEmoji === char.eatEmoji && !isTrippingRef.current;
                if (food.type === 'golden') { distanceRef.current += 50; RenderEngine.spawnParticles(food.x + 20, food.y + 20, 15, { colors: ['#FFD700', '#FFFFFF'], speed: 5, life: 30, size: 4 }); }
                else if (food.type === 'rare') { healthRef.current = Math.min(6, healthRef.current + 2); setHealth(healthRef.current); RenderEngine.spawnParticles(food.x + 20, food.y + 20, 15, { colors: ['#00FFFF', '#FFFFFF'], speed: 5, life: 30, size: 4 }); }
                else if (food.type === 'poison') { speedPenaltyRef.current = speedPenaltyRef.current * 0.9; RenderEngine.spawnParticles(food.x + 20, food.y + 20, 15, { colors: ['#8B00FF', '#FF007F'], speed: 5, life: 30, size: 4 }); }
                else { p.foodEaten++; if (p.foodEaten >= p.foodTarget) { p.width += 2; p.height += 1.3; p.y = gy - p.height; p.foodEaten = 0; p.foodTarget = p.foodTarget + 1; healthRef.current = Math.min(6, healthRef.current + 1); setHealth(healthRef.current); RenderEngine.spawnParticles(p.x + p.width / 2, p.y + p.height / 2, 12, { colors: ['#FFD700', '#FFFFFF'], speed: 3, life: 30, size: 3, gravity: 0.1 }); } }
                if (isEatTrigger) { isEatingRef.current = true; eatTimerRef.current = 0; eatFrameIdxRef.current = 0; p.y = gy - p.height; p.velocityY = 0; p.isJumping = false; p.isHoldingJump = false; p.tilt = 0; p.bob = 0; }
                
                // >>> PACK EVENTS: еда съедена
                window.GameEvents.emit('eat', { type: food.type, emoji: food.emoji });
                return false;
            }
            return true;
        });

        // >>> PACK EVENTS: тик
        window.GameEvents.emit('tick', {
            distance: distanceRef.current,
            speed: currentSpeed,
            health: healthRef.current,
            score: Math.floor(distanceRef.current),
            obstacles: obstaclesRef.current,
            foods: foodsRef.current,
            player: playerRef.current,
            groundY: gy,
            settings: settingsRef.current,
            foodEaten: playerRef.current.foodEaten
        });
    };

    const describeScene = () => {
        const char = CHARACTERS[character] || CHARACTERS.crocodile;
        const gy = groundYRef.current;
        const bgConfig = BACKGROUNDS[backgroundRef.current] || BACKGROUNDS.default;
        const bgImages = backgroundImagesRef.current[bgConfig.id] || { day: new Image(), night: new Image() };
        let charImg;
        if (isEatingRef.current && eatFramesRef.current.length > 0) charImg = eatFramesRef.current[eatFrameIdxRef.current % eatFramesRef.current.length];
        else { const frames = walkFramesRef.current; const idx = frames.length > 0 ? currentFrameRef.current % frames.length : 0; charImg = frames[idx]; }
        const pickImg = (dayImg, nightImg) => timeOfDayRef.current === 'night' ? nightImg.current : dayImg.current;
        return {
            bg: { img: timeOfDayRef.current === 'night' ? bgImages.night : bgImages.day, offset: bgOffsetRef.current, fallbackColor: timeOfDayRef.current === 'night' ? '#0a0512' : '#1a0b2e' },
            groundY: gy,
            player: { x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.width, h: playerRef.current.height, tilt: playerRef.current.tilt, bob: playerRef.current.bob, isJumping: playerRef.current.isJumping, img: charImg, isEating: isEatingRef.current, isTripping: isTrippingRef.current, tripTimer: tripTimerRef.current, isBarrelTrip: isBarrelTripRef.current, isBarrelFlying: isBarrelFlyingRef.current },
            obstacles: obstaclesRef.current.map(o => ({ x: o.x, y: o.y, w: o.width, h: o.height, type: o.type })),
            foods: foodsRef.current.map(f => ({ x: f.x, y: f.y, w: f.width, h: f.height, emoji: f.emoji, type: f.type })),
            explosions: explosionsRef.current.map(e => ({ x: e.x, y: e.y, size: e.size, timer: e.timer, maxTimer: e.maxTimer })),
            pitOverlay: (isFallingIntoPitRef.current || isPitDeathDelayRef.current) && pitTargetRef.current ? { x: pitTargetRef.current.x, y: pitTargetRef.current.y, w: pitTargetRef.current.width, h: pitTargetRef.current.height, img: pickImg(pitImg, pitNightImg) } : null,
            isPitDeath: isFallingIntoPitRef.current || isPitDeathDelayRef.current,
            pitTarget: pitTargetRef.current,
            deathFade: isPitDeathDelayRef.current ? Math.min(1, (pitAudioRef.current && isFinite(pitAudioRef.current.duration) && pitAudioRef.current.duration > 0.1 && settingsRef.current.soundEnabled) ? pitAudioRef.current.currentTime / pitAudioRef.current.duration : pitDeathDelayTimerRef.current / 180) : null,
            images: { puddleImg, puddleNightImg, rockImg, rockNightImg, pitImg, pitNightImg, barrelImg, barrelNightImg, cactusImg, cactusNightImg, explosionImg },
            pickImg,
        };
    };

    const lastTimeRef = useRef(0);
    const accumulatorRef = useRef(0);

    useEffect(() => {
        if (gameState === 'playing') {
            lastTimeRef.current = performance.now();
            accumulatorRef.current = 0;
            const gameLoop = (time) => {
                if (gameState !== 'playing') return;
                let deltaTime = time - lastTimeRef.current;
                lastTimeRef.current = time;
                if (deltaTime > 250) deltaTime = 250;
                accumulatorRef.current += deltaTime;
                const FRAME_TIME = 1000 / 60;
                let loops = 0;
                while (accumulatorRef.current >= FRAME_TIME && loops < 5) { updateLogic(); RenderEngine.update(); accumulatorRef.current -= FRAME_TIME; loops++; }
                if (gameState !== 'playing') return;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                const scene = describeScene();
                RenderEngine.draw(ctx, canvas, scene);
                requestRef.current = requestAnimationFrame(gameLoop);
            };
            requestRef.current = requestAnimationFrame(gameLoop);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [gameState, character, background]);

    const startGame = () => resetGame();
    const formatScore = (num) => num.toString().padStart(5, '0');
    const getHearts = () => { let h = []; for (let i = 0; i < 3; i++) { if (health >= (i + 1) * 2) h.push('❤️'); else if (health === i * 2 + 1) h.push('💔'); else h.push('🖤'); } return h.join(' '); };

    const renderCharacterPanel = () => React.createElement('div', { className: 'char-panel' },
        React.createElement('div', { className: 'char-panel-title' }, 'Hero'),
        Object.values(CHARACTERS).map(char => React.createElement('button', { key: char.id, className: `char-btn ${character === char.id ? 'active' : ''}`, onClick: () => setCharacter(char.id), title: char.name },
            React.createElement('span', { className: 'char-emoji' }, char.emoji || '❓'),
            React.createElement('span', { className: 'char-name' }, char.name)
        ))
    );

    const renderBackgroundPanel = () => React.createElement('div', { className: 'settings', style: { marginTop: '-5px' } },
        Object.values(BACKGROUNDS).map(bg => React.createElement('button', { key: bg.id, className: `btn ${background === bg.id ? 'active' : ''}`, onClick: () => setBackground(bg.id) }, `${bg.emoji} ${bg.name}`))
    );

    return React.createElement('div', { id: 'game-container' },

        (gameState === 'playing' || gameState === 'paused') ? React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'hud-left' },
                React.createElement('span', null, `FOOD: ${playerRef.current.foodEaten} / ${playerRef.current.foodTarget}`),
                React.createElement('span', { style: { fontSize: 'clamp(14px, 2.5vmin, 24px)', letterSpacing: '2px' } }, getHearts())
            ),
            React.createElement('div', { className: 'hud-right' },
                React.createElement('span', { style: {color: '#FFD700'} }, `PWR x${powerDisplay}`),
                React.createElement('span', { style: {color: '#FF00FF'} }, `${speedDisplay === 'REVERSE' ? '◄◄ REV' : `SPD x${speedDisplay}`}`),
                React.createElement('span', null, `HI ${formatScore(highScore)}  ${formatScore(score)}m`)
            )
        ) : null,

        React.createElement('canvas', { ref: canvasRef, width: 1200, height: 600 }),

        gameState === 'playing' ? React.createElement(React.Fragment, null,
            React.createElement('button', { id: 'btn-fullscreen', className: 'game-btn', onClick: toggleFullscreen, 'aria-label': 'Fullscreen' }, '⛶'),
            React.createElement('button', { id: 'btn-pause', className: 'game-btn', onClick: () => setGameState('paused'), 'aria-label': 'Pause' }, '❚❚')
        ) : null,

        gameState === 'menu' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: `celestial-sun ${timeOfDay === 'day' ? 'visible' : ''}` },
                React.createElement('div', { className: 'sun-rays' }),
                React.createElement('div', { className: 'sun-core' })
            ),
            React.createElement('div', { className: `celestial-moon ${timeOfDay === 'night' ? 'visible' : ''}` },
                React.createElement('div', { className: 'moon-crescent' }),
                React.createElement('span', { className: 'star s1' }),
                React.createElement('span', { className: 'star s2' }),
                React.createElement('span', { className: 'star s3' }),
                React.createElement('span', { className: 'star s4' }),
                React.createElement('span', { className: 'star s5' })
            ),

            React.createElement('div', { className: 'title' }, 'LACOSTE', React.createElement('br'), 'RUNNER'),
            React.createElement('div', { className: 'subtitle' }, 'VICE CITY EDITION'),

            renderCharacterPanel(),
            renderBackgroundPanel(),

            React.createElement('div', { className: 'settings', style: { marginTop: '-10px' } },
                React.createElement('button', { className: `btn ${timeOfDay === 'day' ? 'active' : ''}`, onClick: () => setTimeOfDay('day') }, '☀️ Day'),
                React.createElement('button', { className: `btn ${timeOfDay === 'night' ? 'active' : ''}`, onClick: () => setTimeOfDay('night') }, '🌙 Night')
            ),

            React.createElement('div', { style: { display: 'flex', gap: '10px', marginBottom: '15px' } },
                React.createElement('button', { className: 'btn', onClick: toggleFullscreen }, '⛶ На весь экран')
            ),

            React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'Start Escape'),

            React.createElement('button', { className: 'settings-open-btn', onClick: () => setShowSettings(true), style: { marginTop: '15px' } }, '⚙ SETTINGS'),

            React.createElement('div', { style: { marginTop: '10px' } },
                React.createElement('p', { style: {color: '#888', fontSize: '12px'} }, 'Tap / Space — jump, HOLD — high jump!'),
                React.createElement('p', { style: {color: '#FFD700', fontSize: '12px'} }, 'Eat food to grow stronger! ⭐ gold +score, 💎 rare +heal, ☠ poison -speed'),
                React.createElement('p', { style: {color: '#FF007F', fontSize: '12px'} }, 'Avoid pits — instant death! Chain jumps for COMBO!')
            )
        ) : null,

        gameState === 'paused' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title', style: { color: '#00FFFF', textShadow: '2px 2px 0px #FF007F' } }, 'PAUSED'),
            React.createElement('button', { className: 'btn btn-start', onClick: () => setGameState('playing'), style: { marginBottom: '10px' } }, 'Resume'),
            React.createElement('div', { className: 'settings' },
                React.createElement('button', { className: 'btn', onClick: toggleFullscreen }, '⛶ Fullscreen'),
                React.createElement('button', { className: 'btn', onClick: () => resetGame() }, 'Restart'),
                React.createElement('button', { className: 'btn', onClick: () => setGameState('menu') }, 'Menu')
            ),
            React.createElement('button', { className: 'settings-open-btn', onClick: () => setShowSettings(true), style: { marginTop: '15px' } }, '⚙ SETTINGS')
        ) : null,

        gameState === 'gameover' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title', style: {color: 'red', textShadow: '2px 2px 0px #000'} }, 'BUSTED'),
            React.createElement('div', { className: 'subtitle', style: {color: 'white', marginBottom: '10px'} }, 'The employees caught you!'),
            React.createElement('div', { className: 'subtitle' }, 'DIST: ', Math.floor(score), 'm | HI: ', highScore, 'm'),
            renderCharacterPanel(),
            React.createElement('div', { className: 'settings' },
                React.createElement('button', { className: 'btn', onClick: toggleFullscreen }, '⛶ Fullscreen'),
                React.createElement('button', { className: 'btn', onClick: () => setGameState('menu') }, 'Menu'),
                React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'Try Again')
            ),
            React.createElement('button', { className: 'settings-open-btn', onClick: () => setShowSettings(true), style: { marginTop: '15px' } }, '⚙ SETTINGS')
        ) : null,

        showSettings && React.createElement('div', { className: 'settings-overlay' },
            React.createElement('div', { className: 'settings-panel' },
                React.createElement('div', { className: 'settings-header' },
                    React.createElement('div', { className: 'settings-title' }, 'SETTINGS'),
                    React.createElement('button', { className: 'settings-close', onClick: () => setShowSettings(false), 'aria-label': 'Close' }, '✕')
                ),

                React.createElement('div', { className: 'settings-section' },
                    React.createElement('div', { className: 'settings-section-title' }, '🖥 Graphics'),
                    React.createElement('div', { className: 'setting-row' },
                        React.createElement('span', { className: 'setting-label' }, 'Quality'),
                        React.createElement('div', { className: 'segmented' },
                            ['low', 'medium', 'high'].map(q => React.createElement('button', { key: q, className: settings.graphics === q ? 'active' : '', onClick: () => setSettings(s => ({ ...s, graphics: q })) }, q.toUpperCase()))
                        )
                    )
                ),

                React.createElement('div', { className: 'settings-section' },
                    React.createElement('div', { className: 'settings-section-title' }, '😀 Emoji Style'),
                    React.createElement('div', { className: 'setting-row' },
                        React.createElement('span', { className: 'setting-label' }, 'Set'),
                        React.createElement('div', { className: 'segmented' },
                            ['apple', 'twemoji', 'noto'].map(s => React.createElement('button', { key: s, className: settings.emojiStyle === s ? 'active' : '', onClick: () => setSettings(prev => ({ ...prev, emojiStyle: s })) }, s === 'apple' ? '🍎 APPLE' : s === 'twemoji' ? '🐦 TWEMOJI' : '🤖 NOTO'))
                        )
                    ),
                    React.createElement('div', { className: 'setting-row' },
                        React.createElement('span', { className: 'setting-label' }, 'Combo System'),
                        React.createElement('button', { className: `setting-toggle ${settings.comboEnabled ? 'on' : ''}`, onClick: () => setSettings(prev => ({ ...prev, comboEnabled: !prev.comboEnabled })), 'aria-label': 'Toggle combo' })
                    )
                ),

                React.createElement('div', { className: 'settings-section' },
                    React.createElement('div', { className: 'settings-section-title' }, '🔊 Audio'),
                    React.createElement('div', { className: 'setting-row' },
                        React.createElement('span', { className: 'setting-label' }, 'Sound'),
                        React.createElement('button', { className: `setting-toggle ${settings.soundEnabled ? 'on' : ''}`, onClick: () => setSettings(s => ({ ...s, soundEnabled: !s.soundEnabled })), 'aria-label': 'Toggle sound' })
                    ),
                    React.createElement('div', { className: 'setting-row' },
                        React.createElement('span', { className: 'setting-label' }, 'Master'),
                        React.createElement('input', { type: 'range', min: 0, max: 100, value: Math.round(settings.masterVolume * 100), onChange: (e) => setSettings(s => ({ ...s, masterVolume: Number(e.target.value) / 100 })), className: 'setting-slider', style: { '--fill': `${settings.masterVolume * 100}%` } }),
                        React.createElement('span', { className: 'setting-value' }, `${Math.round(settings.masterVolume * 100)}%`)
                    ),
                    React.createElement('div', { className: 'setting-row' },
                        React.createElement('span', { className: 'setting-label' }, 'SFX'),
                        React.createElement('input', { type: 'range', min: 0, max: 100, value: Math.round(settings.sfxVolume * 100), onChange: (e) => setSettings(s => ({ ...s, sfxVolume: Number(e.target.value) / 100 })), className: 'setting-slider', style: { '--fill': `${settings.sfxVolume * 100}%` } }),
                        React.createElement('span', { className: 'setting-value' }, `${Math.round(settings.sfxVolume * 100)}%`)
                    ),
                    React.createElement('div', { className: 'setting-row' },
                        React.createElement('span', { className: 'setting-label' }, 'Ambient'),
                        React.createElement('input', { type: 'range', min: 0, max: 100, value: Math.round(settings.ambientVolume * 100), onChange: (e) => setSettings(s => ({ ...s, ambientVolume: Number(e.target.value) / 100 })), className: 'setting-slider', style: { '--fill': `${settings.ambientVolume * 100}%` } }),
                        React.createElement('span', { className: 'setting-value' }, `${Math.round(settings.ambientVolume * 100)}%`)
                    )
                ),

                React.createElement('div', { className: 'settings-footer' },
                    React.createElement('span', { className: 'settings-hint' }, 'Changes are saved automatically'),
                    React.createElement('button', { className: 'settings-reset', onClick: () => setSettings({ ...DEFAULT_SETTINGS }) }, 'RESET')
                )
            )
        ),

        // >>> УНИВЕРСАЛЬНЫЙ СЛОЙ ДЛЯ ВСЕХ UI ПАКЕТОВ
        React.createElement(AllPacksUI, { gameState }, window.PackUIs && window.PackUIs.map((UI, i) => React.createElement(UI, { key: i, gameState })))
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(Game));
