/* =============================================================
   LOADER — загружает модули из manifest.json и запускает игру
   Порядок:
   1. Читает js/manifest.json
   2. Загружает все модули (параллельно скачивает, последовательно выполняет)
   3. Вызывает window.GameBoot.trigger() → запускает React (game.js)
   ============================================================= */
(function () {
    'use strict';
    const startTime = performance.now();

    function log(msg, color) {
        console.log(`%c${msg}`, `color:${color || '#00FF41'}`);
    }

    // === ЗАГРУЗКА ОДНОГО СКРИПТА ===
    function loadScript(src) {
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = false;  // гарантирует порядок выполнения
            s.onload = () => {
                const elapsed = (performance.now() - startTime).toFixed(0);
                log(`✅ ${src} (${elapsed}ms)`);
                resolve();
            };
            s.onerror = () => {
                console.error(`❌ FAILED: ${src}`);
                resolve(); // не роняем загрузку из-за одного файла
            };
            document.body.appendChild(s);
        });
    }

    // === ГЛАВНЫЙ ЗАПУСК ===
    async function boot() {
        // Ждём, пока game.js создаст инфраструктуру (GameBoot, GameEvents, PackUIs)
        if (!window.GameBoot) {
            console.error('❌ game.js не загружен — GameBoot не найден');
            return;
        }

        // Читаем манифест
        let modules = [];
        try {
            const res = await fetch('js/manifest.json?t=' + Date.now(), { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            modules = data.modules || [];
            log(`📦 Manifest loaded: ${modules.length} modules`, '#00FFFF');
        } catch (e) {
            console.warn('⚠️ manifest.json not found — booting without plugins', e);
        }

        // Загружаем все модули
        await Promise.all(modules.map(loadScript));

        const elapsed = (performance.now() - startTime).toFixed(0);
        log(`🚀 All modules ready in ${elapsed}ms`, '#FFD700');
        console.log('%c🎮 Bootstrapping...', 'color:#FF007F;font-weight:bold');

        // === ТРИГГЕР СТАРТА REACT ===
        // game.js ждёт window.GameBoot.onReady(...) → вызываем trigger()
        window.GameBoot.trigger();
    }

    // Запуск после готовности DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
