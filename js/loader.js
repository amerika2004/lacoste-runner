(function () {
    'use strict';
    const startTime = performance.now();

    function loadScript(src) {
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = false;
            s.onload = () => { console.log(`%c✅ ${src} (${(performance.now() - startTime).toFixed(0)}ms)`, 'color:#00FF41'); resolve(); };
            s.onerror = () => { console.error(`❌ Failed: ${src}`); resolve(); };
            document.body.appendChild(s);
        });
    }

    async function boot() {
        let modules = [];
        try {
            const res = await fetch('js/manifest.json?t=' + Date.now(), { cache: 'no-store' });
            const data = await res.json();
            modules = data.modules || [];
            console.log(`📦 Manifest loaded: ${modules.length} modules`);
        } catch (e) {
            console.warn('⚠️ manifest.json not found', e);
        }

        await Promise.all(modules.map(loadScript));

        const elapsed = (performance.now() - startTime).toFixed(0);
        console.log(`%c🚀 All modules ready in ${elapsed}ms`, 'color:#FFD700;font-weight:bold;font-size:14px');

        if (window.GameBoot) window.GameBoot.trigger();
        else window.__MODULES_READY__ = true;
    }

    boot();
})();
