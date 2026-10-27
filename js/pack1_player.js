/* ==================================================================
   PACK 1 — PLAYER (Физика, анимация и рендер персонажа)
   ================================================================== */
(function () {
    'use strict';

    // === СОСТОЯНИЕ ИГРОКА ===
    const PlayerState = {
        x: 100,
        y: 0,
        vx: 0,
        vy: 0,
        width: 165,
        height: 110,
        isJumping: false,
        isHoldingJump: false,
        jumpMult: 1.0,
        tilt: 0,
        bob: 0,
        charId: 'crocodile',
        
        // Анимация
        currentFrame: 0,
        lastFrameTime: 0,
        frameDelay: 80, // мс на кадр
        
        // Флаги
        isEating: false,
        isTripping: false,
        tripTimer: 0,
    };

    // Экспортируем в глобальную область (для коллизий и других модулей)
    window.PlayerState = PlayerState;

    // === ИНИЦИАЛИЗАЦИЯ ПРИ СТАРТЕ ===
    window.GameEvents.on('game_start', (data) => {
        const cfg = window.GameConfig;
        const char = cfg.CHARACTERS[data.character] || cfg.CHARACTERS['crocodile'];
        
        PlayerState.charId = char.id;
        PlayerState.width = char.baseWidth;
        PlayerState.height = char.baseHeight;
        PlayerState.x = 100;
        PlayerState.y = (cfg.GROUND_Y + (cfg.BACKGROUNDS[data.background]?.groundOffset || 0)) - PlayerState.height;
        
        PlayerState.vx = 0;
        PlayerState.vy = 0;
        PlayerState.isJumping = false;
        PlayerState.isHoldingJump = false;
        PlayerState.isEating = false;
        PlayerState.isTripping = false;
        PlayerState.tripTimer = 0;
        PlayerState.currentFrame = 0;
        PlayerState.lastFrameTime = Date.now();
    });

    // === ОБРАБОТКА ВВОДА (ПРЫЖОК) ===
    window.GameEvents.on('input_keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault && e.preventDefault();
            doJump();
        }
    });

    window.GameEvents.on('input_keyup', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            PlayerState.isHoldingJump = false;
        }
    });

    // (Для тач-устройств)
    window.GameEvents.on('input_touch_start', (e) => {
        // Если тапнули по кнопкам меню, игнорируем
        if (e.touches && e.touches[0] && e.touches[0].target.closest('.btn')) return;
        doJump();
    });

    window.GameEvents.on('input_touch_end', (e) => {
        PlayerState.isHoldingJump = false;
    });

    function doJump() {
        if (PlayerState.isJumping || PlayerState.isTripping || PlayerState.isEating) return;
        
        const baseMult = 1.0; // Можно усложнить (зависеть от дистанции)
        PlayerState.jumpMult = baseMult;
        PlayerState.vy = window.GameConfig.JUMP_FORCE * PlayerState.jumpMult;
        PlayerState.isJumping = true;
        PlayerState.isHoldingJump = true;
        
        // Отправляем событие (звук прыжка, частицы и т.д. подхватят другие модули)
        window.GameEvents.emit('jump');
    }

    // === ЛОГИКА (ТИК 60 FPS) ===
    window.GameEvents.on('tick', () => {
        const cfg = window.GameConfig;
        const gy = cfg.GROUND_Y + (cfg.BACKGROUNDS[window.GameState?.background || 'default']?.groundOffset || 0);

        // Если спотыкается/умирает — не двигаемся вперёд
        if (PlayerState.isTripping) {
            PlayerState.tripTimer++;
            if (PlayerState.tripTimer > 120) {
                PlayerState.isTripping = false;
                PlayerState.tripTimer = 0;
            }
            return;
        }

        // 1. Физика гравитации
        if (PlayerState.isJumping) {
            PlayerState.vy += cfg.GRAVITY;
            if (PlayerState.isHoldingJump) {
                PlayerState.vy -= cfg.HOLD_THRUST;
            }
            PlayerState.y += PlayerState.vy;

            // Наклон в прыжке
            PlayerState.tilt = PlayerState.vy * 0.025;
            PlayerState.tilt = Math.max(-0.35, Math.min(0.35, PlayerState.tilt));

            // Верхняя граница экрана
            if (PlayerState.y <= 0) {
                PlayerState.y = 0;
                if (PlayerState.vy < 0) PlayerState.vy = 0;
            }

            // Приземление
            if (PlayerState.y >= gy - PlayerState.height) {
                PlayerState.y = gy - PlayerState.height;
                PlayerState.vy = 0;
                PlayerState.isJumping = false;
                PlayerState.tilt = 0;
                window.GameEvents.emit('land');
            }
        } else {
            // Покачивание при беге
            PlayerState.bob = Math.sin(Date.now() / 80) * 2.5;
            PlayerState.tilt = 0;
        }

        // 2. Анимация бега
        if (!PlayerState.isJumping) {
            const now = Date.now();
            if (now - PlayerState.lastFrameTime > PlayerState.frameDelay) {
                const frames = window.GameAssets.walkFrames[PlayerState.charId] || [];
                if (frames.length > 0) {
                    PlayerState.currentFrame = (PlayerState.currentFrame + 1) % frames.length;
                }
                PlayerState.lastFrameTime = now;
            }
        }
    });

    // === РЕНДЕР (ВЫЗЫВАЕТСЯ КАЖДЫЙ КАДР) ===
    window.GameEvents.on('render_frame', (e) => {
        const ctx = e.ctx;
        if (!ctx) return;

        // Получаем нужный кадр
        let img = null;
        if (PlayerState.isEating) {
            const eatFrames = window.GameAssets.eatFrames[PlayerState.charId] || [];
            if (eatFrames.length > 0) img = eatFrames[0]; // Заглушка, полная логика поедания в pack2
        } else {
            const walkFrames = window.GameAssets.walkFrames[PlayerState.charId] || [];
            if (walkFrames.length > 0) img = walkFrames[PlayerState.currentFrame % walkFrames.length];
        }

        // Рисуем
        if (img && img.complete) {
            ctx.save();
            
            let yOffset = PlayerState.isJumping ? 0 : PlayerState.bob;
            if (PlayerState.isTripping) {
                // Логика падения (упрощённо)
                const fallProgress = Math.min(1, PlayerState.tripTimer / 15);
                const flatAmount = fallProgress;
                PlayerState.tilt = (Math.PI / 2) * flatAmount;
                yOffset = -((PlayerState.width - PlayerState.height) / 2) * flatAmount;
            }

            const centerX = PlayerState.x + PlayerState.width / 2;
            const centerY = PlayerState.y + PlayerState.height / 2 + yOffset;
            
            ctx.translate(centerX, centerY);
            ctx.rotate(PlayerState.tilt);
            
            ctx.drawImage(img, -PlayerState.width / 2, -PlayerState.height / 2, PlayerState.width, PlayerState.height);
            ctx.restore();
        } else {
            // Заглушка, если картинки не загрузились
            ctx.fillStyle = 'red';
            ctx.fillRect(PlayerState.x, PlayerState.y, PlayerState.width, PlayerState.height);
        }
    });

    console.log('%c🦖 [Pack 1] Player loaded', 'color:#00FF41;font-weight:bold');
})();
