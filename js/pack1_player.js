/* ==================================================================
   PACK 1 — PLAYER (Физика, прыжки, анимация персонажа)
   ================================================================== */
(function () {
    'use strict';

    const PlayerState = {
        x: 100, y: 0, vy: 0, w: 165, h: 110,
        isJumping: false, isHolding: false,
        charId: 'crocodile', frame: 0, tilt: 0,
        isEating: false, eatTimer: 0, eatFrameIdx: 0,
    };

    window.PlayerState = PlayerState;

    window.GameEvents.on('game_start', (data) => {
        const cfg = window.GameConfig;
        const char = cfg.CHARACTERS[data.character] || cfg.CHARACTERS['crocodile'];
        const bg = cfg.BACKGROUNDS[data.background] || cfg.BACKGROUNDS['default'];
        
        PlayerState.charId = char.id;
        PlayerState.w = char.w;
        PlayerState.h = char.h;
        PlayerState.x = 100;
        
        const groundY = cfg.PHYSICS.GROUND_Y + (bg.offset || 0);
        PlayerState.y = groundY - PlayerState.h;
        
        PlayerState.vy = 0;
        PlayerState.isJumping = false;
        PlayerState.isHolding = false;
        PlayerState.tilt = 0;
        PlayerState.frame = 0;
        PlayerState.isEating = false;
        PlayerState.eatTimer = 0;
    });

    window.GameEvents.on('input_keydown', (e) => {
        if ((e.code === 'Space' || e.code === 'ArrowUp') && !PlayerState.isJumping && !PlayerState.isEating) {
            if (e.preventDefault) e.preventDefault();
            PlayerState.vy = window.GameConfig.PHYSICS.JUMP_FORCE;
            PlayerState.isJumping = true;
            PlayerState.isHolding = true;
            window.GameEvents.emit('jump');
        }
    });

    window.GameEvents.on('input_keyup', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') PlayerState.isHolding = false;
    });

    window.GameEvents.on('tick', () => {
        const cfg = window.GameConfig;
        const groundY = cfg.PHYSICS.GROUND_Y + (cfg.BACKGROUNDS[window.GameState?.background || 'default']?.offset || 0);
        const floorY = groundY - PlayerState.h;

        if (PlayerState.isEating) {
            PlayerState.eatTimer++;
            PlayerState.y = floorY;
            PlayerState.vy = 0;
            PlayerState.isJumping = false;
            if (PlayerState.eatTimer >= (cfg.CHARACTERS[PlayerState.charId].eatDuration || 240)) {
                PlayerState.isEating = false;
                PlayerState.eatTimer = 0;
            }
            return;
        }

        if (PlayerState.isJumping) {
            PlayerState.vy += cfg.PHYSICS.GRAVITY;
            if (PlayerState.isHolding) PlayerState.vy -= cfg.PHYSICS.HOLD_THRUST;
            PlayerState.y += PlayerState.vy;
            PlayerState.tilt = PlayerState.vy * 0.025;
            PlayerState.tilt = Math.max(-0.35, Math.min(0.35, PlayerState.tilt));

            if (PlayerState.y >= floorY) {
                PlayerState.y = floorY;
                PlayerState.vy = 0;
                PlayerState.isJumping = false;
                PlayerState.tilt = 0;
            }
        } else {
            PlayerState.y = floorY + Math.sin(Date.now() / 80) * 2.5;
            PlayerState.frame = (PlayerState.frame + 0.1) % 12;
        }
    });

    // БЕЗОПАСНЫЙ РЕНДЕР
    window.GameEvents.on('render_frame', (e) => {
        const ctx = e.ctx;
        if (!ctx) return;

        let img = null;
        
        // БЕЗОПАСНАЯ ПРОВЕРКА
        if (window.GameAssets && window.GameAssets.walk && window.GameAssets.walk[PlayerState.charId]) {
            const frames = window.GameAssets.walk[PlayerState.charId];
            if (frames && frames.length > 0) {
                img = frames[Math.floor(PlayerState.frame) % frames.length];
            }
        }

        if (img && img.complete) {
            ctx.save();
            ctx.translate(PlayerState.x + PlayerState.w / 2, PlayerState.y + PlayerState.h / 2);
            ctx.rotate(PlayerState.tilt);
            ctx.drawImage(img, -PlayerState.w / 2, -PlayerState.h / 2, PlayerState.w, PlayerState.h);
            ctx.restore();
        } else {
            // Заглушка, если картинки нет
            ctx.fillStyle = 'red';
            ctx.fillRect(PlayerState.x, PlayerState.y, PlayerState.w, PlayerState.h);
        }
    });

    window.startEating = function() {
        PlayerState.isEating = true;
        PlayerState.eatTimer = 0;
    };

    console.log('%c🦖 [Pack 1] Player loaded', 'color:#00FF41;font-weight:bold');
})();
