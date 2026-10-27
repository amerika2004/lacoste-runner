/* ==================================================================
   PACK 3 — Biomes, Achievements, Adaptive Music (Web Audio API)
   Подключается через loader.js. Использует window.GameEvents.
   ================================================================== */
(function () {
    'use strict';

    // === СОСТОЯНИЕ ПАКЕТА 3 ===
    const Pack3State = {
        biomeIndex: 0,
        biomes: [
            { id: 'forest',  name: 'Forest',  emoji: '🌲', color: 'rgba(20,40,20,0)',   desc: 'Welcome to the jungle' },
            { id: 'desert',  name: 'Desert',  emoji: '🏜️', color: 'rgba(80,50,20,0.3)', desc: 'It\'s getting hot...' },
            { id: 'city',    name: 'City',    emoji: '🏙️', color: 'rgba(20,20,60,0.4)', desc: 'Vice City nights' },
            { id: 'jungle',  name: 'Jungle',  emoji: '🌿', color: 'rgba(0,60,30,0.4)',   desc: 'Deep in the wild' },
        ],
        achievements: [],
        audioCtx: null,
        musicNodes: null,
        isMusicPlaying: false,
        uiListeners: [],
        currentBiomeData: null,
    };

    const ACHIEVEMENTS_DEF = [
        { id: 'dist_500',  icon: '👟', name: 'First Steps',  desc: 'Пробеги 500м',        check: (s) => s.distance >= 500 },
        { id: 'dist_1000', icon: '🏃', name: 'Marathoner',   desc: 'Пробеги 1000м',       check: (s) => s.distance >= 1000 },
        { id: 'dist_5000', icon: '🚀', name: 'Legend',       desc: 'Пробеги 5000м',       check: (s) => s.distance >= 5000 },
        { id: 'combo_5',   icon: '🔥', name: 'Combo Master', desc: 'Собери комбо x3 (5 прыжков)', check: (s) => s.combo >= 5 },
        { id: 'food_20',   icon: '🍔', name: 'Gourmet',      desc: 'Съешь 20 еды',        check: (s) => s.foodEaten >= 20 },
        { id: 'biome_2',   icon: '🗺️', name: 'Traveler',     desc: 'Дойди до 2-го биома (1000м)', check: (s) => s.biomeIndex >= 1 },
    ];

    // Загружаем сохранённые ачивки
    try {
        Pack3State.achievements = JSON.parse(localStorage.getItem('lacosteAchievements') || '[]');
    } catch { Pack3State.achievements = []; }

    function saveAchievements() {
        localStorage.setItem('lacosteAchievements', JSON.stringify(Pack3State.achievements));
    }

    // === МУЗЫКАЛЬНЫЙ ДВИЖОК (Web Audio API) ===
    function initMusic() {
        if (Pack3State.audioCtx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        try {
            const ctx = new AudioContext();
            const masterGain = ctx.createGain();
            masterGain.gain.value = 0.08; // Тихо, чтобы не перебивать SFX
            masterGain.connect(ctx.destination);

            const bassOsc = ctx.createOscillator();
            bassOsc.type = 'sawtooth';
            const bassGain = ctx.createGain();
            bassGain.gain.value = 0;
            bassOsc.connect(bassGain);
            bassGain.connect(masterGain);
            bassOsc.start();

            const leadOsc = ctx.createOscillator();
            leadOsc.type = 'square';
            const leadGain = ctx.createGain();
            leadGain.gain.value = 0;
            leadOsc.connect(leadGain);
            leadGain.connect(masterGain);
            leadOsc.start();

            Pack3State.audioCtx = ctx;
            Pack3State.musicNodes = { bassOsc, bassGain, leadOsc, leadGain, masterGain };
            Pack3State.isMusicPlaying = true;
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }

    function updateMusic(speed) {
        if (!Pack3State.audioCtx || !Pack3State.musicNodes) return;
        const { bassOsc, bassGain, leadOsc, leadGain } = Pack3State.musicNodes;
        const ctx = Pack3State.audioCtx;
        const now = ctx.currentTime;

        const normSpeed = Math.min(1, Math.max(0, (speed - 0.8) / 3));
        
        bassOsc.frequency.setTargetAtTime(55 + normSpeed * 55, now, 0.1);
        bassGain.gain.setTargetAtTime(0.2 + normSpeed * 0.15, now, 0.5);

        if (normSpeed > 0.5) {
            leadGain.gain.setTargetAtTime((normSpeed - 0.5) * 0.2, now, 0.5);
            const notes = [220, 277.18, 329.63, 440]; 
            const note = notes[Math.floor(now * 8) % notes.length];
            leadOsc.frequency.setTargetAtTime(note, now, 0.05);
        } else {
            leadGain.gain.setTargetAtTime(0, now, 0.3);
        }
    }

    function stopMusic() {
        if (!Pack3State.musicNodes || !Pack3State.audioCtx) return;
        const { bassGain, leadGain } = Pack3State.musicNodes;
        const ctx = Pack3State.audioCtx;
        bassGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        leadGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        Pack3State.isMusicPlaying = false;
    }

    function resumeMusic() {
        if (!Pack3State.audioCtx) initMusic();
        else if (Pack3State.audioCtx.state === 'suspended') Pack3State.audioCtx.resume();
        Pack3State.isMusicPlaying = true;
    }

    // === ПОДПИСКА НА СОБЫТИЯ ИГРЫ ===
    window.GameEvents.on('start', () => {
        Pack3State.biomeIndex = 0;
        const biome = Pack3State.biomes[0];
        Pack3State.currentBiomeData = biome;
        Pack3State.uiListeners.forEach(fn => fn({ biome }));
        resumeMusic();
    });

    window.GameEvents.on('tick', (data) => {
        // Музыка
        if (Pack3State.isMusicPlaying && data.speed) {
            updateMusic(data.speed);
        }

        // Биомы (каждые 1000м)
        const newBiomeIndex = Math.floor(data.distance / 1000);
        if (newBiomeIndex > Pack3State.biomeIndex) {
            Pack3State.biomeIndex = newBiomeIndex;
            const biome = Pack3State.biomes[Pack3State.biomeIndex % Pack3State.biomes.length];
            Pack3State.currentBiomeData = biome;
            
            // Уведомление через Pack 2 (если он подключен)
            if (window.Pack2Hooks && window.Pack2Hooks.toast) {
                window.Pack2Hooks.toast(`🌍 ${biome.name}: ${biome.desc}`, 'success', 3000);
            } else if (window.GameEvents) {
                // Фоллбэк: просто console.log
                console.log(`🌍 Biome: ${biome.name}`);
            }

            Pack3State.uiListeners.forEach(fn => fn({ biome }));
        }

        // Проверка ачивок
        const achState = {
            distance: data.distance,
            combo: data.combo || 0,
            foodEaten: data.foodEaten || 0,
            biomeIndex: Pack3State.biomeIndex,
        };

        ACHIEVEMENTS_DEF.forEach(ach => {
            if (!Pack3State.achievements.includes(ach.id) && ach.check(achState)) {
                Pack3State.achievements.push(ach.id);
                saveAchievements();
                if (window.Pack2Hooks && window.Pack2Hooks.toast) {
                    window.Pack2Hooks.toast(`🏆 ${ach.icon} ${ach.name}`, 'success', 3000);
                } else {
                    console.log(`🏆 Achievement: ${ach.name}`);
                }
            }
        });
    });

    window.GameEvents.on('gameover', () => {
        stopMusic();
    });

    // === UI КОМПОНЕНТ ===
    function Pack3UI({ gameState }) {
        const [biome, setBiome] = React.useState(Pack3State.currentBiomeData || Pack3State.biomes[0]);

        React.useEffect(() => {
            const listener = (data) => setBiome(data.biome);
            Pack3State.uiListeners.push(listener);
            return () => {
                const idx = Pack3State.uiListeners.indexOf(listener);
                if (idx >= 0) Pack3State.uiListeners.splice(idx, 1);
            };
        }, []);

        if (gameState !== 'playing') return null;

        return React.createElement(React.Fragment, null,
            // Цветной оверлей биома (накладывается на канвас)
            React.createElement('div', { 
                className: 'pack3-biome-overlay',
                style: {
                    position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
                    background: biome.color,
                    transition: 'background 2s ease',
                    mixBlendMode: 'multiply'
                }
            }),
            
            // Иконка текущего биома в углу
            React.createElement('div', {
                className: 'pack3-biome-badge',
                style: {
                    position: 'absolute', top: '25%', right: '2%', zIndex: 6,
                    fontSize: 'clamp(18px, 3vmin, 26px)',
                    filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.8))'
                },
                title: biome.name
            }, biome.emoji)
        );
    }

    // Регистрируем UI в глобальный массив
    if (window.PackUIs) {
        window.PackUIs.push(Pack3UI);
    } else {
        window.PackUIs = [Pack3UI];
    }

    console.log('%c🏆 PACK 3 loaded', 'color:#FFD700;font-weight:bold;font-size:14px');
})();
