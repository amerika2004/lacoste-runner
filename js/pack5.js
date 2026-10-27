/* ==================================================================
   PACK 5 — Universal UI Dispatcher, Weather/Buff HUD, Shop/Mission Buttons
   Исправляет отсутствие UI от Pack 2/3/4 в game.js
   ================================================================== */
(function () {
    'use strict';

    // Ссылки на состояния других пакетов (если они загружены)
    const getP2 = () => window.Pack2State || {};
    const getP4 = () => window.Pack4State || {};

    // -------------------- HUD: Погода и Баффы --------------------
    function ActiveBuffsHUD({ gameState }) {
        const [buffs, setBuffs] = React.useState([]);
        const [weather, setWeather] = React.useState('clear');

        React.useEffect(() => {
            const id = setInterval(() => {
                if (gameState !== 'playing') return;

                // Собираем активные баффы из Pack 2
                const p2 = getP2();
                const newBuffs = [];
                const now = performance.now();

                if (p2.powerupActive && now < p2.powerupExpiresAt) {
                    const powerups = {
                        shield: { icon: '🛡️', color: '#00BFFF', duration: 0 },
                        magnet: { icon: '🧲', color: '#FF00FF', duration: 5000 },
                        slowmo: { icon: '⏳', color: '#0080FF', duration: 3000 },
                        sprint: { icon: '⚡', color: '#FFD700', duration: 3000 },
                    };
                    const p = powerups[p2.powerupActive];
                    if (p) {
                        const remaining = p.duration > 0 ? Math.max(0, p2.powerupExpiresAt - now) : -1;
                        newBuffs.push({
                            id: p2.powerupActive,
                            icon: p.icon,
                            color: p.color,
                            progress: p.duration > 0 ? remaining / p.duration : 1,
                        });
                    }
                }

                setBuffs(newBuffs);
                setWeather(p2.weather || 'clear');
            }, 100);
            return () => clearInterval(id);
        }, [gameState]);

        if (gameState !== 'playing') return null;

        const weatherIcons = { clear: '☀️', rain: '🌧️', fog: '🌫️', storm: '⛈️' };

        return React.createElement('div', {
            style: {
                position: 'absolute', top: '12%', right: '2%', zIndex: 8,
                display: 'flex', flexDirection: 'column', gap: '8px',
                pointerEvents: 'none', alignItems: 'center'
            }
        },
            // Иконка погоды
            React.createElement('div', {
                style: {
                    fontSize: 'clamp(24px, 4vmin, 34px)',
                    filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.8))',
                    animation: 'badgeFloat 3s ease-in-out infinite'
                }
            }, weatherIcons[weather] || '☀️'),

            // Баффы с круговым прогрессом
            buffs.map(buff => {
                const size = 48;
                const stroke = 4;
                const radius = (size - stroke) / 2;
                const circumference = radius * 2 * Math.PI;
                const offset = circumference - (buff.progress * circumference);

                return React.createElement('div', {
                    key: buff.id,
                    style: { position: 'relative', width: size, height: size }
                },
                    React.createElement('svg', {
                        width: size, height: size,
                        style: { position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }
                    },
                        React.createElement('circle', {
                            cx: size / 2, cy: size / 2, r: radius,
                            fill: 'none', stroke: 'rgba(0,0,0,0.5)', strokeWidth: stroke
                        }),
                        React.createElement('circle', {
                            cx: size / 2, cy: size / 2, r: radius,
                            fill: 'none', stroke: buff.color, strokeWidth: stroke,
                            strokeDasharray: circumference, strokeDashoffset: offset,
                            strokeLinecap: 'round',
                            style: { transition: 'stroke-dashoffset 0.1s linear' }
                        })
                    ),
                    React.createElement('div', {
                        style: {
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '22px',
                            filter: `drop-shadow(0 0 6px ${buff.color})`
                        }
                    }, buff.icon)
                );
            })
        );
    }

    // -------------------- Меню: Кнопки Shop, Missions, Tutorial --------------------
    function MenuExtras({ gameState }) {
        const [, forceUpdate] = React.useState(0);

        React.useEffect(() => {
            const id = setInterval(() => forceUpdate(n => n + 1), 500);
            return () => clearInterval(id);
        }, []);

        if (gameState !== 'menu') return null;

        const p4 = getP4();
        const coins = p4.coins || 0;

        const openShop = () => {
            if (window.Pack4State) {
                window.Pack4State.showShop = true;
                forceUpdate(n => n + 1);
            }
        };
        const openMissions = () => {
            if (window.Pack4State) {
                window.Pack4State.showMissions = true;
                forceUpdate(n => n + 1);
            }
        };
        const openTutorial = () => {
            // Просто показываем тост через Pack2 (если он есть) или alert
            if (window.Pack2Hooks && window.Pack2Hooks.toast) {
                window.Pack2Hooks.toast('🎮 Тап / Space — прыжок, удержание — высокий. Esc — пауза.', 'info', 5000);
            }
        };

        return React.createElement('div', {
            style: { display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap', justifyContent: 'center', zIndex: 100 }
        },
            React.createElement('button', {
                className: 'btn',
                onClick: openShop,
                style: { borderColor: '#FFD700', color: '#FFD700' }
            }, `🛒 SHOP (${coins} 🪙)`),
            React.createElement('button', {
                className: 'btn',
                onClick: openMissions,
                style: { borderColor: '#00FF41', color: '#00FF41' }
            }, '🎯 MISSIONS'),
            React.createElement('button', {
                className: 'btn',
                onClick: openTutorial,
                style: { borderColor: '#00FFFF', color: '#00FFFF' }
            }, '🎮 CONTROLS')
        );
    }

    // -------------------- Регистрация в общем массиве --------------------
    const Pack5UI = ({ gameState }) => React.createElement(React.Fragment, null,
        React.createElement(ActiveBuffsHUD, { gameState }),
        React.createElement(MenuExtras, { gameState })
    );

    if (window.PackUIs) {
        window.PackUIs.push(Pack5UI);
    } else {
        window.PackUIs = [Pack5UI];
    }

    console.log('%c🚀 PACK 5 loaded', 'color:#00FFFF;font-weight:bold;font-size:14px');
})();
