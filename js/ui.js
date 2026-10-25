const e = React.createElement;

window.GameUI = {
    formatScore: function(num) {
        return num.toString().padStart(5, '0');
    },

    getHearts: function(health) {
        let h = [];
        for (let i = 0; i < 3; i++) {
            if (health >= (i + 1) * 2) h.push('❤️');
            else if (health === i * 2 + 1) h.push('💔');
            else h.push('🖤');
        }
        return h.join(' ');
    },

    HUD: function({ playerRef, powerDisplay, speedDisplay, highScore, score, health }) {
        const hearts = window.GameUI.getHearts(health);
        const fStr = window.GameUI.formatScore;
        
        return e(React.Fragment, null,
            e('div', { className: 'hud-left' }, 
                e('span', null, `FOOD: ${playerRef.current.foodEaten} / ${playerRef.current.foodTarget}`),
                e('span', { style: { fontSize: 'clamp(14px, 2.5vmin, 24px)', letterSpacing: '2px' } }, hearts)
            ),
            e('div', { className: 'hud-right' }, 
                e('span', { style: {color: '#FFD700'} }, `PWR x${powerDisplay}`),
                e('span', { style: {color: '#FF00FF'} }, `${speedDisplay === 'REVERSE' ? '◄◄ REV' : `SPD x${speedDisplay}`}`),
                e('span', null, `HI ${fStr(highScore)}  ${fStr(score)}m`)
            )
        );
    },

    MainMenu: function({ difficulty, setDifficulty, timeOfDay, setTimeOfDay, toggleFullscreen, startGame }) {
        return e('div', { className: 'menu-overlay' },
            e('div', { className: 'title' }, 'LACOSTE', e('br'), 'RUNNER'),
            e('div', { className: 'subtitle' }, 'VICE CITY EDITION'),
            
            e('div', { className: 'settings' },
                e('button', { className: `btn ${difficulty === 'easy' ? 'active' : ''}`, onClick: () => setDifficulty('easy') }, 'Easy'),
                e('button', { className: `btn ${difficulty === 'medium' ? 'active' : ''}`, onClick: () => setDifficulty('medium') }, 'Medium'),
                e('button', { className: `btn ${difficulty === 'hard' ? 'active' : ''}`, onClick: () => setDifficulty('hard') }, 'Hard')
            ),

            e('div', { className: 'settings', style: { marginTop: '-10px' } },
                e('button', { className: `btn ${timeOfDay === 'day' ? 'active' : ''}`, onClick: () => setTimeOfDay('day') }, '☀️ Day'),
                e('button', { className: `btn ${timeOfDay === 'night' ? 'active' : ''}`, onClick: () => setTimeOfDay('night') }, '🌙 Night')
            ),

            e('div', { style: { display: 'flex', gap: '10px', marginBottom: '15px' } },
                e('button', { className: 'btn', onClick: toggleFullscreen }, '⛶ На весь экран')
            ),

            e('button', { className: 'btn btn-start', onClick: startGame }, 'Start Escape'),
            e('div', { style: { marginTop: '10px' } },
                e('p', { style: {color: '#888', fontSize: '12px'} }, 'Tap / Space — jump, HOLD — high jump!'),
                e('p', { style: {color: '#FFD700', fontSize: '12px'} }, 'Eat food to grow stronger!'),
                e('p', { style: {color: '#FF007F', fontSize: '12px'} }, 'Avoid pits — instant death!')
            )
        );
    },

    PauseMenu: function({ resumeGame, restartGame, backToMenu, toggleFullscreen }) {
        return e('div', { className: 'menu-overlay' },
            e('div', { className: 'title', style: { color: '#00FFFF', textShadow: '2px 2px 0px #FF007F' } }, 'PAUSED'),
            e('button', { className: 'btn btn-start', onClick: resumeGame, style: { marginBottom: '10px' } }, 'Resume'),
            e('div', { className: 'settings' },
                e('button', { className: 'btn', onClick: toggleFullscreen }, '⛶ Fullscreen'),
                e('button', { className: 'btn', onClick: restartGame }, 'Restart'),
                e('button', { className: 'btn', onClick: backToMenu }, 'Menu')
            )
        );
    },

    GameOverMenu: function({ score, highScore, toggleFullscreen, startGame }) {
        return e('div', { className: 'menu-overlay' },
            e('div', { className: 'title', style: {color: 'red', textShadow: '2px 2px 0px #000'} }, 'BUSTED'),
            e('div', { className: 'subtitle', style: {color: 'white', marginBottom: '10px'} }, 'The employees caught you!'),
            e('div', { className: 'subtitle' }, 'DIST: ', Math.floor(score), 'm | HI: ', highScore, 'm'),
            e('div', { className: 'settings' },
                e('button', { className: 'btn', onClick: toggleFullscreen }, '⛶ Fullscreen'),
                e('button', { className: 'btn btn-start', onClick: startGame }, 'Try Again')
            )
        );
    }
};
