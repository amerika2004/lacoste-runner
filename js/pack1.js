/* ==================================================================
   PACK 1 — Combo System, Audio (Jump), Vibration
   Подключается через loader.js. Использует window.GameEvents.
   ================================================================== */
(function () {
    'use strict';

    // === СОСТОЯНИЕ ПАКЕТА 1 ===
    const Pack1State = {
        combo: 0,
        comboMult: 1,
        comboDisplay: { mult: 1, count: 0 },
        jumpAudio: null,
        settings: null,
        uiListeners: [],
    };

    // Экспортируем в window, чтобы game.js мог прочитать множитель
    window.Pack1State = Pack1State;

    // === ИНИЦИАЛИЗАЦИЯ ЗВУКОВ ===
    function initSounds() {
        if (!Pack1State.jumpAudio) {
            Pack1State.jumpAudio = new Audio('source/sounds/jump.wav');
            Pack1State.jumpAudio.preload = 'auto';
        }
    }

    // === УТИЛИТЫ ===
    function updateUI() {
        Pack1State.uiListeners.forEach(fn => fn({ ...Pack1State.comboDisplay }));
    }

    function resetCombo() {
        Pack1State.combo = 0;
        Pack1State.comboMult = 1;
        Pack1State.comboDisplay = { mult: 1, count: 0 };
        updateUI();
    }

    function addCombo() {
        if (Pack1State.settings && !Pack1State.settings.comboEnabled) return;
        Pack1State.combo++;
        let mult = 1;
        if (Pack1State.combo >= 8) mult = 5;
        else if (Pack1State.combo >= 5) mult = 3;
        else if (Pack1State.combo >= 3) mult = 2;
        
        Pack1State.comboMult = mult;
        Pack1State.comboDisplay = { mult, count: Pack1State.combo };
        updateUI();
    }

    function vibrate(pattern) {
        if (navigator.vibrate) {
            try { navigator.vibrate(pattern); } catch (e) {}
        }
    }

    function playJumpSound() {
        if (Pack1State.jumpAudio && Pack1State.settings && Pack1State.settings.soundEnabled) {
            Pack1State.jumpAudio.currentTime = 0;
            Pack1State.jumpAudio.play().catch(() => {});
        }
    }

    // === ПОДПИСКА НА СОБЫТИЯ ИГРЫ ===
    
    // Старт игры
    window.GameEvents.on('start', (data) => {
        initSounds();
        resetCombo();
        Pack1State.settings = data.settings;
    });

    // Прыжок персонажа
    window.GameEvents.on('jump', () => {
        addCombo();
        playJumpSound();
        vibrate(15);
    });

    // Столкновение с обычным препятствием
    window.GameEvents.on('hit', (data) => {
        resetCombo();
        vibrate([30, 50, 30]);
        
        if (window.RenderEngine) {
            window.RenderEngine.flash('255,0,0', 0.4);
            window.RenderEngine.shake(6, 12);
            if (window.RenderEngine.spawnParticles) {
                window.RenderEngine.spawnParticles(
                    data.playerX || 100, 
                    data.playerY || 400, 
                    15, 
                    { colors: ['#FF007F', '#FFFFFF'], speed: 4, life: 25, size: 3, gravity: 0.15 }
                );
            }
        }
    });

    // Взрыв бочки
    window.GameEvents.on('barrel_hit', () => {
        resetCombo();
        vibrate([40, 60, 40]);
    });

    // Каждый тик игры (чтобы обновлять настройки, если их поменяли)
    window.GameEvents.on('tick', (data) => {
        if (data.settings) Pack1State.settings = data.settings;
    });

    // Сбор еды
    window.GameEvents.on('eat', (data) => {
        if (data.type === 'poison') {
            vibrate([50, 100, 50]);
        } else if (data.type === 'golden') {
            vibrate(10);
        }
    });

    // Смерть
    window.GameEvents.on('gameover', () => {
        resetCombo();
    });

    // === UI КОМПОНЕНТ (Индикатор комбо) ===
    function Pack1UI({ gameState }) {
        const [display, setDisplay] = React.useState(Pack1State.comboDisplay);

        React.useEffect(() => {
            Pack1State.uiListeners.push(setDisplay);
            return () => {
                const idx = Pack1State.uiListeners.indexOf(setDisplay);
                if (idx >= 0) Pack1State.uiListeners.splice(idx, 1);
            };
        }, []);

        if (display.mult <= 1 || gameState !== 'playing') return null;

        return React.createElement('div', {
            key: display.count, 
            className: `combo-indicator combo-x${display.mult}`
        }, `COMBO x${display.mult}  ${display.count}`);
    }

    // Регистрируем UI в глобальный массив
    if (window.PackUIs) {
        window.PackUIs.push(Pack1UI);
    } else {
        window.PackUIs = [Pack1UI];
    }

    console.log('%c🔥 PACK 1 loaded', 'color:#FF007F;font-weight:bold;font-size:14px');
})();
