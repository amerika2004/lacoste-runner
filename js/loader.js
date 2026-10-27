(function () {
    'use strict';
    const startTime = performance.now();

    // === 1. ПРЕДЗАГРУЗКА КАРТИНОК (не блокирует загрузку скриптов) ===
    function preloadStaticImages() {
        if (!window.GameConfig) return;
        const cfg = window.GameConfig;

        // Фоны
        Object.values(cfg.BACKGROUNDS).forEach(bg => {
            new Image().src = bg.dayImg;
            new Image().src = bg.nightImg;
        });

        // Препятствия
        const obstacles = new Set();
        Object.values(cfg.BACKGROUNDS).forEach(bg => {
            (bg.obstacleTypes || []).forEach(t => obstacles.add(t));
        });
        obstacles.forEach(t => {
            new Image().src = `source/${t}.png`;
            new Image().src = `source/${t}_n.png`;
        });

        // Взрыв
        new Image().src = 'source/explosion.png';
        console.log('%c🖼️ Preloading static images...', 'color:#00FFFF');
    }

    // === 2. ЗАГРУЗКА СКРИПТА ===
    // async:false = скрипты выполняются строго в порядке добавления,
    // но браузер СКАЧИВАЕТ их параллельно.
    function loadScript(src) {
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = false;
            s.onload = () => {
                console.log(`%c✅ ${src} (${(performance.now() - startTime).toFixed(0)}ms)`, 'color:#00FF41');
                resolve();
            };
            s.onerror = () => {
                console.error(`❌ Failed: ${src}`);
                resolve();
            };
            document.body.appendChild(s);
        });
    }

    // === 3. ГЛАВНЫЙ ЗАПУСК ===
    async function boot() {
        // Стартуем предзагрузку картинок СРАЗУ (fire-and-forget)
        preloadStaticImages();

        // Читаем манифест
        let modules = [];
        try {
            const res = await fetch('js/manifest.json?t=' + Date.now(), { cache: 'no-store' });
            const data = await res.json();
            modules = data.modules || [];
        } catch (e) {
            console.warn('⚠️ manifest.json not found', e);
        }

        // Запускаем ВСЕ скрипты параллельно, но они выполнятся по порядку из manifest
        await Promise.all(modules.map(loadScript));

        const elapsed = (performance.now() - startTime).toFixed(0);
        console.log(`%c🚀 All modules ready in ${elapsed}ms`, 'color:#FFD700;font-weight:bold;font-size:14px');

        // Мгновенный старт React
        if (window.GameBoot) {
            window.GameBoot.trigger();
        } else {
            window.__MODULES_READY__ = true;
        }
    }

    boot();
})();
