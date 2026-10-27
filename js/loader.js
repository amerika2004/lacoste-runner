(function () {
    'use strict';
    function loadScript(src) {
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = false; // Важно для сохранения порядка!
            s.onload = () => { console.log('✅ Loaded: ' + src); resolve(); };
            s.onerror = () => { console.error('❌ Failed: ' + src); resolve(); }; // Не падаем, если файла нет
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
            console.warn('manifest.json not found', e);
        }

        for (const src of modules) {
            await loadScript(src);
        }

        console.log('🚀 All modules ready');
        window.__MODULES_READY__ = true;
    }
    loadAll();
})();
