/* ==================================================================
   PACK 6 — STATS & COMBO (Комбо-система и Статистика)
   ================================================================== */
(function () {
    'use strict';

    const { useState, useEffect } = React;

    // === СОСТОЯНИЕ ===
    const StatsState = {
        combo: 0,
        comboMult: 1,
        maxCombo: 0,
        foodEaten: 0,
        damageTaken: 0,
        runStartTime: 0,
        
        isGameOver: false,
        finalStats: null,
    };

    window.StatsState = StatsState;

    // === ЛОГИКА КОМБО ===
    function addCombo() {
        StatsState.combo++;
        let mult = 1;
        if (StatsState.combo >= 8) mult = 5;
        else if (StatsState.combo >= 5) mult = 3;
        else if (StatsState.combo >= 3) mult = 2;
        
        StatsState.comboMult = mult;
        if (StatsState.combo > StatsState.maxCombo) StatsState.maxCombo = StatsState.combo;
        
        // Отправляем множитель в мир (чтобы очки росли быстрее)
        window.GameEvents.emit('combo_changed', { mult, count: StatsState.combo });
    }

    function resetCombo() {
        StatsState.combo = 0;
        StatsState.comboMult = 1;
        window.GameEvents.emit('combo_changed', { mult: 1, count: 0 });
    }

    // === ПОДПИСКА НА СОБЫТИЯ ===
    window.GameEvents.on('game_start', () => {
        StatsState.combo = 0;
        StatsState.comboMult = 1;
        StatsState.maxCombo = 0;
        StatsState.foodEaten = 0;
        StatsState.damageTaken = 0;
        StatsState.runStartTime = Date.now();
        StatsState.isGameOver = false;
        StatsState.finalStats = null;
        resetCombo();
    });

    window.GameEvents.on('jump', () => {
        addCombo();
    });

    window.GameEvents.on('hit', (data) => {
        resetCombo();
        StatsState.damageTaken++;
    });

    window.GameEvents.on('barrel_hit', () => {
        resetCombo();
        StatsState.damageTaken++;
    });

    window.GameEvents.on('eat', () => {
        StatsState.foodEaten++;
    });

    window.GameEvents.on('gameover', (data) => {
        StatsState.isGameOver = true;
        StatsState.finalStats = {
            distance: data.distance,
            maxCombo: StatsState.maxCombo,
            foodEaten: StatsState.foodEaten,
            damageTaken: StatsState.damageTaken,
            time: Math.floor((Date.now() - StatsState.runStartTime) / 1000),
            isNewRecord: data.distance >= (parseInt(localStorage.getItem('lacosteHighScore')) || 0),
            highScore: Math.max(data.distance, parseInt(localStorage.getItem('lacosteHighScore')) || 0)
        };
    });

    // Модификация скорости набора очков (через множитель)
    // game.js (pack2_world) должен читать этот множитель при расчете distance
    
    // === UI КОМПОНЕНТ ===
    function StatsUI({ gameState }) {
        const [combo, setCombo] = useState({ mult: 1, count: 0 });
        const [showStats, setShowStats] = useState(false);
        const [stats, setStats] = useState(null);

        useEffect(() => {
            const onCombo = (data) => setCombo(data);
            window.GameEvents.on('combo_changed', onCombo);
            
            return () => {};
        }, []);

        useEffect(() => {
            if (gameState === 'gameover' && StatsState.finalStats) {
                setStats(StatsState.finalStats);
                setShowStats(true);
            } else if (gameState !== 'gameover') {
                setShowStats(false);
            }
        }, [gameState]);

        return React.createElement(React.Fragment, null,
            // 1. Индикатор комбо в игре
            (gameState === 'playing' && combo.mult > 1) ? React.createElement('div', {
                className: `combo-indicator combo-x${combo.mult}`,
                style: {
                    position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)',
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(24px, 4vmin, 40px)',
                    letterSpacing: '4px', color: combo.mult === 5 ? '#FF007F' : (combo.mult === 3 ? '#FF8C00' : '#FFD700'),
                    textShadow: `0 0 15px currentColor, 0 0 30px currentColor`,
                    zIndex: 6, pointerEvents: 'none', fontWeight: 'bold',
                    animation: 'comboPop 0.3s ease-out'
                }
            }, `COMBO x${combo.mult}  ${combo.count}`) : null,

            // 2. Экран статистики после смерти
            showStats && stats ? React.createElement('div', {
                className: 'menu-overlay',
                style: { background: 'rgba(0,0,0,0.92)', zIndex: 50 }
            },
                React.createElement('div', {
                    style: {
                        background: 'linear-gradient(180deg, rgba(20,10,35,0.98), rgba(10,5,20,0.98))',
                        border: '2px solid #FF007F', borderRadius: '16px',
                        boxShadow: '0 0 40px rgba(255,0,127,0.4)',
                        padding: '24px', width: 'min(92%, 500px)', fontFamily: "'Bebas Neue', sans-serif",
                        color: 'white'
                    }
                },
                    React.createElement('div', { style: { textAlign: 'center', fontSize: '36px', color: stats.isNewRecord ? '#FFD700' : '#FF007F', marginBottom: '20px', letterSpacing: '3px' } }, 
                        stats.isNewRecord ? '🏆 NEW RECORD!' : '📊 SESSION STATS'
                    ),
                    
                    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' } },
                        createStatCard('📏', 'Дистанция', `${stats.distance} м`),
                        createStatCard('⏱️', 'Время', `${Math.floor(stats.time / 60)}:${String(stats.time % 60).padStart(2, '0')}`),
                        createStatCard('🔥', 'Макс. комбо', `x${stats.maxCombo}`),
                        createStatCard('🍽️', 'Съедено', stats.foodEaten),
                        createStatCard('💥', 'Урона', stats.damageTaken),
                        createStatCard('🏅', 'Рекорд', `${stats.highScore} м`, stats.isNewRecord)
                    ),

                    React.createElement('button', {
                        className: 'btn btn-start',
                        style: { width: '100%', marginTop: '10px' },
                        onClick: () => {
                            setShowStats(false);
                            window.GameEvents.emit('game_restart_requested');
                        }
                    }, 'TRY AGAIN')
                )
            ) : null
        );
    }

    function createStatCard(icon, label, value, highlight) {
        return React.createElement('div', {
            style: {
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', padding: '10px'
            }
        },
            React.createElement('span', { style: { fontSize: '24px' } }, icon),
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } },
                React.createElement('span', { style: { fontSize: '10px', color: '#888', letterSpacing: '1px' } }, label.toUpperCase()),
                React.createElement('span', { style: { fontSize: '18px', color: highlight ? '#FFD700' : '#00FFFF', fontFamily: "'Courier New', monospace", fontWeight: 'bold' } }, value)
            )
        );
    }

    if (window.PackUIs) window.PackUIs.push(StatsUI);
    else window.PackUIs = [StatsUI];

    console.log('%c📊 [Pack 6] Stats & Combo loaded', 'color:#FFD700;font-weight:bold');
})();
