(function () {
    'use strict';
    const A = { 
        pit: new Audio('source/sounds/fall_in_pit.wav'), 
        barrel: new Audio('source/sounds/barrel_explosion.wav'), 
        splash: new Audio('source/sounds/splash.wav'), 
        jump: new Audio('source/sounds/jump.wav'), 
        night: new Audio('source/sounds/night_forest.mp3'), 
        day: new Audio('source/sounds/forest_day.wav') 
    };
    A.splash.playbackRate = 1.2; A.night.loop = true; A.day.loop = true;
    
    let settings = window.GameConfig.DEFAULT_SETTINGS; let time = 'day', playing = false;
    
    const apply = () => { 
        const master = settings.soundEnabled ? settings.masterVolume : 0; 
        const sfx = master * settings.sfxVolume, amb = master * settings.ambientVolume; 
        [A.pit, A.barrel, A.splash, A.jump].forEach(a => a.volume = sfx); 
        A.night.volume = amb; A.day.volume = amb; 
    };
    
    const playAmbient = () => { 
        if (!settings.soundEnabled || !playing) { A.day.pause(); A.night.pause(); return; } 
        if (time === 'day') { A.night.pause(); A.day.play().catch(() => {}); } 
        else { A.day.pause(); A.night.play().catch(() => {}); } 
    };
    
    const sfx = (a) => { 
        if (settings.soundEnabled && a) { a.currentTime = 0; a.play().catch(() => {}); } 
    };
    
    window.GameEvents.on('game_start', (d) => { settings = d.settings || settings; time = d.timeOfDay; playing = true; apply(); playAmbient(); });
    window.GameEvents.on('game_abort', () => { playing = false; A.day.pause(); A.night.pause(); });
    window.GameEvents.on('jump', () => sfx(A.jump));
    window.GameEvents.on('hit', (d) => { if (d.type === 'puddle') sfx(A.splash); });
    window.GameEvents.on('barrel_hit', () => sfx(A.barrel));
    window.GameEvents.on('settings_changed', (s) => { settings = s; apply(); playAmbient(); });
    window.GameEvents.on('time_changed', (t) => { time = t; playAmbient(); });
    
    console.log('🔊 Audio loaded');
})();
