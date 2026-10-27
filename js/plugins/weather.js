(function () {
    'use strict';
    const W = { weather: 'clear', progress: 0, particles: [], lightning: 0 };
    const TYPES = { 
        clear: { emoji: '☀️', weight: 55 }, 
        rain: { emoji: '🌧️', weight: 20 }, 
        fog: { emoji: '🌫️', weight: 15 }, 
        storm: { emoji: '⛈️', weight: 10 } 
    };
    
    const pick = () => { 
        const tot = Object.values(TYPES).reduce((s, t) => s + t.weight, 0); 
        let r = Math.random() * tot; 
        for (const [k, t] of Object.entries(TYPES)) { 
            r -= t.weight; if (r <= 0) return k; 
        } 
        return 'clear'; 
    };

    let lastPhase = 0;
    window.GameEvents.on('game_start', () => { 
        W.weather = 'clear'; W.progress = 0; W.particles = []; lastPhase = 0;
    });

    window.GameEvents.on('tick', () => {
        const dist = window.WorldState?.dist || 0; 
        W.progress = dist % 500; 
        const phase = Math.floor(dist / 500);
        
        if (phase > lastPhase) { lastPhase = phase; W.weather = pick(); }
        
        if (W.weather === 'rain' || W.weather === 'storm') { 
            for (let i = 0; i < 3; i++) W.particles.push({ x: Math.random() * 1200, y: -10, vx: -1 + Math.random() * 2, vy: 10 + Math.random() * 5, life: 60 }); 
        }
        if (W.weather === 'storm') { 
            W.lightning++; 
            if (W.lightning > 400 && Math.random() < 0.05) { W.lightning = 0; if (window.RenderEngine.flash) window.RenderEngine.flash('255,255,255', 0.6); } 
        }
        
        W.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; }); 
        W.particles = W.particles.filter(p => p.life > 0 && p.y < 700);
    });

    window.GameEvents.on('render_frame', (e) => { 
        if (W.weather !== 'rain' && W.weather !== 'storm') return; 
        const ctx = e.ctx; 
        ctx.save(); 
        ctx.strokeStyle = W.weather === 'storm' ? 'rgba(150,180,255,0.6)' : 'rgba(180,200,255,0.4)'; 
        ctx.lineWidth = 2; ctx.beginPath(); 
        W.particles.forEach(p => { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2); }); 
        ctx.stroke(); ctx.restore(); 
    });

    const UI = ({ gameState }) => { 
        const [state, set] = React.useState({ weather: W.weather, progress: 0 }); 
        React.useEffect(() => { 
            const id = setInterval(() => set({ weather: W.weather, progress: W.progress }), 150); 
            return () => clearInterval(id); 
        }, []); 
        if (gameState !== 'playing') return null; 
        
        return React.createElement(React.Fragment, null, 
            React.createElement('div', { style: { position: 'absolute', top: '30%', right: '2%', zIndex: 8, fontSize: 'clamp(24px, 4vmin, 34px)' } }, TYPES[state.weather].emoji), 
            React.createElement('div', { style: { position: 'absolute', bottom: '2%', left: '50%', transform: 'translateX(-50%)', width: 'min(60%, 500px)', zIndex: 6 } }, 
                React.createElement('div', { style: { textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.7)', letterSpacing: '2px', marginBottom: '3px' } }, `До смены погоды: ${Math.max(0, Math.ceil(500 - state.progress))}м`), 
                React.createElement('div', { style: { height: '4px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', overflow: 'hidden' } }, 
                    React.createElement('div', { style: { width: `${(state.progress / 500) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #00FF41, #00FFFF, #FF007F)' } }) 
                ) 
            )
        ); 
    };
    
    (window.PackUIs = window.PackUIs || []).push(UI);
    console.log('🌧️ Weather loaded');
})();
