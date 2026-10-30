/* ==================================================================
   menu-shell.js — единое меню (Home / Shop / Promo / Leaderboard /
   Settings / Achievements). Каждая вкладка рендерится как ОТДЕЛЬНЫЙ
   React-компонент со стабильным id → правила хуков не нарушаются.
   ================================================================== */
(function () {
    'use strict';

    if (!window.React) {
        console.error('[MenuShell] React not loaded');
        return;
    }

    function MenuShell({ coins, tabs }) {
        const [activeTabId, setActiveTabId] = React.useState(
            () => (tabs[0] && tabs[0].id) || 'home'
        );

        // Актуальный массив вкладок — обновляем на каждом рендере,
        // чтобы закешированные компоненты всегда звали свежий render().
        const latestTabsRef = React.useRef(tabs);
        latestTabsRef.current = tabs;

        // Стабильный компонент на каждый id вкладки.
        // React видит Shop как ОТДЕЛЬНЫЙ компонент → его хуки привязаны
        // к нему, а не к MenuShell → чёрные экраны исчезают.
        const componentCacheRef = React.useRef({});
        function getTabComponent(tabId) {
            if (!componentCacheRef.current[tabId]) {
                componentCacheRef.current[tabId] = function CachedTab() {
                    const latest = latestTabsRef.current.find(t => t.id === tabId);
                    if (!latest || typeof latest.render !== 'function') return null;
                    return latest.render();
                };
            }
            return componentCacheRef.current[tabId];
        }

        const active = tabs.find(t => t.id === activeTabId) || tabs[0];
        const ActiveComponent = active ? getTabComponent(active.id) : null;

        return React.createElement('div', { className: 'ms-overlay' },
            React.createElement('div', { className: 'ms-panel' },

                // Header: логотип + монеты
                React.createElement('div', { className: 'ms-header' },
                    React.createElement('div', { className: 'ms-logo' }, 'LACOSTE'),
                    React.createElement('div', { className: 'ms-coins' }, `💰 ${coins || 0}`)
                ),

                // Главная навигация (вкладки)
                React.createElement('div', { className: 'ms-nav' },
                    tabs.map(t => React.createElement('button', {
                        key: t.id,
                        type: 'button',
                        className: 'ms-nav-btn' + (activeTabId === t.id ? ' active' : ''),
                        onClick: () => setActiveTabId(t.id),
                        title: t.title || t.label
                    }, `${t.icon || ''} ${t.label || t.id}`.trim()))
                ),

                // Заголовок активной вкладки
                active && active.title
                    ? React.createElement('div', { className: 'ms-title' }, active.title)
                    : null,

                // Тело
                React.createElement('div', { className: 'ms-content' },
                    ActiveComponent ? React.createElement(ActiveComponent) : null
                )
            )
        );
    }

    window.MenuShell = MenuShell;
    console.log('%c📋 MenuShell (stable) loaded', 'color:#00FFCC;font-weight:bold');
})();
