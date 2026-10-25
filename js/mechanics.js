window.GameMechanics = {
    calculateJumpMultiplier: function(playerHeight, gameSpeed, penalty = 1.0) {
        const { BASE_HEIGHT } = window.GameConfig;
        const sizeFactor = Math.sqrt(playerHeight / BASE_HEIGHT);
        const speedFactor = 1 + (gameSpeed - 1) * 0.10;
        return Math.max(1.0, sizeFactor * speedFactor * penalty);
    },

    updateLogic: function(refs, difficulty, actions) {
        const { 
            canvasRef, playerRef, obstaclesRef, foodsRef, explosionsRef, 
            distanceRef, spawnTimerRef, foodTimerRef, bgOffsetRef, spawnCooldownRef,
            healthRef, isTrippingRef, tripTimerRef, speedPenaltyRef, isBarrelTripRef, 
            pendingBarrelDamageRef, isBarrelFlyingRef, barrelFlyVelocityYRef, 
            isFallingIntoPitRef, pitTargetRef, pitFallTimerRef, pitVelocityRef, 
            isPitDeathDelayRef, pitDeathDelayTimerRef, currentFrameRef, lastFrameTimeRef,
            pitAudioRef, pitAudioEndedRef, barrelAudioRef
        } = refs;

        const { setSpeedDisplay, setPowerDisplay, setScore, setHealth, handleGameOver, handleHit, handleBarrelHit } = actions;
        const { GRAVITY, JUMP_FORCE, HOLD_THRUST, GROUND_Y, BASE_SPEED, FRAME_COUNT } = window.GameConfig;
        
        const canvas = canvasRef.current;
        const p = playerRef.current;

        const diffMult = difficulty === 'easy' ? 0.55 : difficulty === 'medium' ? 1.125 : 1.5;
        
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

        const currentPower = window.GameMechanics.calculateJumpMultiplier(p.height, baseSpeedMult, speedPenaltyRef.current); 
        setPowerDisplay(currentPower.toFixed(2));

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
                currentFrameRef.current = (currentFrameRef.current + 1) % FRAME_COUNT; lastFrameTimeRef.current = now;
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
    }
};
