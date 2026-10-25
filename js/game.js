const { useState, useEffect, useRef, useCallback } = React;
const { calculateJumpMultiplier, toggleFullscreen } = window.GameUtils;
const { GROUND_Y, JUMP_FORCE, FRAME_COUNT } = window.GameUtils;

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

    const pitAudioRef = useRef(null);
    const pitAudioEndedRef = useRef(false);
    const barrelAudioRef = useRef(null);

    useEffect(() => {
        const pitAudio = new Audio('source/sounds/fall_in_pit.wav');
        pitAudio.preload = 'auto';
        pitAudioRef.current = pitAudio;

        const barrelAudio = new Audio('source/sounds/barrel_explosion.wav');
        barrelAudio.preload = 'auto';
        barrelAudioRef.current = barrelAudio;

        return () => {
            pitAudio.pause(); pitAudio.src = '';
            barrelAudio.pause(); barrelAudio.src = '';
        };
    }, []);
    
    const playerRef = useRef({
        x: 100, y: GROUND_Y - 110.3, width: 165.4, height: 110.3,
        velocityY: 0, isJumping: false, isHoldingJump: false, jumpMult: 1.0,
        tilt: 0, bob: 0, foodEaten: 0, foodTarget: 1
    });
    
    const obstaclesRef = useRef([]);
    const foodsRef = useRef([]);
    const explosionsRef = useRef([]);
    const distanceRef = useRef(0);
    const speedMultiplierRef = useRef(1.0);
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
    const walkFramesRef = useRef([]); 
    const currentFrameRef = useRef(0); 
    const lastFrameTimeRef = useRef(0); 

    const landscapeImg = useRef(new Image());
    const landscapeNightImg = useRef(new Image());
    const puddleImg = useRef(new Image());
    const puddleNightImg = useRef(new Image());
    const rockImg = useRef(new Image()); 
    const rockNightImg = useRef(new Image()); 
    const pitImg = useRef(new Image());
    const pitNightImg = useRef(new Image());
    const barrelImg = useRef(new Image());
    const barrelNightImg = useRef(new Image());
    const cactusImg = useRef(new Image());
    const cactusNightImg = useRef(new Image());
    const explosionImg = useRef(new Image());

    useEffect(() => {
        for (let i = 1; i <= FRAME_COUNT; i++) {
            const img = new Image(); img.src = `source/walk_animation/${i}.png`; walkFramesRef.current.push(img);
        }
        landscapeImg.current.src = 'source/landscape.jpg'; 
        landscapeNightImg.current.src = 'source/landscape_n.jpg';
        puddleImg.current.src = 'source/puddle.png';
        puddleNightImg.current.src = 'source/puddle_n.png';
        rockImg.current.src = 'source/rock.png'; 
        rockNightImg.current.src = 'source/rock_n.png'; 
        pitImg.current.src = 'source/pit.png';
        pitNightImg.current.src = 'source/pit_n.png';
        barrelImg.current.src = 'source/barrel.png';
        barrelNightImg.current.src = 'source/barrel_n.png';
        cactusImg.current.src = 'source/cactus.png';
        cactusNightImg.current.src = 'source/cactus_n.png';
        explosionImg.current.src = 'source/explosion.png';
    }, []);

    const handleGameOver = useCallback(() => {
        if (pitAudioRef.current) pitAudioRef.current.pause();
        setGameState('gameover');
        if (Math.floor(distanceRef.current) > highScore) {
            const newHigh = Math.floor(distanceRef.current);
            setHighScore(newHigh); localStorage.setItem('lacosteHighScore', newHigh);
        }
    }, [highScore]);

    const engineRef = useRef(null);

    useEffect(() => {
        engineRef.current = window.GameEngine.create({
            refs: {
                canvasRef, playerRef, obstaclesRef, foodsRef, explosionsRef, distanceRef, speedMultiplierRef,
                spawnTimerRef, foodTimerRef, bgOffsetRef, spawnCooldownRef, healthRef, isTrippingRef,
                tripTimerRef, speedPenaltyRef, isBarrelTripRef, pendingBarrelDamageRef, isBarrelFlyingRef,
                barrelFlyVelocityYRef, isFallingIntoPitRef, pitTargetRef, pitFallTimerRef, pitVelocityRef,
                isPitDeathDelayRef, pitDeathDelayTimerRef, walkFramesRef, currentFrameRef, lastFrameTimeRef,
                difficultyRef, timeOfDayRef
            },
            stateSetters: { setScore, setSpeedDisplay, setPowerDisplay, setHealth },
            assets: {
                landscapeImg, landscapeNightImg, puddleImg, puddleNightImg, rockImg, rockNightImg,
                pitImg, pitNightImg, barrelImg, barrelNightImg, cactusImg, cactusNightImg, explosionImg
            },
            audioRefs: { pitAudioRef, pitAudioEndedRef, barrelAudioRef },
            onGameOver: handleGameOver
        });
    }, [handleGameOver]);

    const resetGame = () => {
        playerRef.current = {
            x: 100, y: GROUND_Y - 110.3, width: 165.4, height: 110.3,
            velocityY: 0, isJumping: false, isHoldingJump: false, jumpMult: 1.0,
            tilt: 0, bob: 0, foodEaten: 0, foodTarget: 1 
        };
        obstaclesRef.current = []; foodsRef.current = []; explosionsRef.current = [];
        distanceRef.current = 0; speedMultiplierRef.current = 1.0; spawnTimerRef.current = 0;
        foodTimerRef.current = 0; bgOffsetRef.current = 0; currentFrameRef.current = 0; 
        spawnCooldownRef.current = 0;
        healthRef.current = 6; setHealth(6);
        isTrippingRef.current = false; tripTimerRef.current = 0; speedPenaltyRef.current = 1.0;
        isBarrelTripRef.current = false; pendingBarrelDamageRef.current = false;
        isBarrelFlyingRef.current = false; barrelFlyVelocityYRef.current = 0;
        isFallingIntoPitRef.current = false; pitTargetRef.current = null;
        pitFallTimerRef.current = 0; pitVelocityRef.current = 0;
        isPitDeathDelayRef.current = false; pitDeathDelayTimerRef.current = 0;
        pitAudioEndedRef.current = false;
        if (pitAudioRef.current) { pitAudioRef.current.pause(); pitAudioRef.current.currentTime = 0; }
        setScore(0); setSpeedDisplay(1.0); setPowerDisplay(1.0); setGameState('playing');
    };

    const handleKeyDown = useCallback((e) => {
        if (e.code === 'Escape') {
            e.preventDefault();
            if (isFallingIntoPitRef.current || isPitDeathDelayRef.current) return;
            if (gameState === 'playing') setGameState('paused');
            else if (gameState === 'paused') setGameState('playing');
            return;
        }
        if (e.code === 'KeyN') {
            e.preventDefault();
            setTimeOfDay(prev => prev === 'day' ? 'night' : 'day');
            return;
        }
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            if (gameState === 'menu') setGameState('playing');
            else if (gameState === 'gameover') resetGame();
            else if (gameState === 'playing' && !playerRef.current.isJumping && !isTrippingRef.current && !isFallingIntoPitRef.current && !isPitDeathDelayRef.current && !isBarrelFlyingRef.current) {
                const p = playerRef.current;
                const baseMult = 1.0 + Math.floor(distanceRef.current / 100) * 0.04;
                p.jumpMult = calculateJumpMultiplier(p.height, baseMult, speedPenaltyRef.current);
                p.velocityY = JUMP_FORCE * p.jumpMult;
                p.isJumping = true;
                p.isHoldingJump = true;
            }
        }
    }, [gameState]);

    const handleKeyUp = useCallback((e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') playerRef.current.isHoldingJump = false;
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

        const handleTouchStart = (e) => {
            if (e.target.closest('.game-btn') || e.target.closest('.btn')) return;
            e.preventDefault();
            if (gameState !== 'playing') return;
            if (playerRef.current.isJumping || isTrippingRef.current || isFallingIntoPitRef.current || isPitDeathDelayRef.current || isBarrelFlyingRef.current) return;

            const p = playerRef.current;
            const baseMult = 1.0 + Math.floor(distanceRef.current / 100) * 0.04;
            p.jumpMult = calculateJumpMultiplier(p.height, baseMult, speedPenaltyRef.current);
            p.velocityY = JUMP_FORCE * p.jumpMult;
            p.isJumping = true;
            p.isHoldingJump = true;
        };

        const handleTouchEnd = (e) => {
            if (e.target.closest('.game-btn') || e.target.closest('.btn')) return;
            if (gameState !== 'playing') return;
            e.preventDefault();
            playerRef.current.isHoldingJump = false;
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

    const lastTimeRef = useRef(0);
    const accumulatorRef = useRef(0);

    useEffect(() => {
        if (gameState === 'playing' && engineRef.current) {
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
                while (accumulatorRef.current >= FRAME_TIME && loops < 5) {
                    engineRef.current.updateLogic();
                    accumulatorRef.current -= FRAME_TIME;
                    loops++;
                }
                if (gameState !== 'playing') return;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                engineRef.current.draw(ctx, canvas);
                requestRef.current = requestAnimationFrame(gameLoop);
            };
            requestRef.current = requestAnimationFrame(gameLoop);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [gameState]);

    const getHearts = (currentHealth) => {
        let h = [];
        for (let i = 0; i < 3; i++) {
            if (currentHealth >= (i + 1) * 2) h.push('❤️');
            else if (currentHealth === i * 2 + 1) h.push('💔');
            else h.push('🖤');
        }
        return h.join(' ');
    };

    const { HUD, Menu, PauseMenu, GameOver, Controls } = window.GameUI;

    return React.createElement('div', { id: 'game-container' },
        (gameState === 'playing' || gameState === 'paused') ? React.createElement(HUD, { 
            playerRef, powerDisplay, speedDisplay, highScore, score, health, getHearts 
        }) : null,

        React.createElement('canvas', { ref: canvasRef, width: 1200, height: 600 }),

        gameState === 'playing' ? React.createElement(Controls, { 
            onPause: () => setGameState('paused'), 
            onFullscreen: toggleFullscreen 
        }) : null,
        
        gameState === 'menu' ? React.createElement(Menu, { 
            difficulty, setDifficulty, timeOfDay, setTimeOfDay, onStart: resetGame, onFullscreen: toggleFullscreen 
        }) : null,

        gameState === 'paused' ? React.createElement(PauseMenu, { 
            onResume: () => setGameState('playing'), 
            onRestart: resetGame, 
            onMenu: () => setGameState('menu'), 
            onFullscreen: toggleFullscreen 
        }) : null,
        
        gameState === 'gameover' ? React.createElement(GameOver, { 
            score, highScore, onRestart: resetGame, onFullscreen: toggleFullscreen 
        }) : null
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(Game));
