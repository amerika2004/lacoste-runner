window.GameEvents = window.GameEvents || {
    listeners: {},
    on(event, cb) { if (!this.listeners[event]) this.listeners[event] = []; this.listeners[event].push(cb); },
    emit(event, data) { if (this.listeners[event]) this.listeners[event].forEach(cb => { try { cb(data); } catch(e) { console.error(e); } }); }
};
window.PackUIs = window.PackUIs || [];

/* ==================================================================
   PACK 3 — Biomes, Achievements, Daily Goals, Dynamic Music
   ================================================================== */
(function () {
    'use strict';

    const P3_CONFIG = (window.GAME_CONFIG && window.GAME_CONFIG.pack3) || {
        biomes: [{ id: 'forest', name: 'Forest', distance: 0, dayImg: 'source/landscape.jpg', nightImg: 'source/landscape_n.jpg', obstacleTypes: ['barrel', 'rock', 'cactus', 'puddle', 'pit'] }],
        music: { layers: [], maxTempoRate: 1.15, tempoDistance: 2000 },
        achievements: [], dailyGoals: []
    };

    const Pack3State = {
        currentBiome: P3_CONFIG.biomes[0], nextBiome: null,
        musicAudios: [], settings: null,
        unlockedAchievements: (() => { try { return JSON.parse(localStorage.getItem('lacosteAchievements') || '{}'); } catch(e) { return {}; } })(),
        dailyGoal: null, dailyGoalProgress: 0,
        runStats: { distance: 0, jumps: 0, foodEaten: 0, lastHitDistance: 0, maxCombo: 0 },
        uiListeners: [],
    };

    window.Pack3State = Pack3State;

    function initDailyGoal() {
        if (!Pack3State.settings?.dailyGoalsEnabled) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            const saved = JSON.parse(localStorage.getItem('lacosteDailyGoal') || 'null');
            if (saved && saved.date === today) {
                Pack3State.dailyGoal = P3_CONFIG.dailyGoals.find(g => g.id === saved.goalId) || P3_CONFIG.dailyGoals[0];
                Pack3State.dailyGoalProgress = saved.progress || 0;
            } else {
                const goal = P3_CONFIG.dailyGoals[Math.floor(Math.random() * P3_CONFIG.dailyGoals.length)];
                Pack3State.dailyGoal = goal; Pack3State.dailyGoalProgress = 0;
                localStorage.setItem('lacosteDailyGoal', JSON.stringify({ date: today, goalId: goal.id, progress: 0 }));
            }
        } catch (e) { console.warn("LocalStorage error", e); }
    }

    function updateDailyProgress(amount) {
        if (!Pack3State.settings?.dailyGoalsEnabled || !Pack3State.dailyGoal || Pack3State.dailyGoalProgress >= Pack3State.dailyGoal.target) return;
        Pack3State.dailyGoalProgress += amount;
        try {
            const today = new Date().toISOString().split('T')[0];
            localStorage.setItem('lacosteDailyGoal', JSON.stringify({ date: today, goalId: Pack3State.dailyGoal.id, progress: Pack3State.dailyGoalProgress }));
        } catch(e) {}

        if (Pack3State.dailyGoalProgress >= Pack3State.dailyGoal.target) {
            showToast(`🎯 DAILY GOAL COMPLETE: ${Pack3State.dailyGoal.reward}!`, 'info');
            if (window.Pack2State) {
                if (Pack3State.dailyGoal.reward.includes('Shield')) window.Pack2State.inventory.shield++;
                if (Pack3State.dailyGoal.reward.includes('Magnet')) window.Pack2State.inventory.magnet++;
                if (Pack3State.dailyGoal.reward.includes('Sprint')) window.Pack2State.inventory.sprint++;
                if (window.Pack2State.uiListeners) window.Pack2State.uiListeners.forEach(fn => fn());
            }
        }
    }

    function initAudio() {
        if (Pack3State.musicAudios.length === 0 && P3_CONFIG.music.layers.length > 0) {
            P3_CONFIG.music.layers.forEach((layer) => {
                const a = new Audio(layer.file); a.loop = true; a.preload = 'auto'; a.volume = 0; 
                Pack3State.musicAudios.push(a);
            });
        }
    }

    function showToast(text, type = 'success') { if (window.GameEvents) window.GameEvents.emit('pack3_toast', { text, type }); }

    function checkAchievements(data) {
        if (!Pack3State.settings?.achievementsEnabled) return;
        let changed = false;
        P3_CONFIG.achievements.forEach(ach => {
            if (Pack3State.unlockedAchievements[ach.id]) return;
            let unlocked = false;
            if (ach.id === 'dist_1000' && data.distance >= 1000) unlocked = true;
            if (ach.id === 'dist_3000' && data.distance >= 3000) unlocked = true;
            if (ach.id === 'no_damage_500' && data.distance >= 500 && data.distance - Pack3State.runStats.lastHitDistance >= 500) unlocked = true;
            if (ach.id === 'food_50' && Pack3State.runStats.foodEaten >= 50) unlocked = true;
            if (ach.id === 'jumps_100' && Pack3State.runStats.jumps >= 100) unlocked = true;
            if (ach.id === 'combo_10' && data.combo >= 10) unlocked = true;

            if (unlocked) {
                Pack3State.unlockedAchievements[ach.id] = true; changed = true;
                showToast(`🏆 ACHIEVEMENT: ${ach.title}`, 'success');
                if (window.RenderEngine) window.RenderEngine.flash('255,215,0', 0.5);
            }
        });
        if (changed) { try { localStorage.setItem('lacosteAchievements', JSON.stringify(Pack3State.unlockedAchievements)); } catch(e) {} }
    }

    window.GameEvents.on('start', (data) => {
        Pack3State.settings = data.settings; initAudio(); initDailyGoal();
        Pack3State.currentBiome = P3_CONFIG.biomes[0]; Pack3State.nextBiome = null;
        Pack3State.runStats = { distance: 0, jumps: 0, foodEaten: 0, lastHitDistance: 0, maxCombo: 0 };
        Pack3State.musicAudios.forEach((a, i) => { a.currentTime = 0; a.volume = i === 0 && Pack3State.settings?.dynamicMusicEnabled ? 0.2 : 0; a.play().catch(() => {}); });
    });

    window.GameEvents.on('tick', (data) => {
        if (data.settings) Pack3State.settings = data.settings;
        Pack3State.runStats.distance = data.distance;
        if (data.combo > Pack3State.runStats.maxCombo) Pack3State.runStats.maxCombo = data.combo;

        // 1. Биомы
        if (Pack3State.settings?.biomesEnabled) {
            const dist = data.distance || 0;
            let newBiome = P3_CONFIG.biomes[0];
            for (let i = P3_CONFIG.biomes.length - 1; i >= 0; i--) { if (dist >= P3_CONFIG.biomes[i].distance) { newBiome = P3_CONFIG.biomes[i]; break; } }
            
            if (Pack3State.currentBiome.id !== newBiome.id && Pack3State.nextBiome?.id !== newBiome.id) {
                Pack3State.nextBiome = newBiome;
                const whoosh = new Audio('source/sounds/biome_whoosh.wav');
                if (Pack3State.settings?.soundEnabled) whoosh.play().catch(()=>{});
            }
        }

        // 2. Музыка
        if (Pack3State.settings?.dynamicMusicEnabled && Pack3State.musicAudios.length > 0) {
            const dist = data.distance || 0;
            const tempoRate = 1.0 + Math.min(dist / P3_CONFIG.music.tempoDistance, 1.0) * (P3_CONFIG.music.maxTempoRate - 1.0);
            Pack3State.musicAudios.forEach(a => { a.playbackRate = tempoRate; });
            P3_CONFIG.music.layers.forEach((layer, index) => {
                const audio = Pack3State.musicAudios[index]; if (!audio) return;
                const targetVolume = dist >= layer.minDistance ? 0.2 : 0; 
                if (audio.volume !== targetVolume) audio.volume += (targetVolume - audio.volume) * 0.05;
            });
        } else {
            Pack3State.musicAudios.forEach(a => { a.volume = 0; });
        }

        // 3. Ежедневные цели
        if (Pack3State.settings?.dailyGoalsEnabled && Pack3State.dailyGoal) {
            if (Pack3State.dailyGoal.type === 'jumps' && data.jumps) updateDailyProgress(data.jumps);
            if (Pack3State.dailyGoal.type === 'food' && data.foodEaten) updateDailyProgress(data.foodEaten);
            if (Pack3State.dailyGoal.type === 'distance' && data.distance > Pack3State.dailyGoalProgress) { updateDailyProgress(data.distance - Pack3State.dailyGoalProgress); }
        }

        // 4. Достижения
        checkAchievements(data);
    });

    window.GameEvents.on('jump', () => { Pack3State.runStats.jumps++; if (Pack3State.dailyGoal?.type === 'jumps') updateDailyProgress(1); });
    window.GameEvents.on('eat', () => { Pack3State.runStats.foodEaten++; if (Pack3State.dailyGoal?.type === 'food') updateDailyProgress(1); });
    window.GameEvents.on('hit', (data) => { Pack3State.runStats.lastHitDistance = data.distance || 0; });
    window.GameEvents.on('gameover', () => { Pack3State.musicAudios.forEach(a => a.pause()); checkAchievements({ distance: Pack3State.runStats.distance, combo: Pack3State.runStats.maxCombo }); });

    function Pack3ToastSystem() {
        const [toasts, setToasts] = React.useState([]);
        React.useEffect(() => {
            const listener = (data) => {
                const id = Date.now(); setToasts(prev => [...prev, { id, ...data }]);
                setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 4000);
            };
            window.GameEvents.on('pack3_toast', listener);
            return () => { if (window.GameEvents.listeners['pack3_toast']) window.GameEvents.listeners['pack3_toast'] = window.GameEvents.listeners['pack3_toast'].filter(cb => cb !== listener); };
        }, []);
        return React.createElement('div', { className: 'pack3-toast-container' }, 
            toasts.map(t => React.createElement('div', { key: t.id, className: `pack3-toast ${t.type}` }, t.text))
        );
    }

    function Pack3AchievementsMenu() {
        const [visible, setVisible] = React.useState(false);
        React.useEffect(() => {
            const show = () => setVisible(true);
            window.GameEvents.on('show_achievements', show);
            return () => { if (window.GameEvents.listeners['show_achievements']) window.GameEvents.listeners['show_achievements'] = window.GameEvents.listeners['show_achievements'].filter(cb => cb !== show); };
        }, []);
        if (!visible) return null;
        return React.createElement('div', { className: 'pack3-overlay' },
            React.createElement('div', { className: 'pack3-panel' },
                React.createElement('div', { className: 'pack3-title' }, '🏆 ACHIEVEMENTS'),
                React.createElement('div', { className: 'pack3-ach-grid' },
                    P3_CONFIG.achievements.map(ach => {
                        const unlocked = Pack3State.unlockedAchievements[ach.id];
                        return React.createElement('div', { key: ach.id, className: `pack3-ach-card ${unlocked ? 'unlocked' : ''}` },
                            React.createElement('div', { className: 'pack3-ach-icon' }, unlocked ? ach.icon : '🔒'),
                            React.createElement('div', { className: 'pack3-ach-info' }, React.createElement('div', { className: 'pack3-ach-name' }, ach.title), React.createElement('div', { className: 'pack3-ach-desc' }, ach.desc))
                        );
                    })
                ),
                React.createElement('button', { className: 'pack3-close-btn', onClick: () => setVisible(false) }, 'CLOSE')
            )
        );
    }

    if (window.PackUIs) { window.PackUIs.push(Pack3ToastSystem); window.PackUIs.push(Pack3AchievementsMenu); } 
    else { window.PackUIs = [Pack3ToastSystem, Pack3AchievementsMenu]; }

    console.log('%c🌍 PACK 3 (Biomes, Achievements, Music) loaded', 'color:#FFD700;font-weight:bold;font-size:14px');
})();
