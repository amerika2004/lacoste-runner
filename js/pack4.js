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
        shop: { skins: [], buffs: [], consumables: [] },
        missions: [],
        secrets: { goldenCrocDistance: 5000, konami: { code: [], duration: 10000 }, ufoChance: 0.05, ufoCoins: 100 }
    };

    const Pack4State = {
        coins: parseInt(localStorage.getItem('lacosteCoins') || '0'),
        inventory: JSON.parse(localStorage.getItem('lacosteInventory') || '{}'),
        boughtBuffs: JSON.parse(localStorage.getItem('lacosteBuffs') || '[]'),
        unlockedSkins: JSON.parse(localStorage.getItem('lacosteSkins') || '["default"]'),
        upgrades: JSON.parse(localStorage.getItem('lacosteUpgrades') || '{}'),
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
        localStorage.setItem('lacosteUpgrades', JSON.stringify(Pack4State.upgrades));
        localStorage.setItem('lacosteMissions', JSON.stringify(Pack4State.missions));
        localStorage.setItem('lacosteLeaderboard', JSON.stringify(Pack4State.leaderboard));
        localStorage.setItem('lacosteRunsPlayed', Pack4State.runsPlayed);
    }

    function updateUI() { Pack4State.uiListeners.forEach(fn => fn()); }

    function initMissions() {
        if (Pack4State.missions.length === 0) {
            Pack4State.missions = P4_CONFIG.missions.map(m => ({ ...m, progress: 0, completed: false }));
            saveState();
        }
    }

    function buyItem(type, id, price) {
        if (Pack4State.coins < price) { window.GameEvents.emit('pack4_toast', { text: '❌ Not enough coins!', type: 'danger' }); return; }
        Pack4State.coins -= price;
        if (type === 'skin') {
            if (!Pack4State.unlockedSkins.includes(id)) Pack4State.unlockedSkins.push(id);
        } else if (type === 'buff') {
            if (!Pack4State.boughtBuffs.includes(id)) Pack4State.boughtBuffs.push(id);
        }
        window.GameEvents.emit('pack4_coins_updated');
        window.GameEvents.emit('pack4_toast', { text: '✅ Purchased!', type: 'success' });
        saveState(); updateUI();
    }

    function buyConsumable(id, price) {
        if (Pack4State.coins < price) { window.GameEvents.emit('pack4_toast', { text: '❌ Not enough coins!', type: 'danger' }); return; }
        Pack4State.coins -= price;
        Pack4State.inventory[id] = (Pack4State.inventory[id] || 0) + 1;
        if (window.Pack2State && window.Pack2State.inventory && window.Pack2State.inventory[id] !== undefined) {
            window.Pack2State.inventory[id]++;
            if (window.Pack2State.uiListeners) window.Pack2State.uiListeners.forEach(fn => fn());
        }
        window.GameEvents.emit('pack4_coins_updated');
        window.GameEvents.emit('pack4_toast', { text: `✅ Bought ${id.toUpperCase()}!`, type: 'success' });
        saveState(); updateUI();
    }

    function buyUpgrade(charId, stat, price) {
        if (Pack4State.coins < price) { window.GameEvents.emit('pack4_toast', { text: '❌ Not enough coins!', type: 'danger' }); return; }
        Pack4State.coins -= price;
        if (!Pack4State.upgrades[charId]) Pack4State.upgrades[charId] = { speed: 0, jump: 0, luck: 0 };
        Pack4State.upgrades[charId][stat]++;
        window.GameEvents.emit('pack4_coins_updated');
        window.GameEvents.emit('pack4_toast', { text: `✅ ${stat.toUpperCase()} Upgraded!`, type: 'success' });
        saveState(); updateUI();
    }
    Pack4State.buyUpgrade = buyUpgrade;

    window.GameEvents.on('start', (data) => {
        Pack4State.settings = data.settings;
        initMissions();
        Pack4State.activeUFO = null;
        if (Math.random() < P4_CONFIG.secrets.ufoChance) {
            Pack4State.activeUFO = { x: 800, y: 100, w: 80, h: 40, collected: false, speed: 2 };
        }
    });

    window.GameEvents.on('tick', (data) => {
        if (data.settings) Pack4State.settings = data.settings;
        
        if (Pack4State.activeUFO && !Pack4State.activeUFO.collected) {
            Pack4State.activeUFO.x -= Pack4State.activeUFO.speed;
            Pack4State.activeUFO.y = 100 + Math.sin(Date.now() / 500) * 30;
            const pX = 100; const pY = 530 - 100;
            if (Math.abs(Pack4State.activeUFO.x - pX) < 100 && Math.abs(Pack4State.activeUFO.y - pY) < 150) {
                Pack4State.activeUFO.collected = true;
                Pack4State.coins += P4_CONFIG.secrets.ufoCoins;
                window.GameEvents.emit('pack4_toast', { text: `🛸 UFO CAPTURED! +${P4_CONFIG.secrets.ufoCoins} COINS`, type: 'info' });
                if (window.RenderEngine) window.RenderEngine.flash('0,255,255', 0.5);
                saveState(); updateUI();
            }
            if (Pack4State.activeUFO.x < -100) Pack4State.activeUFO = null;
        }

        if (data.distance) {
            Pack4State.missions.forEach(m => {
                if (m.type === 'distance' && m.progress < m.target && !m.completed) {
                    m.progress = Math.min(m.target, Math.floor(data.distance));
                    if (m.progress >= m.target) {
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
            if (m.type === 'food' && m.progress < m.target && !m.completed) {
                m.progress++;
                if (m.progress >= m.target) {
                    m.completed = true; Pack4State.coins += m.reward;
                    window.GameEvents.emit('pack4_toast', { text: `🎯 MISSION COMPLETE: +${m.reward} COINS`, type: 'success' });
                    saveState(); updateUI();
                }
            }
        });
    });

    window.GameEvents.on('jump', () => {
        Pack4State.missions.forEach(m => {
            if (m.type === 'jumps' && m.progress < m.target && !m.completed) {
                m.progress++;
                if (m.progress >= m.target) {
                    m.completed = true; Pack4State.coins += m.reward;
                    window.GameEvents.emit('pack4_toast', { text: `🎯 MISSION COMPLETE: +${m.reward} COINS`, type: 'success' });
                    saveState(); updateUI();
                }
            }
        });
    });

    window.GameEvents.on('gameover', (data) => {
        const earned = Math.floor(data.distance * P4_CONFIG.economy.coinsPerMeter);
        Pack4State.coins += earned;
        Pack4State.runsPlayed++;
        
        Pack4State.leaderboard.push({ score: data.distance, date: new Date().toISOString() });
        Pack4State.leaderboard.sort((a, b) => b.score - a.score);
        Pack4State.leaderboard = Pack4State.leaderboard.slice(0, 10);

        if (data.distance >= P4_CONFIG.secrets.goldenCrocDistance && !Pack4State.unlockedSkins.includes('gold')) {
            Pack4State.unlockedSkins.push('gold');
            window.GameEvents.emit('pack4_toast', { text: '🌟 GOLDEN CROC UNLOCKED!', type: 'success' });
        }
        window.GameEvents.emit('pack4_coins_updated');
        saveState(); updateUI();
    });

    function Pack4ToastSystem() {
        const [toasts, setToasts] = React.useState([]);
        React.useEffect(() => {
            const listener = (data) => {
                const id = Date.now() + Math.random(); setToasts(prev => [...prev, { id, ...data }]);
                setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 4000);
            };
            window.GameEvents.on('pack4_toast', listener);
            return () => { if (window.GameEvents.listeners['pack4_toast']) window.GameEvents.listeners['pack4_toast'] = window.GameEvents.listeners['pack4_toast'].filter(cb => cb !== listener); };
        }, []);
        return React.createElement('div', { className: 'pack3-toast-container' }, toasts.map(t => React.createElement('div', { key: t.id, className: `pack3-toast ${t.type}` }, t.text)));
    }

    function Pack4Shop() {
        const [visible, setVisible] = React.useState(false);
        const [activeTab, setActiveTab] = React.useState('skins');
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
            React.createElement('div', { className: 'pack4-panel shop-panel' },
                
                React.createElement('div', { className: 'pack4-header' },
                    React.createElement('div', { className: 'pack4-title' }, '🛒 SHOP'),
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '15px' } },
                        React.createElement('div', { className: 'pack4-coins' }, `💰 ${Pack4State.coins}`),
                        React.createElement('button', { className: 'modal-close', onClick: () => setVisible(false) }, '✕')
                    )
                ),

                React.createElement('div', { className: 'shop-tabs' },
                    React.createElement('button', { className: `shop-tab ${activeTab === 'skins' ? 'active' : ''}`, onClick: () => setActiveTab('skins') }, 'Skins'),
                    React.createElement('button', { className: `shop-tab ${activeTab === 'upgrades' ? 'active' : ''}`, onClick: () => setActiveTab('upgrades') }, 'Upgrades'),
                    React.createElement('button', { className: `shop-tab ${activeTab === 'consumables' ? 'active' : ''}`, onClick: () => setActiveTab('consumables') }, 'Consumables')
                ),

                React.createElement('div', { className: 'shop-content' },
                    activeTab === 'skins' && React.createElement('div', { className: 'pack4-section' },
                        React.createElement('div', { className: 'pack4-grid' },
                            P4_CONFIG.shop.skins.map(skin => {
                                const owned = Pack4State.unlockedSkins.includes(skin.id);
                                return React.createElement('div', { key: skin.id, className: `pack4-item ${owned ? 'owned' : ''}` },
                                    React.createElement('div', { className: 'pack4-item-icon' }, skin.icon),
                                    React.createElement('div', { className: 'pack4-item-name' }, skin.name),
                                    React.createElement('div', { className: 'pack4-item-desc' }, skin.desc),
                                    !owned && React.createElement('button', { className: 'pack4-buy-btn', onClick: () => buyItem('skin', skin.id, skin.price) }, `💰 ${skin.price}`),
                                    owned && React.createElement('div', { className: 'pack4-owned-label' }, 'OWNED')
                                );
                            })
                        )
                    ),

                    activeTab === 'upgrades' && React.createElement('div', { className: 'pack4-section' },
                        React.createElement('div', { className: 'pack4-grid' },
                            P4_CONFIG.shop.buffs.map(buff => {
                                const owned = Pack4State.boughtBuffs.includes(buff.id);
                                return React.createElement('div', { key: buff.id, className: `pack4-item ${owned ? 'owned' : ''}` },
                                    React.createElement('div', { className: 'pack4-item-icon' }, buff.icon || '✨'),
                                    React.createElement('div', { className: 'pack4-item-name' }, buff.name),
                                    React.createElement('div', { className: 'pack4-item-desc' }, buff.description),
                                    !owned && React.createElement('button', { className: 'pack4-buy-btn', onClick: () => buyItem('buff', buff.id, buff.price) }, `💰 ${buff.price}`),
                                    owned && React.createElement('div', { className: 'pack4-owned-label' }, 'ACTIVE')
                                );
                            })
                        )
                    ),

                    activeTab === 'consumables' && React.createElement('div', { className: 'pack4-section' },
                        React.createElement('div', { className: 'pack4-grid' },
                            P4_CONFIG.shop.consumables.map(item => {
                                const qty = Pack4State.inventory[item.id] || 0;
                                return React.createElement('div', { key: item.id, className: 'pack4-item consumable' },
                                    qty > 0 && React.createElement('div', { className: 'pack4-item-qty' }, `×${qty}`),
                                    React.createElement('div', { className: 'pack4-item-icon', style: { filter: `drop-shadow(0 0 20px ${item.color})` } }, item.icon),
                                    React.createElement('div', { className: 'pack4-item-name' }, item.name),
                                    React.createElement('button', { className: 'pack4-buy-btn', onClick: () => buyConsumable(item.id, item.price) }, `💰 ${item.price}`)
                                );
                            })
                        )
                    )
                )
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
                React.createElement('div', { className: 'pack4-header', style: { borderBottom: 'none', paddingBottom: '0' } },
                    React.createElement('div', { className: 'pack4-title' }, '🏅 LEADERBOARD'),
                    React.createElement('button', { className: 'modal-close', onClick: () => setVisible(false) }, '✕')
                ),
                React.createElement('div', { className: 'pack4-leaderboard-list' },
                    Pack4State.leaderboard.length === 0
                        ? React.createElement('div', { style: { textAlign: 'center', color: 'var(--fh-text-muted)', padding: '30px' } }, 'No runs yet. Go play!')
                        : Pack4State.leaderboard.map((entry, i) => React.createElement('div', { key: i, className: 'pack4-lb-row' },
                            React.createElement('span', { className: 'pack4-lb-rank' }, `#${i + 1}`),
                            React.createElement('span', { className: 'pack4-lb-score' }, `${entry.score}m`),
                            React.createElement('span', { className: 'pack4-lb-date' }, new Date(entry.date).toLocaleDateString())
                        ))
                )
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
                navigator.clipboard.writeText(gameUrl);
                alert("Ссылка скопирована в буфер обмена!");
            }
        };

        return React.createElement('div', { className: 'pack4-overlay' },
            React.createElement('div', { className: 'pack4-panel', style: { textAlign: 'center' } },
                React.createElement('div', { className: 'pack4-header', style: { borderBottom: 'none', paddingBottom: '0' } },
                    React.createElement('div', { className: 'pack4-title' }, '📸 SHARE'),
                    React.createElement('button', { className: 'modal-close', onClick: () => setVisible(false) }, '✕')
                ),
                React.createElement('div', { style: { fontSize: '48px', margin: '10px 0' } }, '🐊🏃💨'),
                React.createElement('div', { style: { fontSize: '24px', color: '#FFD700', marginBottom: '20px' } }, `Score: ${Math.floor(score)}m`),
                React.createElement('img', { src: qrUrl, style: { width: '150px', height: '150px', marginBottom: '20px' } }),
                React.createElement('div', { style: { display: 'flex', justifyContent: 'center' } },
                    React.createElement('button', { className: 'pack4-buy-btn', onClick: share, style: { maxWidth: '200px' } }, 'SHARE LINK')
                )
            )
        );
    }

    function Pack4HUD({ gameState, score }) {
        if (gameState !== 'playing') return null;
        return React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'pack4-hud-coins' }, `💰 ${Pack4State.coins}`)
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
