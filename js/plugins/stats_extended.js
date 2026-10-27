/* =============================================================
   STATS MODULE — Statistics / Leaderboard / Achievements / Buffs
   Использует только window.GameEvents и window.PackUIs.
   ============================================================= */
(function () {
    'use strict';

    // ==================== STORAGE ====================
    const KEY_STATS = 'lacoste_mod_stats';
    const KEY_LB    = 'lacoste_mod_lb';
    const KEY_ACH   = 'lacoste_mod_ach';

    const state = {
        lifetime: { runs: 0, distance: 0, food: 0, bestDistance: 0, bestCombo: 1, playtime: 0 },
        leaderboard: [],
        achievements: {},
        session: { distance: 0, food: 0, jumps: 0, maxCombo: 1, damage: 0, start: 0 },
        activeBuffs: [],
        toasts: [],
        modal: null,
    };

    try { const s = JSON.parse(localStorage.getItem(KEY_STATS) || '{}'); if (s.lifetime) state.lifetime = { ...state.lifetime, ...s.lifetime }; } catch(e){}
    try { state.leaderboard = JSON.parse(localStorage.getItem(KEY_LB) || '[]'); } catch(e){}
    try { state.achievements = JSON.parse(localStorage.getItem(KEY_ACH) || '{}'); } catch(e){}

    function save() {
        localStorage.setItem(KEY_STATS, JSON.stringify({ lifetime: state.lifetime }));
        localStorage.setItem(KEY_LB, JSON.stringify(state.leaderboard));
        localStorage.setItem(KEY_ACH, JSON.stringify(state.achievements));
    }

    // ==================== TOASTS ====================
    function toast(msg, type = 'info') {
        const id = Date.now() + Math.random();
        state.toasts.push({ id, msg, type });
        setTimeout(() => {
            state.toasts = state.toasts.filter(t => t.id !== id);
        }, 2500);
    }

    // ==================== ACHIEVEMENTS ====================
    const ACHIEVEMENTS = [
        { id:'first_run',  icon:'👟', name:'Первый шаг',   desc:'Завершить первый забег',      check:s => s.lifetime.runs >= 1 },
        { id:'dist_500',   icon:'🏃', name:'Спринтер',     desc:'Пробеги 500м',                check:s => s.lifetime.bestDistance >= 500 },
        { id:'dist_1000',  icon:'🏅', name:'Марафонец',    desc:'Пробеги 1000м',               check:s => s.lifetime.bestDistance >= 1000 },
        { id:'dist_5000',  icon:'🏆', name:'Легенда',      desc:'Пробеги 5000м',               check:s => s.lifetime.bestDistance >= 5000 },
        { id:'combo_5',    icon:'🔥', name:'Комбо-мастер', desc:'Достигни комбо x3 (5 прыжков)',check:s => s.lifetime.bestCombo >= 5 },
        { id:'combo_8',    icon:'💥', name:'Бог комбо',    desc:'Достигни комбо x5 (8 прыжков)',check:s => s.lifetime.bestCombo >= 8 },
        { id:'food_100',   icon:'🍽️', name:'Гурман',       desc:'Съешь 100 еды (суммарно)',    check:s => s.lifetime.food >= 100 },
        { id:'runs_10',    icon:'🎮', name:'Игрок',        desc:'Сыграй 10 забегов',           check:s => s.lifetime.runs >= 10 },
        { id:'runs_50',    icon:'🎯', name:'Ветеран',      desc:'Сыграй 50 забегов',           check:s => s.lifetime.runs >= 50 },
        { id:'playtime_10',icon:'⏰', name:'Ценитель',     desc:'Проведи в игре 10 минут',     check:s => s.lifetime.playtime >= 600 },
    ];

    function checkAchievements() {
        ACHIEVEMENTS.forEach(a => {
            if (state.achievements[a.id]) return;
            if (a.check(state)) {
                state.achievements[a.id] = Date.now();
                save();
                toast(`🏆 ${a.icon} ${a.name}!`, 'success');
            }
        });
    }

    // ==================== BUFFS (Визуальные / Время) ====================
    const BUFFS = {
        speed:  { icon:'⚡', name:'Speed',    color:'#FFD700', dur:5000 },
        shield: { icon:'🛡️', name:'Shield',   color:'#00BFFF', dur:8000 },
        double: { icon:'💰', name:'2x Score', color:'#00FF41', dur:5000 },
        slow:   { icon:'🐌', name:'Slow',     color:'#888888', dur:4000, debuff: true },
    };

    // Модификатор скорости через requestAnimationFrame
    let timeScale = 1.0;
    let virtualTime = 0;
    let lastRealTime = 0;
    const originalRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = function (cb) {
        return originalRAF.call(window, function (realTime) {
            if (lastRealTime === 0) lastRealTime = realTime;
            let delta = realTime - lastRealTime;
            lastRealTime = realTime;
            virtualTime += delta * timeScale;
            cb(virtualTime);
        });
    };

    function addBuff(kind) {
        state.activeBuffs = state.activeBuffs.filter(b => b.kind !== kind);
        const def = BUFFS[kind];
        state.activeBuffs.push({ kind, ...def, ends: Date.now() + def.dur });
        if (kind === 'speed') timeScale = 1.35;
        else if (kind === 'slow') timeScale = 0.65;
        toast(`${def.icon} ${def.name}!`, def.debuff ? 'danger' : 'success');
    }

    function updateBuffs() {
        const now = Date.now();
        let changed = false;
        state.activeBuffs = state.activeBuffs.filter(b => {
            if (now >= b.ends) { changed = true; return false; }
            return true;
        });
        if (changed) {
            timeScale = 1.0; // Сброс скорости, если баффов больше нет
            state.activeBuffs.forEach(b => {
                if (b.kind === 'speed') timeScale = 1.35;
                if (b.kind === 'slow') timeScale = 0.65;
            });
        }
    }

    // ==================== EVENTS (Игра -> Модуль) ====================
    window.GameEvents.on('game_start', () => {
        state.session = { distance: 0, food: 0, jumps: 0, maxCombo: 1, damage: 0, start: Date.now() };
        state.activeBuffs = [];
        timeScale = 1.0;
    });

    window.GameEvents.on('jump', () => {
        state.session.jumps++;
        if (Math.random() < 0.05) addBuff('speed'); // 5% шанс ускорения за прыжок
    });

    window.GameEvents.on('hit', (d) => {
        state.session.damage++;
        if (Math.random() < 0.15) addBuff('slow'); // 15% шанс замедления при ударе
    });

    window.GameEvents.on('eat', (d) => {
        state.session.food++;
        if (d.type === 'golden') addBuff('double');
        if (d.type === 'rare') addBuff('shield');
        if (d.type === 'poison') addBuff('slow');
    });

    window.GameEvents.on('combo_changed', (d) => {
        if (d.mult > state.session.maxCombo) state.session.maxCombo = d.mult;
    });

    window.GameEvents.on('world_tick', (d) => {
        state.session.distance = Math.max(state.session.distance, d.distance);
    });

    window.GameEvents.on('gameover', (d) => {
        const playtime = (Date.now() - state.session.start) / 1000;
        state.session.distance = d.distance;
        
        state.lifetime.runs++;
        state.lifetime.distance += d.distance;
        state.lifetime.food += state.session.food;
        state.lifetime.bestDistance = Math.max(state.lifetime.bestDistance, d.distance);
        state.lifetime.bestCombo = Math.max(state.lifetime.bestCombo, state.session.maxCombo);
        state.lifetime.playtime += playtime;

        state.leaderboard.push({
            distance: Math.floor(d.distance),
            food: state.session.food,
            combo: state.session.maxCombo,
            date: new Date().toISOString()
        });
        state.leaderboard.sort((a, b) => b.distance - a.distance);
        state.leaderboard = state.leaderboard.slice(0, 10);
        
        save();
        checkAchievements();
    });

    window.GameEvents.on('tick', updateBuffs);

    // ==================== UI (React) ====================
    const { useState, useEffect } = React;

    function formatTime(sec) {
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    function statRow(icon, label, value, color) {
        return React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '4px' } },
            React.createElement('span', { style: { color: '#ccc' } }, `${icon} ${label}`),
            React.createElement('span', { style: { color: color || '#00FFFF', fontFamily: "'Courier New', monospace", fontWeight: 'bold' } }, String(value))
        );
    }

    function StatsUI({ gameState }) {
        const [, force] = useState(0);
        const [toasts, setToasts] = useState([]);
        const [buffs, setBuffs] = useState([]);

        useEffect(() => {
            const id = setInterval(() => {
                setToasts([...state.toasts]);
                setBuffs([...state.activeBuffs]);
                force(n => n + 1);
            }, 100);
            return () => clearInterval(id);
        }, []);

        // HUD баффов (круговые таймеры)
        const buffsHUD = (gameState === 'playing' && buffs.length > 0) ? React.createElement('div', { style: { position: 'absolute', top: '12%', right: '2%', zIndex: 8, display: 'flex', flexDirection: 'column', gap: '8px' } },
            buffs.map((b, i) => {
                const pct = Math.max(0, (b.ends - Date.now()) / b.dur) * 100;
                const size = 44, stroke = 3, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
                return React.createElement('div', { key: i, style: { position: 'relative', width: size, height: size } },
                    React.createElement('svg', { width: size, height: size, style: { position: 'absolute', transform: 'rotate(-90deg)' } },
                        React.createElement('circle', { cx: size/2, cy: size/2, r, fill: 'none', stroke: 'rgba(0,0,0,0.5)', strokeWidth: stroke }),
                        React.createElement('circle', { cx: size/2, cy: size/2, r, fill: 'none', stroke: b.color, strokeWidth: stroke, strokeDasharray: circ, strokeDashoffset: circ - (pct / 100) * circ, strokeLinecap: 'round', style: { transition: 'stroke-dashoffset 0.1s linear' } })
                    ),
                    React.createElement('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', filter: `drop-shadow(0 0 6px ${b.color})` } }, b.icon)
                );
            })
        ) : null;

        // Тосты
        const toastsHUD = React.createElement('div', { style: { position: 'absolute', top: '12%', left: '50%', transform: 'translateX(-50%)', zIndex: 25, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' } },
            toasts.map(t => React.createElement('div', {
                key: t.id,
                style: {
                    background: t.type === 'success' ? 'linear-gradient(135deg, #00FF41, #00BFFF)' : (t.type === 'danger' ? 'linear-gradient(135deg, #FF0000, #8B0000)' : 'linear-gradient(135deg, #FF007F, #8B00FF)'),
                    color: '#fff', padding: '8px 20px', borderRadius: '12px',
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: '16px',
                    letterSpacing: '2px', textTransform: 'uppercase',
                    boxShadow: '0 0 20px rgba(255,0,127,0.5)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    animation: 'lmSlide 0.3s ease-out'
                }
            }, t.msg))
        );

        // Кнопки в меню
        const menuButtons = (gameState === 'menu') ? React.createElement('div', { style: { display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap', justifyContent: 'center' } },
            React.createElement('button', { className: 'btn', onClick: () => { state.modal = 'stats'; force(n => n + 1); } }, '📊 STATS'),
            React.createElement('button', { className: 'btn', onClick: () => { state.modal = 'lb'; force(n => n + 1); } }, '🏆 TOP'),
            React.createElement('button', { className: 'btn', onClick: () => { state.modal = 'ach'; force(n => n + 1); } }, '🎖️ ACH')
        ) : null;

        const modalBase = { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 40, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3%' };
        const panelBase = { width: 'min(92%, 600px)', maxHeight: '90%', overflowY: 'auto', background: 'linear-gradient(180deg, rgba(20,10,35,0.98), rgba(10,5,20,0.98))', borderRadius: '16px', padding: '24px', fontFamily: "'Bebas Neue', sans-serif", color: 'white' };

        // Модал: Статистика
        const statsModal = (state.modal === 'stats') ? React.createElement('div', { style: modalBase },
            React.createElement('div', { style: { ...panelBase, border: '2px solid #00FF41', boxShadow: '0 0 40px rgba(0,255,65,0.4)' } },
                React.createElement('h2', { style: { color: '#00FF41', margin: 0, letterSpacing: '3px', marginBottom: '20px' } }, '📊 STATISTICS'),
                React.createElement('h3', { style: { color: '#00FFFF', letterSpacing: '2px' } }, 'LIFETIME'),
                statRow('🎮', 'Total Runs', state.lifetime.runs),
                statRow('📏', 'Total Distance', `${Math.floor(state.lifetime.distance)}m`),
                statRow('🏅', 'Best Distance', `${Math.floor(state.lifetime.bestDistance)}m`, '#FFD700'),
                statRow('🍽️', 'Total Food', state.lifetime.food),
                statRow('🔥', 'Best Combo', `x${state.lifetime.bestCombo}`),
                statRow('⏰', 'Playtime', formatTime(state.lifetime.playtime)),
                React.createElement('h3', { style: { color: '#FFD700', letterSpacing: '2px', marginTop: '20px' } }, 'LAST SESSION'),
                statRow('📏', 'Distance', `${Math.floor(state.session.distance)}m`),
                statRow('🍽️', 'Food', state.session.food),
                statRow('🦘', 'Jumps', state.session.jumps),
                statRow('💥', 'Damage', state.session.damage),
                React.createElement('button', { className: 'btn btn-start', style: { width: '100%', marginTop: '20px' }, onClick: () => { state.modal = null; force(n => n + 1); } }, 'ЗАКРЫТЬ')
            )
        ) : null;

        // Модал: Лидерборд
        const lbModal = (state.modal === 'lb') ? React.createElement('div', { style: modalBase },
            React.createElement('div', { style: { ...panelBase, border: '2px solid #FFD700', boxShadow: '0 0 40px rgba(255,215,0,0.4)' } },
                React.createElement('h2', { style: { color: '#FFD700', margin: 0, letterSpacing: '3px', marginBottom: '20px' } }, '🏆 LEADERBOARD'),
                state.leaderboard.length === 0
                    ? React.createElement('p', { style: { color: '#888', textAlign: 'center', padding: '20px' } }, 'Пока нет рекордов.')
                    : state.leaderboard.map((e, i) => React.createElement('div', {
                        key: i,
                        style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', marginBottom: '6px', background: i === 0 ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.04)', border: i === 0 ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }
                    },
                        React.createElement('span', { style: { fontSize: '24px', fontWeight: 'bold', color: i === 0 ? '#FFD700' : (i === 1 ? '#C0C0C0' : (i === 2 ? '#CD7F32' : '#666')), minWidth: '40px' } }, `#${i + 1}`),
                        React.createElement('div', { style: { flex: 1 } },
                            React.createElement('div', { style: { fontSize: '20px', color: '#00FFFF' } }, `${e.distance}m`),
                            React.createElement('div', { style: { fontSize: '11px', color: '#888' } }, `🍽️${e.food} 🔥x${e.combo} · ${new Date(e.date).toLocaleDateString()}`)
                        )
                    )),
                React.createElement('button', { className: 'btn btn-start', style: { width: '100%', marginTop: '20px' }, onClick: () => { state.modal = null; force(n => n + 1); } }, 'ЗАКРЫТЬ')
            )
        ) : null;

        // Модал: Ачивки
        const achModal = (state.modal === 'ach') ? React.createElement('div', { style: modalBase },
            React.createElement('div', { style: { ...panelBase, border: '2px solid #FF007F', boxShadow: '0 0 40px rgba(255,0,127,0.4)' } },
                React.createElement('h2', { style: { color: '#FF007F', margin: 0, letterSpacing: '3px', marginBottom: '10px' } }, '🎖️ ACHIEVEMENTS'),
                React.createElement('div', { style: { color: '#888', marginBottom: '15px' } }, `${Object.keys(state.achievements).length} / ${ACHIEVEMENTS.length} unlocked`),
                ACHIEVEMENTS.map(a => React.createElement('div', {
                    key: a.id,
                    style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', marginBottom: '6px', background: state.achievements[a.id] ? 'rgba(0,255,65,0.1)' : 'rgba(255,255,255,0.04)', border: state.achievements[a.id] ? '1px solid #00FF41' : '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', opacity: state.achievements[a.id] ? 1 : 0.5 }
                },
                    React.createElement('span', { style: { fontSize: '28px' } }, a.icon),
                    React.createElement('div', { style: { flex: 1 } },
                        React.createElement('div', { style: { fontSize: '16px', color: state.achievements[a.id] ? '#00FF41' : '#ccc' } }, a.name),
                        React.createElement('div', { style: { fontSize: '11px', color: '#888' } }, a.desc)
                    ),
                    state.achievements[a.id] ? React.createElement('span', { style: { color: '#00FF41', fontSize: '20px' } }, '✓') : null
                )),
                React.createElement('button', { className: 'btn btn-start', style: { width: '100%', marginTop: '20px' }, onClick: () => { state.modal = null; force(n => n + 1); } }, 'ЗАКРЫТЬ')
            )
        ) : null;

        return React.createElement(React.Fragment, null, buffsHUD, toastsHUD, menuButtons, statsModal, lbModal, achModal);
    }

    // Инжект CSS-анимации тоста
    if (!document.getElementById('lm-anim')) {
        const s = document.createElement('style'); s.id = 'lm-anim';
        s.textContent = `@keyframes lmSlide { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }`;
        document.head.appendChild(s);
    }

    if (window.PackUIs) window.PackUIs.push(StatsUI);
    else window.PackUIs = [StatsUI];

    console.log('%c📊 Stats Module Loaded', 'color:#FFD700;font-weight:bold');
})();
