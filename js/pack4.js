window.GameEvents = window.GameEvents || {
    listeners: {},
    on(event, cb) { if (!this.listeners[event]) this.listeners[event] = []; this.listeners[event].push(cb); },
    emit(event, data) { if (this.listeners[event]) this.listeners[event].forEach(cb => { try { cb(data); } catch(e) { console.error(e); } }); }
};
window.PackUIs = window.PackUIs || [];

/* ==================================================================
   PACK 4 — Economy, Missions, Shop, Social, Secrets
   ================================================================== */
(function () {
    'use strict';

    const P4_CONFIG = (window.GAME_CONFIG && window.GAME_CONFIG.pack4) || {
        economy: { coinsPerMeter: 1, bonusCombo: 5, bonusGoldenFood: 50 },
        shop: { skins: [], buffs: [], backgrounds: [] },
        missions: [],
        secrets: { goldenCrocDistance: 5000, konami: { code: [], duration: 10000 }, ufoChance: 0.05, ufoCoins: 100 }
    };

    const Pack4State = {
        coins: parseInt(localStorage.getItem('lacosteCoins') || '0'),
        inventory: JSON.parse(localStorage.getItem('lacosteInventory') || '{}'),
        boughtBuffs: JSON.parse(localStorage.getItem('lacosteBuffs') || '[]'),
        unlockedSkins: JSON.parse(localStorage.getItem('lacosteSkins') || '["default"]'),
        missions: JSON.parse(localStorage.getItem('lacosteMissions') || '[]'),
        leaderboard: JSON.parse(localStorage.getItem('lacosteLeaderboard') || '[]'),
        cheatInvincible: 0,
        activeUFO: null,
        runsPlayed: parseInt(localStorage.getItem('lacosteRunsPlayed') || '0'),
        settings: null,
        uiListeners: [],
    };

    window.Pack4State = Pack4State;

    function saveState() {
        localStorage.setItem('lacosteCoins', Pack4State.coins);
        localStorage.setItem('lacosteInventory', JSON.stringify(Pack4State.inventory));
        localStorage.setItem('lacosteBuffs', JSON.stringify(Pack4State.boughtBuffs));
        localStorage.setItem('lacosteSkins', JSON.stringify(Pack4State.unlockedSkins));
        localStorage.setItem('lacosteMissions', JSON.stringify(Pack4State.missions));
        localStorage.setItem('lacosteLeaderboard', JSON.stringify(Pack4State.leaderboard));
        localStorage.setItem('lacosteRunsPlayed', Pack4State.runsPlayed);
    }

    function updateUI() { Pack4State.uiListeners.forEach(fn => fn()); }

    // Инициализация миссий при первом запуске
    function initMissions() {
        if (Pack4State.missions.length === 0) {
            Pack4State.missions = P4_CONFIG.missions.map(m => ({ ...m, progress: 0 }));
            saveState();
        }
    }

    // === МАГАЗИН ===
    function buyItem(type, id, price) {
        if (Pack4State.coins < price) { window.GameEvents.emit('pack4_toast', { text: '❌ Not enough coins!', type: 'danger' }); return; }
        
        Pack4State.coins -= price;
        
        if (type === 'skin') {
            if (!Pack4State.unlockedSkins.includes(id)) Pack4State.unlockedSkins.push(id);
        } else if (type === 'buff') {
            if (!Pack4State.boughtBuffs.includes(id)) Pack4State.boughtBuffs.push(id);
        } else if (type === 'bg') {
            // Логика для фонов
        }
        
        window.GameEvents.emit('pack4_toast', { text: '✅ Purchased!', type: 'success' });
        saveState(); updateUI();
    }

    // === ПОДПИСКА НА СОБЫТИЯ ===
    window.GameEvents.on('start', (data) => {
        Pack4State.settings = data.settings;
        initMissions();
        Pack4State.activeUFO = null;

        // Шанс спавна НЛО (раз в ~20 забегов)
        if (Math.random() < P4_CONFIG.secrets.ufoChance) {
            Pack4State.activeUFO = { x: 800, y: 100, w: 80, h: 40, collected: false, speed: 2 };
        }
    });

    window.GameEvents.on('tick', (data) => {
        if (data.settings) Pack4State.settings = data.settings;
        
        // Движение НЛО
        if (Pack4State.activeUFO && !Pack4State.activeUFO.collected) {
            Pack4State.activeUFO.x -= Pack4State.activeUFO.speed;
            Pack4State.activeUFO.y = 100 + Math.sin(Date.now() / 500) * 30; // Легкое покачивание
            
            // Проверка коллизии с игроком
            const pX = 100; const pY = 530 - 100; // Примерная позиция игрока
            if (Math.abs(Pack4State.activeUFO.x - pX) < 100 && Math.abs(Pack4State.activeUFO.y - pY) < 150) {
                Pack4State.activeUFO.collected = true;
                Pack4State.coins += P4_CONFIG.secrets.ufoCoins;
                window.GameEvents.emit('pack4_toast', { text: `🛸 UFO CAPTURED! +${P4_CONFIG.secrets.ufoCoins} COINS`, type: 'info' });
                if (window.RenderEngine) window.RenderEngine.flash('0,255,255', 0.5);
                saveState(); updateUI();
            }
            
            if (Pack4State.activeUFO.x < -100) Pack4State.activeUFO = null;
        }

        // Обновление миссий
        if (data.distance) {
            Pack4State.missions.forEach(m => {
                if (m.type === 'distance' && m.progress < m.target) {
                    m.progress = Math.min(m.target, Math.floor(data.distance));
                    if (m.progress >= m.target && !m.completed) {
                        m.completed = true;
                        Pack4State.coins += m.reward;
                        window.GameEvents.emit('pack4_toast', { text: `🎯 MISSION COMPLETE: +${m.reward} COINS`, type: 'success' });
                        saveState(); updateUI();
                    }
                }
            });
        }
    });

    window.GameEvents.on('eat', () => {
        Pack4State.missions.forEach(m => {
            if (m.type === 'food' && m.progress < m.target) {
                m.progress++;
                if (m.progress >= m.target && !m.completed) {
                    m.completed = true; Pack4State.coins += m.reward;
                    window.GameEvents.emit('pack4_toast', { text: `🎯 MISSION COMPLETE: +${m.reward} COINS`, type: 'success' });
                    saveState(); updateUI();
                }
            }
        });
    });

    window.GameEvents.on('jump', () => {
        Pack4State.missions.forEach(m => {
            if (m.type === 'jumps' && m.progress < m.target) {
                m.progress++;
                if (m.progress >= m.target && !m.completed) {
                    m.completed = true; Pack4State.coins += m.reward;
                    window.GameEvents.emit('pack4_toast', { text: `🎯 MISSION COMPLETE: +${m.reward} COINS`, type: 'success' });
                    saveState(); updateUI();
                }
            }
        });
    });

    window.GameEvents.on('gameover', (data) => {
        // Начисление монет
        const earned = Math.floor(data.distance * P4_CONFIG.economy.coinsPerMeter);
        Pack4State.coins += earned;
        Pack4State.runsPlayed++;
        
        // Лидерборд
        Pack4State.leaderboard.push({ score: data.distance, date: new Date().toISOString() });
        Pack4State.leaderboard.sort((a, b) => b.score - a.score);
        Pack4State.leaderboard = Pack4State.leaderboard.slice(0, 10); // Топ-10

        // Секретный персонаж
        if (data.distance >= P4_CONFIG.secrets.goldenCrocDistance && !Pack4State.unlockedSkins.includes('gold')) {
            Pack4State.unlockedSkins.push('gold');
            window.GameEvents.emit('pack4_toast', { text: '🌟 GOLDEN CROC UNLOCKED!', type: 'success' });
        }

        saveState(); updateUI();
    });

    // === UI КОМПОНЕНТЫ ===
    function Pack4ToastSystem() {
        const [toasts, setToasts] = React.useState([]);
        React.useEffect(() => {
            const listener = (data) => {
                const id = Date.now(); setToasts(prev => [...prev, { id, ...data }]);
                setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 4000);
            };
            window.GameEvents.on('pack4_toast', listener);
            return () => { if (window.GameEvents.listeners['pack4_toast']) window.GameEvents.listeners['pack4_toast'] = window.GameEvents.listeners['pack4_toast'].filter(cb => cb !== listener); };
        }, []);
        return React.createElement('div', { className: 'pack3-toast-container' }, toasts.map(t => React.createElement('div', { key: t.id, className: `pack3-toast ${t.type}` }, t.text)));
    }

    function Pack4Shop() {
        const [visible, setVisible] = React.useState(false);
        const [, forceUpdate] = React.useReducer(x => x + 1, 0);

        React.useEffect(() => {
            const show = () => setVisible(true);
            window.GameEvents.on('show_shop', show);
            Pack4State.uiListeners.push(forceUpdate);
            return () => {
                if (window.GameEvents.listeners['show_shop']) window.GameEvents.listeners['show_shop'] = window.GameEvents.listeners['show_shop'].filter(cb => cb !== show);
                Pack4State.uiListeners = Pack4State.uiListeners.filter(l => l !== forceUpdate);
            };
        }, []);

        if (!visible) return null;

        return React.createElement('div', { className: 'pack4-overlay' },
            React.createElement('div', { className: 'pack4-panel' },
                React.createElement('div', { className: 'pack4-header' },
                    React.createElement('div', { className: 'pack4-title' }, '🛒 SHOP'),
                    React.createElement('div', { className: 'pack4-coins' }, `💰 ${Pack4State.coins}`)
                ),
                React.createElement('div', { className: 'pack4-section' },
                    React.createElement('h3', null, 'Skins'),
                    React.createElement('div', { className: 'pack4-grid' },
                        P4_CONFIG.shop.skins.map(skin => {
                            const owned = Pack4State.unlockedSkins.includes(skin.id);
                            return React.createElement('div', { key: skin.id, className: `pack4-item ${owned ? 'owned' : ''}` },
                                React.createElement('div', { className: 'pack4-item-icon' }, skin.id === 'gold' ? '👑' : '🐊'),
                                React.createElement('div', { className: 'pack4-item-name' }, skin.name),
                                !owned && React.createElement('button', { className: 'pack4-buy-btn', onClick: () => buyItem('skin', skin.id, skin.price) }, `💰 ${skin.price}`),
                                owned && React.createElement('div', { className: 'pack4-owned-label' }, 'OWNED')
                            );
                        })
                    )
                ),
                React.createElement('div', { className: 'pack4-section' },
                    React.createElement('h3', null, 'Buffs'),
                    React.createElement('div', { className: 'pack4-grid' },
                        P4_CONFIG.shop.buffs.map(buff => {
                            const owned = Pack4State.boughtBuffs.includes(buff.id);
                            return React.createElement('div', { key: buff.id, className: `pack4-item ${owned ? 'owned' : ''}` },
                                React.createElement('div', { className: 'pack4-item-name' }, buff.name),
                                React.createElement('div', { className: 'pack4-item-desc' }, buff.description),
                                !owned && React.createElement('button', { className: 'pack4-buy-btn', onClick: () => buyItem('buff', buff.id, buff.price) }, `💰 ${buff.price}`),
                                owned && React.createElement('div', { className: 'pack4-owned-label' }, 'ACTIVE')
                            );
                        })
                    )
                ),
                React.createElement('button', { className: 'pack3-close-btn', onClick: () => setVisible(false) }, 'CLOSE')
            )
        );
    }

    function Pack4Leaderboard() {
        const [visible, setVisible] = React.useState(false);
        React.useEffect(() => {
            const show = () => setVisible(true);
            window.GameEvents.on('show_leaderboard', show);
            return () => { if (window.GameEvents.listeners['show_leaderboard']) window.GameEvents.listeners['show_leaderboard'] = window.GameEvents.listeners['show_leaderboard'].filter(cb => cb !== show); };
        }, []);
        if (!visible) return null;

        return React.createElement('div', { className: 'pack4-overlay' },
            React.createElement('div', { className: 'pack4-panel' },
                React.createElement('div', { className: 'pack4-title' }, '🏅 LEADERBOARD'),
                React.createElement('div', { className: 'pack4-leaderboard-list' },
                    Pack4State.leaderboard.map((entry, i) => React.createElement('div', { key: i, className: 'pack4-lb-row' },
                        React.createElement('span', { className: 'pack4-lb-rank' }, `#${i + 1}`),
                        React.createElement('span', { className: 'pack4-lb-score' }, `${entry.score}m`),
                        React.createElement('span', { className: 'pack4-lb-date' }, new Date(entry.date).toLocaleDateString())
                    ))
                ),
                React.createElement('button', { className: 'pack3-close-btn', onClick: () => setVisible(false) }, 'CLOSE')
            )
        );
    }

    function Pack4Share({ score }) {
        const [visible, setVisible] = React.useState(false);
        
        React.useEffect(() => {
            const show = () => setVisible(true);
            window.GameEvents.on('show_share', show);
            return () => { if (window.GameEvents.listeners['show_share']) window.GameEvents.listeners['show_share'] = window.GameEvents.listeners['show_share'].filter(cb => cb !== show); };
        }, []);

        if (!visible) return null;

        const gameUrl = window.location.origin + window.location.pathname;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(gameUrl + '?record=' + Math.floor(score))}`;

        const share = () => {
            if (navigator.share) {
                navigator.share({ title: 'Lacoste Runner', text: `I just scored ${Math.floor(score)}m in Lacoste Runner!`, url: gameUrl });
            } else {
                alert("Ссылка скопирована в буфер обмена!");
                navigator.clipboard.writeText(gameUrl);
            }
        };

        return React.createElement('div', { className: 'pack4-overlay' },
            React.createElement('div', { className: 'pack4-panel', style: { textAlign: 'center' } },
                React.createElement('div', { className: 'pack4-title' }, '📸 SHARE'),
                React.createElement('div', { style: { fontSize: '48px', margin: '20px 0' } }, '🐊🏃💨'),
                React.createElement('div', { style: { fontSize: '24px', color: '#FFD700', marginBottom: '20px' } }, `Score: ${Math.floor(score)}m`),
                React.createElement('img', { src: qrUrl, style: { width: '150px', height: '150px', marginBottom: '20px' } }),
                React.createElement('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center' } },
                    React.createElement('button', { className: 'pack4-buy-btn', onClick: share }, 'SHARE LINK'),
                    React.createElement('button', { className: 'pack3-close-btn', onClick: () => setVisible(false) }, 'CLOSE')
                )
            )
        );
    }

    function Pack4HUD({ gameState, score }) {
        if (gameState !== 'playing') return null;
        return React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'pack4-hud-coins' }, `💰 ${Pack4State.coins}`),
            Pack4State.cheatInvincible > Date.now() && React.createElement('div', { className: 'pack4-cheat-indicator' }, '🔱 INVINCIBLE')
        );
    }

    if (window.PackUIs) { 
        window.PackUIs.push(Pack4ToastSystem); 
        window.PackUIs.push(Pack4Shop); 
        window.PackUIs.push(Pack4Leaderboard); 
        window.PackUIs.push(Pack4Share);
        window.PackUIs.push(Pack4HUD);
    } else { 
        window.PackUIs = [Pack4ToastSystem, Pack4Shop, Pack4Leaderboard, Pack4Share, Pack4HUD]; 
    }

    console.log('%c💎 PACK 4 (Economy, Shop, Social) loaded', 'color:#FFD700;font-weight:bold;font-size:14px');
})();
