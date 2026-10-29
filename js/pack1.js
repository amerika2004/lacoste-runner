/* ==================================================================
   PACK 1 — Advanced Combo System, Floating Emojis, Audio, Vibration
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

    const Pack1State = {
        combo: 0,
        comboMult: 1,
        comboDisplay: { mult: 1, count: 0 },
        jumpAudio: null,
        settings: null,
        uiListeners: [],
        activeEmojis: [], // { text, x, y, life, maxLife, color, scale }
        lastJumpTime: 0,
    };

    window.Pack1State = Pack1State;

    function initSounds() {
        if (!Pack1State.jumpAudio) {
            Pack1State.jumpAudio = new Audio('source/sounds/jump.wav');
            Pack1State.jumpAudio.preload = 'auto';
        }
    }

    function updateUI() {
        Pack1State.uiListeners.forEach(fn => fn({ ...Pack1State.comboDisplay }));
    }

    function resetCombo(triggerSadEmoji = false, x = 0, y = 0) {
        if (Pack1State.combo > 0 && triggerSadEmoji && Pack1State.settings?.comboVisualsEnabled) {
            // Добавляем грустный эмодзи, если было активное комбо
            Pack1State.activeEmojis.push({
                text: COMBO_CONFIG.sadEmoji,
                x: x, y: y - 50,
                life: 60, maxLife: 60,
                color: COMBO_CONFIG.sadColor,
                scale: 1.5,
                vy: -2 // медленно летит вверх
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
            if (Pack1State.combo >= tier.threshold) {
                currentTier = tier;
            }
        }

        const prevMult = Pack1State.comboMult;
        Pack1State.comboMult = currentTier.mult;
        Pack1State.comboDisplay = { mult: currentTier.mult, count: Pack1State.combo };

        // Визуал: Спавним эмодзи при достижении нового тира или каждый прыжок
        if (Pack1State.settings?.comboVisualsEnabled) {
            // Если только что апнули тир - спавним большой эмодзи
            if (currentTier.mult > prevMult && currentTier.emoji) {
                Pack1State.activeEmojis.push({
                    text: currentTier.emoji,
                    x: x, y: y - 30,
                    life: 80, maxLife: 80,
                    color: currentTier.color,
                    scale: 2.0,
                    vy: -3
                });
                // Дополнительные искры
                if (window.RenderEngine) {
                    window.RenderEngine.spawnParticles(x, y, 20, {
                        colors: [currentTier.color, '#FFFFFF'], speed: 6, life: 30, size: 3, gravity: -0.1, shape: 'spark'
                    });
                }
            } else {
                // Обычный маленький эмодзи (лайк/сердечко) за каждый прыжок
                const smallEmojis = ['👍', '❤️', '✨', '💯'];
                const randEmoji = smallEmojis[Math.floor(Math.random() * smallEmojis.length)];
                Pack1State.activeEmojis.push({
                    text: randEmoji,
                    x: x + (Math.random() - 0.5) * 40, y: y - 20,
                    life: 40, maxLife: 40,
                    color: '#FFFFFF',
                    scale: 1.0,
                    vy: -2
                });
            }
        }

        updateUI();
    }

    function vibrate(pattern) {
        if (navigator.vibrate) {
            try { navigator.vibrate(pattern); } catch (e) {}
        }
    }

    function playJumpSound() {
        if (Pack1State.jumpAudio && Pack1State.settings && Pack1State.settings.soundEnabled) {
            Pack1State.jumpAudio.currentTime = 0;
            // Чем выше комбо, тем выше тон (опционально)
            Pack1State.jumpAudio.playbackRate = 1.0 + Math.min(Pack1State.combo * 0.02, 0.5);
            Pack1State.jumpAudio.play().catch(() => {});
        }
    }

    // === ПОДПИСКА НА СОБЫТИЯ ===
    
    window.GameEvents.on('start', (data) => {
        initSounds();
        resetCombo(false);
        Pack1State.settings = data.settings;
        Pack1State.activeEmojis = [];
    });

    // Прыжок: получаем координаты персонажа
    window.GameEvents.on('jump', (data) => {
        addCombo(data.x || 100, data.y || 400);
        playJumpSound();
        vibrate(15);
    });

    // Столкновение
    window.GameEvents.on('hit', (data) => {
        resetCombo(true, data.playerX || 100, data.playerY || 400);
        vibrate([30, 50, 30]);
        
        if (window.RenderEngine) {
            window.RenderEngine.flash('255,0,0', 0.4);
            window.RenderEngine.shake(6, 12);
        }
    });

    window.GameEvents.on('barrel_hit', (data) => {
        resetCombo(true, data.x || 100, data.y || 400);
        vibrate([40, 60, 40]);
    });

    // Тик: проверяем затухание комбо
    window.GameEvents.on('tick', (data) => {
        if (data.settings) Pack1State.settings = data.settings;
        
        if (Pack1State.combo > 0 && Pack1State.settings?.comboEnabled) {
            const timeSinceLastJump = Date.now() - Pack1State.lastJumpTime;
            if (timeSinceLastJump > COMBO_CONFIG.decayTimeMs) {
                // Время вышло, сбрасываем комбо без грустного эмодзи (так как это не удар)
                resetCombo(false);
            }
        }
    });

    window.GameEvents.on('eat', (data) => {
        if (data.type === 'poison') vibrate([50, 100, 50]);
        else if (data.type === 'golden') vibrate(10);
    });

    window.GameEvents.on('gameover', () => {
        resetCombo(false);
        Pack1State.activeEmojis = [];
    });

    // === РЕНДЕР ЭМОДЗИ НА КАНВАСЕ ===
    window.GameEvents.on('render_frame', ({ ctx }) => {
        if (!Pack1State.activeEmojis.length) return;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        for (let i = Pack1State.activeEmojis.length - 1; i >= 0; i--) {
            const e = Pack1State.activeEmojis[i];
            
            // Обновляем позицию (летит вверх)
            e.y += e.vy;
            e.life--;

            if (e.life <= 0) {
                Pack1State.activeEmojis.splice(i, 1);
                continue;
            }

            const progress = e.life / e.maxLife;
            // Плавное появление и исчезновение
            const alpha = progress > 0.8 ? (1 - progress) / 0.2 : progress;
            
            ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
            ctx.font = `${Math.floor(30 * e.scale)}px Arial`;
            ctx.fillText(e.text, e.x, e.y);
        }
        ctx.restore();
    });

    // === UI КОМПОНЕНТ (Индикатор комбо в углу) ===
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

        // Находим цвет текущего тира
        let tierColor = '#FFFFFF';
        for (const tier of COMBO_CONFIG.tiers) {
            if (display.count >= tier.threshold) tierColor = tier.color;
        }

        return React.createElement('div', {
            key: display.count, 
            className: `combo-indicator combo-x${display.mult}`,
            style: { color: tierColor, textShadow: `0 0 10px ${tierColor}, 2px 2px 0 #000` }
        }, `COMBO x${display.mult}  [${display.count}]`);
    }

    if (window.PackUIs) {
        window.PackUIs.push(Pack1UI);
    } else {
        window.PackUIs = [Pack1UI];
    }

    console.log('%c🔥 PACK 1 (Advanced Combo) loaded', 'color:#FF007F;font-weight:bold;font-size:14px');
})();
