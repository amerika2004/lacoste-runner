window.GameEvents = window.GameEvents || {
    listeners: {},
    on(event, cb) { if (!this.listeners[event]) this.listeners[event] = []; this.listeners[event].push(cb); },
    emit(event, data) { if (this.listeners[event]) this.listeners[event].forEach(cb => { try { cb(data); } catch(e) { console.error(e); } }); }
};
window.PackUIs = window.PackUIs || [];

/* ==================================================================
   PACK 4 — Economy, Shop (per-char skins), Upgrades, Promo, Social
   v2.0 — UFO fix (render + catch), confirm, SFX/vibration,
          reduced-motion, ownership checks, defensive defaults
   ================================================================== */
(function () {
    'use strict';

    const PREFERS_REDUCED_MOTION = (() => {
        try { return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false; }
        catch { return false; }
    })();

    const P4_CONFIG = (window.GAME_CONFIG && window.GAME_CONFIG.pack4) || {
        economy: { coinsPerMeter: 1, bonusCombo: 5, bonusGoldenFood: 50 },
        shop: { buffs: [], consumables: [] },
        skinTiers: {},
        upgrades: { maxLevel: 10, priceBase: 500, priceStep: 250, statBonus: 0.05 },
        promo: { friendPrefix: 'FRIEND-', friendCodeLength: 4, friendRewardCoins: 500, adminCode: '', adminRewardCoins: 10000 },
        missions: [],
        secrets: { goldenCrocDistance: 5000, konami: { code: [], duration: 10000 }, ufoChance: 0.05, ufoCoins: 100 },
    };

    // Defensive defaults
    if (!P4_CONFIG.economy) P4_CONFIG.economy = { coinsPerMeter: 1, bonusCombo: 5, bonusGoldenFood: 50 };
    if (!P4_CONFIG.shop) P4_CONFIG.shop = { buffs: [], consumables: [] };
    if (!Array.isArray(P4_CONFIG.shop.buffs)) P4_CONFIG.shop.buffs = [];
    if (!Array.isArray(P4_CONFIG.shop.consumables)) P4_CONFIG.shop.consumables = [];
    if (!P4_CONFIG.upgrades) P4_CONFIG.upgrades = { maxLevel: 10, priceBase: 500, priceStep: 250, statBonus: 0.05 };
    if (!P4_CONFIG.promo) P4_CONFIG.promo = { friendPrefix: 'FRIEND-', friendCodeLength: 4, friendRewardCoins: 500, adminCode: '', adminRewardCoins: 10000 };
    if (!P4_CONFIG.secrets) P4_CONFIG.secrets = { ufoChance: 0.05, ufoCoins: 100 };
    if (!Array.isArray(P4_CONFIG.missions)) P4_CONFIG.missions = [];

    // ─── SFX (использует существующие wav) ───
    const SFX = (() => {
        const files = {
            buy:    'source/sounds/milestone.wav',
            unlock: 'source/sounds/jump.wav',
            equip:  'source/sounds/eat.wav',
            promo:  'source/sounds/milestone.wav',
            ufo:    'source/sounds/milestone.wav',
            error:  'source/sounds/hit.wav',
        };
        const audios = {};
        let settings = null;
        for (const [k, f] of Object.entries(files)) {
            try { const a = new Audio(f); a.preload = 'auto'; a.volume = 0.7; audios[k] = a; } catch (e) {}
        }
        function play(key, rate = 1.0, volMult = 1.0) {
            const a = audios[key];
            if (!a || !settings || !settings.soundEnabled) return;
            try {
                if (a.readyState >= 1) a.currentTime = 0;
                a.playbackRate = Math.max(0.5, Math.min(2.0, rate));
                a.volume = Math.max(0, Math.min(1,
                    (settings.sfxVolume ?? 0.7) * (settings.masterVolume ?? 1.0) * volMult
                ));
                a.play().catch(() => {});
            } catch (e) {}
        }
        return { play, setSettings: (s) => { settings = s; } };
    })();

    function vibrate(pattern) {
        if (Pack4State.settings && Pack4State.settings.vibrateEnabled === false) return;
        if (PREFERS_REDUCED_MOTION) {
            if (Array.isArray(pattern)) pattern = pattern.map(v => Math.min(20, v));
            else if (typeof pattern === 'number') pattern = Math.min(20, pattern);
        }
        if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
    }

    // ─── MIGRATION skins ───
    function migrateSkins() {
        const chars = (window.GAME_CONFIG && window.GAME_CONFIG.characters) || {};
        const allSkinIds = new Set();
        const defaultSkinIds = new Set();
        Object.values(chars).forEach(char => {
            (char.skins || []).forEach(s => allSkinIds.add(s.id));
            if (char.skins?.[0]?.id) defaultSkinIds.add(char.skins[0].id);
        });

        const set = new Set(defaultSkinIds);

        const raw = localStorage.getItem('lacosteSkins');
        if (raw) {
            let old = [];
            try { old = JSON.parse(raw); } catch {}
            const legacyMap = { 'gold': 'croc_gold', 'red': 'panda_gold' };
            old.forEach(id => {
                if (id === 'default') return;
                const mapped = legacyMap[id];
                if (mapped) {
                    if (allSkinIds.has(mapped)) set.add(mapped);
                    return;
                }
                if (typeof id === 'string' && id.includes('_') && allSkinIds.has(id)) set.add(id);
            });
        }
        return Array.from(set);
    }

    function generateFriendCode() {
        const prefix = P4_CONFIG.promo.friendPrefix || 'FRIEND-';
        const len = P4_CONFIG.promo.friendCodeLength || 4;
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return prefix + code;
    }

    // ─── STATE ───
    const Pack4State = {
        coins: parseInt(localStorage.getItem('lacosteCoins') || '0'),
        inventory: JSON.parse(localStorage.getItem('lacosteInventory') || '{}'),
        boughtBuffs: JSON.parse(localStorage.getItem('lacosteBuffs') || '[]'),
        unlockedSkins: migrateSkins(),
        upgrades: JSON.parse(localStorage.getItem('lacosteUpgrades') || '{}'),
        missions: JSON.parse(localStorage.getItem('lacosteMissions') || '[]'),
        leaderboard: JSON.parse(localStorage.getItem('lacosteLeaderboard') || '[]'),
        promoUsed: JSON.parse(localStorage.getItem('lacostePromoUsed') || '{}'),
        myFriendCode: localStorage.getItem('lacosteRefCode') || generateFriendCode(),
        cheatInvincible: 0,
        activeUFO: null,
        runsPlayed: parseInt(localStorage.getItem('lacosteRunsPlayed') || '0'),
        settings: null,
        uiListeners: [],
        reviveUsed: false,
        _playerPos: null, // filled from render_frame
    };
    window.Pack4State = Pack4State;
    localStorage.setItem('lacosteRefCode', Pack4State.myFriendCode);

    function saveState() {
        localStorage.setItem('lacosteCoins', Pack4State.coins);
        localStorage.setItem('lacosteInventory', JSON.stringify(Pack4State.inventory));
        localStorage.setItem('lacosteBuffs', JSON.stringify(Pack4State.boughtBuffs));
        localStorage.setItem('lacosteSkins', JSON.stringify(Pack4State.unlockedSkins));
        localStorage.setItem('lacosteUpgrades', JSON.stringify(Pack4State.upgrades));
        localStorage.setItem('lacosteMissions', JSON.stringify(Pack4State.missions));
        localStorage.setItem('lacosteLeaderboard', JSON.stringify(Pack4State.leaderboard));
        localStorage.setItem('lacostePromoUsed', JSON.stringify(Pack4State.promoUsed));
        localStorage.setItem('lacosteRunsPlayed', Pack4State.runsPlayed);
    }

    function updateUI() {
        Pack4State.uiListeners.forEach(fn => { try { fn(); } catch (e) {} });
    }

    function ensureAllDefaultsUnlocked() {
        const chars = (window.GAME_CONFIG && window.GAME_CONFIG.characters) || {};
        let changed = false;
        Object.values(chars).forEach(char => {
            const defaultSkin = char.skins?.[0]?.id;
            if (defaultSkin && !Pack4State.unlockedSkins.includes(defaultSkin)) {
                Pack4State.unlockedSkins.push(defaultSkin);
                changed = true;
            }
        });
        if (changed) saveState();
    }

    function initMissions() {
        if (Pack4State.missions.length === 0 && P4_CONFIG.missions.length > 0) {
            Pack4State.missions = P4_CONFIG.missions.map(m => ({ ...m, progress: 0 }));
            saveState();
        }
    }

    // Инициализация при загрузке модуля (не только на start)
    ensureAllDefaultsUnlocked();
    initMissions();

    // ─── HELPERS ───
    function getCurrentSkinFor(charId) {
        try {
            const cur = JSON.parse(localStorage.getItem('lacosteCurrentSkins') || '{}');
            if (cur[charId]) return cur[charId];
        } catch {}
        const chars = (window.GAME_CONFIG && window.GAME_CONFIG.characters) || {};
        return chars[charId]?.skins?.[0]?.id || 'default';
    }

    function upgradePrice(currentLevel) {
        return (P4_CONFIG.upgrades.priceBase || 500) + currentLevel * (P4_CONFIG.upgrades.priceStep || 250);
    }

    function confirmPurchase(name, price) {
        if (price < 600) return true;
        return window.confirm(`Купить "${name}" за ${price}💰?`);
    }

    // ─── PURCHASES ───
    function buySkin(skinId, price) {
        if (Pack4State.unlockedSkins.includes(skinId)) return false;
        if (Pack4State.coins < price) {
            window.GameEvents.emit('pack4_toast', { text: '❌ Not enough coins!', type: 'danger' });
            SFX.play('error', 0.8);
            vibrate([20, 40, 20]);
            return false;
        }
        if (!confirmPurchase(skinId, price)) return false;
        Pack4State.coins -= price;
        Pack4State.unlockedSkins.push(skinId);
        window.GameEvents.emit('pack4_coins_updated');
        window.GameEvents.emit('pack4_toast', { text: '✅ Skin unlocked!', type: 'success' });
        SFX.play('unlock', 1.3);
        vibrate([15, 30, 15]);
        saveState(); updateUI(); return true;
    }

    function buyBuff(buffId, price) {
        if (Pack4State.boughtBuffs.includes(buffId)) return false;
        if (Pack4State.coins < price) {
            window.GameEvents.emit('pack4_toast', { text: '❌ Not enough coins!', type: 'danger' });
            SFX.play('error', 0.8);
            return false;
        }
        if (!confirmPurchase(buffId, price)) return false;
        Pack4State.coins -= price;
        Pack4State.boughtBuffs.push(buffId);
        window.GameEvents.emit('pack4_coins_updated');
        window.GameEvents.emit('pack4_toast', { text: '✅ Buff active!', type: 'success' });
        SFX.play('buy', 1.2);
        vibrate([20, 30, 20]);
        saveState(); updateUI(); return true;
    }

    function buyConsumable(id, price) {
        if (Pack4State.coins < price) {
            window.GameEvents.emit('pack4_toast', { text: '❌ Not enough coins!', type: 'danger' });
            SFX.play('error', 0.8);
            return false;
        }
        if (!confirmPurchase(id, price)) return false;
        Pack4State.coins -= price;
        Pack4State.inventory[id] = (Pack4State.inventory[id] || 0) + 1;
        window.GameEvents.emit('pack4_coins_updated');
        window.GameEvents.emit('pack4_toast', { text: `✅ ${id.toUpperCase()} +1`, type: 'success' });
        SFX.play('buy', 1.0);
        vibrate(15);
        saveState(); updateUI(); return true;
    }

    function buyUpgrade(charId, stat) {
        const maxLvl = P4_CONFIG.upgrades.maxLevel || 10;
        if (!Pack4State.upgrades[charId]) Pack4State.upgrades[charId] = { speed: 0, jump: 0, luck: 0 };
        const currentLvl = Pack4State.upgrades[charId][stat] || 0;
        if (currentLvl >= maxLvl) {
            window.GameEvents.emit('pack4_toast', { text: '⭐ MAX LEVEL', type: 'info' });
            return false;
        }
        const price = upgradePrice(currentLvl);
        if (Pack4State.coins < price) {
            window.GameEvents.emit('pack4_toast', { text: '❌ Not enough coins!', type: 'danger' });
            SFX.play('error', 0.8);
            return false;
        }
        if (!confirmPurchase(`${stat} Lv.${currentLvl + 1}`, price)) return false;
        Pack4State.coins -= price;
        Pack4State.upgrades[charId][stat] = currentLvl + 1;
        window.GameEvents.emit('pack4_coins_updated');
        window.GameEvents.emit('pack4_toast', { text: `✅ ${stat.toUpperCase()} Lv.${currentLvl + 1}`, type: 'success' });
        SFX.play('buy', 1.1 + currentLvl * 0.05);
        vibrate(15);
        saveState(); updateUI(); return true;
    }

    function equipSkin(charId, skinId) {
        // SECURITY: проверка ownership
        if (!Pack4State.unlockedSkins.includes(skinId)) {
            window.GameEvents.emit('pack4_toast', { text: '❌ Skin not owned', type: 'danger' });
            SFX.play('error', 0.8);
            return false;
        }
        try {
            const cur = JSON.parse(localStorage.getItem('lacosteCurrentSkins') || '{}');
            cur[charId] = skinId;
            localStorage.setItem('lacosteCurrentSkins', JSON.stringify(cur));
            window.GameEvents.emit('pack4_skins_updated', { charId, skinId });
            window.GameEvents.emit('pack4_toast', { text: '🎨 Skin equipped', type: 'info' });
            SFX.play('equip', 1.0);
            vibrate(10);
            updateUI();
            return true;
        } catch (e) { console.error(e); return false; }
    }

    // ─── PROMO ───
    function applyFriendCode(input) {
        const code = (input || '').trim().toUpperCase();
        const prefix = P4_CONFIG.promo.friendPrefix || 'FRIEND-';
        const minLen = prefix.length + (P4_CONFIG.promo.friendCodeLength || 4);

        if (!code.startsWith(prefix) || code.length < minLen) {
            window.GameEvents.emit('pack4_toast', { text: '❌ Invalid friend code', type: 'danger' });
            SFX.play('error', 0.8);
            return false;
        }
        if (code === Pack4State.myFriendCode) {
            window.GameEvents.emit('pack4_toast', { text: '❌ Это ваш собственный код', type: 'danger' });
            SFX.play('error', 0.8);
            return false;
        }
        if (Pack4State.promoUsed.friend) {
            window.GameEvents.emit('pack4_toast', { text: '❌ Friend code уже использован', type: 'danger' });
            return false;
        }
        const reward = P4_CONFIG.promo.friendRewardCoins || 500;
        Pack4State.coins += reward;
        Pack4State.promoUsed.friend = code;
        window.GameEvents.emit('pack4_coins_updated');
        window.GameEvents.emit('pack4_toast', { text: `🎁 +${reward} COINS from friend!`, type: 'success' });
        SFX.play('promo', 1.3);
        vibrate([20, 30, 20, 30, 50]);
        saveState(); updateUI(); return true;
    }

    function applyAdminCode(input) {
        const code = (input || '').trim();
        if (!P4_CONFIG.promo.adminCode || code !== P4_CONFIG.promo.adminCode) {
            window.GameEvents.emit('pack4_toast', { text: '❌ Invalid admin code', type: 'danger' });
            SFX.play('error', 0.8);
            return false;
        }
        if (Pack4State.promoUsed.admin) {
            window.GameEvents.emit('pack4_toast', { text: '❌ Admin code уже использован', type: 'danger' });
            return false;
        }
        const reward = P4_CONFIG.promo.adminRewardCoins || 10000;
        Pack4State.coins += reward;

        // Unlock all skins
        const chars = (window.GAME_CONFIG && window.GAME_CONFIG.characters) || {};
        Object.values(chars).forEach(char => {
            (char.skins || []).forEach(skin => {
                if (!Pack4State.unlockedSkins.includes(skin.id)) Pack4State.unlockedSkins.push(skin.id);
            });
        });
        // Unlock all buffs
        P4_CONFIG.shop.buffs.forEach(b => {
            if (!Pack4State.boughtBuffs.includes(b.id)) Pack4State.boughtBuffs.push(b.id);
        });
        Pack4State.promoUsed.admin = true;

        window.GameEvents.emit('pack4_coins_updated');
        window.GameEvents.emit('pack4_toast', { text: `👑 ADMIN: +${reward} COINS + ALL UNLOCKED`, type: 'success' });
        SFX.play('promo', 1.5);
        vibrate([60, 30, 60, 30, 100]);
        if (window.RenderEngine && !PREFERS_REDUCED_MOTION) {
            window.RenderEngine.flash('255,215,0', 0.6);
            window.RenderEngine.shake(12, 20);
        }
        saveState(); updateUI(); return true;
    }

    // ─── EVENT: START ───
    window.GameEvents.on('start', (data) => {
        Pack4State.settings = data?.settings || Pack4State.settings;
        SFX.setSettings(Pack4State.settings);
        initMissions();
        Pack4State.activeUFO = null;
        Pack4State.reviveUsed = false;
        Pack4State._playerPos = null;

        if (Math.random() < (P4_CONFIG.secrets.ufoChance || 0.05)) {
            Pack4State.activeUFO = {
                x: 800,
                y: 250, // altitude achievable by high jump
                w: 80,
                h: 40,
                collected: false,
                speed: 2,
            };
        }
    });

    // ─── EVENT: TICK ───
    window.GameEvents.on('tick', (data) => {
        if (data.settings) {
            Pack4State.settings = data.settings;
            SFX.setSettings(data.settings);
        }

        // UFO update + collision (uses real player pos from render_frame)
        const ufo = Pack4State.activeUFO;
        if (ufo && !ufo.collected) {
            ufo.x -= ufo.speed;
            ufo.y = 250 + Math.sin(Date.now() / 500) * 30;

            const p = Pack4State._playerPos;
            if (p) {
                const pcx = p.x + p.w / 2;
                const pcy = p.y + p.h / 2;
                const dx = ufo.x - pcx;
                const dy = ufo.y - pcy;
                if (Math.abs(dx) < 90 && Math.abs(dy) < 90) {
                    ufo.collected = true;
                    const reward = P4_CONFIG.secrets.ufoCoins || 100;
                    Pack4State.coins += reward;
                    window.GameEvents.emit('pack4_toast', { text: `🛸 UFO CAPTURED! +${reward} COINS`, type: 'info' });
                    window.GameEvents.emit('pack4_coins_updated');
                    SFX.play('ufo', 1.6);
                    vibrate([30, 40, 30, 40, 80]);
                    if (window.RenderEngine && !PREFERS_REDUCED_MOTION) {
                        window.RenderEngine.flash('0,255,255', 0.5);
                        window.RenderEngine.spawnParticles(ufo.x, ufo.y, 30, {
                            colors: ['#00FFFF', '#FFD700', '#FFFFFF'], speed: 6, life: 40, size: 4, gravity: 0.1,
                        });
                    }
                    Pack4State.activeUFO = null;
                    saveState(); updateUI();
                }
            }
            if (ufo.x < -100) Pack4State.activeUFO = null;
        }

        // Missions — distance
        if (data.distance !== undefined) {
            Pack4State.missions.forEach(m => {
                if (m.type === 'distance' && m.progress < m.target && !m.completed) {
                    m.progress = Math.min(m.target, Math.floor(data.distance));
                    if (m.progress >= m.target) completeMission(m);
                }
            });
        }

        // Missions — combo
        if (data.combo !== undefined) {
            Pack4State.missions.forEach(m => {
                if (m.type === 'combo' && m.progress < m.target && !m.completed) {
                    m.progress = Math.max(m.progress, data.combo || 0);
                    if (m.progress >= m.target) completeMission(m);
                }
            });
        }
    });

    function completeMission(m) {
        m.completed = true;
        Pack4State.coins += m.reward;
        window.GameEvents.emit('pack4_toast', { text: `🎯 MISSION COMPLETE: +${m.reward} COINS`, type: 'success' });
        window.GameEvents.emit('pack4_coins_updated');
        SFX.play('promo', 1.2);
        vibrate([20, 30, 20]);
        saveState(); updateUI();
    }

    // ─── EVENT: EAT / JUMP ───
    window.GameEvents.on('eat', () => {
        Pack4State.missions.forEach(m => {
            if (m.type === 'food' && m.progress < m.target && !m.completed) {
                m.progress++;
                if (m.progress >= m.target) completeMission(m);
            }
        });
    });

    window.GameEvents.on('jump', () => {
        Pack4State.missions.forEach(m => {
            if (m.type === 'jumps' && m.progress < m.target && !m.completed) {
                m.progress++;
                if (m.progress >= m.target) completeMission(m);
            }
        });
    });

    // ─── EVENT: GAMEOVER ───
    window.GameEvents.on('gameover', (data) => {
        const earned = Math.floor((data.distance || 0) * (P4_CONFIG.economy.coinsPerMeter || 1));
        Pack4State.coins += earned;
        Pack4State.runsPlayed++;

        // Filter tiny runs from leaderboard
        if ((data.distance || 0) >= 10) {
            Pack4State.leaderboard.push({ score: Math.floor(data.distance), date: new Date().toISOString() });
            Pack4State.leaderboard.sort((a, b) => b.score - a.score);
            Pack4State.leaderboard = Pack4State.leaderboard.slice(0, 10);
        }

        Pack4State.activeUFO = null;
        Pack4State._playerPos = null;
        window.GameEvents.emit('pack4_coins_updated');
        saveState(); updateUI();
    });

    // ─── EVENT: RENDER_FRAME (для UFO + сохранения позиции игрока) ───
    window.GameEvents.on('render_frame', ({ ctx, player }) => {
        if (player) {
            Pack4State._playerPos = { x: player.x, y: player.y, w: player.w, h: player.h };
        }

        const ufo = Pack4State.activeUFO;
        if (!ufo || ufo.collected || !ctx) return;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (!PREFERS_REDUCED_MOTION) {
            const g = ctx.createRadialGradient(ufo.x, ufo.y, 0, ufo.x, ufo.y, 60);
            g.addColorStop(0, 'rgba(0, 255, 255, 0.5)');
            g.addColorStop(1, 'rgba(0, 255, 255, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(ufo.x - 60, ufo.y - 60, 120, 120);
        }

        ctx.font = '48px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText('🛸', ufo.x, ufo.y);
        ctx.restore();
    });

    // ─── RENDER: SHOP ───
    function renderShopTab() {
        const [activeSub, setActiveSub] = React.useState('skins');
        const [charId, setCharId] = React.useState(() => {
            const saved = localStorage.getItem('lacosteCharacter');
            const chars = (window.GAME_CONFIG && window.GAME_CONFIG.characters) || {};
            if (saved && chars[saved]) return saved;
            return Object.keys(chars)[0] || 'crocodile';
        });
        const [, force] = React.useReducer(x => x + 1, 0);
        React.useEffect(() => {
            Pack4State.uiListeners.push(force);
            return () => { Pack4State.uiListeners = Pack4State.uiListeners.filter(l => l !== force); };
        }, []);

        const chars = (window.GAME_CONFIG && window.GAME_CONFIG.characters) || {};
        const tiers = P4_CONFIG.skinTiers || {};
        const currentSkinsMap = (() => { try { return JSON.parse(localStorage.getItem('lacosteCurrentSkins') || '{}'); } catch { return {}; } })();
        const currentSkinForChar = currentSkinsMap[charId] || chars[charId]?.skins?.[0]?.id;

        const selectChar = (id) => {
            setCharId(id);
            localStorage.setItem('lacosteCharacter', id);
            if (window.__gameSetCharacter) window.__gameSetCharacter(id);
            window.GameEvents.emit('pack4_character_changed', { charId: id });
        };

        const subTabs = [
            { id: 'skins', label: '🎨 Skins' },
            { id: 'buffs', label: '⭐ Buffs' },
            { id: 'items', label: '🧪 Items' },
            { id: 'upgrades', label: '📈 Upgrades' },
        ];

        const renderSkins = () => {
            const charSkins = chars[charId]?.skins || [];
            return React.createElement('div', null,
                React.createElement('div', { className: 'ms-char-tabs' },
                    Object.values(chars).map(c => React.createElement('button', {
                        key: c.id,
                        className: `ms-char-tab ${charId === c.id ? 'active' : ''}`,
                        onClick: () => selectChar(c.id),
                    }, `${c.emoji || '❓'} ${c.name}`))
                ),
                charSkins.length === 0
                    ? React.createElement('div', { className: 'ms-empty' }, 'No skins for this character')
                    : React.createElement('div', { className: 'ms-grid' },
                        charSkins.slice().sort((a, b) => (tiers[a.tier]?.order || 0) - (tiers[b.tier]?.order || 0)).map(skin => {
                            const owned = Pack4State.unlockedSkins.includes(skin.id);
                            const equipped = currentSkinForChar === skin.id;
                            const tier = tiers[skin.tier] || { name: skin.tier, color: '#fff', emoji: '?' };
                            return React.createElement('div', { key: skin.id, className: `ms-card ${owned ? 'owned' : ''}` },
                                React.createElement('div', { className: 'ms-card-tier', style: { background: tier.color + '33', color: tier.color, border: `1px solid ${tier.color}66` } }, `${tier.emoji} ${tier.name}`),
                                React.createElement('div', { className: 'ms-card-icon', style: { filter: tier.filter || 'none' } }, chars[charId].emoji || '🐾'),
                                React.createElement('div', { className: 'ms-card-name' }, skin.name),
                                equipped
                                    ? React.createElement('button', { className: 'ms-buy-btn equipped', disabled: true }, '✓ EQUIPPED')
                                    : owned
                                        ? React.createElement('button', { className: 'ms-buy-btn', onClick: () => { equipSkin(charId, skin.id); force(); } }, 'EQUIP')
                                        : React.createElement('button', { className: 'ms-buy-btn', onClick: () => { buySkin(skin.id, skin.price); force(); } }, `💰 ${skin.price}`)
                            );
                        })
                    )
            );
        };

        const renderBuffs = () => React.createElement('div', { className: 'ms-grid' },
            P4_CONFIG.shop.buffs.map(buff => {
                const owned = Pack4State.boughtBuffs.includes(buff.id);
                return React.createElement('div', { key: buff.id, className: `ms-card ${owned ? 'owned' : ''}` },
                    React.createElement('div', { className: 'ms-card-icon' }, buff.icon || '⭐'),
                    React.createElement('div', { className: 'ms-card-name' }, buff.name),
                    React.createElement('div', { className: 'ms-card-sub' }, buff.description),
                    owned
                        ? React.createElement('button', { className: 'ms-buy-btn equipped', disabled: true }, '✓ ACTIVE')
                        : React.createElement('button', { className: 'ms-buy-btn', onClick: () => { buyBuff(buff.id, buff.price); force(); } }, `💰 ${buff.price}`)
                );
            })
        );

        const renderItems = () => React.createElement('div', { className: 'ms-grid' },
            P4_CONFIG.shop.consumables.map(item => {
                const count = Pack4State.inventory[item.id] || 0;
                return React.createElement('div', { key: item.id, className: 'ms-card' },
                    React.createElement('div', { className: 'ms-card-icon', style: { color: item.color || '#fff' } }, item.icon || '🧪'),
                    React.createElement('div', { className: 'ms-card-name' }, item.name),
                    React.createElement('div', { className: 'ms-card-sub', style: { color: '#FFD700' } }, `Owned: ${count}`),
                    React.createElement('button', { className: 'ms-buy-btn', onClick: () => { buyConsumable(item.id, item.price); force(); } }, `💰 ${item.price}`)
                );
            })
        );

        const renderUpgrades = () => {
            const maxLvl = P4_CONFIG.upgrades.maxLevel || 10;
            const statInfo = { speed: { icon: '⚡', name: 'Speed' }, jump: { icon: '🦘', name: 'Jump' }, luck: { icon: '🍀', name: 'Luck' } };
            const charData = chars[charId];
            const charUpgrades = Pack4State.upgrades[charId] || { speed: 0, jump: 0, luck: 0 };
            return React.createElement('div', null,
                React.createElement('div', { className: 'ms-char-tabs' },
                    Object.values(chars).map(c => React.createElement('button', {
                        key: c.id,
                        className: `ms-char-tab ${charId === c.id ? 'active' : ''}`,
                        onClick: () => selectChar(c.id),
                    }, `${c.emoji || '❓'} ${c.name}`))
                ),
                React.createElement('div', { className: 'ms-grid' },
                    ['speed', 'jump', 'luck'].map(stat => {
                        const lvl = charUpgrades[stat] || 0;
                        const maxed = lvl >= maxLvl;
                        const price = upgradePrice(lvl);
                        const base = charData?.stats?.[stat] ?? 1.0;
                        const current = base + lvl * (P4_CONFIG.upgrades.statBonus || 0.05);
                        return React.createElement('div', { key: stat, className: `ms-card ${maxed ? 'maxed' : ''}` },
                            React.createElement('div', { className: 'ms-card-icon' }, statInfo[stat].icon),
                            React.createElement('div', { className: 'ms-card-name' }, `${statInfo[stat].name} · Lv.${lvl}/${maxLvl}`),
                            React.createElement('div', { className: 'ms-card-sub' }, `${base.toFixed(2)} → ${current.toFixed(2)}`),
                            React.createElement('div', { className: 'ms-progress' },
                                React.createElement('div', { className: `ms-progress-bar ${maxed ? 'maxed' : ''}`, style: { width: `${(lvl / maxLvl) * 100}%` } })
                            ),
                            maxed
                                ? React.createElement('button', { className: 'ms-buy-btn maxed', disabled: true }, '⭐ MAXED')
                                : React.createElement('button', { className: 'ms-buy-btn', onClick: () => { buyUpgrade(charId, stat); force(); } }, `💰 ${price}`)
                        );
                    })
                )
            );
        };

        return React.createElement('div', null,
            React.createElement('div', { className: 'ms-tabs', style: { padding: '0 0 10px', marginBottom: '16px' } },
                subTabs.map(t => React.createElement('button', {
                    key: t.id,
                    className: `ms-tab ${activeSub === t.id ? 'active' : ''}`,
                    onClick: () => setActiveSub(t.id),
                }, t.label))
            ),
            activeSub === 'skins' && renderSkins(),
            activeSub === 'buffs' && renderBuffs(),
            activeSub === 'items' && renderItems(),
            activeSub === 'upgrades' && renderUpgrades()
        );
    }

    // ─── RENDER: PROMO ───
    function renderPromoTab() {
        const [, force] = React.useReducer(x => x + 1, 0);
        React.useEffect(() => {
            Pack4State.uiListeners.push(force);
            return () => { Pack4State.uiListeners = Pack4State.uiListeners.filter(l => l !== force); };
        }, []);
        const [friendInput, setFriendInput] = React.useState('');
        const [adminInput, setAdminInput] = React.useState('');

        const copyMyCode = () => {
            try {
                navigator.clipboard.writeText(Pack4State.myFriendCode);
                window.GameEvents.emit('pack4_toast', { text: '📋 Code copied', type: 'info' });
                SFX.play('equip', 1.0);
            } catch (e) {}
        };

        return React.createElement('div', null,
            React.createElement('div', { className: 'ms-promo-card' },
                React.createElement('div', { className: 'ms-section-title' }, '🎁 My friend code'),
                React.createElement('div', { className: 'ms-promo-code' }, Pack4State.myFriendCode),
                React.createElement('div', { className: 'ms-promo-hint' }, 'Поделись с другом — он получит 500 монет.'),
                React.createElement('div', { className: 'ms-row', style: { marginTop: '12px' } },
                    React.createElement('button', { className: 'ms-btn', onClick: copyMyCode }, '📋 COPY')
                )
            ),
            React.createElement('div', { className: 'ms-promo-card' },
                React.createElement('div', { className: 'ms-section-title' }, '👥 Enter friend code'),
                React.createElement('div', { className: 'ms-row' },
                    React.createElement('input', {
                        className: 'ms-input',
                        placeholder: 'FRIEND-XXXX',
                        value: friendInput,
                        onChange: e => setFriendInput(e.target.value.toUpperCase()),
                        disabled: !!Pack4State.promoUsed.friend,
                    }),
                    React.createElement('button', {
                        className: 'ms-btn primary',
                        onClick: () => { if (applyFriendCode(friendInput)) { setFriendInput(''); force(); } },
                        disabled: !!Pack4State.promoUsed.friend,
                    }, Pack4State.promoUsed.friend ? '✓ USED' : 'ACTIVATE')
                ),
                Pack4State.promoUsed.friend && React.createElement('div', { className: 'ms-promo-hint' }, '✅ Использован: ', Pack4State.promoUsed.friend)
            ),
            React.createElement('div', { className: 'ms-promo-card' },
                React.createElement('div', { className: 'ms-section-title' }, '👑 Admin code'),
                React.createElement('div', { className: 'ms-row' },
                    React.createElement('input', {
                        className: 'ms-input',
                        placeholder: 'Enter admin code',
                        value: adminInput,
                        onChange: e => setAdminInput(e.target.value),
                        disabled: !!Pack4State.promoUsed.admin,
                    }),
                    React.createElement('button', {
                        className: 'ms-btn primary',
                        onClick: () => { if (applyAdminCode(adminInput)) { setAdminInput(''); force(); } },
                        disabled: !!Pack4State.promoUsed.admin,
                    }, Pack4State.promoUsed.admin ? '✓ USED' : 'ACTIVATE')
                ),
                React.createElement('div', { className: 'ms-promo-hint' }, 'Reward: +10000 💰 + все скины + все бафы')
            )
        );
    }

    // ─── RENDER: LEADERBOARD ───
    function renderLeaderboardTab() {
        if (Pack4State.leaderboard.length === 0) {
            return React.createElement('div', { className: 'ms-empty' }, '🏆 Пока нет рекордов. Сыграй!');
        }
        return React.createElement('div', null,
            React.createElement('div', { className: 'ms-section-title' }, '🏆 Top 10'),
            Pack4State.leaderboard.map((entry, i) => React.createElement('div', {
                key: i,
                className: 'ms-row',
                style: {
                    padding: '10px 14px',
                    background: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)',
                    borderRadius: '8px',
                    border: i === 0 ? '1px solid rgba(255,215,0,0.4)' : '1px solid rgba(255,255,255,0.08)',
                },
            },
                React.createElement('span', { style: { fontSize: '20px', minWidth: '40px' } }, `#${i + 1}`),
                React.createElement('span', { style: { flex: 1, fontFamily: 'Rajdhani', fontWeight: '700', fontSize: '16px', color: i === 0 ? '#FFD700' : '#fff' } }, `${entry.score}m`),
                React.createElement('span', { style: { fontSize: '12px', opacity: 0.6 } }, new Date(entry.date).toLocaleDateString())
            ))
        );
    }

    window.Pack4Render = {
        shop: renderShopTab,
        promo: renderPromoTab,
        leaderboard: renderLeaderboardTab,
    };

    // ─── TOAST ───
    function Pack4ToastSystem() {
        const [toasts, setToasts] = React.useState([]);
        React.useEffect(() => {
            const listener = (data) => {
                const id = Date.now() + Math.random();
                setToasts(prev => [...prev, { id, ...data }]);
                setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
            };
            window.GameEvents.on('pack4_toast', listener);
            return () => {
                if (window.GameEvents.listeners['pack4_toast']) {
                    window.GameEvents.listeners['pack4_toast'] = window.GameEvents.listeners['pack4_toast'].filter(cb => cb !== listener);
                }
            };
        }, []);
        return React.createElement('div', {
            className: 'pack3-toast-container', // сохраняем класс для совместимости CSS
            style: { pointerEvents: 'none' },
        }, toasts.map(t => React.createElement('div', { key: t.id, className: `pack3-toast ${t.type}` }, t.text)));
    }

    if (window.PackUIs) window.PackUIs.push(Pack4ToastSystem);

    console.log('%c💎 PACK 4 (Economy, Skins, Upgrades, Promo v2) loaded', 'color:#FFD700;font-weight:bold;font-size:14px');
})();
