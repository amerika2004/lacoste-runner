/* ==================================================================
   PACK 1 — Advanced Game Feel: Audio, Vibration, Visual Juice
   (Система комбо оставлена без изменений, добавлены новые фичи)
   ================================================================== */
(function () {
    'use strict';

    const COMBO_CONFIG = (window.GAME_CONFIG && window.GAME_CONFIG.combo) || {
        decayTimeMs: 3000,
        tiers: [
            { threshold: 3, mult: 2, emoji: '😎', color: '#00FFFF' },
            { threshold: 5, mult: 3, emoji: '🔥', color: '#FFD700' },
            { threshold: 10, mult: 5, emoji: '👑', color: '#FF007F' },
            { threshold: 20, mult: 10, emoji: '🌈', color: '#FFFFFF' }
        ],
        sadEmoji: '😢',
        sadColor: '#888888'
    };

    // === СОСТОЯНИЕ ПАКЕТА 1 ===
    const Pack1State = {
        // Combo State
        combo: 0,
        comboMult: 1,
        comboDisplay: { mult: 1, count: 0 },
        lastJumpTime: 0,
        uiListeners: [],
        activeEmojis: [], 
        
        // Game Feel State
        settings: null,
        audios: { jump: null, hit: null, land: null, eat: null, milestone: null },
        lastHealth: 6,
        lowHealthPulse: 0,
        lastMilestone: 0,
        milestonesActive: [], // { text, x, y, life, color }
        
        // Внутренние флаги
        isFalling: false, // Для отслеживания приземления
    };

    window.Pack1State = Pack1State;

    // === ИНИЦИАЛИЗАЦИЯ ЗВУКОВ ===
    function initSounds() {
        const soundPaths = {
            jump: 'source/sounds/jump.wav',
            hit: 'source/sounds/hit.wav', // Если нет, замените на что-то другое
            land: 'source/sounds/land.wav', // Если нет, замените
            eat: 'source/sounds/eat.wav',   // Если нет, замените
            milestone: 'source/sounds/milestone.wav' // Если нет, замените
        };

        for (const [key, path] of Object.entries(soundPaths)) {
            if (!Pack1State.audios[key]) {
                const audio = new Audio(path);
                audio.preload = 'auto';
                Pack1State.audios[key] = audio;
            }
        }
    }

    function playSound(key, rate = 1.0) {
        const audio = Pack1State.audios[key];
        if (audio && Pack1State.settings && Pack1State.settings.soundEnabled) {
            audio.currentTime = 0;
            audio.playbackRate = rate;
            audio.volume = (Pack1State.settings.sfxVolume || 0.7) * (Pack1State.settings.masterVolume || 1.0);
            audio.play().catch(() => {});
        }
    }

    function vibrate(pattern) {
        if (navigator.vibrate) {
            try { navigator.vibrate(pattern); } catch (e) {}
        }
    }

    // === УТИЛИТЫ КОМБО (БЕЗ ИЗМЕНЕНИЙ) ===
    function updateUI() {
        Pack1State.uiListeners.forEach(fn => fn({ ...Pack1State.comboDisplay }));
    }

    function resetCombo(triggerSadEmoji = false, x = 0, y = 0) {
        if (Pack1State.combo > 0 && triggerSadEmoji && Pack1State.settings?.comboVisualsEnabled) {
            Pack1State.activeEmojis.push({
                text: COMBO_CONFIG.sadEmoji, x: x, y: y - 50,
                life: 60, maxLife: 60, color: COMBO_CONFIG.sadColor, scale: 1.5, vy: -2 
            });
        }
        Pack1State.combo = 0;
        Pack1State.comboMult = 1;
        Pack1State.comboDisplay = { mult: 1, count: 0 };
        updateUI();
    }

    function addCombo(x, y) {
        if (Pack1State.settings && !Pack1State.settings.comboEnabled) return;
        
        Pack1State.combo++;
        Pack1State.lastJumpTime = Date.now();

        let currentTier = { mult: 1, emoji: '', color: '#FFF' };
        for (const tier of COMBO_CONFIG.tiers) {
            if (Pack1State.combo >= tier.threshold) currentTier = tier;
        }

        const prevMult = Pack1State.comboMult;
        Pack1State.comboMult = currentTier.mult;
        Pack1State.comboDisplay = { mult: currentTier.mult, count: Pack1State.combo };

        if (Pack1State.settings?.comboVisualsEnabled) {
            if (currentTier.mult > prevMult && currentTier.emoji) {
                Pack1State.activeEmojis.push({
                    text: currentTier.emoji, x: x, y: y - 30,
                    life: 80, maxLife: 80, color: currentTier.color, scale: 2.0, vy: -3
                });
                if (window.RenderEngine) {
                    window.RenderEngine.spawnParticles(x, y, 20, {
                        colors: [currentTier.color, '#FFFFFF'], speed: 6, life: 30, size: 3, gravity: -0.1, shape: 'spark'
                    });
                }
            } else {
                const smallEmojis = ['👍', '❤️', '✨', '💯'];
                const randEmoji = smallEmojis[Math.floor(Math.random() * smallEmojis.length)];
                Pack1State.activeEmojis.push({
                    text: randEmoji, x: x + (Math.random() - 0.5) * 40, y: y - 20,
                    life: 40, maxLife: 40, color: '#FFFFFF', scale: 1.0, vy: -2
                });
            }
        }
        updateUI();
    }

    // === ПОДПИСКА НА СОБЫТИЯ ИГРЫ ===
    
    window.GameEvents.on('start', (data) => {
        initSounds();
        resetCombo(false);
        Pack1State.settings = data.settings;
        Pack1State.activeEmojis = [];
        Pack1State.milestonesActive = [];
        Pack1State.lastHealth = 6;
        Pack1State.lastMilestone = 0;
        Pack1State.lowHealthPulse = 0;
        Pack1State.isFalling = false;
    });

    window.GameEvents.on('jump', (data) => {
        addCombo(data.x || 100, data.y || 400);
        // Высота звука растет с комбо
        playSound('jump', 1.0 + Math.min(Pack1State.combo * 0.02, 0.5));
        vibrate(15);
        Pack1State.isFalling = true; // Персонаж в воздухе
    });

       window.GameEvents.on('land', () => {
        // Проигрываем звук приземления (если он есть)
        playSound('land');
    });

    window.GameEvents.on('hit', (data) => {
        resetCombo(true, data.playerX || 100, data.playerY || 400);
        playSound('hit');
        vibrate([30, 50, 30]);
        
        if (window.RenderEngine) {
            window.RenderEngine.flash('255,0,0', 0.4);
            window.RenderEngine.shake(6, 12);
            window.RenderEngine.spawnParticles(data.playerX || 100, data.playerY || 400, 15, {
                colors: ['#FF007F', '#FFFFFF'], speed: 4, life: 25, size: 3, gravity: 0.15
            });
        }
    });

    window.GameEvents.on('barrel_hit', (data) => {
        resetCombo(true, data.x || 100, data.y || 400);
        playSound('hit');
        vibrate([40, 60, 40]);
    });

    window.GameEvents.on('eat', (data) => {
        playSound('eat', 1.2);
        vibrate(10);

        // Визуальный фидбек от еды
        if (window.RenderEngine) {
            window.RenderEngine.spawnParticles(100, 400, 10, { // Координаты примерные, так как игра не шлет их в событии eat
                colors: ['#FFD700', '#FFAA00'], speed: 3, life: 30, size: 4, gravity: 0.1
            });
        }
    });

    // Отслеживаем тики для затухания комбо, приземлений, здоровья и рубежей
    window.GameEvents.on('tick', (data) => {
        if (data.settings) Pack1State.settings = data.settings;
        
        // 1. Затухание комбо
        if (Pack1State.combo > 0 && Pack1State.settings?.comboEnabled) {
            const timeSinceLastJump = Date.now() - Pack1State.lastJumpTime;
            if (timeSinceLastJump > COMBO_CONFIG.decayTimeMs) {
                resetCombo(false);
            }
        }

        // 2. Проверка здоровья (для красной пульсации)
        if (data.health !== undefined) {
            if (data.health <= 2 && data.health > 0) {
                Pack1State.lowHealthPulse += 0.1; // Ускоряем пульс
            } else {
                Pack1State.lowHealthPulse = 0;
            }
            Pack1State.lastHealth = data.health;
        }

        // 3. Рубежи дистанции
        if (data.distance !== undefined) {
            const currentMile = Math.floor(data.distance / 100);
            if (currentMile > Pack1State.lastMilestone && currentMile > 0) {
                Pack1State.lastMilestone = currentMile;
                playSound('milestone', 1.0 + (currentMile % 5) * 0.1); // Каждые 500м звук выше
                vibrate([20, 100, 20]);
                
                Pack1State.milestonesActive.push({
                    text: `${currentMile * 100}m! ✨`,
                    x: 600, y: 200, // Центр экрана (примерно)
                    life: 120, maxLife: 120, color: '#FFD700', scale: 1.5, vy: -1
                });

                if (window.RenderEngine) {
                    window.RenderEngine.spawnParticles(600, 300, 40, {
                        colors: ['#FFD700', '#FF007F', '#00FFFF'], speed: 8, life: 60, size: 4, gravity: 0.05
                    });
                }
            }
        }
    });

    window.GameEvents.on('gameover', () => {
        resetCombo(false);
        Pack1State.activeEmojis = [];
        Pack1State.milestonesActive = [];
        Pack1State.lowHealthPulse = 0;
    });


    // === РЕНДЕР ЭФФЕКТОВ НА КАНВАСЕ ===
    window.GameEvents.on('render_frame', ({ ctx }) => {
        // 1. Рендер эмодзи комбо
        if (Pack1State.activeEmojis.length) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let i = Pack1State.activeEmojis.length - 1; i >= 0; i--) {
                const e = Pack1State.activeEmojis[i];
                e.y += e.vy; e.life--;
                if (e.life <= 0) { Pack1State.activeEmojis.splice(i, 1); continue; }
                
                const progress = e.life / e.maxLife;
                ctx.globalAlpha = Math.min(1, Math.max(0, progress > 0.8 ? (1 - progress) / 0.2 : progress));
                ctx.font = `${Math.floor(30 * e.scale)}px Arial`;
                ctx.fillText(e.text, e.x, e.y);
            }
            ctx.restore();
        }

        // 2. Рендер текста рубежей
        if (Pack1State.milestonesActive.length) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let i = Pack1State.milestonesActive.length - 1; i >= 0; i--) {
                const m = Pack1State.milestonesActive[i];
                m.y += m.vy; m.life--;
                if (m.life <= 0) { Pack1State.milestonesActive.splice(i, 1); continue; }
                
                const progress = m.life / m.maxLife;
                ctx.globalAlpha = Math.min(1, Math.max(0, progress));
                ctx.font = `bold ${Math.floor(40 * m.scale)}px Arial`;
                ctx.fillStyle = m.color;
                ctx.shadowColor = '#000';
                ctx.shadowBlur = 10;
                ctx.fillText(m.text, m.x, m.y);
            }
            ctx.restore();
        }

        // 3. Красная пульсация при низком здоровье
        if (Pack1State.lastHealth <= 2 && Pack1State.lastHealth > 0) {
            ctx.save();
            // Пульсирующая альфа от 0.1 до 0.4
            const alpha = 0.15 + Math.sin(Pack1State.lowHealthPulse) * 0.15;
            
            // Рисуем виньетку по краям
            const grad = ctx.createRadialGradient(
                ctx.canvas.width / 2, ctx.canvas.height / 2, Math.min(ctx.canvas.width, ctx.canvas.height) * 0.4,
                ctx.canvas.width / 2, ctx.canvas.height / 2, Math.max(ctx.canvas.width, ctx.canvas.height) * 0.7
            );
            grad.addColorStop(0, 'rgba(255,0,0,0)');
            grad.addColorStop(1, `rgba(255,0,0,${alpha})`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.restore();
        }
    });

    // === UI КОМПОНЕНТ (Индикатор комбо) ===
    function Pack1UI({ gameState }) {
        const [display, setDisplay] = React.useState(Pack1State.comboDisplay);

        React.useEffect(() => {
            Pack1State.uiListeners.push(setDisplay);
            return () => {
                const idx = Pack1State.uiListeners.indexOf(setDisplay);
                if (idx >= 0) Pack1State.uiListeners.splice(idx, 1);
            };
        }, []);

        if (display.mult <= 1 || gameState !== 'playing') return null;

        let tierColor = '#FFFFFF';
        for (const tier of COMBO_CONFIG.tiers) {
            if (display.count >= tier.threshold) tierColor = tier.color;
        }

        return React.createElement('div', {
            key: display.count, 
            className: `combo-indicator combo-x${display.mult}`,
        }, `COMBO x${display.mult}  [${display.count}]`);
    }

    if (window.PackUIs) {
        window.PackUIs.push(Pack1UI);
    } else {
        window.PackUIs = [Pack1UI];
    }

    console.log('%c🔥 PACK 1 (Advanced Game Feel) loaded', 'color:#FF007F;font-weight:bold;font-size:14px');
})();
