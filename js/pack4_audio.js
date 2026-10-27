/* ==================================================================
   PACK 4 — AUDIO (Фоновая музыка + Твои SFX)
   Без синтезаторов и нагнетания. Только твои файлы.
   ================================================================== */
(function () {
    'use strict';

    // === СОСТОЯНИЕ АУДИО ===
    const AudioState = {
        dayAmbient: null,
        nightAmbient: null,
        jumpSfx: null,
        splashSfx: null,
        barrelSfx: null,
        pitSfx: null,
        
        currentTimeOfDay: 'day',
        isPaused: false,
        settings: { soundEnabled: true, masterVolume: 1, sfxVolume: 0.7, ambientVolume: 0.25 }
    };

    // === ИНИЦИАЛИЗАЦИЯ ПРИ СТАРТЕ ===
    window.GameEvents.on('game_start', (data) => {
        AudioState.settings = data.settings || AudioState.settings;
        AudioState.currentTimeOfDay = data.timeOfDay || 'day';
        AudioState.isPaused = false;

        // 1. Создаём фоновую музыку
        if (!AudioState.dayAmbient) {
            AudioState.dayAmbient = new Audio('source/sounds/forest_day.wav');
            AudioState.dayAmbient.loop = true;
        }
        if (!AudioState.nightAmbient) {
            AudioState.nightAmbient = new Audio('source/sounds/night_forest.mp3');
            AudioState.nightAmbient.loop = true;
        }

        // 2. Создаём SFX
        if (!AudioState.jumpSfx) {
            AudioState.jumpSfx = new Audio('source/sounds/jump.wav');
            AudioState.jumpSfx.preload = 'auto';
        }
        if (!AudioState.splashSfx) {
            AudioState.splashSfx = new Audio('source/sounds/splash.wav');
            AudioState.splashSfx.preload = 'auto';
            AudioState.splashSfx.playbackRate = 1.2;
        }
        if (!AudioState.barrelSfx) {
            AudioState.barrelSfx = new Audio('source/sounds/barrel_explosion.wav');
            AudioState.barrelSfx.preload = 'auto';
        }
        if (!AudioState.pitSfx) {
            AudioState.pitSfx = new Audio('source/sounds/fall_in_pit.wav');
            AudioState.pitSfx.preload = 'auto';
        }

        applyVolume();
        playAmbient(AudioState.currentTimeOfDay);
    });

    // === СМЕНА ДНЯ/НОЧИ ===
    window.GameEvents.on('time_changed', (data) => {
        AudioState.currentTimeOfDay = data.timeOfDay;
        if (!AudioState.isPaused) {
            playAmbient(data.timeOfDay);
        }
    });

    // === НАСТРОЙКИ ===
    window.GameEvents.on('settings_changed', (settings) => {
        AudioState.settings = settings;
        applyVolume();
        if (!settings.soundEnabled) {
            pauseAll();
        } else if (!AudioState.isPaused) {
            playAmbient(AudioState.currentTimeOfDay);
        }
    });

    // === ПАУЗА / ВОЗОБНОВЛЕНИЕ ===
    window.GameEvents.on('game_pause', () => {
        AudioState.isPaused = true;
        pauseAll();
    });

    window.GameEvents.on('game_resume', () => {
        AudioState.isPaused = false;
        playAmbient(AudioState.currentTimeOfDay);
    });

    // === SFX СОБЫТИЙ ===
    window.GameEvents.on('jump', () => {
        playSFX(AudioState.jumpSfx);
    });

    window.GameEvents.on('hit', (data) => {
        if (data.type === 'puddle') {
            playSFX(AudioState.splashSfx);
        }
    });

    window.GameEvents.on('barrel_hit', () => {
        playSFX(AudioState.barrelSfx);
    });

    window.GameEvents.on('pit_fall', () => {
        playSFX(AudioState.pitSfx);
    });

    // === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
    function playAmbient(timeOfDay) {
        if (!AudioState.settings.soundEnabled || AudioState.isPaused) return;
        if (timeOfDay === 'day') {
            if (AudioState.nightAmbient) AudioState.nightAmbient.pause();
            if (AudioState.dayAmbient) AudioState.dayAmbient.play().catch(() => {});
        } else {
            if (AudioState.dayAmbient) AudioState.dayAmbient.pause();
            if (AudioState.nightAmbient) AudioState.nightAmbient.play().catch(() => {});
        }
    }

    function pauseAll() {
        if (AudioState.dayAmbient) AudioState.dayAmbient.pause();
        if (AudioState.nightAmbient) AudioState.nightAmbient.pause();
    }

    function playSFX(audio) {
        if (!AudioState.settings.soundEnabled || !audio) return;
        try {
            audio.currentTime = 0;
            audio.play().catch(() => {});
        } catch (e) {}
    }

    function applyVolume() {
        const master = AudioState.settings.soundEnabled ? AudioState.settings.masterVolume : 0;
        const sfxVol = master * AudioState.settings.sfxVolume;
        const ambVol = master * AudioState.settings.ambientVolume;

        [AudioState.jumpSfx, AudioState.splashSfx, AudioState.barrelSfx, AudioState.pitSfx].forEach(a => {
            if (a) a.volume = sfxVol;
        });
        if (AudioState.dayAmbient) AudioState.dayAmbient.volume = ambVol;
        if (AudioState.nightAmbient) AudioState.nightAmbient.volume = ambVol;
    }

    console.log('%c🔊 [Pack 4] Audio loaded (Ambient + SFX)', 'color:#FF007F;font-weight:bold');
})();
