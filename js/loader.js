(function () {
    'use strict';
    const startTime = performance.now();

    function preloadStaticImages() {
        if (!window.GameConfig) return;
        const cfg = window.GameConfig;
        Object.values(cfg.BACKGROUNDS).forEach(bg => {
            new Image().src = bg.dayImg;
            new Image().src = bg.nightImg;
        });
        ['barrel', 'rock', 'cactus', 'puddle', 'pit'].forEach(t => {
            new Image().src = `source/${t}.png`;
            new Image().src = `source/${t}_n.png`;
        });
        new Image().src = 'source/explosion.png';
    }

    function loadScript(src) {
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = false; 
            s.onload = () => {
                console.log(`%c✅ ${src}`, 'color:#00FF41');
                resolve();
            };
            s.onerror = () => {
                console.error(`%c❌ FAILED TO LOAD: ${src}`, 'color:red;font-weight:bold');
                resolve();
            };
            document.body.appendChild(s);
        });
    }

    async function boot() {
        preloadStaticImages();
        
        let modules = [];
        try {
            const res = await fetch('js/manifest.json?t=' + Date.now(), { cache: 'no-store' });
            if (!res.ok) throw new Error('404');
            const data = await res.json();
            modules = data.modules || [];
            console.log('📦 Manifest loaded, modules:', modules.length);
        } catch (e) {
            console.error('%c❌ manifest.json NOT FOUND or invalid!', 'color:red;font-weight:bold');
        }

        await Promise.all(modules.map(loadScript));
        console.log('%c🚀 All modules ready!', 'color:#FFD700;font-weight:bold');

        if (window.GameBoot) window.GameBoot.trigger();
        else window.__MODULES_READY__ = true;
    }

    boot();
})();
