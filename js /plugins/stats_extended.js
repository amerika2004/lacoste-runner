/* =============================================================
   STATS_EXTENDED — Statistics / Leaderboard / Achievements / Buffs
   ============================================================= */
(function () {
    'use strict';
    const KEY = 'lacoste_extended_stats';

    const S = {
        session: { distance: 0, food: 0, jumps: 0, maxCombo: 1, damage: 0, startTime: 0 },
        lifetime: { totalRuns: 0, totalDistance: 0, totalFood: 0, bestDistance: 0, bestCombo: 1, playtime: 0 },
        leaderboard: [],
        achievements: {},
        buffs: [],
        showStats: false,
        showLeaderboard: false,
        showAchievements: false,
    };

    function loadState() {
        try {
            const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
            if (saved.lifetime) S.lifetime = saved.lifetime;
            if (saved.leaderboard) S.leaderboard = saved.leaderboard;
            if (saved.achievements) S.achievements = saved.achievements;
        } catch (e) { console.warn(e); }
    }
    function saveState() {
        try { localStorage.setItem(KEY, JSON.stringify({ lifetime: S.lifetime, leaderboard: S.leaderboard, achievements: S.achievements })); } catch (e) {}
    }
    loadState();

    // === ACHIEVEMENTS ===
    const ACHIEVEMENTS = [
        { id: 'first_run',   icon: '👟', name: 'Первый шаг',   desc: 'Завершить первый забег',       check: (s) => s.lifetime.totalRuns >= 1 },
        { id: 'dist_500',    icon: '🏃', name: 'Спринтер',     desc: 'Пробеги 500м',                 check: (s) => s.lifetime.bestDistance >= 500 },
        { id: 'dist_1000',   icon: '🏅', name: 'Марафонец',    desc: 'Пробеги 1000м',                check: (s) => s.lifetime.bestDistance >= 1000 },
        { id: 'dist_5000',   icon: '🏆', name: 'Легенда',      desc: 'Пробеги 5000м',                check: (s) => s.lifetime.bestDistance >= 5000 },
        { id: 'combo_5',     icon: '🔥', name: 'Комбо-мастер', desc: 'Комбо x3 (5 прыжков)',         check: (s) => s.lifetime.bestCombo >= 5 },
        { id: 'combo_8',     icon: '💥', name: 'Бог комбо',    desc: 'Комбо x5 (8 прыжков)',         check: (s) => s.lifetime.bestCombo >= 8 },
        { id: 'food_100',    icon: '🍽️', name: 'Гурман',       desc: 'Съешь 100 еды (суммарно)',     check: (s) => s.lifetime.totalFood >= 100 },
        { id: 'runs_10',     icon: '🎮', name: 'Игрок',        desc: 'Сыграй 10 забегов',            check: (s) => s.lifetime.totalRuns >= 10 },
        { id: 'runs_50',     icon: '🎯', name: 'Ветеран',      desc: 'Сыграй 50 забегов',            check: (s) => s.lifetime.totalRuns >= 50 },
        { id: 'playtime_10', icon: '⏰', name: 'Ценитель',     desc: 'Проведи в игре 10 минут',      check: (s) => s.lifetime.playtime >= 600 },
    ];

    function checkAchievements() {
        ACHIEVEMENTS.forEach(a => {
            if (S.achievements[a.id]) return;
            if (a.check(S)) {
                S.achievements[a.id] = Date.now();
                saveState();
                toast(`🏆 ${a.icon} ${a.name}!`, 'success');
            }
        });
    }

    // === BUFFS ===
    const BUFF_DEFS = {
        speed:   { icon: '⚡', name: 'Speed',    color: '#FFD700', duration: 5000 },
        shield:  { icon: '🛡️', name: 'Shield',   color: '#00BFFF', duration: 0, hits: 1 },
        magnet:  { icon: '🧲', name: 'Magnet',   color: '#FF00FF', duration: 5000 },
        double:  { icon: '💰', name: '2x Score', color: '#00FF41', duration: 5000 },
    };

    function addBuff(kind) {
        S.buffs = S.buffs.filter(b => b.kind !== kind);
        const def = BUFF_DEFS[kind];
        S.buffs.push({
            kind, icon: def.icon, name: def.name, color: def.color,
            endsAt: def.duration > 0 ? Date.now() + def.duration : Infinity,
            maxDuration: def.duration,
            hitsLeft: def.hits || 0,
        });
        applyBuff(kind, true);
        toast(`${def.icon} ${def.name}!`, 'success');
    }

    function removeBuff(kind) {
        S.buffs = S.buffs.filter(b => b.kind !== kind);
        applyBuff(kind, false);
    }

    function applyBuff(kind, on) {
        const m = window.GameRefs?.modifiers;
        if (!m) return;
        if (kind === 'speed')  m.speed = on ? 1.4 : 1.0;
        if (kind === 'shield') m.invincible = on;
        if (kind === 'double') m.scoreMult = on ? 2 : 1;
    }

    function tickBuffs() {
        const now = Date.now();
        S.buffs.forEach(b => {
            if (b.endsAt !== Infinity && now >= b.endsAt) {
                removeBuff(b.kind);
                toast(`⏱️ ${b.name} expired`, 'info');
            }
        });
    }

    // === TOAST ===
    const toasts = [];
    let toastListeners = [];
    function toast(msg, type = 'info') {
        const id = Date.now() + Math.random();
        toasts.push({ id, msg, type });
        toastListeners.forEach(f => f([...toasts]));
        setTimeout(() => {
            const i = toasts.findIndex(t => t.id === id);
            if (i >= 0) toasts.splice(i, 1);
            toastListeners.forEach(f => f([...toasts]));
        }, 2500);
    }

    // === EVENTS ===
    window.GameEvents.on('game_start', () => {
        S.session = { distance: 0, food: 0, jumps: 0, maxCombo: 1, damage: 0, startTime: Date.now() };
        S.buffs = [];
        const m = window.GameRefs?.modifiers;
        if (m) { m.speed = 1.0; m.invincible = false; m.scoreMult = 1; }
    });

    window.GameEvents.on('jump', () => S.session.jumps++);

    window.GameEvents.on('hit', () => {
        S.session.damage++;
        const sh = S.buffs.find(b => b.kind === 'shield' && b.hitsLeft > 0);
        if (sh) {
            sh.hitsLeft--;
            if (sh.hitsLeft <= 0) removeBuff('shield');
            if (window.GameRefs?.health) {
                window.GameRefs.health.current = Math.min(6, window.GameRefs.health.current + 1);
                if (window.GameRefs.setHealth) window.GameRefs.setHealth(window.GameRefs.health.current);
            }
            toast('🛡️ Shield absorbed!', 'success');
        }
    });

    window.GameEvents.on('eat', (d) => {
        S.session.food++;
        if (d.type === 'golden') addBuff('speed');
        if (d.type === 'rare') { addBuff('shield'); addBuff('magnet'); }
        if (d.type === 'normal' && Math.random() < 0.15) addBuff('double');
    });

    window.GameEvents.on('combo_changed', (d) => {
        if (d.mult > S.session.maxCombo) S.session.maxCombo = d.mult;
    });

    window.GameEvents.on('world_tick', (d) => {
        S.session.distance = Math.max(S.session.distance, d.distance);
    });

    window.GameEvents.on('gameover', (d) => {
        const playtime = (Date.now() - S.session.startTime) / 1000;
        S.session.distance = d.distance;
        S.lifetime.totalRuns++;
        S.lifetime.totalDistance += d.distance;
        S.lifetime.totalFood += S.session.food;
        S.lifetime.bestDistance = Math.max(S.lifetime.bestDistance, d.distance);
        S.lifetime.bestCombo = Math.max(S.lifetime.bestCombo, S.session.maxCombo);
        S.lifetime.playtime += playtime;

        S.leaderboard.push({ distance: Math.floor(d.distance), food: S.session.food, combo: S.session.maxCombo, date: new Date().toISOString() });
        S.leaderboard.sort((a, b) => b.distance - a.distance);
        S.leaderboard = S.leaderboard.slice(0, 10);

        saveState();
        checkAchievements();
    });

    // Магнит — притягивает еду каждый тик
    window.GameEvents.on('tick', () => {
        tickBuffs();
        if (!S.buffs.some(b => b.kind === 'magnet')) return;
        const p = window.GameRefs?.player?.current;
        const foods = window.GameRefs?.foods?.current;
        if (!p || !foods) return;
        foods.forEach(f => {
            const dx = (p.x + p.width / 2) - (f.x + f.width / 2);
            const dy = (p.y + p.height / 2) - (f.y + f.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 250 && dist > 5) { f.x += dx * 0.08; f.y += dy * 0.08; }
        });
    });

    // === UI ===
    function formatTime(sec) {
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    function statRow(icon, label, value, color) {
        return React.createElement('div', {
            style: { display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '4px' }
        },
            React.createElement('span', { style: { color: '#ccc' } }, `${icon} ${label}`),
            React.createElement('span', { style: { color: color || '#00FFFF', fontFamily: "'Courier New', monospace", fontWeight: 'bold' } }, String(value))
        );
    }

    function StatsUI({ gameState }) {
        const [, force] = React.useState(0);
        const [toastsLocal, setToastsLocal] = React.useState([]);
        const [buffs, setBuffs] = React.useState([]);

        React.useEffect(() => {
            const t = (x) => setToastsLocal(x);
            toastListeners.push(t);
            const id = setInterval(() => {
                setBuffs([...S.buffs]);
                force(n => n + 1);
            }, 150);
            return () => {
                clearInterval(id);
                const i = toastListeners.indexOf(t);
                if (i >= 0) toastListeners.splice(i, 1);
            };
        }, []);

        // HUD бафов (круговые таймеры)
        const buffsHUD = (gameState === 'playing' && buffs.length > 0) ? React.createElement('div', {
            style: { position: 'absolute', top: '12%', right: '2%', zIndex: 8, display: 'flex', flexDirection: 'column', gap: '8px' }
        },
            buffs.map((b, i) => {
                const left = b.endsAt === Infinity ? 1 : Math.max(0, (b.endsAt - Date.now()) / b.maxDuration);
                const size = 44, stroke = 3, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
                return React.createElement('div', { key: i, style: { position: 'relative', width: size, height: size } },
                    React.createElement('svg', { width: size, height: size, style: { position: 'absolute', transform: 'rotate(-90deg)' } },
                        React.createElement('circle', { cx: size/2, cy: size/2, r, fill: 'none', stroke: 'rgba(0,0,0,0.5)', strokeWidth: stroke }),
                        React.createElement('circle', { cx: size/2, cy: size/2, r, fill: 'none', stroke: b.color, strokeWidth: stroke, strokeDasharray: circ, strokeDashoffset: circ - left * circ, strokeLinecap: 'round', style: { transition: 'stroke-dashoffset 0.1s linear' } })
                    ),
                    React.createElement('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', filter: `drop-shadow(0 0 6px ${b.color})` } }, b.icon)
                );
            })
        ) : null;

        // Тосты
        const toastsHUD = React.createElement('div', {
            style: { position: 'absolute', top: '12%', left: '50%', transform: 'translateX(-50%)', zIndex: 25, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }
        },
            toastsLocal.map(t => React.createElement('div', {
                key: t.id,
                style: {
                    background: t.type === 'success' ? 'linear-gradient(135deg, #00FF41, #00BFFF)' : 'linear-gradient(135deg, #FF007F, #8B00FF)',
                    color: '#fff', padding: '8px 20px', borderRadius: '12px',
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: '16px',
                    letterSpacing: '2px', textTransform: 'uppercase',
                    boxShadow: '0 0 20px rgba(255,0,127,0.5)',
                    border: '2px solid rgba(255,255,255,0.3)'
                }
            }, t.msg))
        );

        // Кнопки в меню
        const menuButtons = (gameState === 'menu') ? React.createElement('div', {
            style: { display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap', justifyContent: 'center' }
        },
            React.createElement('button', { className: 'btn', onClick: () => { S.showStats = true; force(n => n + 1); } }, '📊 STATS'),
            React.createElement('button', { className: 'btn', onClick: () => { S.showLeaderboard = true; force(n => n + 1); } }, '🏆 TOP'),
            React.createElement('button', { className: 'btn', onClick: () => { S.showAchievements = true; force(n => n + 1); } }, '🎖️ ACH')
        ) : null;

        const modalBase = { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 40, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3%' };
        const panelBase = { width: 'min(92%, 600px)', maxHeight: '90%', overflowY: 'auto', background: 'linear-gradient(180deg, rgba(20,10,35,0.98), rgba(10,5,20,0.98))', borderRadius: '16px', padding: '24px', fontFamily: "'Bebas Neue', sans-serif", color: 'white' };

        // Модал: статистика
        const statsModal = S.showStats ? React.createElement('div', { style: modalBase },
            React.createElement('div', { style: { ...panelBase, border: '2px solid #00FF41', boxShadow: '0 0 40px rgba(0,255,65,0.4)' } },
                React.createElement('h2', { style: { color: '#00FF41', margin: 0, letterSpacing: '3px', marginBottom: '20px' } }, '📊 STATISTICS'),
                React.createElement('h3', { style: { color: '#00FFFF', letterSpacing: '2px' } }, 'LIFETIME'),
                statRow('🎮', 'Total Runs', S.lifetime.totalRuns),
                statRow('📏', 'Total Distance', `${Math.floor(S.lifetime.totalDistance)}m`),
                statRow('🏅', 'Best Distance', `${Math.floor(S.lifetime.bestDistance)}m`, '#FFD700'),
                statRow('🍽️', 'Total Food', S.lifetime.totalFood),
                statRow('🔥', 'Best Combo', `x${S.lifetime.bestCombo}`),
                statRow('⏰', 'Playtime', formatTime(S.lifetime.playtime)),
                React.createElement('h3', { style: { color: '#FFD700', letterSpacing: '2px', marginTop: '20px' } }, 'LAST SESSION'),
                statRow('📏', 'Distance', `${Math.floor(S.session.distance)}m`),
                statRow('🍽️', 'Food', S.session.food),
                statRow('🦘', 'Jumps', S.session.jumps),
                statRow('💥', 'Damage', S.session.damage),
                React.createElement('button', { className: 'btn btn-start', style: { width: '100%', marginTop: '20px' }, onClick: () => { S.showStats = false; force(n => n + 1); } }, 'ЗАКРЫТЬ')
            )
        ) : null;

        // Модал: лидерборд
        const lbModal = S.showLeaderboard ? React.createElement('div', { style: modalBase },
            React.createElement('div', { style: { ...panelBase, border: '2px solid #FFD700', boxShadow: '0 0 40px rgba(255,215,0,0.4)' } },
                React.createElement('h2', { style: { color: '#FFD700', margin: 0, letterSpacing: '3px', marginBottom: '20px' } }, '🏆 LEADERBOARD'),
                S.leaderboard.length === 0
                    ? React.createElement('p', { style: { color: '#888', textAlign: 'center', padding: '20px' } }, 'Пока нет рекордов. Сыграй первый забег!')
                    : S.leaderboard.map((e, i) => React.createElement('div', {
                        key: i,
                        style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', marginBottom: '6px', background: i === 0 ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.04)', border: i === 0 ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }
                    },
                        React.createElement('span', { style: { fontSize: '24px', fontWeight: 'bold', color: i === 0 ? '#FFD700' : (i === 1 ? '#C0C0C0' : (i === 2 ? '#CD7F32' : '#666')), minWidth: '40px' } }, `#${i + 1}`),
                        React.createElement('div', { style: { flex: 1 } },
                            React.createElement('div', { style: { fontSize: '20px', color: '#00FFFF' } }, `${e.distance}m`),
                            React.createElement('div', { style: { fontSize: '11px', color: '#888' } }, `🍽️${e.food} 🔥x${e.combo} · ${new Date(e.date).toLocaleDateString()}`)
                        )
                    )),
                React.createElement('button', { className: 'btn btn-start', style: { width: '100%', marginTop: '20px' }, onClick: () => { S.showLeaderboard = false; force(n => n + 1); } }, 'ЗАКРЫТЬ')
            )
        ) : null;

        // Модал: ачивки
        const achModal = S.showAchievements ? React.createElement('div', { style: modalBase },
            React.createElement('div', { style: { ...panelBase, border: '2px solid #FF007F', boxShadow: '0 0 40px rgba(255,0,127,0.4)' } },
                React.createElement('h2', { style: { color: '#FF007F', margin: 0, letterSpacing: '3px', marginBottom: '10px' } }, '🎖️ ACHIEVEMENTS'),
                React.createElement('div', { style: { color: '#888', marginBottom: '15px' } }, `${Object.keys(S.achievements).length} / ${ACHIEVEMENTS.length} unlocked`),
                ACHIEVEMENTS.map(a => React.createElement('div', {
                    key: a.id,
                    style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', marginBottom: '6px', background: S.achievements[a.id] ? 'rgba(0,255,65,0.1)' : 'rgba(255,255,255,0.04)', border: S.achievements[a.id] ? '1px solid #00FF41' : '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', opacity: S.achievements[a.id] ? 1 : 0.5 }
                },
                    React.createElement('span', { style: { fontSize: '28px' } }, a.icon),
                    React.createElement('div', { style: { flex: 1 } },
                        React.createElement('div', { style: { fontSize: '16px', color: S.achievements[a.id] ? '#00FF41' : '#ccc' } }, a.name),
                        React.createElement('div', { style: { fontSize: '11px', color: '#888' } }, a.desc)
                    ),
                    S.achievements[a.id] ? React.createElement('span', { style: { color: '#00FF41', fontSize: '20px' } }, '✓') : null
                )),
                React.createElement('button', { className: 'btn btn-start', style: { width: '100%', marginTop: '20px' }, onClick: () => { S.showAchievements = false; force(n => n + 1); } }, 'ЗАКРЫТЬ')
            )
        ) : null;

        return React.createElement(React.Fragment, null, buffsHUD, toastsHUD, menuButtons, statsModal, lbModal, achModal);
    }

    if (window.PackUIs) window.PackUIs.push(StatsUI);
    else window.PackUIs = [StatsUI];

    console.log('%c📊 [Stats Extended] Loaded', 'color:#FFD700;font-weight:bold');
})();
