/* ============================================================
   js/loader.js — авто-загрузчик модулей
   Читает js/manifest.json и подключает все pack*.js
   по порядку. Гарантирует, что они исполняются ДО запуска игры.
   ============================================================ */
(function () {
    'use strict';

    console.log('%c📦 Loader started', 'color:#00FFFF;font-weight:bold');

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = false;         // сохраняет порядок
            s.onload = () => { console.log('%c✅ Loaded: ' + src, 'color:#00FF41'); resolve(); };
            s.onerror = () => { console.error('%c❌ Failed: ' + src, 'color:#FF0000'); reject(new Error(src)); };
            document.body.appendChild(s);
        });
    }

    async function loadAll() {
        let modules = [];
        try {
            const res = await fetch('js/manifest.json?t=' + Date.now(), { cache: 'no-store' });
            const data = await res.json();
            modules = data.modules || [];
        } catch (e) {
            console.warn('manifest.json not found — skipping modules.', e);
        }

        for (const src of modules) {
            await loadScript(src);
        }

        // Все модули загружены. Теперь запускаем игру.
        if (!window.__GAME_STARTED__) {
            console.log('%c🚀 All modules ready, booting game...', 'color:#FFD700;font-weight:bold');
            if (typeof window.__bootGame === 'function') {
                window.__bootGame();
            } else {
                console.error('__bootGame() не найдена — game.js не загрузился?');
            }
        }
    }

    loadAll();
})();
