/* ==================================================================
   menu.js — Universal MenuShell (единый интерфейс для всех окон)
   ================================================================== */
(function () {
    'use strict';

    /**
     * MenuShell(props):
     *   props.tabs       — [{ id, icon, label, title, render:()=>JSX }]
     *   props.initialTab — id стартового таба
     *   props.coins      — монеты для шапки (опционально)
     *   props.onClose    — колбэк закрытия (опционально)
     *   props.headerBadge— строка бейджа (напр. "🛒 SHOP")
     */
    function MenuShell(props) {
        const { tabs, initialTab, coins, onClose, headerBadge } = props;
        const [activeTab, setActiveTab] = React.useState(initialTab || (tabs[0] && tabs[0].id));
        const current = tabs.find(t => t.id === activeTab) || tabs[0];

        return React.createElement('div', { className: 'ms-overlay' },
            React.createElement('div', { className: 'ms-panel' },
                // ── HEADER ──
                React.createElement('div', { className: 'ms-header' },
                    React.createElement('div', { className: 'ms-title' },
                        React.createElement('span', { className: 'ms-title-icon' }, current?.icon || '🎮'),
                        React.createElement('span', null, current?.title || current?.label || 'MENU')
                    ),
                    React.createElement('div', { className: 'ms-header-right' },
                        coins !== undefined && React.createElement('div', { className: 'ms-coins' }, '💰 ', coins),
                        headerBadge && React.createElement('div', { className: 'ms-badge' }, headerBadge),
                        onClose && React.createElement('button', { className: 'ms-close', onClick: onClose, title: 'Close' }, '✕')
                    )
                ),
                // ── TABS ──
                tabs.length > 1 && React.createElement('div', { className: 'ms-tabs' },
                    tabs.map(t => React.createElement('button', {
                        key: t.id,
                        className: `ms-tab ${activeTab === t.id ? 'active' : ''}`,
                        onClick: () => setActiveTab(t.id)
                    },
                        React.createElement('span', { className: 'ms-tab-icon' }, t.icon || ''),
                        React.createElement('span', { className: 'ms-tab-label' }, t.label || t.id)
                    ))
                ),
                // ── CONTENT ──
                React.createElement('div', { className: 'ms-content' },
                    current && current.render ? current.render() : null
                )
            )
        );
    }

    window.MenuShell = MenuShell;

    // ── CSS для MenuShell (инжектится один раз) ──
    if (!document.getElementById('ms-style')) {
        const css = `
            .ms-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 9000; padding: 16px; animation: msFadeIn 0.18s ease; }
            @keyframes msFadeIn { from { opacity: 0; } to { opacity: 1; } }
            .ms-panel { width: min(900px, 100%); max-height: 92vh; background: linear-gradient(160deg, #1a1a2e 0%, #16213e 60%, #0f172a 100%); border: 2px solid rgba(255,215,0,0.35); border-radius: 16px; box-shadow: 0 20px 80px rgba(0,0,0,0.7), inset 0 0 60px rgba(255,215,0,0.05); display: flex; flex-direction: column; overflow: hidden; }
            .ms-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: linear-gradient(90deg, rgba(255,215,0,0.15), rgba(155,48,255,0.1)); border-bottom: 2px solid rgba(255,215,0,0.25); flex-shrink: 0; }
            .ms-title { display: flex; align-items: center; gap: 10px; font-family: 'Rajdhani', 'Montserrat', sans-serif; font-weight: 800; font-size: 22px; letter-spacing: 2px; color: #FFD700; text-shadow: 0 0 10px rgba(255,215,0,0.5); text-transform: uppercase; }
            .ms-title-icon { font-size: 26px; }
            .ms-header-right { display: flex; align-items: center; gap: 12px; }
            .ms-coins { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 18px; color: #FFD700; background: rgba(0,0,0,0.4); padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(255,215,0,0.35); }
            .ms-badge { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 12px; color: #00FFFF; background: rgba(0,255,255,0.1); padding: 4px 10px; border-radius: 12px; border: 1px solid rgba(0,255,255,0.3); letter-spacing: 1px; }
            .ms-close { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,0,80,0.15); border: 1px solid rgba(255,0,80,0.4); color: #FF3333; font-size: 18px; cursor: pointer; transition: all 0.15s; }
            .ms-close:hover { background: rgba(255,0,80,0.35); transform: scale(1.08); }
            .ms-tabs { display: flex; gap: 4px; padding: 10px 20px 0; border-bottom: 1px solid rgba(255,255,255,0.1); flex-shrink: 0; overflow-x: auto; scrollbar-width: thin; }
            .ms-tab { display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-bottom: none; border-radius: 10px 10px 0 0; color: rgba(255,255,255,0.6); font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: 1px; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
            .ms-tab:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.9); }
            .ms-tab.active { background: linear-gradient(180deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05)); border-color: rgba(255,215,0,0.5); color: #FFD700; }
            .ms-tab-icon { font-size: 16px; }
            .ms-content { padding: 20px; overflow-y: auto; flex: 1; scrollbar-width: thin; scrollbar-color: rgba(255,215,0,0.4) transparent; }
            .ms-content::-webkit-scrollbar { width: 8px; }
            .ms-content::-webkit-scrollbar-thumb { background: rgba(255,215,0,0.35); border-radius: 4px; }

            /* ═══ Общие элементы внутри MenuShell ═══ */
            .ms-section-title { font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 16px; letter-spacing: 2px; color: #FFD700; text-transform: uppercase; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,215,0,0.2); }
            .ms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
            .ms-card { background: linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 14px 10px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; position: relative; transition: all 0.15s; }
            .ms-card:hover { transform: translateY(-2px); border-color: rgba(255,215,0,0.35); }
            .ms-card.owned { border-color: rgba(0,255,180,0.35); background: linear-gradient(160deg, rgba(0,255,180,0.08), rgba(0,255,180,0.02)); }
            .ms-card.maxed { border-color: rgba(155,48,255,0.5); background: linear-gradient(160deg, rgba(155,48,255,0.12), rgba(155,48,255,0.03)); }
            .ms-card-icon { font-size: 38px; line-height: 1; }
            .ms-card-name { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 14px; color: #fff; }
            .ms-card-sub { font-size: 11px; opacity: 0.65; }
            .ms-card-tier { position: absolute; top: 6px; right: 6px; padding: 2px 6px; border-radius: 8px; font-size: 10px; font-weight: 800; letter-spacing: 0.5px; }
            .ms-buy-btn { width: 100%; margin-top: auto; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255,215,0,0.4); background: linear-gradient(180deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05)); color: #FFD700; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 13px; letter-spacing: 0.5px; cursor: pointer; transition: all 0.15s; }
            .ms-buy-btn:hover:not(:disabled) { background: linear-gradient(180deg, rgba(255,215,0,0.3), rgba(255,215,0,0.1)); transform: scale(1.02); }
            .ms-buy-btn:disabled { opacity: 0.4; cursor: not-allowed; }
            .ms-buy-btn.equipped { background: linear-gradient(180deg, rgba(0,255,180,0.25), rgba(0,255,180,0.1)); border-color: rgba(0,255,180,0.5); color: #00FFB4; }
            .ms-buy-btn.maxed { background: linear-gradient(180deg, rgba(155,48,255,0.25), rgba(155,48,255,0.1)); border-color: rgba(155,48,255,0.5); color: #C77DFF; }
            .ms-owned-tag { font-size: 11px; color: #00FFB4; font-weight: 800; letter-spacing: 1px; }

            .ms-char-tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
            .ms-char-tab { flex: 1; min-width: 120px; padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.7); font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; justify-content: center; transition: all 0.15s; }
            .ms-char-tab:hover { background: rgba(255,255,255,0.08); }
            .ms-char-tab.active { border-color: #FFD700; background: linear-gradient(180deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05)); color: #FFD700; }

            .ms-progress { width: 100%; height: 8px; border-radius: 4px; background: rgba(0,0,0,0.4); overflow: hidden; margin-top: 4px; }
            .ms-progress-bar { height: 100%; background: linear-gradient(90deg, #00FFFF, #FFD700); transition: width 0.2s; }
            .ms-progress-bar.maxed { background: linear-gradient(90deg, #9B30FF, #FF0080); }

            .ms-empty { text-align: center; padding: 40px 20px; color: rgba(255,255,255,0.5); font-family: 'Rajdhani', sans-serif; font-size: 14px; }

            .ms-input { width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,215,0,0.3); background: rgba(0,0,0,0.4); color: #fff; font-family: 'Rajdhani', sans-serif; font-size: 14px; letter-spacing: 1px; }
            .ms-input:focus { outline: none; border-color: rgba(255,215,0,0.7); box-shadow: 0 0 10px rgba(255,215,0,0.2); }
            .ms-btn { padding: 10px 18px; border-radius: 8px; border: 1px solid rgba(255,215,0,0.4); background: linear-gradient(180deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05)); color: #FFD700; font-family: 'Rajdhani', sans-serif; font-weight: 800; letter-spacing: 1px; cursor: pointer; transition: all 0.15s; }
            .ms-btn:hover { background: linear-gradient(180deg, rgba(255,215,0,0.35), rgba(255,215,0,0.1)); }
            .ms-btn.primary { background: linear-gradient(180deg, #FFD700, #FF8C00); color: #0a0a1a; border-color: #FFD700; }
            .ms-btn.primary:hover { transform: scale(1.03); box-shadow: 0 4px 20px rgba(255,215,0,0.4); }
            .ms-btn.ghost { background: transparent; border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.75); }

            .ms-row { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }

            .ms-home-title { font-family: 'Rajdhani', sans-serif; font-weight: 900; font-size: 48px; letter-spacing: 6px; text-align: center; background: linear-gradient(180deg, #FFD700, #FF8C00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 4px; }
            .ms-home-sub { text-align: center; font-family: 'Montserrat', sans-serif; font-size: 12px; letter-spacing: 4px; opacity: 0.7; margin-bottom: 24px; }
            .ms-home-stats { text-align: center; font-family: 'Rajdhani', sans-serif; font-size: 18px; color: #FFD700; margin: 16px 0; }
            .ms-home-start { width: 100%; padding: 16px; font-size: 22px; letter-spacing: 4px; border-radius: 12px; }
            .ms-tod { display: flex; gap: 8px; justify-content: center; margin-bottom: 12px; }
            .ms-tod-btn { padding: 8px 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.7); font-family: 'Rajdhani', sans-serif; font-weight: 700; cursor: pointer; }
            .ms-tod-btn.active { border-color: #FFD700; color: #FFD700; background: rgba(255,215,0,0.15); }

            .ms-promo-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,215,0,0.2); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
            .ms-promo-code { font-family: 'Courier New', monospace; font-size: 22px; font-weight: 800; letter-spacing: 3px; color: #00FFFF; text-shadow: 0 0 10px rgba(0,255,255,0.5); padding: 10px; background: rgba(0,0,0,0.4); border-radius: 8px; text-align: center; user-select: all; }
            .ms-promo-hint { font-size: 12px; opacity: 0.6; margin-top: 8px; }
        `;
        const style = document.createElement('style');
        style.id = 'ms-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    console.log('%c🎨 Universal MenuShell loaded', 'color:#FFD700;font-weight:bold');
})();
