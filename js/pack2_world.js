/* ==================================================================
   PACK 2 — WORLD (Фон, Препятствия, Еда, Коллизии)
   ================================================================== */
(function () {
    'use strict';

    // === СОСТОЯНИЕ МИРА ===
    const WorldState = {
        distance: 0,
        speed: window.GameConfig.BASE_SPEED,
        bgOffset: 0,
        isAlive: true,
        timeOfDay: 'day',
        background: 'default',
        
        obstacles: [],
        foods: [],
        explosions: [],
        
        spawnTimer: 0,
        foodTimer: 0,
        spawnCooldown: 0,
        
        health: 6,
        isTripping: false,
        tripTimer: 0,
    };

    // Экспортируем для UI и других модулей
    window.WorldState = WorldState;

    // === ИНИЦИАЛИЗАЦИЯ ===
    window.GameEvents.on('game_start', (data) => {
        const cfg = window.GameConfig;
        
        WorldState.distance = 0;
        WorldState.speed = cfg.BASE_SPEED;
        WorldState.bgOffset = 0;
        WorldState.isAlive = true;
        WorldState.timeOfDay = data.timeOfDay || 'day';
        WorldState.background = data.background || 'default';
        
        WorldState.obstacles = [];
        WorldState.foods = [];
        WorldState.explosions = [];
        
        WorldState.spawnTimer = 0;
        WorldState.foodTimer = 0;
        WorldState.spawnCooldown = 0;
        
        WorldState.health = 6;
        WorldState.isTripping = false;
    });

    // === ЛОГИКА (ТИК 60 FPS) ===
    window.GameEvents.on('tick', () => {
        if (!WorldState.isAlive) return;

        const cfg = window.GameConfig;
        const p = window.PlayerState;
        const bgConfig = cfg.BACKGROUNDS[WorldState.background];
        const gy = cfg.GROUND_Y + (bgConfig.groundOffset || 0);

        // 1. Движение мира (если игрок не спотыкается и не ест)
        let currentSpeed = 0;
        if (!WorldState.isTripping && !p.isEating) {
            currentSpeed = WorldState.speed * cfg.SPEED_MULTIPLIER;
            WorldState.distance += currentSpeed * 0.03;
            WorldState.bgOffset -= currentSpeed;
        }

        // 2. Спавн препятствий
        if (!WorldState.isTripping && !p.isEating) {
            if (WorldState.spawnCooldown > 0) {
                WorldState.spawnCooldown--;
            } else {
                WorldState.spawnTimer++;
                if (WorldState.spawnTimer > Math.max(70, 140 - currentSpeed * 3) + Math.random() * 40) {
                    
                    const types = bgConfig.obstacleTypes || ['barrel', 'rock', 'cactus', 'puddle', 'pit'];
                    const type = types[Math.floor(Math.random() * types.length)];
                    let w = 40, h = 40, yOffset = 0;

                    if (type === 'rock') { w = 120; h = 120; yOffset = 30; }
                    if (type === 'cactus') { w = 70; h = 110; }
                    if (type === 'barrel') { w = 50; h = 60; }
                    if (type === 'puddle') { w = 120; h = 120; yOffset = 30; }
                    if (type === 'pit') { w = 140; h = 90; yOffset = 40; }

                    WorldState.obstacles.push({
                        x: 1200,
                        y: gy - h + yOffset,
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
                    const foodList = char.foodEmojis || ['🍗', '🍔'];
                    const baseFood = foodList[Math.floor(Math.random() * foodList.length)];
                    
                    // Определяем тип еды по весам
                    const r = Math.random() * 100;
                    let foodType = 'normal';
                    if (r > 85) foodType = 'golden';
                    else if (r > 75) foodType = 'rare';
                    else if (r > 70) foodType = 'poison';
                    
                    const emoji = cfg.FOOD_TYPES[foodType].emoji || baseFood;

                    WorldState.foods.push({
                        x: 1200,
                        y: Math.random() > 0.5 ? gy - 80 : gy - 40,
                        w: 40, h: 40,
                        emoji: emoji,
                        type: foodType
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
                const px = p.x + p.width * 0.6;
                const py = p.y + p.height * 0.4;
                const pw = p.width * 0.25;
                const ph = p.height * 0.4;

                // Хитбоксы препятствий (упрощённо)
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
                        // Смерть в яме
                        WorldState.isAlive = false;
                        p.isFallingIntoPit = true;
                        window.GameEvents.emit('pit_fall');
                        break;
                    } else if (o.type === 'barrel') {
                        // Взрыв бочки
                        WorldState.obstacles.splice(i, 1);
                        WorldState.health -= 1;
                        p.isTripping = true;
                        WorldState.isTripping = true;
                        WorldState.tripTimer = 0;
                        window.RenderEngine.shake(12, 20);
                        window.RenderEngine.flash('255,150,0', 0.3);
                        WorldState.explosions.push({ x: o.x + o.w/2, y: o.y + o.h/2, size: o.h * 6, timer: 0, maxTimer: 30 });
                        
                        window.GameEvents.emit('barrel_hit', { health: WorldState.health });
                        break;
                    } else {
                        // Обычное препятствие (камень, кактус, лужа)
                        WorldState.obstacles.splice(i, 1);
                        WorldState.health -= 1;
                        p.isTripping = true;
                        WorldState.isTripping = true;
                        WorldState.tripTimer = 0;
                        window.RenderEngine.flash('255,0,0', 0.4);
                        window.RenderEngine.shake(6, 12);
                        
                        window.GameEvents.emit('hit', { health: WorldState.health, type: o.type });
                        break;
                    }
                }
            }
        }

        // 6. Логика спотыкания (трип)
        if (WorldState.isTripping) {
            WorldState.tripTimer++;
            if (WorldState.tripTimer > 120) {
                WorldState.isTripping = false;
                p.isTripping = false;
            }
            if (WorldState.health <= 0 && WorldState.isAlive) {
                WorldState.isAlive = false;
                window.GameEvents.emit('gameover', { distance: Math.floor(WorldState.distance), health: 0 });
            }
        }

        // 7. Коллизии с едой
        if (!WorldState.isTripping && !p.isEating) {
            for (let i = WorldState.foods.length - 1; i >= 0; i--) {
                const f = WorldState.foods[i];
                const px = p.x + 20, py = p.y + 20, pw = p.width - 40, ph = p.height - 20;

                if (px < f.x + f.w && px + pw > f.x && py < f.y + f.h && py + ph > f.y) {
                    WorldState.foods.splice(i, 1);
                    
                    // Логика эффектов
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
                    
                    // Триггер поедания (для панды)
                    const char = cfg.CHARACTERS[p.charId];
                    if (char.eatEmoji && f.emoji === char.eatEmoji) {
                        p.isEating = true;
                        p.eatTimer = 0;
                        window.GameEvents.emit('eat_start', { emoji: f.emoji });
                    } else {
                        window.GameEvents.emit('eat', { type: f.type, emoji: f.emoji });
                    }
                }
            }
        }

        // 8. Логика поедания (остановка мира)
        if (p.isEating) {
            p.eatTimer = (p.eatTimer || 0) + 1;
            if (p.eatTimer > 60) { // Условно 1 секунда
                p.isEating = false;
                p.eatTimer = 0;
            }
        }
        
        // 9. Обновляем UI и шлём данные
        window.GameEvents.emit('world_tick', { distance: WorldState.distance, health: WorldState.health, speed: currentSpeed });
    });

    // === РЕНДЕР ФОНА, ОБЪЕКТОВ И ПРЕПЯТСТВИЙ ===
    window.GameEvents.on('render_frame', (e) => {
        const ctx = e.ctx;
        if (!ctx) return;

        const cfg = window.GameConfig;
        const bgConfig = cfg.BACKGROUNDS[WorldState.background];
        const W = 1200, H = 600;

        // 1. Фон
        const bgImg = bgConfig ? (WorldState.timeOfDay === 'night' ? bgConfig.nightImg : bgConfig.dayImg) : null;
        const bgAsset = window.GameAssets.backgrounds[WorldState.background];
        const img = window.getTimeImg(bgAsset, WorldState.timeOfDay);
        
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

        // 2. Яма (если игрок падает в неё)
        // (В реальности нужно рисовать pit_img)
        
        // 3. Препятствия
        WorldState.obstacles.forEach(o => {
            const obsAsset = window.GameAssets.obstacles[o.type];
            const obsImg = window.getTimeImg(obsAsset, WorldState.timeOfDay);
            
            if (obsImg && obsImg.complete) {
                ctx.drawImage(obsImg, o.x, o.y, o.w, o.h);
            } else {
                ctx.fillStyle = o.type === 'pit' ? 'black' : (o.type === 'puddle' ? 'rgba(0,150,255,0.5)' : '#888');
                ctx.fillRect(o.x, o.y, o.w, o.h);
            }
        });

        // 4. Еда
        ctx.textBaseline = 'bottom';
        WorldState.foods.forEach(f => {
            ctx.font = '40px Arial';
            // Свечение для особых типов
            let shadowColor = '#fff';
            if (f.type === 'golden') shadowColor = '#FFD700';
            else if (f.type === 'rare') shadowColor = '#00FFFF';
            else if (f.type === 'poison') shadowColor = '#8B00FF';

            ctx.shadowColor = shadowColor;
            ctx.shadowBlur = f.type !== 'normal' ? 12 : 0;
            ctx.fillText(f.emoji, f.x, f.y + f.h);
            ctx.shadowBlur = 0;
        });

        // 5. Взрывы
        WorldState.explosions.forEach(expl => {
            const progress = expl.timer / expl.maxTimer;
            const scale = 1 + progress * 0.5;
            const alpha = 1 - progress;
            const size = expl.size * scale;
            
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'orange';
            ctx.beginPath();
            ctx.arc(expl.x, expl.y, size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(expl.x, expl.y, size / 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    });

    // Обновление таймеров взрывов
    window.GameEvents.on('tick', () => {
        WorldState.explosions.forEach(ex => ex.timer++);
        WorldState.explosions = WorldState.explosions.filter(ex => ex.timer < ex.maxTimer);
    });

    console.log('%c🌍 [Pack 2] World loaded', 'color:#FFD700;font-weight:bold');
})();
