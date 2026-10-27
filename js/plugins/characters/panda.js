window.GameCharacters = window.GameCharacters || {};
window.GameCharacters.panda = {
    id: 'panda', name: 'Panda', emoji: '🐼',
    folder: 'source/characters/panda', frameCount: 20,
    baseWidth: 160, baseHeight: 120,
    foodEmojis: ['🎋'],
    eatEmoji: '🎋',
    eatFolder: 'source/characters/panda/eating',
    eatFrameCount: 8, eatDuration: 4.0
};

(function () {
    const c = window.GameCharacters.panda;
    for (let i = 1; i <= c.frameCount; i++) new Image().src = `${c.folder}/${i}.png`;
    if (c.eatFolder) {
        for (let i = 1; i <= c.eatFrameCount; i++) new Image().src = `${c.eatFolder}/${i}.png`;
    }
})();
console.log('🐼 Panda registered + preloading frames');
