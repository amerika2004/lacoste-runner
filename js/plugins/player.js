(function () {
    'use strict';
    const P = { 
        x: 100, y: 400, vy: 0, w: 165, h: 110, 
        isJumping: false, isHolding: false, 
        charId: 'crocodile', char: null, frame: 0, tilt: 0, 
        walkFrames: [], eatFrames: [], 
        isEating: false, eatTimer: 0 
    };
    window.PlayerState = P;

    window.GameEvents.on('game_start', (d) => {
        // Защита: если персонаж не найден, берем крокодила (или заглушку)
        const chars = window.GameCharacters || {};
        P.char = chars[d.character] || chars.crocodile || { baseWidth: 150, baseHeight: 100, folder: 'source/characters/crocodile', frameCount: 12 };
        
        P.charId = P.char.id || 'crocodile'; 
        P.w = P.char.baseWidth; P.h = P.char.baseHeight;
        
        const bg = window.GameConfig.BACKGROUNDS[d.background] || window.GameConfig.BACKGROUNDS.default;
        P.y = window.GameConfig.PHYSICS.GROUND_Y + (bg?.groundOffset || 0) - P.h;
        P.vy = 0; P.isJumping = false; P.isEating = false; P.eatTimer = 0;
        
        P.walkFrames = []; 
        for (let i = 1; i <= P.char.frameCount; i++) { 
            const img = new Image(); img.src = `${P.char.folder}/${i}.png`; P.walkFrames.push(img); 
        }
        
        console.log(`🦖 Player Init: ${P.charId}, x=${P.x}, y=${P.y}, w=${P.w}, h=${P.h}`);
    });

    const doJump = () => { 
        if (P.isJumping || P.isEating) return; 
        P.vy = window.GameConfig.PHYSICS.JUMP_FORCE; 
        P.isJumping = true; P.isHolding = true; 
        window.GameEvents.emit('jump'); 
    };
    
    window.GameEvents.on('input_keydown', (e) => { 
        if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault?.(); doJump(); } 
    });
    window.GameEvents.on('input_touch_start', doJump);

    window.GameEvents.on('tick', () => {
        const cfg = window.GameConfig; 
        const bg = cfg.BACKGROUNDS[localStorage.getItem('lacosteBackground') || 'default'];
        const floorY = cfg.PHYSICS.GROUND_Y + (bg?.groundOffset || 0) - P.h;
        
        if (P.isEating) { 
            P.eatTimer++; P.y = floorY; P.vy = 0; 
            if (P.eatTimer >= 240) { P.isEating = false; P.eatTimer = 0; } 
            return; 
        }
        
        if (P.isJumping) { 
            P.vy += cfg.PHYSICS.GRAVITY; 
            if (P.isHolding) P.vy -= cfg.PHYSICS.HOLD_THRUST; 
            P.y += P.vy; 
            P.tilt = Math.max(-0.35, Math.min(0.35, P.vy * 0.025)); 
            if (P.y >= floorY) { P.y = floorY; P.vy = 0; P.isJumping = false; P.tilt = 0; } 
        } else { 
            P.y = floorY + Math.sin(Date.now() / 80) * 2.5; 
            P.frame = (P.frame + 0.1) % (P.walkFrames.length || 12); 
        }
    });

    window.GameEvents.on('render_frame', (e) => {
        const ctx = e.ctx; 
        let img = (P.isEating && P.eatFrames.length) ? P.eatFrames[0] : (P.walkFrames.length ? P.walkFrames[Math.floor(P.frame) % P.walkFrames.length] : null);
        
        if (img && img.complete) { 
            ctx.save(); 
            ctx.translate(P.x + P.w / 2, P.y + P.h / 2); 
            ctx.rotate(P.tilt); 
            ctx.drawImage(img, -P.w / 2, -P.h / 2, P.w, P.h); 
            ctx.restore(); 
        } else { 
            // Если картинки нет, рисуем заметный красный квадрат
            ctx.fillStyle = 'red'; 
            ctx.fillRect(P.x, P.y, P.w, P.h); 
        }
    });
    
    window.startEating = () => { P.isEating = true; P.eatTimer = 0; };
    console.log('🦖 Player plugin loaded');
})();
