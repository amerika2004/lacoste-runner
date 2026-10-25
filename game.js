const { useState, useEffect, useRef, useCallback } = React;

const FLIP_CROC = false; 

// === НАСТРОЙКИ ФИЗИКИ ===
const GRAVITY = 0.75;        
const JUMP_FORCE = -10.5;    
const HOLD_THRUST = 0.45;    

const GROUND_Y = 530; 
const BASE_SPEED = 4.0; 

// === РЕЕСТР ПЕРСОНАЖЕЙ ===
// emoji — отображается в панели выбора
// folder — откуда грузятся кадры анимации (1.png ... frameCount.png)
const CHARACTERS = {
    crocodile: {
        id: 'crocodile',
        name: 'Crocodile',
        emoji: '🐊',
        folder: 'source/characters/crocodile',
        frameCount: 12,
        baseWidth: 165.4,
        baseHeight: 110.3,
    },
    panda: {
        id: 'panda',
        name: 'Panda',
        emoji: '🐼',
        folder: 'source/characters/panda',
        frameCount: 20,
        baseWidth: 160,
        baseHeight: 120,
    },
    // wolf: {
    //     id: 'wolf',
    //     name: 'Wolf',
    //     emoji: '🐺',
    //     folder: 'source/characters/wolf',
    //     frameCount: 12,
    //     baseWidth: 175,
    //     baseHeight: 115,
    // },
};

function Game() {
    const [gameState, setGameState] = useState('menu');
    const [timeOfDay, setTimeOfDay] = useState(() => localStorage.getItem('lacosteTimeOfDay') || 'day');
    const [difficulty, setDifficulty] = useState(() => localStorage.getItem('lacosteDifficulty') || 'hard');
    const [character, setCharacter] = useState(() => {
        const saved = localStorage.getItem('lacosteCharacter');
        return (saved && CHARACTERS[saved]) ? saved : 'crocodile';
    });
    
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

    // === ЗАГРУЗКА КАДРОВ ПЕРСОНАЖА ===
    const walkFramesRef = useRef([]); 
    const currentFrameRef = useRef(0); 
    const lastFrameTimeRef = useRef(0); 

    useEffect(() => {
        localStorage.setItem('lacosteCharacter', character);
        walkFramesRef.current = [];
        currentFrameRef.current = 0;
        const char = CHARACTERS[character] || CHARACTERS.crocodile;
        for (let i = 1; i <= char.frameCount; i++) {
            const img = new Image();
            img.src = `${char.folder}/${i}.png`;
            walkFramesRef.current.push(img);
        }
    }, [character]);

    // === АУДИО ===
    const pitAudioRef = useRef(null);
    const pitAudioEndedRef = useRef(false);
    const barrelAudioRef = useRef(null);
    const nightAmbientRef = useRef(null); // >>> Ссылка на ночной эмбиент

    useEffect(() => {
        const pitAudio = new Audio('source/sounds/fall_in_pit.wav');
        pitAudio.preload = 'auto';
        pitAudioRef.current = pitAudio;

        const barrelAudio = new Audio('source/sounds/barrel_explosion.wav');
        barrelAudio.preload = 'auto';
        barrelAudioRef.current = barrelAudio;

        // >>> Инициализация ночного звука
        const nightAmbient = new Audio('source/sounds/night_forest.mp3');
        nightAmbient.loop = true;
        nightAmbient.volume = 0.25; // Немного приглушенный фон
        nightAmbient.preload = 'auto';
        nightAmbientRef.current = nightAmbient;

        return () => {
            pitAudio.pause(); pitAudio.src = '';
            barrelAudio.pause(); barrelAudio.src = '';
            nightAmbient.pause(); nightAmbient.src = '';
        };
    }, []);

    // >>> Логика включения/выключения ночного звука
    useEffect(() => {
        const audio = nightAmbientRef.current;
        if (!audio) return;
        if (timeOfDay === 'night') {
            audio.play().catch(() => {
                // Браузер может заблокировать автозапуск, если нет действия пользователя
            });
        } else {
            audio.pause();
        }
    }, [timeOfDay]);

    // >>> Обход блокировки автовоспроизведения (если игра загрузилась сразу с ночным режимом)
    useEffect(() => {
        if (timeOfDay !== 'night') return;
        const tryPlay = () => {
            const audio = nightAmbientRef.current;
            if (audio && audio.paused) {
                audio.play().catch(() => {});
            }
        };
        tryPlay();
        window.addEventListener('pointerdown', tryPlay, { once: true });
        window.addEventListener('keydown', tryPlay, { once: true });
        return () => {
            window.removeEventListener('pointerdown', tryPlay);
            window.removeEventListener('keydown', tryPlay);
        };
    }, [timeOfDay]);
    
    // === ИГРОВЫЕ РЕФЫ ===
    const initChar = CHARACTERS[character] || CHARACTERS.crocodile;
    const playerRef = useRef({
        x: 100, y: GROUND_Y - initChar.baseHeight, 
        width: initChar.baseWidth, height: initChar.baseHeight,
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

    // === СТАТИЧНЫЕ ИЗОБРАЖЕНИЯ ===
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

    const calculateJumpMultiplier = (playerHeight, gameSpeed, penalty = 1.0) => {
        const char = CHARACTERS[character] || CHARACTERS.crocodile;
        const sizeFactor = Math.sqrt(playerHeight / char.baseHeight);
        const speedFactor = 1 + (gameSpeed - 1) * 0.10;
        return Math.max(1.0, sizeFactor * speedFactor * penalty);
    };

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
    }, [gameState, character]);

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
            if (e.target.closest('.game-btn') || e.target.closest('.btn') || e.target.closest('.char-btn')) return;
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
            if (e.target.closest('.game-btn') || e.target.closest('.btn') || e.target.closest('.char-btn')) return;
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
    }, [gameState, character]);

    const resetGame = () => {
        const char = CHARACTERS[character] || CHARACTERS.crocodile;
        playerRef.current = {
            x: 100, y: GROUND_Y - char.baseHeight, 
            width: char.baseWidth, height: char.baseHeight,
            velocityY: 0, isJumping: false, isHoldingJump: false, jumpMult: 1.0,
            tilt: 0, bob: 0, foodEaten: 0, foodTarget: 1 
        };
        obstaclesRef.current = []; foodsRef.current = []; explosionsRef.current = [];
        distanceRef.current = 0; spawnTimerRef.current = 0;
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
        p.y = GROUND_Y - p.height; p.velocityY = 0; p.isJumping = false; p.tilt = 0;
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

    const updateLogic = () => {
        const canvas = canvasRef.current;
        const p = playerRef.current;
        const char = CHARACTERS[character] || CHARACTERS.crocodile;

        const diff = difficultyRef.current;
        const diffMult = diff === 'easy' ? 0.8 : diff === 'medium' ? 1.8 : 2.3;
        
        if (isFallingIntoPitRef.current) {
            pitFallTimerRef.current++; pitVelocityRef.current += 0.2; p.y += pitVelocityRef.current;
            if (p.y > GROUND_Y + 30 || pitFallTimerRef.current > 400) {
                isFallingIntoPitRef.current = false; isPitDeathDelayRef.current = true; pitDeathDelayTimerRef.current = 0;

                pitAudioEndedRef.current = false;
                const a = pitAudioRef.current;
                if (a) {
                    a.currentTime = 0; a.onended = () => { pitAudioEndedRef.current = true; }; a.onerror = () => { pitAudioEndedRef.current = true; };
                    a.play().catch(() => { pitAudioEndedRef.current = true; });
                } else { pitAudioEndedRef.current = true; }
            }
            return;
        }
        
        if (isPitDeathDelayRef.current) {
            pitDeathDelayTimerRef.current++;
            const audioDone = pitAudioEndedRef.current || !pitAudioRef.current;
            const fallbackDone = pitDeathDelayTimerRef.current > 600;
            const minDelayPassed = pitDeathDelayTimerRef.current > 20;

            if ((audioDone && minDelayPassed) || fallbackDone) {
                isPitDeathDelayRef.current = false; handleGameOver(); return;
            }
            return;
        }
        
        if (isBarrelFlyingRef.current) {
            barrelFlyVelocityYRef.current += GRAVITY; p.y += barrelFlyVelocityYRef.current; p.tilt = Math.max(p.tilt - 0.03, -0.4);
            
            const backSpeed = 10 * diffMult; 
            bgOffsetRef.current += backSpeed;
            obstaclesRef.current.forEach(o => { o.x += backSpeed; }); foodsRef.current.forEach(f => { f.x += backSpeed; });
            setSpeedDisplay("REVERSE");
            
            if (p.y >= GROUND_Y - p.height) {
                p.y = GROUND_Y - p.height; isBarrelFlyingRef.current = false; barrelFlyVelocityYRef.current = 0;
                isTrippingRef.current = true; tripTimerRef.current = 0; pendingBarrelDamageRef.current = true; p.tilt = 0;
            }
            explosionsRef.current.forEach(e => e.timer++); explosionsRef.current = explosionsRef.current.filter(e => e.timer < e.maxTimer);
            return;
        }
        
        if (isTrippingRef.current) {
            tripTimerRef.current++;
            if (pendingBarrelDamageRef.current && tripTimerRef.current >= 15) {
                pendingBarrelDamageRef.current = false; healthRef.current -= 1; setHealth(healthRef.current);
                speedPenaltyRef.current = speedPenaltyRef.current * 0.65;
                if (healthRef.current <= 0) { handleGameOver(); return; }
            }
            if (tripTimerRef.current > 120) { isTrippingRef.current = false; tripTimerRef.current = 0; }
        }
        
        explosionsRef.current.forEach(e => e.timer++); explosionsRef.current = explosionsRef.current.filter(e => e.timer < e.maxTimer);

        const baseSpeedMult = 1.0 + Math.floor(distanceRef.current / 100) * 0.04;
        const effectiveSpeedMult = Math.max(1.0, baseSpeedMult * speedPenaltyRef.current);

        let currentSpeed = 0;
        if (!isTrippingRef.current) {
            currentSpeed = BASE_SPEED * effectiveSpeedMult * diffMult;
            setSpeedDisplay((effectiveSpeedMult * diffMult).toFixed(2));
            distanceRef.current += (currentSpeed * 0.03); 
            setScore(Math.floor(distanceRef.current)); 
            bgOffsetRef.current -= currentSpeed;
        } else { setSpeedDisplay("0.00"); }

        const currentPower = calculateJumpMultiplier(p.height, baseSpeedMult, speedPenaltyRef.current); setPowerDisplay(currentPower.toFixed(2));

        if (p.isJumping) {
            p.velocityY += GRAVITY; if (p.isHoldingJump) p.velocityY -= HOLD_THRUST * p.jumpMult;
            p.y += p.velocityY; p.tilt = p.velocityY * 0.025; p.tilt = Math.max(-0.35, Math.min(0.35, p.tilt)); 
            if (p.y <= 0) { p.y = 0; if (p.velocityY < 0) p.velocityY = 0; }
            if (p.y >= GROUND_Y - p.height) { p.y = GROUND_Y - p.height; p.velocityY = 0; p.isJumping = false; p.tilt = 0; }
        } else if (!isTrippingRef.current) {
            p.bob = Math.sin(Date.now() / 80) * 2.5; p.tilt = 0;
        }

        if (!p.isJumping && !isTrippingRef.current) {
            const now = Date.now(); const frameDelay = Math.max(30, 100 - (currentSpeed * 5)); 
            if (now - lastFrameTimeRef.current > frameDelay) {
                currentFrameRef.current = (currentFrameRef.current + 1) % char.frameCount; 
                lastFrameTimeRef.current = now;
            }
        }

        if (!isTrippingRef.current) {
            if (spawnCooldownRef.current > 0) { spawnCooldownRef.current--; spawnTimerRef.current = 0; } 
            else {
                spawnTimerRef.current += (currentSpeed / BASE_SPEED);
                
                let gapOk = true;
                for (let obs of obstaclesRef.current) { if (obs.x + obs.width > canvas.width - 350) { gapOk = false; break; } }
                
                if (gapOk && spawnTimerRef.current > Math.max(70, 140 - currentSpeed * 3) + Math.random() * 40) {
                    const types = ['barrel', 'rock', 'cactus', 'puddle', 'pit']; 
                    const randomType = types[Math.floor(Math.random() * types.length)];
                    let width = 40, height = 40, yOffset = 0;
                    if (randomType === 'rock') { width = 120; height = 120; yOffset = 30; } 
                    if (randomType === 'cactus') { width = 70; height = 110; }
                    if (randomType === 'barrel') { width = 50; height = 60; }
                    if (randomType === 'puddle') { width = 120; height = 120; yOffset = 30; }
                    if (randomType === 'pit') { width = 140; height = 90; yOffset = 40; }

                    const powerTier = Math.max(0, Math.floor((currentPower - 1.0) / 0.3));
                    const maxScale = 1.0 + powerTier * 0.15;
                    const scale = 1.0 + Math.random() * (maxScale - 1.0);
                    width *= scale; height *= scale; yOffset *= scale;

                    obstaclesRef.current.push({ x: canvas.width, y: GROUND_Y - height + yOffset, width: width, height: height, type: randomType });
                    spawnTimerRef.current = 0;
                }
            }

            foodTimerRef.current += (currentSpeed / BASE_SPEED);
            if (foodTimerRef.current > 100 + Math.random() * 80) { 
                let isSafeToSpawn = true;
                for (let obs of obstaclesRef.current) { if (obs.x + obs.width > canvas.width - 300) { isSafeToSpawn = false; break; } }
                if (isSafeToSpawn) {
                    const foodEmojis = ['🍗', '🍔', '🍕', '🥩'];
                    const randomFood = foodEmojis[Math.floor(Math.random() * foodEmojis.length)];
                    const foodY = Math.random() > 0.5 ? GROUND_Y - 80 : GROUND_Y - 40;
                    foodsRef.current.push({ x: canvas.width, y: foodY, width: 40, height: 40, emoji: randomFood });
                    foodTimerRef.current = 0; 
                }
            }
        }

        obstaclesRef.current.forEach(obs => { obs.x -= currentSpeed; }); obstaclesRef.current = obstaclesRef.current.filter(obs => obs.x + obs.width > 0);
        foodsRef.current.forEach(food => { food.x -= currentSpeed; }); foodsRef.current = foodsRef.current.filter(food => food.x + food.width > 0);

        if (!isTrippingRef.current) {
            for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
                let obs = obstaclesRef.current[i];
                const hitboxX = p.x + p.width * 0.6; const hitboxY = p.y + p.height * 0.4;
                const hitboxWidth = p.width * 0.25; const hitboxHeight = p.height * 0.4; 
                let obsHitboxX = obs.x + 10; let obsHitboxWidth = obs.width - 20;
                let obsHitboxY = obs.y + 5; let obsHitboxHeight = obs.height - 5;

                if (obs.type === 'puddle') { obsHitboxY = obs.y + obs.height * 0.5; obsHitboxHeight = obs.height * 0.5; } 
                else if (obs.type === 'rock') { obsHitboxY = obs.y + obs.height * 0.2; obsHitboxHeight = obs.height * 0.8; } 
                else if (obs.type === 'pit') {
                    const pitHitboxW = obs.width * 0.5; const pitHitboxH = obs.height * 0.5;
                    obsHitboxX = obs.x + (obs.width - pitHitboxW) / 2 + obs.width * 0.35;
                    obsHitboxWidth = pitHitboxW; obsHitboxY = obs.y + (obs.height - pitHitboxH) / 2; obsHitboxHeight = pitHitboxH;
                } else if (obs.type === 'cactus') {
                    const pad = obs.width * 0.3; obsHitboxX = obs.x + pad; obsHitboxWidth = obs.width - pad * 2;
                }

                if (hitboxX < obsHitboxX + obsHitboxWidth && hitboxX + hitboxWidth > obsHitboxX && hitboxY < obsHitboxY + obsHitboxHeight && hitboxY + hitboxHeight > obsHitboxY) {
                    if (obs.type === 'pit') {
                        isFallingIntoPitRef.current = true; pitTargetRef.current = obs;
                        pitFallTimerRef.current = 0; pitVelocityRef.current = 0;
                        p.velocityY = 0; p.isJumping = false; p.isHoldingJump = false;
                        return;
                    } else if (obs.type === 'barrel') { handleBarrelHit(i); break; } 
                    else { handleHit(i); break; }
                }
            }
        }

        foodsRef.current = foodsRef.current.filter(food => {
            const hitboxX = p.x + 20; const hitboxY = p.y + 20; const hitboxWidth = p.width - 40; const hitboxHeight = p.height - 20;
            if (hitboxX < food.x + food.width && hitboxX + hitboxWidth > food.x && hitboxY < food.y + food.height && hitboxY + hitboxHeight > food.y) {
                p.foodEaten++;
                if (p.foodEaten >= p.foodTarget) {
                    p.width += 2; p.height += 1.3; p.y = GROUND_Y - p.height; 
                    p.foodEaten = 0; p.foodTarget = p.foodTarget + 1;
                    healthRef.current = Math.min(6, healthRef.current + 1); setHealth(healthRef.current);
                }
                return false; 
            }
            return true;
        });
    };

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
                while (accumulatorRef.current >= FRAME_TIME && loops < 5) {
                    updateLogic();
                    accumulatorRef.current -= FRAME_TIME;
                    loops++;
                }

                if (gameState !== 'playing') return;

                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                draw(ctx, canvas);

                requestRef.current = requestAnimationFrame(gameLoop);
            };

            requestRef.current = requestAnimationFrame(gameLoop);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [gameState, character]);

    const pickImg = (dayImg, nightImg) => timeOfDayRef.current === 'night' ? nightImg.current : dayImg.current;
    const drawObstacleImage = (ctx, obs, dayImg, nightImg, fallbackColor) => {
        const img = pickImg(dayImg, nightImg);
        if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, obs.x, obs.y, obs.width, obs.height);
        else { ctx.fillStyle = fallbackColor; ctx.fillRect(obs.x, obs.y, obs.width, obs.height); }
    };

    const draw = (ctx, canvas) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const p = playerRef.current;
        const bgImg = pickImg(landscapeImg, landscapeNightImg);

        if (bgImg.complete && bgImg.naturalWidth > 0) {
            const scale = canvas.height / bgImg.naturalHeight; const exactWidth = Math.ceil(bgImg.naturalWidth * scale);
            let offsetX = Math.floor(bgOffsetRef.current % exactWidth);
            if (offsetX > 0) offsetX -= exactWidth;
            for (let i = offsetX; i < canvas.width; i += exactWidth) ctx.drawImage(bgImg, i, 0, exactWidth, canvas.height);
        } else {
            ctx.fillStyle = timeOfDayRef.current === 'night' ? '#0a0512' : '#1a0b2e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        if ((isFallingIntoPitRef.current || isPitDeathDelayRef.current) && pitTargetRef.current) {
            const obs = pitTargetRef.current; const pitDrawImg = pickImg(pitImg, pitNightImg);
            if (pitDrawImg.complete && pitDrawImg.naturalWidth > 0) ctx.drawImage(pitDrawImg, obs.x, obs.y, obs.width, obs.height);
            else { ctx.fillStyle = 'black'; ctx.beginPath(); ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2); ctx.fill(); }
        }

        const frames = walkFramesRef.current;
        const frameIdx = frames.length > 0 ? (currentFrameRef.current % frames.length) : 0;
        const charImg = frames[frameIdx];

        if (isFallingIntoPitRef.current || isPitDeathDelayRef.current) {
            if (charImg && charImg.complete && charImg.naturalWidth > 0) {
                ctx.save(); ctx.beginPath(); ctx.rect(0, 0, canvas.width, GROUND_Y); ctx.clip();
                ctx.save(); const centerX = p.x + p.width / 2; const centerY = p.y + p.height / 2;
                ctx.translate(centerX, centerY); ctx.rotate(p.tilt); if (FLIP_CROC) ctx.scale(-1, 1);
                ctx.drawImage(charImg, -p.width / 2, -p.height / 2, p.width, p.height); ctx.restore(); ctx.restore();
            }
        } else {
            if (charImg && charImg.complete && charImg.naturalWidth > 0) {
                ctx.save();
                let fallAngle = 0, yOffset = 0, flyTilt = 0;
                if (isBarrelFlyingRef.current) flyTilt = p.tilt;
                if (isTrippingRef.current) {
                    const fallProgress = Math.min(1, tripTimerRef.current / 15); const standProgress = Math.max(0, (tripTimerRef.current - 40) / 80);
                    const flatAmount = fallProgress * (1 - standProgress);
                    let dir = isBarrelTripRef.current ? (FLIP_CROC ? 1 : -1) : (FLIP_CROC ? -1 : 1);
                    fallAngle = dir * (Math.PI / 2) * flatAmount; yOffset = -((p.width - p.height) / 2) * flatAmount;
                    if (Math.floor(tripTimerRef.current / 10) % 2 === 1) ctx.globalAlpha = 0.5;
                }
                const centerX = p.x + p.width / 2; const centerY = p.y + p.height / 2 + (p.isJumping ? 0 : (isTrippingRef.current ? yOffset : p.bob));
                ctx.translate(centerX, centerY); ctx.rotate(p.tilt + fallAngle + flyTilt);
                if (FLIP_CROC) ctx.scale(-1, 1); 
                ctx.drawImage(charImg, -p.width / 2, -p.height / 2, p.width, p.height); ctx.restore();
            } else { ctx.fillStyle = 'red'; ctx.fillRect(p.x, p.y, p.width, p.height); }
        }

        explosionsRef.current.forEach(expl => {
            const progress = expl.timer / expl.maxTimer; const scale = 1 + progress * 0.5; const alpha = 1 - progress; const size = expl.size * scale;
            const x = expl.x - size / 2; const y = expl.y - size / 2;
            if (explosionImg.current.complete && explosionImg.current.naturalWidth > 0) {
                ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(explosionImg.current, x, y, size, size); ctx.restore();
            } else {
                ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = 'orange'; ctx.beginPath(); ctx.arc(expl.x, expl.y, size / 2, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'yellow'; ctx.beginPath(); ctx.arc(expl.x, expl.y, size / 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            }
        });

        ctx.textBaseline = 'bottom';
        foodsRef.current.forEach(food => { ctx.font = `40px Arial`; ctx.fillText(food.emoji, food.x, food.y + food.height); });

        obstaclesRef.current.forEach(obs => {
            if ((isFallingIntoPitRef.current || isPitDeathDelayRef.current) && obs === pitTargetRef.current) return;
            if (obs.type === 'puddle') drawObstacleImage(ctx, obs, puddleImg, puddleNightImg, 'rgba(0, 150, 255, 0.5)');
            else if (obs.type === 'pit') drawObstacleImage(ctx, obs, pitImg, pitNightImg, 'black');
            else if (obs.type === 'rock') drawObstacleImage(ctx, obs, rockImg, rockNightImg, '#888');
            else if (obs.type === 'barrel') drawObstacleImage(ctx, obs, barrelImg, barrelNightImg, '#c97b2a');
            else if (obs.type === 'cactus') drawObstacleImage(ctx, obs, cactusImg, cactusNightImg, '#2e8b3a');
        });
        
        if (isPitDeathDelayRef.current) {
            let fadeProgress;
            const a = pitAudioRef.current;
            if (a && isFinite(a.duration) && a.duration > 0.1) fadeProgress = Math.min(1, a.currentTime / a.duration);
            else fadeProgress = Math.min(1, pitDeathDelayTimerRef.current / 180);
            ctx.fillStyle = `rgba(0, 0, 0, ${fadeProgress})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    };

    const startGame = () => resetGame();
    const formatScore = (num) => num.toString().padStart(5, '0');
    const getHearts = () => {
        let h = [];
        for (let i = 0; i < 3; i++) {
            if (health >= (i + 1) * 2) h.push('❤️');
            else if (health === i * 2 + 1) h.push('💔');
            else h.push('🖤');
        }
        return h.join(' ');
    };

    const renderCharacterPanel = () => React.createElement('div', { className: 'char-panel' },
        React.createElement('div', { className: 'char-panel-title' }, 'Hero'),
        Object.values(CHARACTERS).map(char =>
            React.createElement('button', {
                key: char.id,
                className: `char-btn ${character === char.id ? 'active' : ''}`,
                onClick: () => setCharacter(char.id),
                title: char.name
            },
                React.createElement('span', { className: 'char-emoji' }, char.emoji || '❓'),
                React.createElement('span', { className: 'char-name' }, char.name)
            )
        )
    );

    return React.createElement('div', { id: 'game-container' },
        
        (gameState === 'playing' || gameState === 'paused') ? React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'hud-left' }, 
                React.createElement('span', null, `FOOD: ${playerRef.current.foodEaten} / ${playerRef.current.foodTarget}`),
                React.createElement('span', { style: { fontSize: 'clamp(14px, 2.5vmin, 24px)', letterSpacing: '2px' } }, getHearts())
            ),
            React.createElement('div', { className: 'hud-right' }, 
                React.createElement('span', { style: {color: '#FFD700'} }, `PWR x${powerDisplay}`),
                React.createElement('span', { style: {color: '#FF00FF'} }, `${speedDisplay === 'REVERSE' ? '◄◄ REV' : `SPD x${speedDisplay}`}`),
                React.createElement('span', null, `HI ${formatScore(highScore)}  ${formatScore(score)}m`)
            )
        ) : null,

        React.createElement('canvas', { ref: canvasRef, width: 1200, height: 600 }),

        gameState === 'playing' ? React.createElement(React.Fragment, null,
            React.createElement('button', { id: 'btn-fullscreen', className: 'game-btn', onClick: toggleFullscreen, 'aria-label': 'Fullscreen' }, '⛶'),
            React.createElement('button', { id: 'btn-pause', className: 'game-btn', onClick: () => setGameState('paused'), 'aria-label': 'Pause' }, '❚❚')
        ) : null,
        
        gameState === 'menu' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title' }, 'LACOSTE', React.createElement('br'), 'RUNNER'),
            React.createElement('div', { className: 'subtitle' }, 'VICE CITY EDITION'),

            renderCharacterPanel(),
            
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
                React.createElement('button', { className: 'btn', onClick: toggleFullscreen }, '⛶ На весь экран')
            ),

            React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'Start Escape'),
            React.createElement('div', { style: { marginTop: '10px' } },
                React.createElement('p', { style: {color: '#888', fontSize: '12px'} }, 'Tap / Space — jump, HOLD — high jump!'),
                React.createElement('p', { style: {color: '#FFD700', fontSize: '12px'} }, 'Eat food to grow stronger!'),
                React.createElement('p', { style: {color: '#FF007F', fontSize: '12px'} }, 'Avoid pits — instant death!')
            )
        ) : null,

        gameState === 'paused' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title', style: { color: '#00FFFF', textShadow: '2px 2px 0px #FF007F' } }, 'PAUSED'),
            React.createElement('button', { className: 'btn btn-start', onClick: () => setGameState('playing'), style: { marginBottom: '10px' } }, 'Resume'),
            React.createElement('div', { className: 'settings' },
                React.createElement('button', { className: 'btn', onClick: toggleFullscreen }, '⛶ Fullscreen'),
                React.createElement('button', { className: 'btn', onClick: () => resetGame() }, 'Restart'),
                React.createElement('button', { className: 'btn', onClick: () => setGameState('menu') }, 'Menu')
            )
        ) : null,
        
        gameState === 'gameover' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title', style: {color: 'red', textShadow: '2px 2px 0px #000'} }, 'BUSTED'),
            React.createElement('div', { className: 'subtitle', style: {color: 'white', marginBottom: '10px'} }, 'The employees caught you!'),
            React.createElement('div', { className: 'subtitle' }, 'DIST: ', Math.floor(score), 'm | HI: ', highScore, 'm'),

            renderCharacterPanel(),

            React.createElement('div', { className: 'settings' },
                React.createElement('button', { className: 'btn', onClick: toggleFullscreen }, '⛶ Fullscreen'),
                React.createElement('button', { className: 'btn', onClick: () => setGameState('menu') }, 'Menu'),
                React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'Try Again')
            )
        ) : null
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(Game));
