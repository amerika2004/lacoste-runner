(function () {
    'use strict';

    // Список всех UI-компонентов из пакетов
    window.PackUIs = [];

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = false; // сохраняет порядок
            s.onload = () => { console.log('✅ Loaded: ' + src); resolve(); };
            s.onerror = () => { console.error('❌ Failed: ' + src); reject(); };
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
            console.warn('manifest.json not found');
        }

        for (const src of modules) {
            await loadScript(src);
        }

        console.log('🚀 All modules ready');

        // Принудительно перерисовываем React, чтобы подключить PackUIs
        if (typeof window.__forceReactUpdate === 'function') {
            window.__forceReactUpdate();
        }
    }

    loadAll();
})();
