/* ==================================================================
   PACK 1 — PLAYER (Физика, прыжки, анимация персонажа)
   ================================================================== */
(function () {
    'use strict';

    // === СОСТОЯНИЕ ИГРОКА ===
    const PlayerState = {
        x: 100,
        y: 0,
        vx: 0,
        vy: 0,
        w: 165,
        h: 110,
        isJumping: false,
        isHolding: false,
        charId: 'crocodile',
        frame: 0,
        tilt: 0,
        isEating: false,
        eatTimer: 0,
        eatFrameIdx: 0,
        lastEatFrameTime: 0,
        baseY: 0, // для прыжков и приземления
    };

    // Экспортируем состояние для доступа из pack2_world (коллизии)
    window.PlayerState = PlayerState;

    // === ИНИЦИАЛИЗАЦИЯ ПРИ СТАРТЕ ИГРЫ ===
    window.GameEvents.on('game_start', (data) => {
        const cfg = window.GameConfig;
        const char = cfg.CHARACTERS[data.character] || cfg.CHARACTERS['crocodile'];
        const bg = cfg.BACKGROUNDS[data.background] || cfg.BACKGROUNDS['default'];
        
        PlayerState.charId = char.id;
        PlayerState.w = char.w;
        PlayerState.h = char.h;
        PlayerState.x = 100;
        
        // Учитываем смещение фона (например, cartoon)
        const groundY = cfg.PHYSICS.GROUND_Y + (bg.offset || 0);
        PlayerState.baseY = groundY - PlayerState.h;
        PlayerState.y = PlayerState.baseY;
        
        PlayerState.vy = 0;
        PlayerState.isJumping = false;
        PlayerState.isHolding = false;
        PlayerState.tilt = 0;
        PlayerState.frame = 0;
        PlayerState.isEating = false;
        PlayerState.eatTimer = 0;
        PlayerState.eatFrameIdx = 0;
        PlayerState.lastEatFrameTime = Date.now();
    });

    // === ВВОД ===
    // Клавиатура
    window.GameEvents.on('input_keydown', (e) => {
        if ((e.code === 'Space' || e.code === 'ArrowUp') && !PlayerState.isJumping && !PlayerState.isEating) {
            if (e.preventDefault) e.preventDefault();
            doJump();
        }
    });

    window.GameEvents.on('input_keyup', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            PlayerState.isHolding = false;
        }
    });

    // Тач
    window.GameEvents.on('input_touch', (e) => {
        if (!PlayerState.isJumping && !PlayerState.isEating) {
            doJump();
        }
    });
    
    // Отпускание тача (для высокого прыжка)
    window.GameEvents.on('input_touch_end', () => {
        PlayerState.isHolding = false;
    });

    function doJump() {
        const cfg = window.GameConfig;
        PlayerState.vy = cfg.PHYSICS.JUMP_FORCE;
        PlayerState.isJumping = true;
        PlayerState.isHolding = true;
        window.GameEvents.emit('jump');
    }

    // === ЛОГИКА (ТИК 60 FPS) ===
    window.GameEvents.on('tick', () => {
        const cfg = window.GameConfig;
        const gravity = cfg.PHYSICS.GRAVITY;
        const holdThrust = cfg.PHYSICS.HOLD_THRUST;
        const groundY = cfg.PHYSICS.GROUND_Y + (cfg.BACKGROUNDS[window.GameState?.background || 'default']?.offset || 0);
        const floorY = groundY - PlayerState.h;

        // 1. Обработка поедания (остановка физики)
        if (PlayerState.isEating) {
            PlayerState.eatTimer++;
            const char = cfg.CHARACTERS[PlayerState.charId];
            const totalFrames = char.eatDuration || 240;
            
            // Анимация поедания
            const frames = window.GameAssets.eat[PlayerState.charId] || [];
            if (frames.length > 0) {
                const frameIdx = Math.min(frames.length - 1, Math.floor((PlayerState.eatTimer / totalFrames) * frames.length));
                PlayerState.eatFrameIdx = frameIdx;
            }
            
            // Стоим на месте
            PlayerState.y = floorY;
            PlayerState.vy = 0;
            PlayerState.isJumping = false;
            PlayerState.tilt = 0;

            // Окончание еды
            if (PlayerState.eatTimer >= totalFrames) {
                PlayerState.isEating = false;
                PlayerState.eatTimer = 0;
                PlayerState.eatFrameIdx = 0;
            }
            return;
        }

        // 2. Физика прыжка
        if (PlayerState.isJumping) {
            PlayerState.vy += gravity;
            if (PlayerState.isHolding) {
                PlayerState.vy -= holdThrust;
            }
            PlayerState.y += PlayerState.vy;

            // Наклон в прыжке
            PlayerState.tilt = PlayerState.vy * 0.025;
            PlayerState.tilt = Math.max(-0.35, Math.min(0.35, PlayerState.tilt));

            // Приземление
            if (PlayerState.y >= floorY) {
                PlayerState.y = floorY;
                PlayerState.vy = 0;
                PlayerState.isJumping = false;
                PlayerState.tilt = 0;
                window.GameEvents.emit('land');
            }
        } else {
            // Покачивание при беге
            PlayerState.y = floorY + Math.sin(Date.now() / 80) * 2.5;
        }

        // 3. Анимация бега (если не прыгаем и не едим)
        if (!PlayerState.isJumping && !PlayerState.isEating) {
            const frames = window.GameAssets.walk[PlayerState.charId] || [];
            if (frames.length > 0) {
                const speed = 0.1 + (window.WorldState?.speed || 4) * 0.02;
                PlayerState.frame = (PlayerState.frame + speed) % frames.length;
            }
        }
    });

    // === РЕНДЕР (ВЫЗЫВАЕТСЯ КАЖДЫЙ КАДР) ===
    window.GameEvents.on('render_frame', (e) => {
        const ctx = e.ctx;
        if (!ctx) return;

        let img = null;
        if (PlayerState.isEating) {
            const eatFrames = window.GameAssets.eat[PlayerState.charId] || [];
            if (eatFrames.length > 0) {
                img = eatFrames[PlayerState.eatFrameIdx % eatFrames.length];
            }
        } else {
            const walkFrames = window.GameAssets.walk[PlayerState.charId] || [];
            if (walkFrames.length > 0) {
                img = walkFrames[Math.floor(PlayerState.frame) % walkFrames.length];
            }
        }

        if (img && img.complete) {
            ctx.save();
            
            // Точка поворота — центр персонажа
            const centerX = PlayerState.x + PlayerState.w / 2;
            const centerY = PlayerState.y + PlayerState.h / 2;
            
            ctx.translate(centerX, centerY);
            ctx.rotate(PlayerState.tilt);
            
            // Рисуем картинку с учётом возможного масштаба (если персонаж вырос)
            ctx.drawImage(img, -PlayerState.w / 2, -PlayerState.h / 2, PlayerState.w, PlayerState.h);
            
            ctx.restore();
        } else {
            // Заглушка (красный прямоугольник)
            ctx.fillStyle = 'red';
            ctx.fillRect(PlayerState.x, PlayerState.y, PlayerState.w, PlayerState.h);
        }
    });

    // Экспорт функции для запуска поедания (вызывается из pack2_world при сборе еды)
    window.startEating = function() {
        PlayerState.isEating = true;
        PlayerState.eatTimer = 0;
        PlayerState.eatFrameIdx = 0;
        PlayerState.lastEatFrameTime = Date.now();
    };

    console.log('%c🦖 [Pack 1] Player loaded', 'color:#00FF41;font-weight:bold');
})();
