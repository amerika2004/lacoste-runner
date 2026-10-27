(function () {
    'use strict';
    const S = { food: 0, damage: 0, start: 0 };
    
    window.GameEvents.on('game_start', () => { S.food = 0; S.damage = 0; S.start = Date.now(); });
    window.GameEvents.on('eat', () => S.food++);
    window.GameEvents.on('hit', () => S.damage++);
    window.GameEvents.on('barrel_hit', () => S.damage++);
    
    window.GameEvents.on('gameover', (d) => { 
        const time = Math.floor((Date.now() - S.start) / 1000); 
        console.log(`📊 Session: dist=${Math.floor(d.distance)}m food=${S.food} dmg=${S.damage} time=${time}s`); 
    });
    
    console.log('📊 Stats loaded');
})();
