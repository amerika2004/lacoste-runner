(function () {
    'use strict';
    const W = { dist: 0, speed: 4, bgOffset: 0, health: 6, alive: true, obs: [], foods: [], spawnT: 0, foodT: 0, tripT: 0, tripping: false };
    window.WorldState = W;

    const imgs = { 
        puddle: new Image(), puddleN: new Image(), rock: new Image(), rockN: new Image(), 
        pit: new Image(), pitN: new Image(), barrel: new Image(), barrelN: new Image(), 
        cactus: new Image(), cactusN: new Image() 
    };
    imgs.puddle.src = 'source/puddle.png'; imgs.puddleN.src = 'source/puddle_n.png'; 
    imgs.rock.src = 'source/rock.png'; imgs.rockN.src = 'source/rock_n.png'; 
    imgs.pit.src = 'source/pit.png'; imgs.pitN.src = 'source/pit_n.png'; 
    imgs.barrel.src = 'source/barrel.png'; imgs.barrelN.src = 'source/barrel_n.png'; 
    imgs.cactus.src = 'source/cactus.png'; imgs.cactusN.src = 'source/cactus_n.png';

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
        W.spawnT = 0; W.foodT = 0; W.tripT = 0; W.tripping = false; 
        curBg = d.background; curTime = d.timeOfDay; 
    });

    window.GameEvents.on('tick', () => {
        if (!W.alive) return; 
        const p = window.PlayerState; 
        const bg = window.GameConfig.BACKGROUNDS[curBg]; 
        const gy = window.GameConfig.PHYSICS.GROUND_Y + (bg?.groundOffset || 0); 
        if (!p) return;

        let spd = 0; 
        if (!W.tripping && !p.isEating) { 
            spd = W.speed * window.GameConfig.SPEED.SPEED_MULTIPLIER; 
            W.dist += spd * 0.03; W.bgOffset -= spd; 
        }

        if (!W.tripping && !p.isEating) {
            W.spawnT++; 
            if (W.spawnT > 100) { 
                const types = bg.obstacleTypes || ['barrel']; 
                const t = types[Math.floor(Math.random() * types.length)]; 
                let w = 40, h = 40, yo = 0; 
                if (t === 'rock') { w = 120; h = 120; yo = 30; } 
                if (t === 'cactus') { w = 70; h = 110; } 
                if (t === 'barrel') { w = 50; h = 60; } 
                if (t === 'puddle') { w = 120; h = 120; yo = 30; } 
                if (t === 'pit') { w = 140; h = 90; yo = 40; } 
                W.obs.push({ x: 1200, y: gy - h + yo, w, h, type: t }); 
                W.spawnT = 0; 
            }
            W.foodT++; 
            if (W.foodT > 150) { 
                const ch = window.GameCharacters[p.charId]; 
                const list = ch?.foodEmojis || ['🍗']; 
                W.foods.push({ x: 1200, y: Math.random() > 0.5 ? gy - 80 : gy - 40, w: 40, h: 40, emoji: list[Math.floor(Math.random() * list.length)], type: 'normal' }); 
                W.foodT = 0; 
            }
        }

        W.obs.forEach(o => o.x -= spd); W.obs = W.obs.filter(o => o.x + o.w > 0); 
        W.foods.forEach(f => f.x -= spd); W.foods = W.foods.filter(f => f.x + f.w > 0);

        if (!W.tripping && !p.isEating) {
            for (let i = W.obs.length - 1; i >= 0; i--) {
                const o = W.obs[i]; 
                const px = p.x + p.w * 0.6, py = p.y + p.h * 0.4, pw = p.w * 0.25, ph = p.h * 0.4;
                if (px < o.x + o.w && px + pw > o.x && py < o.y + o.h && py + ph > o.y) {
                    W.obs.splice(i, 1); 
                    if (o.type === 'pit') { W.alive = false; window.GameEvents.emit('gameover', { distance: W.dist, health: 0 }); return; }
                    W.health -= 1; W.tripping = true; W.tripT = 0; 
                    window.GameEvents.emit('hit', { health: W.health, type: o.type }); 
                    if (W.health <= 0) { W.alive = false; window.GameEvents.emit('gameover', { distance: W.dist, health: 0 }); return; } 
                    break;
                }
            }
        }

        if (W.tripping) { W.tripT++; if (W.tripT > 60) W.tripping = false; }

        for (let i = W.foods.length - 1; i >= 0; i--) {
            const f = W.foods[i]; 
            const px = p.x + 20, py = p.y + 20, pw = p.w - 40, ph = p.h - 20;
            if (px < f.x + f.w && px + pw > f.x && py < f.y + f.h && py + ph > f.y) { 
                W.foods.splice(i, 1); 
                window.GameEvents.emit('eat', { type: f.type, emoji: f.emoji }); 
                if (p.char?.eatEmoji === f.emoji && window.startEating) window.startEating(); 
            }
        }
        
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
        
        W.obs.forEach(o => { 
            let img = null; 
            if (o.type === 'puddle') img = curTime === 'night' ? imgs.puddleN : imgs.puddle; 
            else if (o.type === 'rock') img = curTime === 'night' ? imgs.rockN : imgs.rock; 
            else if (o.type === 'pit') img = curTime === 'night' ? imgs.pitN : imgs.pit; 
            else if (o.type === 'barrel') img = curTime === 'night' ? imgs.barrelN : imgs.barrel; 
            else if (o.type === 'cactus') img = curTime === 'night' ? imgs.cactusN : imgs.cactus; 
            if (img?.complete) ctx.drawImage(img, o.x, o.y, o.w, o.h); 
            else { ctx.fillStyle = o.type === 'pit' ? 'black' : '#888'; ctx.fillRect(o.x, o.y, o.w, o.h); } 
        });
        
        ctx.textBaseline = 'bottom'; 
        W.foods.forEach(f => { ctx.font = '40px Arial'; ctx.fillText(f.emoji, f.x, f.y + f.h); });
    });
    
    window.GameEvents.on('game_abort', () => { W.alive = false; });
    console.log('🌍 World loaded');
})();
