// ======================= AUDIO =======================
const AudioManager = {
    day: null, night: null, jump: null, splash: null, barrel: null,
    init() {
        this.day = new Audio('source/sounds/forest_day.wav'); this.day.loop = true;
        this.night = new Audio('source/sounds/night_forest.mp3'); this.night.loop = true;
        this.jump = new Audio('source/sounds/jump.wav');
        this.splash = new Audio('source/sounds/splash.wav');
        this.barrel = new Audio('source/sounds/barrel_explosion.wav');
    },
    playAmbient(timeOfDay, enabled) {
        if (!enabled) { this.day.pause(); this.night.pause(); return; }
        if (timeOfDay === 'day') { this.night.pause(); this.day.play().catch(()=>{}); }
        else { this.day.pause(); this.night.play().catch(()=>{}); }
    },
    playSFX(type) {
        const snd = this[type];
        if (snd) { snd.currentTime = 0; snd.play().catch(()=>{}); }
    }
};

// ======================= REACT UI =======================
function Game() {
    const [gameState, setGameState] = useState('menu');
    const [score, setScore] = useState(0);
    const [health, setHealth] = useState(6);
    const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('lacosteHighScore')) || 0);
    
    // Настройки
    const [character, setCharacter] = useState('crocodile');
    const [background, setBackground] = useState('default');
    const [timeOfDay, setTimeOfDay] = useState('day');
    
    const canvasRef = useRef(null);
    const requestRef = useRef();

    useEffect(() => {
        RenderEngine.init(canvasRef);
        AudioManager.init();
        
        window.GameEvents.on('world_tick', (d) => { setScore(Math.floor(d.distance)); setHealth(d.health); });
        window.GameEvents.on('gameover', (d) => {
            if (d.distance > highScore) { setHighScore(Math.floor(d.distance)); localStorage.setItem('lacosteHighScore', Math.floor(d.distance)); }
            setGameState('gameover');
            AudioManager.playAmbient(timeOfDay, false);
        });
        window.GameEvents.on('jump', () => AudioManager.playSFX('jump'));
        window.GameEvents.on('hit', () => AudioManager.playSFX('splash'));
    }, [highScore, timeOfDay]);

    // Главный цикл
    useEffect(() => {
        if (gameState === 'playing') {
            const loop = () => {
                const bgConfig = CONFIG.BACKGROUNDS[background];
                Player.tick(bgConfig.offset);
                World.tick(bgConfig, timeOfDay);
                
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, 1200, 600);
                
                World.render(ctx, timeOfDay, bgConfig);
                Player.render(ctx, timeOfDay);
                
                requestRef.current = requestAnimationFrame(loop);
            };
            requestRef.current = requestAnimationFrame(loop);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [gameState, background, timeOfDay]);

    // Ввод
    useEffect(() => {
        const kd = (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); Player.jump(); }
            if (e.code === 'Escape') setGameState(prev => prev === 'playing' ? 'paused' : (prev === 'paused' ? 'playing' : prev));
        };
        const ku = (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') Player.isHolding = false; };
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup', ku);
        return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
    }, []);

    const startGame = () => {
        const bgConfig = CONFIG.BACKGROUNDS[background];
        Player.reset(character, bgConfig.offset);
        World.reset();
        setGameState('playing');
        AudioManager.playAmbient(timeOfDay, true);
    };

    return React.createElement('div', { id: 'game-container' },
        React.createElement('canvas', { ref: canvasRef, width: 1200, height: 600 }),
        
        // HUD
        (gameState === 'playing' || gameState === 'paused') ? React.createElement('div', { style: { position: 'absolute', top: 20, left: 20, color: '#00FF41', fontFamily: 'monospace', fontSize: '24px', zIndex: 10, textShadow: '1px 1px 0 #000' } },
            React.createElement('div', null, `DIST: ${score}m`),
            React.createElement('div', null, `HP: ${'❤️'.repeat(Math.ceil(health/2))}`)
        ) : null,

        // Меню
        gameState === 'menu' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('h1', { className: 'title' }, 'LACOSTE RUNNER'),
            
            // Выбор персонажа
            React.createElement('div', { style: { display: 'flex', gap: '10px', margin: '20px 0' } },
                Object.values(CONFIG.CHARACTERS).map(c => 
                    React.createElement('button', { key: c.id, className: `btn ${character === c.id ? 'active' : ''}`, onClick: () => setCharacter(c.id) }, `${c.emoji} ${c.name}`)
                )
            ),

            // Выбор фона
            React.createElement('div', { style: { display: 'flex', gap: '10px', marginBottom: '20px' } },
                Object.values(CONFIG.BACKGROUNDS).map(b => 
                    React.createElement('button', { key: b.id, className: `btn ${background === b.id ? 'active' : ''}`, onClick: () => setBackground(b.id) }, `${b.emoji} ${b.name}`)
                )
            ),

            // День/Ночь
            React.createElement('div', { style: { display: 'flex', gap: '10px', marginBottom: '20px' } },
                React.createElement('button', { className: `btn ${timeOfDay === 'day' ? 'active' : ''}`, onClick: () => setTimeOfDay('day') }, '☀️ Day'),
                React.createElement('button', { className: `btn ${timeOfDay === 'night' ? 'active' : ''}`, onClick: () => setTimeOfDay('night') }, '🌙 Night')
            ),

            React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'START ESCAPE')
        ) : null,

        // Пауза
        gameState === 'paused' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('h1', { className: 'title', style: { color: '#00FFFF' } }, 'PAUSED'),
            React.createElement('button', { className: 'btn btn-start', onClick: () => setGameState('playing') }, 'RESUME')
        ) : null,

        // Смерть
        gameState === 'gameover' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('h1', { className: 'title', style: { color: 'red' } }, 'BUSTED'),
            React.createElement('div', { style: { fontSize: '24px', color: 'white', marginBottom: '20px' } }, `DIST: ${score}m | HI: ${highScore}m`),
            React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'TRY AGAIN'),
            React.createElement('button', { className: 'btn', onClick: () => setGameState('menu'), style: { marginTop: '10px' } }, 'MENU')
        ) : null
    );
}

// Запуск
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(Game));
