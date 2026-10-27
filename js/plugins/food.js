/* ==================================================================
   PACK — FOOD (Спавн, коллизии и эффекты еды)
   ================================================================== */
(function () {
    'use strict';

    const Food = {
        items: [],
        spawnTimer: 0,
        eaten: 0,
        target: 1,
        curBg: 'default'
    };
    window.FoodState = Food;

    function pickType() {
        const types = window.GameConfig.FOOD_TYPES;
        const total = Object.values(types).reduce((s, t) => s + t.weight, 0);
        let r = Math.random() * total;
        for (const [k, t] of Object.entries(types)) {
            r -= t.weight;
            if (r <= 0) return k;
        }
        return 'normal';
    }

    window.GameEvents.on('game_start', (d) => {
        Food.items = [];
        Food.spawnTimer = 0;
        Food.eaten = 0;
        Food.target = 1;
        Food.curBg = d.background || 'default';
        console.log('🍎 Food module init');
    });

    window.GameEvents.on('tick', () => {
        const p = window.PlayerState;
        const w = window.WorldState;
        if (!p || !w || !w.alive) return;
        if (p.isEating || w.tripping) {
            // Двигаем еду даже если игрок ест/спотыкается (медленнее)
            return;
        }

        const cfg = window.GameConfig;
        const bg = cfg.BACKGROUNDS[Food.curBg] || cfg.BACKGROUNDS.default;
        const gy = cfg.PHYSICS.GROUND_Y + (bg?.groundOffset || 0);
        const spd = w.speed * cfg.SPEED.SPEED_MULTIPLIER;

        // Спавн
        Food.spawnTimer++;
        if (Food.spawnTimer > 150) {
            const ch = window.GameCharacters[p.charId] || window.GameCharacters.crocodile;
            const baseList = ch?.foodEmojis || ['🍗'];
            const type = pickType();
            const typeEmoji = cfg.FOOD_TYPES[type].emoji;
            const baseEmoji = baseList[Math.floor(Math.random() * baseList.length)];
            const finalEmoji = typeEmoji || baseEmoji;

            Food.items.push({
                x: 1200,
                y: Math.random() > 0.5 ? gy - 80 : gy - 40,
                w: 40, h: 40,
                emoji: finalEmoji,
                baseEmoji: baseEmoji,
                type: type
            });
            Food.spawnTimer = 0;
        }

        // Движение
        Food.items.forEach(f => f.x -= spd);
        Food.items = Food.items.filter(f => f.x + f.w > 0);

        // Коллизии
        for (let i = Food.items.length - 1; i >= 0; i--) {
            const f = Food.items[i];
            const px = p.x + 20, py = p.y + 20, pw = p.w - 40, ph = p.h - 20;
            if (px < f.x + f.w && px + pw > f.x && py < f.y + f.h && py + ph > f.y) {
                Food.items.splice(i, 1);
                applyEffect(f, p, w, gy);

                window.GameEvents.emit('eat', { type: f.type, emoji: f.emoji });

                // Анимация поедания для персонажа с eatEmoji (панда)
                const ch = window.GameCharacters[p.charId];
                if (ch && ch.eatEmoji && f.baseEmoji === ch.eatEmoji && window.startEating) {
                    window.startEating();
                }
            }
        }
    });

    function applyEffect(f, p, w, gy) {
        if (f.type === 'golden') {
            // Бонус к дистанции
            w.dist += 50;
        } else if (f.type === 'rare') {
            // Восстановление HP
            w.health = Math.min(6, w.health + 2);
            window.GameEvents.emit('world_tick', { distance: w.dist, health: w.health });
        } else if (f.type === 'poison') {
            // Яд — урон + замедление через trip
            w.health = Math.max(0, w.health - 1);
            w.tripping = true;
            w.tripT = 0;
            window.GameEvents.emit('hit', { health: w.health, type: 'poison' });
            if (w.health <= 0) {
                w.alive = false;
                window.GameEvents.emit('gameover', { distance: w.dist, health: 0 });
            }
        } else {
            // Обычная — рост персонажа
            Food.eaten++;
            if (Food.eaten >= Food.target) {
                p.w += 2;
                p.h += 1.3;
                p.y = gy - p.h;
                Food.eaten = 0;
                Food.target += 1;
                w.health = Math.min(6, w.health + 1);
                window.GameEvents.emit('world_tick', { distance: w.dist, health: w.health });
            }
        }
    }

    window.GameEvents.on('render_frame', (e) => {
        const ctx = e.ctx;
        ctx.textBaseline = 'bottom';
        Food.items.forEach(f => {
            let shadow = '#FFFFFF';
            if (f.type === 'golden') shadow = '#FFD700';
            else if (f.type === 'rare') shadow = '#00FFFF';
            else if (f.type === 'poison') shadow = '#8B00FF';

            ctx.shadowColor = shadow;
            ctx.shadowBlur = f.type !== 'normal' ? 12 : 0;
            ctx.font = '40px Arial';
            ctx.fillText(f.emoji, f.x, f.y + f.h);
            ctx.shadowBlur = 0;
        });
    });

    console.log('🍎 Food module loaded');
})();
