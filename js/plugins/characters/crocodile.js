window.GameCharacters = window.GameCharacters || {};
window.GameCharacters.crocodile = {
    id: 'crocodile', name: 'Crocodile', emoji: '🐊',
    folder: 'source/characters/crocodile', frameCount: 12,
    baseWidth: 165.4, baseHeight: 110.3,
    foodEmojis: ['🍗', '🍔', '🍕', '🥩']
};

(function () {
    const c = window.GameCharacters.crocodile;
    for (let i = 1; i <= c.frameCount; i++) new Image().src = `${c.folder}/${i}.png`;
})();
console.log('🐊 Crocodile registered + preloading frames');
