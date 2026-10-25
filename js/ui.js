window.GameUI = (() => {
    const { formatScore } = window.GameUtils;

    const HUD = ({ playerRef, powerDisplay, speedDisplay, highScore, score, health, getHearts }) => {
        return React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'hud-left' }, 
                React.createElement('span', null, `FOOD: ${playerRef.current.foodEaten} / ${playerRef.current.foodTarget}`),
                React.createElement('span', { style: { fontSize: 'clamp(14px, 2.5vmin, 24px)', letterSpacing: '2px' } }, getHearts(health))
            ),
            React.createElement('div', { className: 'hud-right' }, 
                React.createElement('span', { style: {color: '#FFD700'} }, `PWR x${powerDisplay}`),
                React.createElement('span', { style: {color: '#FF00FF'} }, `${speedDisplay === 'REVERSE' ? '◄◄ REV' : `SPD x${speedDisplay}`}`),
                React.createElement('span', null, `HI ${formatScore(highScore)}  ${formatScore(score)}m`)
            )
        );
    };

    const Menu = ({ difficulty, setDifficulty, timeOfDay, setTimeOfDay, onStart, onFullscreen }) => {
        return React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title' }, 'LACOSTE', React.createElement('br'), 'RUNNER'),
            React.createElement('div', { className: 'subtitle' }, 'VICE CITY EDITION'),
            
            React.createElement('div', { className: 'settings' },
                React.createElement('button', { className: `btn ${difficulty === 'easy' ? 'active' : ''}`, onClick: () => setDifficulty('easy') }, 'Easy'),
                React.createElement('button', { className: `btn ${difficulty === 'medium' ? 'active' : ''}`, onClick: () => setDifficulty('medium') }, 'Medium'),
                React.createElement('button', { className: `btn ${difficulty === 'hard' ? 'active' : ''}`, onClick: () => setDifficulty('hard') }, 'Hard')
            ),

            React.createElement('div', { className: 'settings', style: { marginTop: '-10px' } },
                React.createElement('button', { className: `btn ${timeOfDay === 'day' ? 'active' : ''}`, onClick: () => setTimeOfDay('day') }, '☀️ Day'),
                React.createElement('button', { className: `btn ${timeOfDay === 'night' ? 'active' : ''}`, onClick: () => setTimeOfDay('night') }, '🌙 Night')
            ),

            React.createElement('div', { style: { display: 'flex', gap: '10px', marginBottom: '15px' } },
                React.createElement('button', { className: 'btn', onClick: onFullscreen }, '⛶ На весь экран')
            ),

            React.createElement('button', { className: 'btn btn-start', onClick: onStart }, 'Start Escape'),
            React.createElement('div', { style: { marginTop: '10px' } },
                React.createElement('p', { style: {color: '#888', fontSize: '12px'} }, 'Tap / Space — jump, HOLD — high jump!'),
                React.createElement('p', { style: {color: '#FFD700', fontSize: '12px'} }, 'Eat food to grow stronger!'),
                React.createElement('p', { style: {color: '#FF007F', fontSize: '12px'} }, 'Avoid pits — instant death!')
            )
        );
    };

    const PauseMenu = ({ onResume, onRestart, onMenu, onFullscreen }) => {
        return React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title', style: { color: '#00FFFF', textShadow: '2px 2px 0px #FF007F' } }, 'PAUSED'),
            React.createElement('button', { className: 'btn btn-start', onClick: onResume, style: { marginBottom: '10px' } }, 'Resume'),
            React.createElement('div', { className: 'settings' },
                React.createElement('button', { className: 'btn', onClick: onFullscreen }, '⛶ Fullscreen'),
                React.createElement('button', { className: 'btn', onClick: onRestart }, 'Restart'),
                React.createElement('button', { className: 'btn', onClick: onMenu }, 'Menu')
            )
        );
    };

    const GameOver = ({ score, highScore, onRestart, onFullscreen }) => {
        return React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title', style: {color: 'red', textShadow: '2px 2px 0px #000'} }, 'BUSTED'),
            React.createElement('div', { className: 'subtitle', style: {color: 'white', marginBottom: '10px'} }, 'The employees caught you!'),
            React.createElement('div', { className: 'subtitle' }, 'DIST: ', Math.floor(score), 'm | HI: ', highScore, 'm'),
            React.createElement('div', { className: 'settings' },
                React.createElement('button', { className: 'btn', onClick: onFullscreen }, '⛶ Fullscreen'),
                React.createElement('button', { className: 'btn btn-start', onClick: onRestart }, 'Try Again')
            )
        );
    };

    const Controls = ({ onPause, onFullscreen }) => {
        return React.createElement(React.Fragment, null,
            React.createElement('button', { id: 'btn-fullscreen', className: 'game-btn', onClick: onFullscreen, 'aria-label': 'Fullscreen' }, '⛶'),
            React.createElement('button', { id: 'btn-pause', className: 'game-btn', onClick: onPause, 'aria-label': 'Pause' }, '❚❚')
        );
    };

    return { HUD, Menu, PauseMenu, GameOver, Controls };
})();
