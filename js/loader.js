/* ==================================================================
   loader.js — последовательная загрузка плагинов + триггер GameBoot
   ================================================================== */
(function () {
    'use strict';

    /* === 1. СТАБЫ (на случай если game.js загрузится позже) === */
    window.GameEvents = window.GameEvents || {
        listeners: {},
        on(e, cb) { (this.listeners[e] = this.listeners[e] || []).push(cb); },
        emit(e, d) {
            (this.listeners[e] || []).forEach(cb => {
                try { cb(d); } catch (err) { console.error(err); }
            });
        }
    };

    window.GameBoot = window.GameBoot || {
        triggered: false,
        callbacks: [],
        onReady(cb) {
            if (this.triggered) { try { cb(); } catch (e) { console.error(e); } return; }
            this.callbacks.push(cb);
        },
        trigger() {
            if (this.triggered) return;
            this.triggered = true;
            this.callbacks.forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
            this.callbacks = [];
        }
    };

    window.PackUIs = window.PackUIs || [];

    /* === 2. КОНФИГ === */
    const PLUGINS = [
        'js/plugins/all_in_one.js',
        // другие плагины добавляй сюда — загрузятся строго по порядку
    ];

    /* === 3. УТИЛИТЫ === */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = false;              // сохраняет порядок в DOM
            s.onload = () => {
                console.log(`✅ ${src}`);
                resolve();
            };
            s.onerror = () => {
                console.error(`❌ Не удалось загрузить: ${src}`);
                reject(new Error(src));
            };
            document.head.appendChild(s);
        });
    }

    // Ждём React — плагин использует React.createElement и React.useState
    function waitForReact(cb, attempts = 0) {
        if (window.React && window.ReactDOM) return cb();
        if (attempts > 50) {
            console.warn('⚠️ React не найден за 5с — грузим плагины всё равно');
            return cb();
        }
        setTimeout(() => waitForReact(cb, attempts + 1), 100);
    }

    /* === 4. ПОСЛЕДОВАТЕЛЬНОСТЬ ЗАГРУЗКИ === */
    async function bootSequence() {
        // Шаг 1: загружаем плагины по одному
        for (const src of PLUGINS) {
            try {
                await loadScript(src);
            } catch (e) {
                console.error(`⚠️ Пропускаю ${src}:`, e.message);
            }
        }

        // Шаг 2: лог «Bootstrapping» — ПОСЛЕ плагинов, но ДО триггера
        console.log(
            `%c🎮 Bootstrapping...  [PackUIs: ${window.PackUIs.length}]`,
            'color:#00FFFF;font-weight:bold'
        );

        // Шаг 3: триггерим GameBoot → game.js запускает React-рендер
        window.GameBoot.trigger();
    }

    /* === 5. СТАРТ === */
    waitForReact(bootSequence);
})();
