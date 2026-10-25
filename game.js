const { useState, useEffect, useRef, useCallback } = React;

const FLIP_CROC = false; 

// === НАСТРОЙКИ ФИЗИКИ ===
const GRAVITY = 0.75;        
const JUMP_FORCE = -10.5;    
const HOLD_THRUST = 0.45;    
const BASE_HEIGHT = 110.3;   

const GROUND_Y = 530; 
const BASE_SPEED = 4.0; 
const FRAME_COUNT = 12; 

function Game() {
    const [gameState, setGameState] = useState('menu');
    const [timeOfDay, setTimeOfDay] = useState(() => {
        return localStorage.getItem('lacosteTimeOfDay') || 'day';
    });
    const [score, setScore] = useState(0);
    const [speedDisplay, setSpeedDisplay] = useState(1.0); 
    const [powerDisplay, setPowerDisplay] = useState(1.0);
    const [health, setHealth] = useState(6);
    const [highScore, setHighScore] = useState(() => {
        return parseInt(localStorage.getItem('lacosteHighScore')) || 0;
    });

    const canvasRef = useRef(null);
    const requestRef = useRef();

    // Режим день/ночь через ref (чтобы читать свежее значение в RAF)
    const timeOfDayRef = useRef(timeOfDay);

    useEffect(() => {
        timeOfDayRef.current = timeOfDay;
        localStorage.setItem('lacosteTimeOfDay', timeOfDay);
    }, [timeOfDay]);
    
    const playerRef = useRef({
        x: 100,
        y: GROUND_Y - 110.3, 
        width: 165.4,        
        height: 110.3,       
        velocityY: 0,
        isJumping: false,
        isHoldingJump: false,
        jumpMult: 1.0,
        tilt: 0, 
        bob: 0,
        foodEaten: 0,
        foodTarget: 1
    });
    
    const obstaclesRef = useRef([]);
    const foodsRef = useRef([]);
    const explosionsRef = useRef([]);
    
    const distanceRef = useRef(0);
    const speedMultiplierRef = useRef(1.0);
    const spawnTimerRef = useRef(0);
    const foodTimerRef = useRef(0);
    const bgOffsetRef = useRef(0); 

    // Карантин спавна после взрыва бочки
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

    // === ИЗОБРАЖЕНИЯ (день / ночь) ===
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
            const img = new Image();
            img.src = `source/walk_animation/${i}.png`; 
            walkFramesRef.current.push(img);
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

    // Сила учитывает penalty и не падает ниже базового значения 1.0
    const calculateJumpMultiplier = (playerHeight, gameSpeed, penalty = 1.0) => {
        const sizeFactor = Math.sqrt(playerHeight / BASE_HEIGHT);
        const speedFactor = 1 + (gameSpeed - 1) * 0.10;
        return Math.max(1.0, sizeFactor * speedFactor * penalty);
    };

    const handleKeyDown = useCallback((e) => {
        // >>> ПАУЗА / RESUME по Escape
        if (e.code === 'Escape') {
            e.preventDefault();
            if (gameState === 'playing') setGameState('paused');
            else if (gameState === 'paused') setGameState('playing');
            return;
        }

        // Переключение день/ночь по клавише N
        if (e.code === 'KeyN') {
            e.preventDefault();
            setTimeOfDay(prev => prev === 'day' ? 'night' : 'day');
            return;
        }

        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            if (gameState === 'menu') {
                setGameState('playing');
            } else if (gameState === 'gameover') {
                resetGame();
            } else if (gameState === 'playing' && !playerRef.current.isJumping && !isTrippingRef.current && !isFallingIntoPitRef.current && !isPitDeathDelayRef.current && !isBarrelFlyingRef.current) {
                // >>> gameState === 'playing' — чтобы не прыгать в паузе
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
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            playerRef.current.isHoldingJump = false;
        }
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown, handleKeyUp]);

    // >>> МОБИЛЬНАЯ АДАПТАЦИЯ: тап по канвасу = прыжок
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleTouchStart = (e) => {
            e.preventDefault();
            if (gameState !== 'playing') return;
            if (playerRef.current.isJumping) return;
            if (isTrippingRef.current || isFallingIntoPitRef.current ||
                isPitDeathDelayRef.current || isBarrelFlyingRef.current) return;

            const p = playerRef.current;
            const baseMult = 1.0 + Math.floor(distanceRef.current / 100) * 0.04;
            p.jumpMult = calculateJumpMultiplier(p.height, baseMult, speedPenaltyRef.current);
            p.velocityY = JUMP_FORCE * p.jumpMult;
            p.isJumping = true;
            p.isHoldingJump = true;
        };

        const handleTouchEnd = (e) => {
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

    const resetGame = () => {
        playerRef.current = {
            x: 100, y: GROUND_Y - 110.3, width: 165.4, height: 110.3,
            velocityY: 0, isJumping: false, isHoldingJump: false, jumpMult: 1.0,
            tilt: 0, bob: 0, foodEaten: 0, foodTarget: 1 
        };
        obstaclesRef.current = [];
        foodsRef.current = [];
        explosionsRef.current = [];
        distanceRef.current = 0;
        speedMultiplierRef.current = 1.0;
        spawnTimerRef.current = 0;
        foodTimerRef.current = 0;
        bgOffsetRef.current = 0;
        currentFrameRef.current = 0; 
        
        spawnCooldownRef.current = 0;

        healthRef.current = 6;
        setHealth(6);
        isTrippingRef.current = false;
        tripTimerRef.current = 0;
        speedPenaltyRef.current = 1.0;
        
        isBarrelTripRef.current = false;
        pendingBarrelDamageRef.current = false;
        isBarrelFlyingRef.current = false;
        barrelFlyVelocityYRef.current = 0;
        
        isFallingIntoPitRef.current = false;
        pitTargetRef.current = null;
        pitFallTimerRef.current = 0;
        pitVelocityRef.current = 0;
        
        isPitDeathDelayRef.current = false;
        pitDeathDelayTimerRef.current = 0;

        setScore(0);
        setSpeedDisplay(1.0);
        setPowerDisplay(1.0);
        setGameState('playing');
    };

    const handleGameOver = () => {
        setGameState('gameover');
        if (Math.floor(distanceRef.current) > highScore) {
            const newHigh = Math.floor(distanceRef.current);
            setHighScore(newHigh);
            localStorage.setItem('lacosteHighScore', newHigh);
        }
    };

    const handleHit = (index) => {
        if (isTrippingRef.current) return;
        
        obstaclesRef.current.splice(index, 1);
        
        healthRef.current -= 1;
        setHealth(healthRef.current);
        
        if (healthRef.current <= 0) {
            handleGameOver();
            return;
        }
        
        isTrippingRef.current = true;
        tripTimerRef.current = 0;
        isBarrelTripRef.current = false;
        
        const p = playerRef.current;
        p.y = GROUND_Y - p.height;
        p.velocityY = 0;
        p.isJumping = false;
        p.tilt = 0;
        
        speedPenaltyRef.current = speedPenaltyRef.current * 0.65;
    };

    // === БОЧКА: ВЗРЫВ + ОТЛЁТ ===
    const handleBarrelHit = (index) => {
        if (isTrippingRef.current || isBarrelFlyingRef.current) return;
        
        const obs = obstaclesRef.current[index];
        if (!obs) return;
        
        const canvas = canvasRef.current;
        const p = playerRef.current;
        
        const explSize = obs.height * 6;
        explosionsRef.current.push({
            x: obs.x + obs.width / 2,
            y: obs.y + obs.height / 2,
            size: explSize,
            timer: 0,
            maxTimer: 30
        });
        
        obstaclesRef.current.splice(index, 1);
        
        obstaclesRef.current = obstaclesRef.current.filter(o => 
            (o.x + o.width) > p.x &&
            o.x < canvas.width
        );
        
        foodsRef.current = foodsRef.current.filter(f => f.x < canvas.width);

        spawnCooldownRef.current = 90;
        spawnTimerRef.current = 0;
        
        isBarrelFlyingRef.current = true;
        isBarrelTripRef.current = true;
        barrelFlyVelocityYRef.current = -20;
        
        p.velocityY = 0;
        p.isJumping = false;
        p.isHoldingJump = false;
        p.tilt = 0;
    };

    const updateGame = () => {
        if (gameState !== 'playing') return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const p = playerRef.current;
        
        if (isFallingIntoPitRef.current) {
            pitFallTimerRef.current++;
            
            pitVelocityRef.current += 0.2;
            p.y += pitVelocityRef.current;
            
            if (p.y > GROUND_Y + 30 || pitFallTimerRef.current > 400) {
                isFallingIntoPitRef.current = false;
                isPitDeathDelayRef.current = true;
                pitDeathDelayTimerRef.current = 0;
            }
            
            draw(ctx, canvas);
            requestRef.current = requestAnimationFrame(updateGame);
            return;
        }
        
        if (isPitDeathDelayRef.current) {
            pitDeathDelayTimerRef.current++;
            
            if (pitDeathDelayTimerRef.current > 180) {
                isPitDeathDelayRef.current = false;
                handleGameOver();
                return;
            }
            
            draw(ctx, canvas);
            requestRef.current = requestAnimationFrame(updateGame);
            return;
        }
        
        if (isBarrelFlyingRef.current) {
            barrelFlyVelocityYRef.current += GRAVITY;
            p.y += barrelFlyVelocityYRef.current;
            
            p.tilt = Math.max(p.tilt - 0.03, -0.4);
            
            const backSpeed = 10;
            bgOffsetRef.current += backSpeed;
            obstaclesRef.current.forEach(o => { o.x += backSpeed; });
            foodsRef.current.forEach(f => { f.x += backSpeed; });
            
            setSpeedDisplay("REVERSE");
            
            if (p.y >= GROUND_Y - p.height) {
                p.y = GROUND_Y - p.height;
                isBarrelFlyingRef.current = false;
                barrelFlyVelocityYRef.current = 0;
                
                isTrippingRef.current = true;
                tripTimerRef.current = 0;
                pendingBarrelDamageRef.current = true;
                p.tilt = 0;
            }
            
            explosionsRef.current.forEach(e => e.timer++);
            explosionsRef.current = explosionsRef.current.filter(e => e.timer < e.maxTimer);
            
            draw(ctx, canvas);
            requestRef.current = requestAnimationFrame(updateGame);
            return;
        }
        
        if (isTrippingRef.current) {
            tripTimerRef.current++;
            
            if (pendingBarrelDamageRef.current && tripTimerRef.current >= 15) {
                pendingBarrelDamageRef.current = false;
                healthRef.current -= 1;
                setHealth(healthRef.current);
                speedPenaltyRef.current = speedPenaltyRef.current * 0.65;
                
                if (healthRef.current <= 0) {
                    handleGameOver();
                    return;
                }
            }
            
            if (tripTimerRef.current > 120) {
                isTrippingRef.current = false;
                tripTimerRef.current = 0;
            }
        }
        
        explosionsRef.current.forEach(e => e.timer++);
        explosionsRef.current = explosionsRef.current.filter(e => e.timer < e.maxTimer);

        const baseSpeedMult = 1.0 + Math.floor(distanceRef.current / 100) * 0.04;
        const effectiveSpeedMult = Math.max(1.0, baseSpeedMult * speedPenaltyRef.current);

        let currentSpeed = 0;
        if (!isTrippingRef.current) {
            currentSpeed = BASE_SPEED * effectiveSpeedMult;
            setSpeedDisplay(effectiveSpeedMult.toFixed(2));
            distanceRef.current += (currentSpeed * 0.03);
            setScore(Math.floor(distanceRef.current));
            bgOffsetRef.current -= currentSpeed;
        } else {
            setSpeedDisplay("0.00");
        }

        const currentPower = calculateJumpMultiplier(p.height, baseSpeedMult, speedPenaltyRef.current);
        setPowerDisplay(currentPower.toFixed(2));

        if (p.isJumping) {
            p.velocityY += GRAVITY;
            if (p.isHoldingJump) {
                p.velocityY -= HOLD_THRUST * p.jumpMult;
            }
            p.y += p.velocityY;

            p.tilt = p.velocityY * 0.025; 
            p.tilt = Math.max(-0.35, Math.min(0.35, p.tilt)); 

            if (p.y <= 0) {
                p.y = 0;
                if (p.velocityY < 0) p.velocityY = 0;
            }

            if (p.y >= GROUND_Y - p.height) {
                p.y = GROUND_Y - p.height;
                p.velocityY = 0;
                p.isJumping = false;
                p.tilt = 0; 
            }
        } else if (!isTrippingRef.current) {
            p.bob = Math.sin(Date.now() / 80) * 2.5; 
            p.tilt = 0;
        }

        if (!p.isJumping && !isTrippingRef.current) {
            const now = Date.now();
            const frameDelay = Math.max(30, 100 - (currentSpeed * 5)); 
            if (now - lastFrameTimeRef.current > frameDelay) {
                currentFrameRef.current = (currentFrameRef.current + 1) % FRAME_COUNT;
                lastFrameTimeRef.current = now;
            }
        }

        // === СПАВН ПРЕПЯТСТВИЙ И ЕДЫ ===
        if (!isTrippingRef.current) {
            if (spawnCooldownRef.current > 0) {
                spawnCooldownRef.current--;
                spawnTimerRef.current = 0;
            } else {
                spawnTimerRef.current++;

                let gapOk = true;
                for (let obs of obstaclesRef.current) {
                    if (obs.x + obs.width > canvas.width - 350) {
                        gapOk = false;
                        break;
                    }
                }

                if (gapOk && spawnTimerRef.current > Math.max(70, 140 - currentSpeed * 3) + Math.random() * 40) {
                    const types = ['barrel', 'rock', 'cactus', 'puddle', 'pit']; 
                    const randomType = types[Math.floor(Math.random() * types.length)];
                    
                    let width = 40, height = 40;
                    let yOffset = 0;

                    if (randomType === 'rock') { width = 120; height = 120; yOffset = 30; } 
                    if (randomType === 'cactus') { width = 70; height = 110; }
                    if (randomType === 'barrel') { width = 50; height = 60; }
                    if (randomType === 'puddle') { width = 120; height = 120; yOffset = 30; }
                    if (randomType === 'pit') { width = 140; height = 90; yOffset = 40; }

                    const powerTier = Math.max(0, Math.floor((currentPower - 1.0) / 0.3));
                    const maxScale = 1.0 + powerTier * 0.15;
                    const scale = 1.0 + Math.random() * (maxScale - 1.0);

                    width *= scale;
                    height *= scale;
                    yOffset *= scale;

                    obstaclesRef.current.push({
                        x: canvas.width,
                        y: GROUND_Y - height + yOffset, 
                        width: width, height: height, type: randomType
                    });
                    spawnTimerRef.current = 0;
                }
            }

            foodTimerRef.current++;
            if (foodTimerRef.current > 100 + Math.random() * 80) { 
                let isSafeToSpawn = true;
                for (let obs of obstaclesRef.current) {
                    if (obs.x + obs.width > canvas.width - 300) {
                        isSafeToSpawn = false;
                        break;
                    }
                }

                if (isSafeToSpawn) {
                    const foodEmojis = ['🍗', '🍔', '🍕', '🥩'];
                    const randomFood = foodEmojis[Math.floor(Math.random() * foodEmojis.length)];
                    const foodY = Math.random() > 0.5 ? GROUND_Y - 80 : GROUND_Y - 40;

                    foodsRef.current.push({
                        x: canvas.width,
                        y: foodY, 
                        width: 40, height: 40, emoji: randomFood
                    });
                    foodTimerRef.current = 0; 
                }
            }
        }

        obstaclesRef.current.forEach(obs => { obs.x -= currentSpeed; });
        obstaclesRef.current = obstaclesRef.current.filter(obs => obs.x + obs.width > 0);

        foodsRef.current.forEach(food => { food.x -= currentSpeed; });
        foodsRef.current = foodsRef.current.filter(food => food.x + food.width > 0);

        if (!isTrippingRef.current) {
            for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
                let obs = obstaclesRef.current[i];
                
                const hitboxX = p.x + p.width * 0.6; 
                const hitboxY = p.y + p.height * 0.4;
                const hitboxWidth = p.width * 0.25; 
                const hitboxHeight = p.height * 0.4; 

                let obsHitboxX = obs.x + 10;
                let obsHitboxWidth = obs.width - 20;
                let obsHitboxY = obs.y + 5;
                let obsHitboxHeight = obs.height - 5;

                if (obs.type === 'puddle') {
                    obsHitboxY = obs.y + obs.height * 0.5; 
                    obsHitboxHeight = obs.height * 0.5;
                } else if (obs.type === 'rock') {
                    obsHitboxY = obs.y + obs.height * 0.2;
                    obsHitboxHeight = obs.height * 0.8;
                } else if (obs.type === 'pit') {
                    const pitHitboxW = obs.width * 0.5;
                    const pitHitboxH = obs.height * 0.5;
                    obsHitboxX = obs.x + (obs.width - pitHitboxW) / 2 + obs.width * 0.35;
                    obsHitboxWidth = pitHitboxW;
                    obsHitboxY = obs.y + (obs.height - pitHitboxH) / 2;
                    obsHitboxHeight = pitHitboxH;
                } else if (obs.type === 'cactus') {
                    const pad = obs.width * 0.3;
                    obsHitboxX = obs.x + pad;
                    obsHitboxWidth = obs.width - pad * 2;
                }

                if (
                    hitboxX < obsHitboxX + obsHitboxWidth &&
                    hitboxX + hitboxWidth > obsHitboxX &&
                    hitboxY < obsHitboxY + obsHitboxHeight &&
                    hitboxY + hitboxHeight > obsHitboxY
                ) {
                    if (obs.type === 'pit') {
                        isFallingIntoPitRef.current = true;
                        pitTargetRef.current = obs;
                        pitFallTimerRef.current = 0;
                        pitVelocityRef.current = 0;
                        
                        p.velocityY = 0;
                        p.isJumping = false;
                        p.isHoldingJump = false;
                        
                        draw(ctx, canvas);
                        requestRef.current = requestAnimationFrame(updateGame);
                        return;
                    } else if (obs.type === 'barrel') {
                        handleBarrelHit(i);
                        break;
                    } else {
                        handleHit(i);
                        break;
                    }
                }
            }
        }

        foodsRef.current = foodsRef.current.filter(food => {
            const hitboxX = p.x + 20; 
            const hitboxY = p.y + 20;
            const hitboxWidth = p.width - 40;
            const hitboxHeight = p.height - 20;

            if (
                hitboxX < food.x + food.width &&
                hitboxX + hitboxWidth > food.x &&
                hitboxY < food.y + food.height &&
                hitboxY + hitboxHeight > food.y
            ) {
                p.foodEaten++;
                if (p.foodEaten >= p.foodTarget) {
                    p.width += 2;
                    p.height += 1.3;
                    p.y = GROUND_Y - p.height; 
                    p.foodEaten = 0;
                    p.foodTarget = p.foodTarget + 1;

                    healthRef.current = Math.min(6, healthRef.current + 1);
                    setHealth(healthRef.current);
                }
                return false; 
            }
            return true;
        });

        draw(ctx, canvas);
        requestRef.current = requestAnimationFrame(updateGame);
    };

    // === ХЕЛПЕР: выбор картинки по день/ночь ===
    const pickImg = (dayImg, nightImg) => {
        return timeOfDayRef.current === 'night' ? nightImg.current : dayImg.current;
    };

    // === ХЕЛПЕР: отрисовка препятствия-картинки с fallback-прямоугольником ===
    const drawObstacleImage = (ctx, obs, dayImg, nightImg, fallbackColor) => {
        const img = pickImg(dayImg, nightImg);
        if (img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, obs.x, obs.y, obs.width, obs.height);
        } else {
            ctx.fillStyle = fallbackColor;
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        }
    };

    const draw = (ctx, canvas) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const p = playerRef.current;

        // ФОН (день/ночь)
        const bgImg = pickImg(landscapeImg, landscapeNightImg);

        if (bgImg.complete && bgImg.naturalWidth > 0) {
            const scale = canvas.height / bgImg.naturalHeight;
            const exactWidth = Math.ceil(bgImg.naturalWidth * scale);
            
            let offsetX = Math.floor(bgOffsetRef.current % exactWidth);
            if (offsetX > 0) offsetX -= exactWidth;

            for (let i = offsetX; i < canvas.width; i += exactWidth) {
                ctx.drawImage(bgImg, i, 0, exactWidth, canvas.height);
            }
        } else {
            ctx.fillStyle = timeOfDayRef.current === 'night' ? '#0a0512' : '#1a0b2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Яма (когда крокодил уже падает)
        if ((isFallingIntoPitRef.current || isPitDeathDelayRef.current) && pitTargetRef.current) {
            const obs = pitTargetRef.current;
            const pitDrawImg = pickImg(pitImg, pitNightImg);
            if (pitDrawImg.complete && pitDrawImg.naturalWidth > 0) {
                ctx.drawImage(pitDrawImg, obs.x, obs.y, obs.width, obs.height);
            } else {
                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // КРОКОДИЛ
        const crocImg = walkFramesRef.current[currentFrameRef.current];
        
        if (isFallingIntoPitRef.current || isPitDeathDelayRef.current) {
            if (crocImg && crocImg.complete && crocImg.naturalWidth > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, canvas.width, GROUND_Y);
                ctx.clip();
                ctx.save();
                const centerX = p.x + p.width / 2;
                const centerY = p.y + p.height / 2;
                ctx.translate(centerX, centerY);
                ctx.rotate(p.tilt);
                if (FLIP_CROC) ctx.scale(-1, 1);
                ctx.drawImage(crocImg, -p.width / 2, -p.height / 2, p.width, p.height);
                ctx.restore();
                ctx.restore();
            }
        } else {
            if (crocImg && crocImg.complete && crocImg.naturalWidth > 0) {
                ctx.save();
                
                let fallAngle = 0;
                let yOffset = 0;
                let flyTilt = 0;

                if (isBarrelFlyingRef.current) {
                    flyTilt = p.tilt;
                }

                if (isTrippingRef.current) {
                    const fallProgress = Math.min(1, tripTimerRef.current / 15);
                    const standProgress = Math.max(0, (tripTimerRef.current - 40) / 80);
                    
                    const flatAmount = fallProgress * (1 - standProgress);
                    
                    let dir;
                    if (isBarrelTripRef.current) {
                        dir = FLIP_CROC ? 1 : -1;
                    } else {
                        dir = FLIP_CROC ? -1 : 1;
                    }
                    
                    fallAngle = dir * (Math.PI / 2) * flatAmount;
                    yOffset = -((p.width - p.height) / 2) * flatAmount;
                    
                    if (Math.floor(tripTimerRef.current / 10) % 2 === 1) {
                        ctx.globalAlpha = 0.5;
                    }
                }

                const centerX = p.x + p.width / 2;
                const centerY = p.y + p.height / 2 + (p.isJumping ? 0 : (isTrippingRef.current ? yOffset : p.bob));
                
                ctx.translate(centerX, centerY);
                ctx.rotate(p.tilt + fallAngle + flyTilt);
                if (FLIP_CROC) ctx.scale(-1, 1); 
                
                ctx.drawImage(crocImg, -p.width / 2, -p.height / 2, p.width, p.height);
                ctx.restore();
            } else {
                ctx.fillStyle = 'red';
                ctx.fillRect(p.x, p.y, p.width, p.height);
            }
        }

        // ВЗРЫВЫ
        explosionsRef.current.forEach(expl => {
            const progress = expl.timer / expl.maxTimer;
            const scale = 1 + progress * 0.5;
            const alpha = 1 - progress;
            const size = expl.size * scale;
            const x = expl.x - size / 2;
            const y = expl.y - size / 2;
            
            if (explosionImg.current.complete && explosionImg.current.naturalWidth > 0) {
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.drawImage(explosionImg.current, x, y, size, size);
                ctx.restore();
            } else {
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = 'orange';
                ctx.beginPath();
                ctx.arc(expl.x, expl.y, size / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'yellow';
                ctx.beginPath();
                ctx.arc(expl.x, expl.y, size / 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        });

        // ЕДА
        ctx.textBaseline = 'bottom';
        foodsRef.current.forEach(food => {
            ctx.font = `40px Arial`; 
            ctx.fillText(food.emoji, food.x, food.y + food.height);
        });

        // ПРЕПЯТСТВИЯ
        obstaclesRef.current.forEach(obs => {
            if ((isFallingIntoPitRef.current || isPitDeathDelayRef.current) && obs === pitTargetRef.current) return;
            
            if (obs.type === 'puddle') {
                drawObstacleImage(ctx, obs, puddleImg, puddleNightImg, 'rgba(0, 150, 255, 0.5)');
            } else if (obs.type === 'pit') {
                drawObstacleImage(ctx, obs, pitImg, pitNightImg, 'black');
            } else if (obs.type === 'rock') {
                drawObstacleImage(ctx, obs, rockImg, rockNightImg, '#888');
            } else if (obs.type === 'barrel') {
                drawObstacleImage(ctx, obs, barrelImg, barrelNightImg, '#c97b2a');
            } else if (obs.type === 'cactus') {
                drawObstacleImage(ctx, obs, cactusImg, cactusNightImg, '#2e8b3a');
            }
        });
        
        if (isPitDeathDelayRef.current) {
            const fadeProgress = Math.min(1, pitDeathDelayTimerRef.current / 180);
            ctx.fillStyle = `rgba(0, 0, 0, ${fadeProgress * 0.85})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    };

    // >>> RAF-цикл: останавливается при паузе (gameState !== 'playing')
    useEffect(() => {
        if (gameState === 'playing') {
            requestRef.current = requestAnimationFrame(updateGame);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [gameState]);

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

    return React.createElement('div', { id: 'game-container' },
        
        React.createElement('div', { 
            style: { 
                position: 'absolute', top: '20px', left: '20px',
                fontFamily: "'Courier New', Courier, monospace", 
                fontSize: '20px', color: '#00FF41',
                textShadow: '2px 2px 0 #000', zIndex: 10, letterSpacing: '1px',
                display: 'flex', flexDirection: 'column', gap: '5px'
            } 
        }, 
            React.createElement('span', null, `FOOD: ${playerRef.current.foodEaten} / ${playerRef.current.foodTarget}`),
            React.createElement('span', { style: { fontSize: '28px', letterSpacing: '5px', marginTop: '5px' } }, getHearts())
        ),

        React.createElement('div', { 
            style: { 
                position: 'absolute', top: '20px', right: '20px', 
                fontFamily: "'Courier New', Courier, monospace", 
                fontSize: '22px', color: '#ff007f', 
                textShadow: '2px 2px 0 #000', zIndex: 10, letterSpacing: '2px',
                display: 'flex', gap: '20px'
            } 
        }, 
            React.createElement('span', { style: {color: '#FFD700'} }, `POWER x${powerDisplay}`),
            React.createElement('span', { style: {color: '#FF00FF'} }, `${speedDisplay === 'REVERSE' ? '◄◄ REVERSE' : `SPEED x${speedDisplay}`}`),
            React.createElement('span', null, `HI ${formatScore(highScore)}  ${formatScore(score)}m`)
        ),

        React.createElement('canvas', { ref: canvasRef, width: 1200, height: 600 }),

        // >>> Кнопка паузы (только во время игры)
        gameState === 'playing' ? React.createElement('button', {
            className: 'pause-btn',
            onClick: () => setGameState('paused'),
            'aria-label': 'Pause'
        }, '❚❚') : null,
        
        gameState === 'menu' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title' }, 'LACOSTE', React.createElement('br'), 'RUNNER'),
            React.createElement('div', { className: 'subtitle' }, 'VICE CITY EDITION'),
            React.createElement('div', { className: 'settings', style: { marginTop: '10px' } },
                React.createElement('button',
                    { className: `btn ${timeOfDay === 'day' ? 'active' : ''}`, onClick: () => setTimeOfDay('day') },
                    '☀️ Day'
                ),
                React.createElement('button',
                    { className: `btn ${timeOfDay === 'night' ? 'active' : ''}`, onClick: () => setTimeOfDay('night') },
                    '🌙 Night'
                )
            ),
            React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'Start Escape'),
            React.createElement('p', { style: {marginTop: '20px', color: '#888', fontSize: '16px'} }, 'Tap / Space — jump, HOLD — high jump!'),
            React.createElement('p', { style: {color: '#FFD700', fontSize: '14px'} }, 'Eat food to grow stronger, jump higher and heal!'),
            React.createElement('p', { style: {color: '#FF007F', fontSize: '14px'} }, 'Avoid pits — they are instant death!'),
            React.createElement('p', { style: {color: '#888', fontSize: '12px'} }, 'Press N or use menu to switch Day / Night')
        ) : null,

        // >>> Оверлей паузы
        gameState === 'paused' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title', style: { color: '#00FFFF', textShadow: '4px 4px 0px #FF007F' } }, 'PAUSED'),
            React.createElement('div', { className: 'subtitle' }, 'Take a breath'),
            React.createElement('button', {
                className: 'btn btn-start',
                onClick: () => setGameState('playing'),
                style: { marginBottom: '20px' }
            }, 'Resume'),
            React.createElement('div', { className: 'settings' },
                React.createElement('button', {
                    className: 'btn',
                    onClick: () => resetGame()
                }, 'Restart'),
                React.createElement('button', {
                    className: 'btn',
                    onClick: () => setGameState('menu')
                }, 'Menu')
            ),
            React.createElement('p', { style: {marginTop: '20px', color: '#888', fontSize: '14px'} }, 'Press ESC or tap Resume to continue')
        ) : null,
        
        gameState === 'gameover' ? React.createElement('div', { className: 'menu-overlay' },
            React.createElement('div', { className: 'title', style: {color: 'red', textShadow: '4px 4px 0px #000'} }, 'BUSTED'),
            React.createElement('div', { className: 'subtitle', style: {color: 'white'} }, 'The employees caught you!'),
            React.createElement('div', { className: 'subtitle' }, 'DISTANCE: ', Math.floor(score), 'm | HI: ', highScore, 'm'),
            React.createElement('button', { className: 'btn btn-start', onClick: startGame }, 'Try Again')
        ) : null
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(Game));
