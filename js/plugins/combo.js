(function () {
    'use strict';
    let combo = 0, mult = 1;
    const settings = () => JSON.parse(localStorage.getItem('lacosteSettings') || '{}');
    
    window.GameEvents.on('game_start', () => { 
        combo = 0; mult = 1; 
        window.GameEvents.emit('combo_changed', { mult: 1, count: 0 }); 
    });
    
    window.GameEvents.on('jump', () => { 
        const s = settings(); 
        if (s.comboEnabled === false) return; 
        combo++; 
        let m = 1; 
        if (combo >= 8) m = 5; 
        else if (combo >= 5) m = 3; 
        else if (combo >= 3) m = 2; 
        mult = m; 
        window.GameEvents.emit('combo_changed', { mult: m, count: combo }); 
    });
    
    const reset = () => { 
        combo = 0; mult = 1; 
        window.GameEvents.emit('combo_changed', { mult: 1, count: 0 }); 
    };
    
    window.GameEvents.on('hit', reset);
    window.GameEvents.on('barrel_hit', reset);
    
    window.ComboMult = () => mult;
    console.log('🔥 Combo loaded');
})();
