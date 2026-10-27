(function () {
    'use strict';
    const W = { dist: 0, speed: 4, bgOffset: 0, health: 6, alive: true, obs: [], foods: [], spawnT: 0, foodT: 0, tripping: false };
    window.WorldState = W;

    // Картинки фона
    const bgImgs = {}; 
    Object.values(window.GameConfig.BACKGROUNDS).forEach(bg => { 
        const d = new Image(); d.src = bg.dayImg; 
        const n = new Image(); n.src = bg.nightImg; 
        bgImgs[bg.id] = { day: d, night: n }; 
    });
    let curBg = 'default', curTime = 'day';

    window.GameEvents.on('game_start', (d) => { 
        W.dist = 0; W.speed = window.GameConfig.SPEED.BASE_SPEED; W.bgOffset = 0; 
        W.health = 6; W.alive = true; W.obs = []; W.foods = []; 
        W.spawnT = 0; W.foodT = 0; W.tripping = false; 
        curBg = d.background || 'default'; curTime = d.timeOfDay || 'day'; 
        console.log(`🌍 World Init: bg=${curBg}, time=${curTime}`);
    });

    window.GameEvents.on('tick', () => {
        if (!W.alive) return; 
        const p = window.PlayerState; 
        // Если игрок еще не создан, ничего не двигаем
        if (!p) return; 

        const spd = W.speed * window.GameConfig.SPEED.SPEED_MULTIPLIER; 
        if (!W.tripping && !p.isEating) { 
            W.dist += spd * 0.03; W.bgOffset -= spd; 
        }

        // Двигаем препятствия и еду
        if (!W.tripping && !p.isEating) {
            W.spawnT++; 
            if (W.spawnT > 100) { 
                const bg = window.GameConfig.BACKGROUNDS[curBg];
                const types = bg?.obstacleTypes || ['barrel']; 
                const t = types[Math.floor(Math.random() * types.length)]; 
                let w = 40, h = 40, yo = 0; 
                if (t === 'rock') { w = 120; h = 120; yo = 30; } 
                if (t === 'cactus') { w = 70; h = 110; } 
                if (t === 'barrel') { w = 50; h = 60; } 
                if (t === 'puddle') { w = 120; h = 120; yo = 30; } 
                if (t === 'pit') { w = 140; h = 90; yo = 40; } 
                const gy = window.GameConfig.PHYSICS.GROUND_Y + (bg?.groundOffset || 0);
                W.obs.push({ x: 1200, y: gy - h + yo, w, h, type: t }); 
                W.spawnT = 0; 
            }
            W.foodT++; 
            if (W.foodT > 150) { 
                const ch = window.GameCharacters[p.charId]; 
                const list = ch?.foodEmojis || ['🍗']; 
                const gy = window.GameConfig.PHYSICS.GROUND_Y + (window.GameConfig.BACKGROUNDS[curBg]?.groundOffset || 0);
                W.foods.push({ x: 1200, y: Math.random() > 0.5 ? gy - 80 : gy - 40, w: 40, h: 40, emoji: list[Math.floor(Math.random() * list.length)], type: 'normal' }); 
                W.foodT = 0; 
            }
        }

        W.obs.forEach(o => o.x -= spd); W.obs = W.obs.filter(o => o.x + o.w > 0); 
        W.foods.forEach(f => f.x -= spd); W.foods = W.foods.filter(f => f.x + f.w > 0);
        
        window.GameEvents.emit('world_tick', { distance: W.dist, health: W.health });
    });

    window.GameEvents.on('render_frame', (e) => {
        const ctx = e.ctx; 
        const bg = bgImgs[curBg]?.[curTime];
        if (bg?.complete) { 
            const sc = 600 / bg.naturalHeight; const w = bg.naturalWidth * sc; 
            let off = W.bgOffset % w; if (off > 0) off -= w; 
            for (let i = off; i < 1200; i += w) ctx.drawImage(bg, i, 0, w, 600); 
        } else { 
            ctx.fillStyle = curTime === 'night' ? '#0a0512' : '#1a0b2e'; ctx.fillRect(0, 0, 1200, 600); 
        }
        
        ctx.textBaseline = 'bottom'; 
        W.foods.forEach(f => { ctx.font = '40px Arial'; ctx.fillText(f.emoji, f.x, f.y + f.h); });
    });
    
    console.log('🌍 World plugin loaded');
})();
