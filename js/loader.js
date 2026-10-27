(function () {
    'use strict';

    function loadScript(src) {
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = false; // Критично: гарантирует, что плагины грузятся строго по порядку
            s.onload = () => { console.log(`✅ Loaded: ${src}`); resolve(); };
            s.onerror = () => { console.error(`❌ Failed: ${src}`); resolve(); };
            document.body.appendChild(s);
        });
    }

    async function loadAll() {
        let modules = [];
        try {
            // Добавляем ?t=..., чтобы браузер не кэшировал старый манифест
            const res = await fetch('js/manifest.json?t=' + Date.now(), { cache: 'no-store' });
            const data = await res.json();
            modules = data.modules || [];
        } catch (e) {
            console.warn('manifest.json not found, loading without plugins', e);
        }

        for (const src of modules) {
            await loadScript(src);
        }

        console.log('%c🚀 All modules ready! Booting React...', 'color:#00FF41;font-weight:bold');
        
        // Даем сигнал движку (game.js), что всё загружено и можно запускать React
        window.__MODULES_READY__ = true;
    }

    loadAll();
})();
