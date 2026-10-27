/* ==================================================================
   PACK 2 — WORLD (Фон, Спавн, Коллизии, Еда, Смерть)
   ================================================================== */
(function () {
    'use strict';

    // === СОСТОЯНИЕ МИРА ===
    const WorldState = {
        distance: 0,
        speed: 4,
        bgOffset: 0,
        isAlive: true,
        health: 6,
        background: 'default',
        timeOfDay: 'day',
        
        obstacles: [],
        foods: [],
        explosions: [],
        
        spawnTimer: 0,
        foodTimer: 0,
        spawnCooldown: 0,
        
        isTripping: false,
        tripTimer: 0,
    };

    // Экспортируем для UI и других модулей
    window.WorldState = WorldState;

    // === ИНИЦИАЛИЗАЦИЯ ПРИ СТАРТЕ ===
    window.GameEvents.on('game_start', (data) => {
        const cfg = window.GameConfig;
        WorldState.distance = 0;
        WorldState.speed = cfg.SPEED.BASE_SPEED;
        WorldState.bgOffset = 0;
        WorldState.isAlive = true;
        WorldState.health = 6;
        WorldState.background = data.background || 'default';
        WorldState.timeOfDay = data.timeOfDay || 'day';
        
        WorldState.obstacles = [];
        WorldState.foods = [];
        WorldState.explosions = [];
        WorldState.spawnTimer = 0;
        WorldState.foodTimer = 0;
        WorldState.spawnCooldown = 0;
        WorldState.isTripping = false;
        WorldState.tripTimer = 0;
    });

    // === ЛОГИКА (ТИК 60 FPS) ===
    window.GameEvents.on('tick', () => {
        if (!WorldState.isAlive) return;

        const cfg = window.GameConfig;
        const p = window.PlayerState;
        const bgConfig = cfg.BACKGROUNDS[WorldState.background];
        const groundY = cfg.PHYSICS.GROUND_Y + (bgConfig.offset || 0);
        
        // 1. Скорость (если не спотыкаемся и не едим)
        let currentSpeed = 0;
        if (!WorldState.isTripping && !p.isEating) {
            currentSpeed = WorldState.speed * cfg.SPEED.SPEED_MULTIPLIER;
            // Множитель из Пакета 6
let comboMult = 1;
if (window.StatsState && window.StatsState.comboMult) {
    comboMult = window.StatsState.comboMult;
}
WorldState.distance += currentSpeed * 0.03 * comboMult;
            WorldState.bgOffset -= currentSpeed;
        }

        // 2. Спавн препятствий
        if (!WorldState.isTripping && !p.isEating) {
            if (WorldState.spawnCooldown > 0) {
                WorldState.spawnCooldown--;
            } else {
                WorldState.spawnTimer++;
                if (WorldState.spawnTimer > Math.max(70, 140 - currentSpeed * 3) + Math.random() * 40) {
                    const types = bgConfig.types || ['barrel', 'rock', 'cactus', 'puddle', 'pit'];
                    const type = types[Math.floor(Math.random() * types.length)];
                    
                    let w = 40, h = 40, yOffset = 0;
                    if (type === 'rock') { w = 120; h = 120; yOffset = 30; }
                    if (type === 'cactus') { w = 70; h = 110; }
                    if (type === 'barrel') { w = 50; h = 60; }
                    if (type === 'puddle') { w = 120; h = 120; yOffset = 30; }
                    if (type === 'pit') { w = 140; h = 90; yOffset = 40; }

                    WorldState.obstacles.push({
                        x: 1200,
                        y: groundY - h + yOffset,
                        w: w, h: h, type: type
                    });
                    WorldState.spawnTimer = 0;
                }
            }

            // 3. Спавн еды
            WorldState.foodTimer++;
            if (WorldState.foodTimer > 100 + Math.random() * 80) {
                let safe = true;
                for (let o of WorldState.obstacles) { if (o.x > 900) { safe = false; break; } }
                
                if (safe) {
                    const char = cfg.CHARACTERS[p.charId];
                    const foodList = char.food || ['🍗', '🍔'];
                    const baseFood = foodList[Math.floor(Math.random() * foodList.length)];
                    
                    // Взвешенный рандом для типа еды
                    const r = Math.random() * 100;
                    let foodType = 'normal';
                    if (r > 85) foodType = 'golden';
                    else if (r > 75) foodType = 'rare';
                    else if (r > 70) foodType = 'poison';
                    
                    const emoji = cfg.FOOD_TYPES[foodType].emoji || baseFood;

                    WorldState.foods.push({
                        x: 1200,
                        y: Math.random() > 0.5 ? groundY - 80 : groundY - 40,
                        w: 40, h: 40, emoji: emoji, type: foodType
                    });
                    WorldState.foodTimer = 0;
                }
            }
        }

        // 4. Движение объектов
        WorldState.obstacles.forEach(o => o.x -= currentSpeed);
        WorldState.obstacles = WorldState.obstacles.filter(o => o.x + o.w > 0);
        
        WorldState.foods.forEach(f => f.x -= currentSpeed);
        WorldState.foods = WorldState.foods.filter(f => f.x + f.w > 0);

        // 5. Коллизии с препятствиями
        if (!WorldState.isTripping && !p.isEating) {
            for (let i = WorldState.obstacles.length - 1; i >= 0; i--) {
                const o = WorldState.obstacles[i];
                
                // Хитбокс игрока (немного уменьшен)
                const px = p.x + p.w * 0.6;
                const py = p.y + p.h * 0.4;
                const pw = p.w * 0.25;
                const ph = p.h * 0.4;

                // Хитбоксы препятствий
                let ox = o.x + 10, oy = o.y + 5, ow = o.w - 20, oh = o.h - 5;
                if (o.type === 'puddle') { oy = o.y + o.h * 0.5; oh = o.h * 0.5; }
                if (o.type === 'rock') { oy = o.y + o.h * 0.2; oh = o.h * 0.8; }
                if (o.type === 'pit') { 
                    ox = o.x + o.w * 0.35; ow = o.w * 0.5; 
                    oy = o.y + o.h * 0.25; oh = o.h * 0.5; 
                }
                if (o.type === 'cactus') { ox = o.x + o.w * 0.3; ow = o.w * 0.4; }

                if (px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy) {
                    
                    if (o.type === 'pit') {
                        WorldState.isAlive = false;
                        window.GameEvents.emit('pit_fall');
                        window.GameEvents.emit('gameover', { distance: WorldState.distance, health: WorldState.health });
                        break;
                    } else if (o.type === 'barrel') {
                        WorldState.obstacles.splice(i, 1);
                        WorldState.health -= 1;
                        WorldState.isTripping = true;
                        WorldState.tripTimer = 0;
                        p.isTripping = true;
                        window.RenderEngine.shake(12, 20);
                        window.RenderEngine.flash('255,150,0', 0.3);
                        WorldState.explosions.push({ x: o.x + o.w/2, y: o.y + o.h/2, size: o.h * 6, timer: 0, maxTimer: 30 });
                        window.GameEvents.emit('barrel_hit', { health: WorldState.health });
                        break;
                    } else {
                        WorldState.obstacles.splice(i, 1);
                        WorldState.health -= 1;
                        WorldState.isTripping = true;
                        WorldState.tripTimer = 0;
                        p.isTripping = true;
                        window.RenderEngine.flash('255,0,0', 0.4);
                        window.RenderEngine.shake(6, 12);
                        window.GameEvents.emit('hit', { health: WorldState.health, type: o.type });
                        break;
                    }
                }
            }
        }

        // 6. Логика спотыкания (восстановление)
        if (WorldState.isTripping) {
            WorldState.tripTimer++;
            if (WorldState.tripTimer > 120) {
                WorldState.isTripping = false;
                p.isTripping = false;
            }
        }

        // 7. Коллизии с едой
        if (!WorldState.isTripping && !p.isEating) {
            for (let i = WorldState.foods.length - 1; i >= 0; i--) {
                const f = WorldState.foods[i];
                const px = p.x + 20, py = p.y + 20, pw = p.w - 40, ph = p.h - 20;

                if (px < f.x + f.w && px + pw > f.x && py < f.y + f.h && py + ph > f.y) {
                    WorldState.foods.splice(i, 1);
                    
                    if (f.type === 'golden') {
                        WorldState.distance += 50;
                        window.RenderEngine.flash('255,215,0', 0.2);
                    } else if (f.type === 'rare') {
                        WorldState.health = Math.min(6, WorldState.health + 2);
                        window.RenderEngine.flash('0,255,255', 0.2);
                    } else if (f.type === 'poison') {
                        WorldState.health -= 1;
                        window.RenderEngine.flash('139,0,255', 0.4);
                    }
                    
                    const char = cfg.CHARACTERS[p.charId];
                    if (char.eatEmoji && f.emoji === char.eatEmoji) {
                        if (window.startEating) window.startEating();
                    } else {
                        window.GameEvents.emit('eat', { type: f.type, emoji: f.emoji });
                    }
                    
                    if (WorldState.health <= 0) {
                        WorldState.isAlive = false;
                        window.GameEvents.emit('gameover', { distance: WorldState.distance, health: WorldState.health });
                    }
                }
            }
        }

        // 8. Обновление взрывов
        WorldState.explosions.forEach(ex => ex.timer++);
        WorldState.explosions = WorldState.explosions.filter(ex => ex.timer < ex.maxTimer);
        
        // 9. Отправляем данные для UI
        window.GameEvents.emit('world_tick', { distance: WorldState.distance, health: WorldState.health, speed: currentSpeed });
    });

    // === РЕНДЕР ФОНА, ОБЪЕКТОВ И ПРЕПЯТСТВИЙ ===
    window.GameEvents.on('render_frame', (e) => {
        const ctx = e.ctx;
        if (!ctx) return;

        const cfg = window.GameConfig;
        const W = 1200, H = 600;

        // 1. Фон
        const bgAsset = window.GameAssets.bg[WorldState.background];
        const img = WorldState.timeOfDay === 'night' ? bgAsset.night : bgAsset.day;
        
        if (img && img.complete) {
            const scale = H / img.naturalHeight;
            const w = Math.ceil(img.naturalWidth * scale);
            let offset = WorldState.bgOffset % w;
            if (offset > 0) offset -= w;
            for (let i = offset; i < W; i += w) {
                ctx.drawImage(img, i, 0, w, H);
            }
        } else {
            ctx.fillStyle = WorldState.timeOfDay === 'night' ? '#0a0512' : '#1a0b2e';
            ctx.fillRect(0, 0, W, H);
        }

        // 2. Препятствия
        WorldState.obstacles.forEach(o => {
            const obsAsset = window.GameAssets.obs[o.type];
            const obsImg = WorldState.timeOfDay === 'night' ? obsAsset.night : obsAsset.day;
            
            if (obsImg && obsImg.complete) {
                ctx.drawImage(obsImg, o.x, o.y, o.w, o.h);
            } else {
                ctx.fillStyle = o.type === 'pit' ? 'black' : '#888';
                ctx.fillRect(o.x, o.y, o.w, o.h);
            }
        });

        // 3. Еда
        ctx.textBaseline = 'bottom';
        WorldState.foods.forEach(f => {
            ctx.font = '40px Arial';
            let shadowColor = '#fff';
            if (f.type === 'golden') shadowColor = '#FFD700';
            else if (f.type === 'rare') shadowColor = '#00FFFF';
            else if (f.type === 'poison') shadowColor = '#8B00FF';

            ctx.shadowColor = shadowColor;
            ctx.shadowBlur = f.type !== 'normal' ? 12 : 0;
            ctx.fillText(f.emoji, f.x, f.y + f.h);
            ctx.shadowBlur = 0;
        });

        // 4. Взрывы
        WorldState.explosions.forEach(expl => {
            const progress = expl.timer / expl.maxTimer;
            const scale = 1 + progress * 0.5;
            const alpha = 1 - progress;
            const size = expl.size * scale;
            
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'orange';
            ctx.beginPath(); ctx.arc(expl.x, expl.y, size / 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'yellow';
            ctx.beginPath(); ctx.arc(expl.x, expl.y, size / 4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });
    });

    console.log('%c🌍 [Pack 2] World loaded', 'color:#FFD700;font-weight:bold');
})();
