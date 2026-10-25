const { useState, useEffect, useRef, useCallback } = React;
const e = React.createElement;

function Game() {
    const [gameState, setGameState] = useState('menu');
    const [timeOfDay, setTimeOfDay] = useState(() => localStorage.getItem('lacosteTimeOfDay') || 'day');
    const [difficulty, setDifficulty] = useState(() => localStorage.getItem('lacosteDifficulty') || 'hard');
    
    const [score, setScore] = useState(0);
    const [speedDisplay, setSpeedDisplay] = useState(1.0); 
    const [powerDisplay, setPowerDisplay] = useState(1.0);
    const [health, setHealth] = useState(6);
    const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('lacosteHighScore')) || 0);

    const canvasRef = useRef(null);
    const requestRef = useRef();
    
    // Рефы для чтения в игровом цикле без перезапуска
    const timeOfDayRef = useRef(timeOfDay);
    const difficultyRef = useRef(difficulty);

    useEffect(() => {
        timeOfDayRef.current = timeOfDay;
        localStorage.setItem('lacosteTimeOfDay', timeOfDay);
    }, [timeOfDay]);

    useEffect(() => {
        difficultyRef.current = difficulty;
        localStorage.setItem('lacosteDifficulty', difficulty);
    }, [difficulty]);

    // === АУДИО ===
    const pitAudioRef = useRef(null);
    const pitAudioEndedRef = useRef(false);
    const barrelAudioRef = useRef(null);

    // === ИГРОВЫЕ РЕФЫ ===
    const playerRef = useRef({
        x: 100, y: 530 - 110.3, width: 165.4, height: 110.3,
        velocityY: 0, isJumping: false, isHoldingJump: false, jumpMult: 1.0,
        tilt: 0, bob: 0, foodEaten: 0, foodTarget: 1
    });
    
    const obstaclesRef = useRef([]);
    const foodsRef = useRef([]);
    const explosionsRef = useRef([]);
    
    const distanceRef = useRef(0);
    const spawnTimerRef = useRef(0);
    const foodTimerRef = useRef(0);
    const bgOffsetRef = useRef(0); 
    const spawnCooldownRef = useRef(0);

    const healthRef = useRef(6);
    const isTrippingRef = useRef(false);
    const tripTimerRef = useRef(0);
    const speedPenaltyRef = useRef(1.0); 
    
    const isBarrelTripRef = useRef(false);
    const pendingBarrelDamageRef = useRef(false);
    const isBarrelFlyingRef = useRef(false);
    const barrelFlyVelocityYRef = useRef(0);
    
    const isFallingIntoPitRef = useRef(false);
    const pitTargetRef = useRef(null);
    const pitFallTimerRef = useRef(0);
    const pitVelocityRef = useRef(0); 
    const isPitDeathDelayRef = useRef(false);
    const pitDeathDelayTimerRef = useRef(0);

    const currentFrameRef = useRef(0); 
    const lastFrameTimeRef = useRef(0); 

    // === ИЗОБРАЖЕНИЯ ===
    const images = {
        landscape: useRef(new Image()), landscapeNight: useRef(new Image()),
        puddle: useRef(new Image()), puddleNight: useRef(new Image()),
        rock: useRef(new Image()), rockNight: useRef(new Image()),
        pit: useRef(new Image()), pitNight: useRef(new Image()),
        barrel: useRef(new Image()), barrelNight: useRef(new Image()),
        cactus: useRef(new Image()), cactusNight: useRef(new Image()),
        explosion: useRef(new Image()), walkFrames: useRef([])
    };

    useEffect(() => {
        const { FRAME_COUNT } = window.GameConfig;
        for (let i = 1; i <= FRAME_COUNT; i++) {
            const img = new Image(); img.src = `source/walk_animation/${i}.png`; images.walkFrames.current.push(img);
        }
        images.landscape.current.src = 'source/landscape.jpg'; 
        images.landscapeNight.current.src = 'source/landscape_n.jpg';
        images.puddle.current.src = 'source/puddle.png'; 
        images.puddleNight.current.src = 'source/puddle_n.png';
        images.rock.current.src = 'source/rock.png'; 
        images.rockNight.current.src = 'source/rock_n.png'; 
        images.pit.current.src = 'source/pit.png'; 
        images.pitNight.current.src = 'source/pit_n.png';
        images.barrel.current.src = 'source/barrel.png'; 
        images.barrelNight.current.src = 'source/barrel_n.png';
        images.cactus.current.src = 'source/cactus.png'; 
        images.cactusNight.current.src = 'source/cactus_n.png';
        images.explosion.current.src = 'source/explosion.png';

        pitAudioRef.current = new Audio('source/sounds/fall_in_pit.wav');
        pitAudioRef.current.preload = 'auto';
        barrelAudioRef.current = new Audio('source/sounds/barrel_explosion.wav');
        barrelAudioRef.current.preload = 'auto';

        return () => {
            if (pitAudioRef.current) { pitAudioRef.current.pause(); pitAudioRef.current.src = ''; }
            if (barrelAudioRef.current) { barrelAudioRef.current.pause(); barrelAudioRef.current.src = ''; }
        };
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => console.warn("Fullscreen error:", err));
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch((err) => console.warn("Orientation lock error:", err));
            }
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    };

    const jump = () => {
        if (playerRef.current.isJumping || isTrippingRef.current || isFallingIntoPitRef.current || isPitDeathDelayRef.current || isBarrelFlyingRef.current) return;
        const p = playerRef.current;
        const baseMult = 1.0 + Math.floor(distanceRef.current / 100) * 0.04;
        p.jumpMult = window.GameMechanics.calculateJumpMultiplier(p.height, baseMult, speedPenaltyRef.current);
        p.velocityY = window.GameConfig.JUMP_FORCE * p.jumpMult;
        p.isJumping = true;
        p.isHoldingJump = true;
    };

    const handleKeyDown = useCallback((ev) => {
        if (ev.code === 'Escape') {
            ev.preventDefault();
            if (isFallingIntoPitRef.current || isPitDeathDelayRef.current) return;
            if (gameState === 'playing') setGameState('paused');
            else if (gameState === 'paused') setGameState('playing');
            return;
        }
        if (ev.code === 'KeyN') {
            ev.preventDefault();
            setTimeOfDay(prev => prev === 'day' ? 'night' : 'day');
            return;
        }
        if (ev.code === 'Space' || ev.code === 'ArrowUp') {
            ev.preventDefault();
            if (gameState === 'menu') setGameState('playing');
            else if (gameState === 'gameover') resetGame();
            else if (gameState === 'playing') jump();
        }
    }, [gameState]);

    const handleKeyUp = useCallback((ev) => {
        if (ev.code === 'Space' || ev.code === 'ArrowUp') playerRef.current.isHoldingJump = false;
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown, handleKeyUp]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleTouchStart = (ev) => {
            if (ev.target.closest('.game-btn') || ev.target.closest('.btn')) return;
            ev.preventDefault();
            if (gameState === 'playing') jump();
        };
        const handleTouchEnd = (ev) => {
            if (ev.target.closest('.game-btn') || ev.target.closest('.btn')) return;
            if (gameState === 'playing') { ev.preventDefault(); playerRef.current.isHoldingJump = false; }
        };

        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

        return () => {
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchend', handleTouchEnd);
            canvas.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [gameState]);

    const resetGame = () => {
        playerRef.current = { x: 100, y: 530 - 110.3, width: 165.4, height: 110.3, velocityY: 0, isJumping: false, isHoldingJump: false, jumpMult: 1.0, tilt: 0, bob: 0, foodEaten: 0, foodTarget: 1 };
        obstaclesRef.current = []; foodsRef.current = []; explosionsRef.current = [];
        distanceRef.current = 0; spawnTimerRef.current = 0; foodTimerRef.current = 0; bgOffsetRef.current = 0; currentFrameRef.current = 0; spawnCooldownRef.current = 0;
        healthRef.current = 6; setHealth(6); isTrippingRef.current = false; tripTimerRef.current = 0; speedPenaltyRef.current = 1.0;
        isBarrelTripRef.current = false; pendingBarrelDamageRef.current = false; isBarrelFlyingRef.current = false; barrelFlyVelocityYRef.current = 0;
        isFallingIntoPitRef.current = false; pitTargetRef.current = null; pitFallTimerRef.current = 0; pitVelocityRef.current = 0;
        isPitDeathDelayRef.current = false; pitDeathDelayTimerRef.current = 0;

        pitAudioEndedRef.current = false;
        if (pitAudioRef.current) { pitAudioRef.current.pause(); pitAudioRef.current.currentTime = 0; }

        setScore(0); setSpeedDisplay(1.0); setPowerDisplay(1.0); setGameState('playing');
    };

    const handleGameOver = () => {
        if (pitAudioRef.current) pitAudioRef.current.pause();
        setGameState('gameover');
        if (Math.floor(distanceRef.current) > highScore) {
            const newHigh = Math.floor(distanceRef.current);
            setHighScore(newHigh); localStorage.setItem('lacosteHighScore', newHigh);
        }
    };

    const handleHit = (index) => {
        if (isTrippingRef.current) return;
        obstaclesRef.current.splice(index, 1);
        healthRef.current -= 1; setHealth(healthRef.current);
        if (healthRef.current <= 0) { handleGameOver(); return; }
        
        isTrippingRef.current = true; tripTimerRef.current = 0; isBarrelTripRef.current = false;
        const p = playerRef.current;
        p.y = 530 - p.height; p.velocityY = 0; p.isJumping = false; p.tilt = 0;
        speedPenaltyRef.current = speedPenaltyRef.current * 0.65;
    };

    const handleBarrelHit = (index) => {
        if (isTrippingRef.current || isBarrelFlyingRef.current) return;
        const obs = obstaclesRef.current[index]; if (!obs) return;
        const canvas = canvasRef.current; const p = playerRef.current;
        
        explosionsRef.current.push({ x: obs.x + obs.width / 2, y: obs.y + obs.height / 2, size: obs.height * 6, timer: 0, maxTimer: 30 });
        
        if (barrelAudioRef.current) {
            barrelAudioRef.current.currentTime = 0;
            barrelAudioRef.current.play().catch(e => console.warn("Audio blocked", e));
        }

        obstaclesRef.current.splice(index, 1);
        obstaclesRef.current = obstaclesRef.current.filter(o => (o.x + o.width) > p.x && o.x < canvas.width);
        foodsRef.current = foodsRef.current.filter(f => f.x < canvas.width);

        spawnCooldownRef.current = 90; spawnTimerRef.current = 0;
        isBarrelFlyingRef.current = true; isBarrelTripRef.current = true; barrelFlyVelocityYRef.current = -20;
        p.velocityY = 0; p.isJumping = false; p.isHoldingJump = false; p.tilt = 0;
    };

    // === ФИКСИРОВАННЫЙ ЦИКЛ (60 FPS) ===
    const lastTimeRef = useRef(0);
    const accumulatorRef = useRef(0);

    useEffect(() => {
        if (gameState === 'playing') {
            lastTimeRef.current = performance.now();
            accumulatorRef.current = 0;

            const gameLoop = (time) => {
                if (gameState !== 'playing') return;

                let deltaTime = time - lastTimeRef.current;
                lastTimeRef.current = time;
                if (deltaTime > 250) deltaTime = 250; 
                accumulatorRef.current += deltaTime;

                const FRAME_TIME = 1000 / 60;
                let loops = 0;
                
                // Передаем все рефы и экшены в механику
                const refs = {
                    canvasRef, playerRef, obstaclesRef, foodsRef, explosionsRef, distanceRef, 
                    spawnTimerRef, foodTimerRef, bgOffsetRef, spawnCooldownRef, healthRef, 
                    isTrippingRef, tripTimerRef, speedPenaltyRef, isBarrelTripRef, pendingBarrelDamageRef, 
                    isBarrelFlyingRef, barrelFlyVelocityYRef, isFallingIntoPitRef, pitTargetRef, 
                    pitFallTimerRef, pitVelocityRef, isPitDeathDelayRef, pitDeathDelayTimerRef, 
                    currentFrameRef, lastFrameTimeRef, pitAudioRef, pitAudioEndedRef, barrelAudioRef, images
                };
                const actions = { setSpeedDisplay, setPowerDisplay, setScore, setHealth, handleGameOver, handleHit, handleBarrelHit };

                while (accumulatorRef.current >= FRAME_TIME && loops < 5) {
                    window.GameMechanics.updateLogic(refs, difficultyRef.current, actions);
                    accumulatorRef.current -= FRAME_TIME;
                    loops++;
                }

                if (gameState !== 'playing') return;

                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                window.GameRenderer.draw(ctx, canvas, refs, timeOfDayRef.current, window.GameConfig.FLIP_CROC);

                requestRef.current = requestAnimationFrame(gameLoop);
            };

            requestRef.current = requestAnimationFrame(gameLoop);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [gameState]);

    const startGame = () => resetGame();

    return e('div', { id: 'game-container' },
        
        (gameState === 'playing' || gameState === 'paused') ? e(window.GameUI.HUD, {
            playerRef, powerDisplay, speedDisplay, highScore, score, health
        }) : null,

        e('canvas', { ref: canvasRef, width: 1200, height: 600 }),

        gameState === 'playing' ? e(React.Fragment, null,
            e('button', { id: 'btn-fullscreen', className: 'game-btn', onClick: toggleFullscreen, 'aria-label': 'Fullscreen' }, '⛶'),
            e('button', { id: 'btn-pause', className: 'game-btn', onClick: () => setGameState('paused'), 'aria-label': 'Pause' }, '❚❚')
        ) : null,
        
        gameState === 'menu' ? e(window.GameUI.MainMenu, {
            difficulty, setDifficulty, timeOfDay, setTimeOfDay, toggleFullscreen, startGame
        }) : null,

        gameState === 'paused' ? e(window.GameUI.PauseMenu, {
            resumeGame: () => setGameState('playing'), 
            restartGame: resetGame, 
            backToMenu: () => setGameState('menu'), 
            toggleFullscreen
        }) : null,
        
        gameState === 'gameover' ? e(window.GameUI.GameOverMenu, {
            score, highScore, toggleFullscreen, startGame
        }) : null
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(Game));
