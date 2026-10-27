/* ==================================================================
   ALL-IN-ONE PLUGIN — Stats / Leaderboard / Achievements / Buffs / Weather
   Единственный плагин расширения. Работает через GameEvents + PackUIs.
   ================================================================== */
(function () {
    'use strict';
    const { useState, useEffect } = React;

    /* ============================================================
       1. STORAGE
       ============================================================ */
    const K_STATS = 'lacoste_mod_stats';
    const K_LB    = 'lacoste_mod_lb';
    const K_ACH   = 'lacoste_mod_ach';

    const S = {
        lifetime: { runs: 0, distance: 0, food: 0, bestDistance: 0, bestCombo: 1, playtime: 0 },
        leaderboard: [],
        achievements: {},
        session: { distance: 0, food: 0, jumps: 0, maxCombo: 1, damage: 0, start: 0 },
        buffs: [],
        toasts: [],
        modal: null,
        weather: 'clear',
        weatherProgress: 0,
        weatherParticles: [],
        lightningTimer: 0,
    };

    try { const s = JSON.parse(localStorage.getItem(K_STATS) || '{}'); if (s.lifetime) S.lifetime = { ...S.lifetime, ...s.lifetime }; } catch(e){}
    try { S.leaderboard = JSON.parse(localStorage.getItem(K_LB) || '[]'); } catch(e){}
    try { S.achievements = JSON.parse(localStorage.getItem(K_ACH) || '{}'); } catch(e){}

    function save() {
        localStorage.setItem(K_STATS, JSON.stringify({ lifetime: S.lifetime }));
        localStorage.setItem(K_LB, JSON.stringify(S.leaderboard));
        localStorage.setItem(K_ACH, JSON.stringify(S.achievements));
    }

    /* ============================================================
       2. TOASTS
       ============================================================ */
    function toast(msg, type = 'info') {
        const id = Date.now() + Math.random();
        S.toasts.push({ id, msg, type });
        setTimeout(() => { S.toasts = S.toasts.filter(t => t.id !== id); }, 2500);
    }

    /* ============================================================
       3. ACHIEVEMENTS
       ============================================================ */
    const ACH = [
        { id:'first_run',  icon:'👟', name:'Первый шаг',   desc:'Заверши первый забег',        check:s=>s.lifetime.runs>=1 },
        { id:'dist_500',   icon:'🏃', name:'Спринтер',     desc:'Пробеги 500м',                check:s=>s.lifetime.bestDistance>=500 },
        { id:'dist_1000',  icon:'🏅', name:'Марафонец',    desc:'Пробеги 1000м',               check:s=>s.lifetime.bestDistance>=1000 },
        { id:'dist_5000',  icon:'🏆', name:'Легенда',      desc:'Пробеги 5000м',               check:s=>s.lifetime.bestDistance>=5000 },
        { id:'combo_5',    icon:'🔥', name:'Комбо-мастер', desc:'Комбо x3 (5 прыжков)',        check:s=>s.lifetime.bestCombo>=5 },
        { id:'combo_8',    icon:'💥', name:'Бог комбо',    desc:'Комбо x5 (8 прыжков)',        check:s=>s.lifetime.bestCombo>=8 },
        { id:'food_100',   icon:'🍽️', name:'Гурман',       desc:'Съешь 100 еды (суммарно)',    check:s=>s.lifetime.food>=100 },
        { id:'runs_10',    icon:'🎮', name:'Игрок',        desc:'Сыграй 10 забегов',           check:s=>s.lifetime.runs>=10 },
        { id:'runs_50',    icon:'🎯', name:'Ветеран',      desc:'Сыграй 50 забегов',           check:s=>s.lifetime.runs>=50 },
        { id:'playtime_10',icon:'⏰', name:'Ценитель',     desc:'10 минут в игре',             check:s=>s.lifetime.playtime>=600 },
    ];

    function checkAch() {
        ACH.forEach(a => {
            if (S.achievements[a.id]) return;
            if (a.check(S)) {
                S.achievements[a.id] = Date.now();
                save();
                toast(`🏆 ${a.icon} ${a.name}!`, 'success');
            }
        });
    }

    /* ============================================================
       4. BUFFS (реально работают через RAF timeScale)
       ============================================================ */
    const BUFFS = {
        speed:  { icon:'⚡', name:'Speed',    color:'#FFD700', dur:5000 },
        slow:   { icon:'🐌', name:'Slow',     color:'#888888', dur:4000, debuff:true },
        double: { icon:'💰', name:'2x Score', color:'#00FF41', dur:6000 },
        shield: { icon:'🛡️', name:'Shield',   color:'#00BFFF', dur:8000 },
    };

    let timeScale = 1.0;
    let vt = 0, lrt = 0;
    const origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = function (cb) {
        return origRAF.call(window, function (rt) {
            if (!lrt) lrt = rt;
            const d = rt - lrt; lrt = rt;
            vt += d * timeScale;
            cb(vt);
        });
    };

    function addBuff(kind) {
        S.buffs = S.buffs.filter(b => b.kind !== kind);
        const def = BUFFS[kind];
        S.buffs.push({ kind, ...def, ends: Date.now() + def.dur });
        recomputeTimeScale();
        toast(`${def.icon} ${def.name}!`, def.debuff ? 'danger' : 'success');
    }

    function recomputeTimeScale() {
        timeScale = 1.0;
        if (S.buffs.some(b => b.kind === 'speed')) timeScale = 1.35;
        if (S.buffs.some(b => b.kind === 'slow'))  timeScale = 0.65;
    }

    function tickBuffs() {
        const now = Date.now();
        const before = S.buffs.length;
        S.buffs = S.buffs.filter(b => now < b.ends);
        if (S.buffs.length !== before) recomputeTimeScale();
    }

    /* ============================================================
       5. WEATHER
       ============================================================ */
    const WEATHER = {
        clear: { emoji:'☀️', weight:55 },
        rain:  { emoji:'🌧️', weight:20 },
        fog:   { emoji:'🌫️', weight:15 },
        storm: { emoji:'⛈️', weight:10 },
    };
    function pickWeather() {
        const total = Object.values(WEATHER).reduce((s, w) => s + w.weight, 0);
        let r = Math.random() * total;
        for (const [k, w] of Object.entries(WEATHER)) { r -= w.weight; if (r <= 0) return k; }
        return 'clear';
    }
    let lastWeatherPhase = 0;

    function tickWeather() {
        const dist = S.session.distance;
        S.weatherProgress = dist % 500;
        const phase = Math.floor(dist / 500);
        if (phase > lastWeatherPhase) {
            lastWeatherPhase = phase;
            S.weather = pickWeather();
        }
        if (S.weather === 'rain' || S.weather === 'storm') {
            for (let i = 0; i < 3; i++) {
                S.weatherParticles.push({
                    x: Math.random() * 1200, y: -10,
                    vx: -1 + Math.random() * 2, vy: 10 + Math.random() * 5, life: 60,
                });
            }
        }
        if (S.weather === 'storm') {
            S.lightningTimer++;
            if (S.lightningTimer > 400 && Math.random() < 0.05) {
                S.lightningTimer = 0;
                if (window.RenderEngine && window.RenderEngine.flash) {
                    window.RenderEngine.flash('255,255,255', 0.6);
                }
            }
        }
        S.weatherParticles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
        S.weatherParticles = S.weatherParticles.filter(p => p.life > 0 && p.y < 700);
    }

    function renderWeather(ctx) {
        if (S.weather !== 'rain' && S.weather !== 'storm') return;
        ctx.save();
        ctx.strokeStyle = S.weather === 'storm' ? 'rgba(150,180,255,0.6)' : 'rgba(180,200,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        S.weatherParticles.forEach(p => {
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2);
        });
        ctx.stroke();
        ctx.restore();
    }

    /* ============================================================
       6. EVENTS (игра → плагин)
       ============================================================ */
    window.GameEvents.on('game_start', () => {
        S.session = { distance: 0, food: 0, jumps: 0, maxCombo: 1, damage: 0, start: Date.now() };
        S.buffs = [];
        S.weather = 'clear';
        S.weatherProgress = 0;
        S.weatherParticles = [];
        S.lightningTimer = 0;
        lastWeatherPhase = 0;
        timeScale = 1.0;
    });

    window.GameEvents.on('jump', () => {
        S.session.jumps++;
        if (Math.random() < 0.04) addBuff('speed');
    });

    window.GameEvents.on('hit', () => {
        S.session.damage++;
        if (S.buffs.some(b => b.kind === 'shield')) {
            S.buffs = S.buffs.filter(b => b.kind !== 'shield');
            toast('🛡️ Shield absorbed!', 'success');
        } else if (Math.random() < 0.1) {
            addBuff('slow');
        }
    });

    window.GameEvents.on('eat', (d) => {
        S.session.food++;
        if (d.type === 'golden') addBuff('double');
        if (d.type === 'rare') addBuff('shield');
        if (d.type === 'poison') addBuff('slow');
    });

    window.GameEvents.on('combo_changed', (d) => {
        if (d.mult > S.session.maxCombo) S.session.maxCombo = d.mult;
    });

    window.GameEvents.on('world_tick', (d) => {
        S.session.distance = Math.max(S.session.distance, d.distance);
    });

    window.GameEvents.on('gameover', (d) => {
        const playtime = (Date.now() - S.session.start) / 1000;
        S.session.distance = d.distance;

        S.lifetime.runs++;
        S.lifetime.distance += d.distance;
        S.lifetime.food += S.session.food;
        S.lifetime.bestDistance = Math.max(S.lifetime.bestDistance, d.distance);
        S.lifetime.bestCombo = Math.max(S.lifetime.bestCombo, S.session.maxCombo);
        S.lifetime.playtime += playtime;

        S.leaderboard.push({
            distance: Math.floor(d.distance),
            food: S.session.food,
            combo: S.session.maxCombo,
            date: new Date().toISOString(),
        });
        S.leaderboard.sort((a, b) => b.distance - a.distance);
        S.leaderboard = S.leaderboard.slice(0, 10);

        save();
        checkAch();
    });

    window.GameEvents.on('tick', () => {
        tickBuffs();
        tickWeather();
    });

    window.GameEvents.on('render_frame', (e) => {
        renderWeather(e.ctx);
    });

    /* ============================================================
       7. UI
       ============================================================ */
    function fmtTime(sec) {
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    function StatRow(icon, label, value, color) {
        return React.createElement('div', {
            style: { display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '4px' },
        },
            React.createElement('span', { style: { color: '#ccc' } }, `${icon} ${label}`),
            React.createElement('span', { style: { color: color || '#00FFFF', fontFamily: "'Courier New', monospace", fontWeight: 'bold' } }, String(value))
        );
    }

    function PluginUI({ gameState }) {
        const [, force] = useState(0);
        const [toasts, setToasts] = useState([]);
        const [buffs, setBuffs] = useState([]);
        const [weather, setWeather] = useState('clear');
        const [weatherProgress, setWeatherProgress] = useState(0);

        useEffect(() => {
            const id = setInterval(() => {
                setToasts([...S.toasts]);
                setBuffs([...S.buffs]);
                setWeather(S.weather);
                setWeatherProgress(S.weatherProgress);
                force(n => n + 1);
            }, 100);
            return () => clearInterval(id);
        }, []);

        // === BUFF HUD ===
        const buffsHUD = (gameState === 'playing' && buffs.length > 0) ? React.createElement('div', {
            style: { position: 'absolute', top: '12%', right: '2%', zIndex: 8, display: 'flex', flexDirection: 'column', gap: '8px' }
        },
            buffs.map((b, i) => {
                const pct = Math.max(0, (b.ends - Date.now()) / b.dur) * 100;
                const size = 44, stroke = 3, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
                return React.createElement('div', { key: i, style: { position: 'relative', width: size, height: size } },
                    React.createElement('svg', { width: size, height: size, style: { position: 'absolute', transform: 'rotate(-90deg)' } },
                        React.createElement('circle', { cx: size/2, cy: size/2, r, fill: 'none', stroke: 'rgba(0,0,0,0.5)', strokeWidth: stroke }),
                        React.createElement('circle', { cx: size/2, cy: size/2, r, fill: 'none', stroke: b.color, strokeWidth: stroke, strokeDasharray: circ, strokeDashoffset: circ - (pct/100)*circ, strokeLinecap: 'round' })
                    ),
                    React.createElement('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', filter: `drop-shadow(0 0 6px ${b.color})` } }, b.icon)
                );
            })
        ) : null;

        // === TOASTS ===
        const toastsHUD = React.createElement('div', {
            style: { position: 'absolute', top: '12%', left: '50%', transform: 'translateX(-50%)', zIndex: 25, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }
        },
            toasts.map(t => React.createElement('div', {
                key: t.id,
                style: {
                    background: t.type === 'success' ? 'linear-gradient(135deg, #00FF41, #00BFFF)' : (t.type === 'danger' ? 'linear-gradient(135deg, #FF0000, #8B0000)' : 'linear-gradient(135deg, #FF007F, #8B00FF)'),
                    color: '#fff', padding: '8px 20px', borderRadius: '12px',
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: '16px',
                    letterSpacing: '2px', textTransform: 'uppercase',
                    boxShadow: '0 0 20px rgba(255,0,127,0.5)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    animation: 'aioSlide 0.3s ease-out',
                }
            }, t.msg))
        );

        // === WEATHER HUD ===
        const weatherHUD = (gameState === 'playing') ? React.createElement(React.Fragment, null,
            React.createElement('div', { style: { position: 'absolute', top: '30%', right: '2%', zIndex: 7, fontSize: 'clamp(24px, 4vmin, 34px)', filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.8))' } }, WEATHER[weather].emoji),
            React.createElement('div', { style: { position: 'absolute', bottom: '2%', left: '50%', transform: 'translateX(-50%)', width: 'min(60%, 500px)', zIndex: 6, pointerEvents: 'none' } },
                React.createElement('div', { style: { textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.7)', letterSpacing: '2px', marginBottom: '3px', fontFamily: "'Bebas Neue', sans-serif" } },
                    `До смены погоды: ${Math.max(0, Math.ceil(500 - weatherProgress))}м`
                ),
                React.createElement('div', { style: { height: '4px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' } },
                    React.createElement('div', { style: { width: `${(weatherProgress / 500) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #00FF41, #00FFFF, #FF007F)', boxShadow: '0 0 10px rgba(0,255,200,0.6)' } })
                )
            )
        ) : null;

        // === MENU BUTTONS ===
        const menuButtons = (gameState === 'menu') ? React.createElement('div', {
            style: { display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap', justifyContent: 'center' }
        },
            React.createElement('button', { className: 'btn', onClick: () => { S.modal = 'stats'; force(n => n + 1); } }, '📊 STATS'),
            React.createElement('button', { className: 'btn', onClick: () => { S.modal = 'lb'; force(n => n + 1); } }, '🏆 TOP'),
            React.createElement('button', { className: 'btn', onClick: () => { S.modal = 'ach'; force(n => n + 1); } }, '🎖️ ACH')
        ) : null;

        // === MODALS ===
        const mBase = { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 40, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3%' };
        const pBase = { width: 'min(92%, 600px)', maxHeight: '90%', overflowY: 'auto', background: 'linear-gradient(180deg, rgba(20,10,35,0.98), rgba(10,5,20,0.98))', borderRadius: '16px', padding: '24px', fontFamily: "'Bebas Neue', sans-serif", color: 'white' };
        const closeModal = () => { S.modal = null; force(n => n + 1); };

        const statsModal = (S.modal === 'stats') ? React.createElement('div', { style: mBase },
            React.createElement('div', { style: { ...pBase, border: '2px solid #00FF41', boxShadow: '0 0 40px rgba(0,255,65,0.4)' } },
                React.createElement('h2', { style: { color: '#00FF41', margin: 0, letterSpacing: '3px', marginBottom: '20px' } }, '📊 STATISTICS'),
                React.createElement('h3', { style: { color: '#00FFFF', letterSpacing: '2px' } }, 'LIFETIME'),
                StatRow('🎮', 'Runs', S.lifetime.runs),
                StatRow('📏', 'Total Distance', `${Math.floor(S.lifetime.distance)}m`),
                StatRow('🏅', 'Best', `${Math.floor(S.lifetime.bestDistance)}m`, '#FFD700'),
                StatRow('🍽️', 'Food', S.lifetime.food),
                StatRow('🔥', 'Best Combo', `x${S.lifetime.bestCombo}`),
                StatRow('⏰', 'Playtime', fmtTime(S.lifetime.playtime)),
                React.createElement('h3', { style: { color: '#FFD700', letterSpacing: '2px', marginTop: '20px' } }, 'LAST SESSION'),
                StatRow('📏', 'Distance', `${Math.floor(S.session.distance)}m`),
                StatRow('🍽️', 'Food', S.session.food),
                StatRow('🦘', 'Jumps', S.session.jumps),
                StatRow('💥', 'Damage', S.session.damage),
                React.createElement('button', { className: 'btn btn-start', style: { width: '100%', marginTop: '20px' }, onClick: closeModal }, 'ЗАКРЫТЬ')
            )
        ) : null;

        const lbModal = (S.modal === 'lb') ? React.createElement('div', { style: mBase },
            React.createElement('div', { style: { ...pBase, border: '2px solid #FFD700', boxShadow: '0 0 40px rgba(255,215,0,0.4)' } },
                React.createElement('h2', { style: { color: '#FFD700', margin: 0, letterSpacing: '3px', marginBottom: '20px' } }, '🏆 TOP 10'),
                S.leaderboard.length === 0
                    ? React.createElement('p', { style: { color: '#888', textAlign: 'center', padding: '20px' } }, 'Пока нет рекордов.')
                    : S.leaderboard.map((e, i) => React.createElement('div', {
                        key: i,
                        style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', marginBottom: '6px', background: i === 0 ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.04)', border: i === 0 ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }
                    },
                        React.createElement('span', { style: { fontSize: '22px', fontWeight: 'bold', color: i === 0 ? '#FFD700' : (i === 1 ? '#C0C0C0' : (i === 2 ? '#CD7F32' : '#666')), minWidth: '40px' } }, `#${i + 1}`),
                        React.createElement('div', { style: { flex: 1 } },
                            React.createElement('div', { style: { fontSize: '20px', color: '#00FFFF' } }, `${e.distance}m`),
                            React.createElement('div', { style: { fontSize: '11px', color: '#888' } }, `🍽️${e.food} 🔥x${e.combo} · ${new Date(e.date).toLocaleDateString()}`)
                        )
                    )),
                React.createElement('button', { className: 'btn btn-start', style: { width: '100%', marginTop: '20px' }, onClick: closeModal }, 'ЗАКРЫТЬ')
            )
        ) : null;

        const achModal = (S.modal === 'ach') ? React.createElement('div', { style: mBase },
            React.createElement('div', { style: { ...pBase, border: '2px solid #FF007F', boxShadow: '0 0 40px rgba(255,0,127,0.4)' } },
                React.createElement('h2', { style: { color: '#FF007F', margin: 0, letterSpacing: '3px', marginBottom: '10px' } }, '🎖️ ACHIEVEMENTS'),
                React.createElement('div', { style: { color: '#888', marginBottom: '15px' } }, `${Object.keys(S.achievements).length} / ${ACH.length} unlocked`),
                ACH.map(a => React.createElement('div', {
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
                React.createElement('button', { className: 'btn btn-start', style: { width: '100%', marginTop: '20px' }, onClick: closeModal }, 'ЗАКРЫТЬ')
            )
        ) : null;

        return React.createElement(React.Fragment, null,
            buffsHUD, toastsHUD, weatherHUD, menuButtons,
            statsModal, lbModal, achModal
        );
    }

    // CSS для анимации тоста
    if (!document.getElementById('aio-style')) {
        const s = document.createElement('style');
        s.id = 'aio-style';
        s.textContent = `@keyframes aioSlide { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }`;
        document.head.appendChild(s);
    }

    if (window.PackUIs) window.PackUIs.push(PluginUI);
    else window.PackUIs = [PluginUI];

    console.log('%c🎯 [All-in-One] Plugin loaded', 'color:#FFD700;font-weight:bold');
})();
