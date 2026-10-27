/* ==================================================================
   PACK 4 — Economy, Shop, Daily Missions, Share, Secrets
   Использует window.GameEvents и window.PackUIs
   ================================================================== */
(function () {
    'use strict';

    // ==================== STATE ====================
    const Pack4State = {
        coins: parseInt(localStorage.getItem('lacosteCoins') || '0'),
        purchasedSkins: JSON.parse(localStorage.getItem('lacostePurchasedSkins') || '["crocodile", "panda"]'),
        activeSkin: localStorage.getItem('lacosteActiveSkin') || 'crocodile',
        
        dailyMissions: [],
        lastMissionDate: '',
        
        konamiProgress: 0,
        isGodMode: false,
        godModeTimer: null,
        
        uiListeners: [],
        showShop: false,
        showMissions: false,
        showShare: false,
        lastRunStats: null,
        _lastCoinDist: 0,
    };

    // Экспортируем для других пакетов и игры
    window.Pack4State = Pack4State;

    // ==================== SKINS & UPGRADES ====================
    const SKINS = [
        { id: 'crocodile', name: 'Crocodile', emoji: '🐊', price: 0 },
        { id: 'panda', name: 'Panda', emoji: '🐼', price: 0 },
        { id: 'gold_croc', name: 'Golden Croc', emoji: '🌟', price: 500 },
        { id: 'ninja_panda', name: 'Ninja Panda', emoji: '🥷', price: 800 },
    ];

    const UPGRADES = [
        { id: 'start_shield', name: 'Стартовый Щит', emoji: '🛡️', price: 300, desc: 'Начинать игру со щитом' },
        { id: 'extra_hp', name: 'Доп. Сердце', emoji: '❤️', price: 200, desc: '+1 HP на старте' },
    ];

    function saveEconomy() {
        localStorage.setItem('lacosteCoins', Pack4State.coins.toString());
        localStorage.setItem('lacostePurchasedSkins', JSON.stringify(Pack4State.purchasedSkins));
        localStorage.setItem('lacosteActiveSkin', Pack4State.activeSkin);
    }

    // ==================== MISSIONS ====================
    const MISSION_POOL = [
        { id: 'run_500', text: 'Пробеги 500 метров', icon: '🏃', target: 500, type: 'distance', reward: 50 },
        { id: 'eat_10', text: 'Съешь 10 еды', icon: '🍔', target: 10, type: 'food', reward: 30 },
        { id: 'jump_50', text: 'Прыгни 50 раз', icon: '🦘', target: 50, type: 'jumps', reward: 40 },
        { id: 'gold_5', text: 'Собери 5 золотых звёзд', icon: '⭐', target: 5, type: 'gold', reward: 100 },
        { id: 'no_damage', text: 'Пройди без урона 300м', icon: '🛡️', target: 300, type: 'nodamage', reward: 80 },
    ];

    function generateDailyMissions() {
        const today = new Date().toISOString().split('T')[0];
        if (Pack4State.lastMissionDate === today && Pack4State.dailyMissions.length > 0) return;

        const shuffled = [...MISSION_POOL].sort(() => 0.5 - Math.random());
        Pack4State.dailyMissions = shuffled.slice(0, 3).map(m => ({
            ...m,
            progress: 0,
            completed: false,
        }));
        Pack4State.lastMissionDate = today;
        localStorage.setItem('lacosteDailyMissions', JSON.stringify({
            date: today,
            missions: Pack4State.dailyMissions
        }));
    }

    function updateMissions(data) {
        let changed = false;
        Pack4State.dailyMissions.forEach(m => {
            if (m.completed) return;
            let prog = m.progress;
            
            if (m.type === 'distance') prog = Math.max(prog, data.distance);
            if (m.type === 'food' && data._foodJustEaten) prog += 1;
            if (m.type === 'jumps' && data._jumpJustHappened) prog += 1;
            if (m.type === 'gold' && data._goldJustEaten) prog += 1;
            if (m.type === 'nodamage') prog = (data.damageTaken === 0) ? Math.max(prog, data.distance) : 0;

            if (prog >= m.target) {
                m.completed = true;
                m.progress = m.target;
                Pack4State.coins += m.reward;
                saveEconomy();
                if (window.Pack2Hooks && window.Pack2Hooks.toast) {
                    window.Pack2Hooks.toast(`🎯 Миссия выполнена! +${m.reward} 🪙`, 'success', 3000);
                }
                changed = true;
            } else if (prog !== m.progress) {
                m.progress = prog;
                changed = true;
            }
        });
        if (changed) {
            localStorage.setItem('lacosteDailyMissions', JSON.stringify({
                date: Pack4State.lastMissionDate,
                missions: Pack4State.dailyMissions
            }));
        }
    }

    // ==================== SHARE ====================
    function generateShareImage(stats) {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');

        // Фон
        const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
        grad.addColorStop(0, '#0b0c10');
        grad.addColorStop(0.5, '#1a0b2e');
        grad.addColorStop(1, '#0b0c10');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1080, 1080);

        // Рамка
        ctx.strokeStyle = '#FF007F';
        ctx.lineWidth = 8;
        ctx.strokeRect(30, 30, 1020, 1020);

        // Заголовок
        ctx.fillStyle = '#FF007F';
        ctx.font = 'bold 90px "Bebas Neue", sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#00FFFF';
        ctx.shadowBlur = 20;
        ctx.fillText('LACOSTE RUNNER', 540, 200);
        ctx.shadowBlur = 0;

        // Статистика
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 60px "Bebas Neue", sans-serif';
        ctx.fillText('РЕЗУЛЬТАТ ЗАБЕГА', 540, 320);

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 220px "Bebas Neue", sans-serif';
        ctx.fillText(`${stats.distance}м`, 540, 560);

        ctx.fillStyle = '#00FF41';
        ctx.font = 'bold 44px "Bebas Neue", sans-serif';
        ctx.fillText(`🏆 Рекорд: ${stats.highScore}м`, 540, 660);
        ctx.fillText(`🔥 Комбо: x${stats.combo || 1}`, 540, 720);
        ctx.fillText(`🍽️ Еды: ${stats.foodEaten || 0}`, 540, 780);
        ctx.fillText(`🪙 Монет: ${Pack4State.coins}`, 540, 840);

        // Подпись
        ctx.fillStyle = '#AAAAAA';
        ctx.font = '30px "Courier New", monospace';
        ctx.fillText('lacoste-runner • vice city edition', 540, 980);

        return canvas;
    }

    function shareResult(stats) {
        const canvas = generateShareImage(stats);
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            
            if (navigator.share) {
                const file = new File([blob], 'lacoste-runner.png', { type: 'image/png' });
                navigator.share({
                    title: 'Lacoste Runner',
                    text: `Я пробежал ${stats.distance}м в Lacoste Runner! 🐊`,
                    files: [file]
                }).catch((e) => {
                    if (e.name !== 'AbortError') downloadImage(url);
                });
            } else {
                downloadImage(url);
            }
        });
    }

    function downloadImage(url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lacoste-runner.png';
        a.click();
        URL.revokeObjectURL(url);
    }

    // ==================== SECRETS (KONAMI) ====================
    const KONAMI_CODE = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];
    
    function checkKonami(e) {
        const expected = KONAMI_CODE[Pack4State.konamiProgress];
        if (e.code === expected) {
            Pack4State.konamiProgress++;
            if (Pack4State.konamiProgress === KONAMI_CODE.length) {
                activateGodMode();
                Pack4State.konamiProgress = 0;
            }
        } else {
            Pack4State.konamiProgress = 0;
        }
    }

    function activateGodMode() {
        if (Pack4State.isGodMode) return;
        Pack4State.isGodMode = true;
        
        if (window.Pack2Hooks && window.Pack2Hooks.toast) {
            window.Pack2Hooks.toast('🌟 BEZSMERTIE AKTIVIROVANO! 10 сек', 'success', 3000);
        }
        
        setTimeout(() => {
            Pack4State.isGodMode = false;
            if (window.Pack2Hooks && window.Pack2Hooks.toast) {
                window.Pack2Hooks.toast('🌟 Bezsmertie konchilos', 'info', 2000);
            }
        }, 10000);
    }

    // ==================== GAME EVENTS ====================
    let missionTickData = { _foodJustEaten: false, _jumpJustHappened: false, _goldJustEaten: false };

    window.GameEvents.on('start', () => {
        generateDailyMissions();
        Pack4State.lastRunStats = { distance: 0, foodEaten: 0, combo: 0, highScore: 0 };
        Pack4State._lastCoinDist = 0;
        missionTickData = { _foodJustEaten: false, _jumpJustHappened: false, _goldJustEaten: false };
    });

    window.GameEvents.on('jump', () => {
        missionTickData._jumpJustHappened = true;
    });

    window.GameEvents.on('eat', (data) => {
        missionTickData._foodJustEaten = true;
        if (data.type === 'golden') {
            missionTickData._goldJustEaten = true;
            Pack4State.coins += 5;
        } else {
            Pack4State.coins += 1;
        }
        saveEconomy();
    });

    window.GameEvents.on('tick', (data) => {
        // Монеты за дистанцию (1 монета за 10м)
        const currentCoinDist = Math.floor(data.distance / 10);
        if (currentCoinDist > Pack4State._lastCoinDist) {
            Pack4State.coins += (currentCoinDist - Pack4State._lastCoinDist);
            Pack4State._lastCoinDist = currentCoinDist;
            saveEconomy();
        }

        // Обновляем миссии
        updateMissions({
            distance: data.distance,
            damageTaken: Pack4State.lastRunStats?.damageTaken || 0,
            ...missionTickData,
        });
        missionTickData._foodJustEaten = false;
        missionTickData._jumpJustHappened = false;
        missionTickData._goldJustEaten = false;

        // Обновляем последние статы для шаринга
        Pack4State.lastRunStats = {
            distance: Math.floor(data.distance),
            foodEaten: data.foodEaten || 0,
            combo: 1,
            highScore: parseInt(localStorage.getItem('lacosteHighScore') || '0'),
            damageTaken: data.damageTaken || 0,
        };
        
        Pack4State.uiListeners.forEach(fn => fn());
    });

    window.GameEvents.on('hit', () => {
        if (Pack4State.lastRunStats) Pack4State.lastRunStats.damageTaken++;
        if (Pack4State.isGodMode && window.GameRefs && window.GameRefs.health) {
            // Восстанавливаем здоровье
            window.GameRefs.health.current = Math.min(6, window.GameRefs.health.current + 1);
        }
    });

    window.GameEvents.on('gameover', (data) => {
        Pack4State.lastRunStats = {
            distance: data.distance,
            highScore: parseInt(localStorage.getItem('lacosteHighScore') || '0'),
            foodEaten: data.foodEaten || 0,
            combo: data.combo || 1,
            damageTaken: data.health ? 6 - data.health : 0,
        };
        Pack4State.showShare = true;
        Pack4State.uiListeners.forEach(fn => fn());
    });

    // ==================== KEYBOARD ====================
    window.addEventListener('keydown', (e) => {
        checkKonami(e);
        if (e.code === 'Escape') {
            if (Pack4State.showShop) Pack4State.showShop = false;
            if (Pack4State.showMissions) Pack4State.showMissions = false;
            if (Pack4State.showShare) Pack4State.showShare = false;
            Pack4State.uiListeners.forEach(fn => fn());
        }
    });

    // ==================== UI ====================
    function Pack4UI({ gameState }) {
        const [, forceUpdate] = React.useState(0);
        
        React.useEffect(() => {
            const listener = () => forceUpdate(n => n + 1);
            Pack4State.uiListeners.push(listener);
            return () => {
                const idx = Pack4State.uiListeners.indexOf(listener);
                if (idx >= 0) Pack4State.uiListeners.splice(idx, 1);
            };
        }, []);

        // Счётчик монет в HUD (только в игре)
        const coinHud = (gameState === 'playing') ? React.createElement('div', {
            style: {
                position: 'absolute', top: '30%', right: '2%', zIndex: 7,
                fontFamily: "'Courier New', monospace",
                fontSize: 'clamp(12px, 2vmin, 18px)',
                color: '#FFD700',
                textShadow: '0 0 10px rgba(255, 215, 0, 0.8), 1px 1px 0 #000',
                background: 'rgba(0,0,0,0.5)',
                padding: '4px 10px',
                borderRadius: '20px',
                border: '1px solid rgba(255,215,0,0.4)',
            }
        }, `🪙 ${Pack4State.coins}`) : null;

        // Кнопки в меню
        const menuButtons = (gameState === 'menu') ? React.createElement('div', {
            style: { display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap', justifyContent: 'center' }
        },
            React.createElement('button', {
                className: 'btn',
                onClick: () => { Pack4State.showShop = true; forceUpdate(n => n + 1); }
            }, `🛒 SHOP (${Pack4State.coins} 🪙)`),
            React.createElement('button', {
                className: 'btn',
                onClick: () => { Pack4State.showMissions = true; forceUpdate(n => n + 1); }
            }, '🎯 MISSIONS')
        ) : null;

        // Модал магазина
        const shopModal = Pack4State.showShop ? React.createElement('div', {
            style: {
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 40,
                display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3%',
            }
        },
            React.createElement('div', {
                style: {
                    width: 'min(92%, 700px)', maxHeight: '90%', overflowY: 'auto',
                    background: 'linear-gradient(180deg, rgba(20,10,35,0.98), rgba(10,5,20,0.98))',
                    border: '2px solid #FFD700', borderRadius: '16px',
                    boxShadow: '0 0 40px rgba(255,215,0,0.4)',
                    padding: '24px', fontFamily: "'Bebas Neue', sans-serif", color: 'white',
                }
            },
                React.createElement('div', {
                    style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }
                },
                    React.createElement('h2', { style: { color: '#FFD700', margin: 0, letterSpacing: '3px' } }, '🛒 SHOP'),
                    React.createElement('div', { style: { color: '#FFD700', fontSize: '24px' } }, `🪙 ${Pack4State.coins}`)
                ),
                React.createElement('h3', { style: { color: '#00FFFF', marginTop: '20px', marginBottom: '10px', letterSpacing: '2px' } }, 'SKINS'),
                ...SKINS.map(skin => {
                    const owned = Pack4State.purchasedSkins.includes(skin.id);
                    const isActive = Pack4State.activeSkin === skin.id;
                    return React.createElement('div', {
                        key: skin.id,
                        style: {
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px', marginBottom: '8px',
                            background: isActive ? 'rgba(0,255,65,0.1)' : 'rgba(255,255,255,0.04)',
                            border: isActive ? '2px solid #00FF41' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                        }
                    },
                        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
                            React.createElement('span', { style: { fontSize: '32px' } }, skin.emoji),
                            React.createElement('div', null,
                                React.createElement('div', { style: { fontSize: '18px', letterSpacing: '1px' } }, skin.name),
                                React.createElement('div', { style: { fontSize: '12px', color: '#888' } }, owned ? (isActive ? '✅ АКТИВЕН' : '✅ Куплен') : `${skin.price} 🪙`)
                            )
                        ),
                        React.createElement('button', {
                            className: 'btn',
                            style: { padding: '6px 16px', fontSize: '14px' },
                            onClick: () => {
                                if (isActive) return;
                                if (owned) {
                                    Pack4State.activeSkin = skin.id;
                                    saveEconomy();
                                    if (window.GameEvents) window.GameEvents.emit('skin_changed', { skin: skin.id });
                                } else if (Pack4State.coins >= skin.price) {
                                    Pack4State.coins -= skin.price;
                                    Pack4State.purchasedSkins.push(skin.id);
                                    Pack4State.activeSkin = skin.id;
                                    saveEconomy();
                                    if (window.GameEvents) window.GameEvents.emit('skin_changed', { skin: skin.id });
                                } else {
                                    if (window.Pack2Hooks) window.Pack2Hooks.toast('❌ Недостаточно монет', 'danger');
                                }
                                forceUpdate(n => n + 1);
                            }
                        }, isActive ? 'АКТИВЕН' : (owned ? 'ВЫБРАТЬ' : 'КУПИТЬ'))
                    );
                }),
                React.createElement('button', {
                    className: 'btn',
                    style: { marginTop: '20px', width: '100%' },
                    onClick: () => { Pack4State.showShop = false; forceUpdate(n => n + 1); }
                }, 'ЗАКРЫТЬ')
            )
        ) : null;

        // Модал миссий
        const missionsModal = Pack4State.showMissions ? React.createElement('div', {
            style: {
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 40,
                display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3%',
            }
        },
            React.createElement('div', {
                style: {
                    width: 'min(92%, 600px)', maxHeight: '90%', overflowY: 'auto',
                    background: 'linear-gradient(180deg, rgba(20,10,35,0.98), rgba(10,5,20,0.98))',
                    border: '2px solid #00FF41', borderRadius: '16px',
                    boxShadow: '0 0 40px rgba(0,255,65,0.3)',
                    padding: '24px', fontFamily: "'Bebas Neue', sans-serif", color: 'white',
                }
            },
                React.createElement('h2', { style: { color: '#00FF41', margin: 0, letterSpacing: '3px', marginBottom: '20px' } }, '🎯 DAILY MISSIONS'),
                ...Pack4State.dailyMissions.map(m => React.createElement('div', {
                    key: m.id,
                    style: {
                        padding: '12px', marginBottom: '10px',
                        background: m.completed ? 'rgba(0,255,65,0.15)' : 'rgba(255,255,255,0.04)',
                        border: m.completed ? '2px solid #00FF41' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                    }
                },
                    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' } },
                        React.createElement('span', { style: { fontSize: '18px' } }, `${m.icon} ${m.text}`),
                        React.createElement('span', { style: { color: '#FFD700', fontSize: '16px' } }, `+${m.reward} 🪙`)
                    ),
                    React.createElement('div', {
                        style: { height: '6px', background: 'rgba(0,0,0,0.5)', borderRadius: '3px', overflow: 'hidden' }
                    },
                        React.createElement('div', {
                            style: {
                                width: `${Math.min(100, (m.progress / m.target) * 100)}%`,
                                height: '100%',
                                background: m.completed ? '#00FF41' : 'linear-gradient(90deg, #00FFFF, #FF00FF)',
                                transition: 'width 0.3s'
                            }
                        })
                    ),
                    React.createElement('div', { style: { fontSize: '12px', color: '#888', marginTop: '4px', textAlign: 'right' } },
                        `${Math.min(m.progress, m.target)} / ${m.target}`
                    )
                )),
                React.createElement('button', {
                    className: 'btn',
                    style: { marginTop: '20px', width: '100%' },
                    onClick: () => { Pack4State.showMissions = false; forceUpdate(n => n + 1); }
                }, 'ЗАКРЫТЬ')
            )
        ) : null;

        // Модал шаринга
        const shareModal = (Pack4State.showShare && Pack4State.lastRunStats && gameState === 'gameover') ? React.createElement('div', {
            style: {
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 40,
                display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3%',
            }
        },
            React.createElement('div', {
                style: {
                    width: 'min(92%, 500px)',
                    background: 'linear-gradient(180deg, rgba(20,10,35,0.98), rgba(10,5,20,0.98))',
                    border: '2px solid #FF007F', borderRadius: '16px',
                    boxShadow: '0 0 40px rgba(255,0,127,0.4)',
                    padding: '24px', fontFamily: "'Bebas Neue', sans-serif", color: 'white',
                    textAlign: 'center',
                }
            },
                React.createElement('h2', { style: { color: '#FF007F', letterSpacing: '3px', marginTop: 0 } }, '📸 SHARE RESULT'),
                React.createElement('div', { style: { fontSize: '64px', color: '#FFD700', margin: '20px 0' } }, `${Pack4State.lastRunStats.distance}м`),
                React.createElement('div', { style: { fontSize: '16px', color: '#00FFFF', marginBottom: '20px' } },
                    `🏆 Рекорд: ${Pack4State.lastRunStats.highScore}м`
                ),
                React.createElement('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' } },
                    React.createElement('button', {
                        className: 'btn',
                        style: { background: '#FF007F', color: 'white', padding: '12px 24px' },
                        onClick: () => shareResult(Pack4State.lastRunStats)
                    }, '📤 ПОДЕЛИТЬСЯ'),
                    React.createElement('button', {
                        className: 'btn',
                        style: { padding: '12px 24px' },
                        onClick: () => { Pack4State.showShare = false; forceUpdate(n => n + 1); }
                    }, 'ЗАКРЫТЬ')
                )
            )
        ) : null;

        return React.createElement(React.Fragment, null,
            coinHud,
            menuButtons,
            shopModal,
            missionsModal,
            shareModal
        );
    }

    if (window.PackUIs) {
        window.PackUIs.push(Pack4UI);
    } else {
        window.PackUIs = [Pack4UI];
    }

    console.log('%c💰 PACK 4 loaded', 'color:#FFD700;font-weight:bold;font-size:14px');
})();
