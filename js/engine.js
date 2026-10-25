window.GameEngine = (() => {
    const { GRAVITY, JUMP_FORCE, HOLD_THRUST, GROUND_Y, BASE_SPEED, calculateJumpMultiplier, pickImg } = window.GameUtils;

    const create = (params) => {
        const {
            refs, stateSetters, assets, audioRefs, onGameOver
        } = params;

        const {
            playerRef, obstaclesRef, foodsRef, explosionsRef, distanceRef, speedMultiplierRef,
            spawnTimerRef, foodTimerRef, bgOffsetRef, spawnCooldownRef, healthRef, isTrippingRef,
            tripTimerRef, speedPenaltyRef, isBarrelTripRef, pendingBarrelDamageRef, isBarrelFlyingRef,
            barrelFlyVelocityYRef, isFallingIntoPitRef, pitTargetRef, pitFallTimerRef, pitVelocityRef,
            isPitDeathDelayRef, pitDeathDelayTimerRef, walkFramesRef, currentFrameRef, lastFrameTimeRef,
            difficultyRef, timeOfDayRef
        } = refs;

        const { setScore, setSpeedDisplay, setPowerDisplay, setHealth } = stateSetters;
        const { landscapeImg, landscapeNightImg, puddleImg, puddleNightImg, rockImg, rockNightImg,
            pitImg, pitNightImg, barrelImg, barrelNightImg, cactusImg, cactusNightImg, explosionImg } = assets;
        const { pitAudioRef, pitAudioEndedRef, barrelAudioRef } = audioRefs;

        const handleHit = (index) => {
            if (isTrippingRef.current) return;
            obstaclesRef.current.splice(index, 1);
            healthRef.current -= 1; setHealth(healthRef.current);
            if (healthRef.current <= 0) { onGameOver(); return; }
            
            isTrippingRef.current = true; tripTimerRef.current = 0; isBarrelTripRef.current = false;
            const p = playerRef.current;
            p.y = GROUND_Y - p.height; p.velocityY = 0; p.isJumping = false; p.tilt = 0;
            speedPenaltyRef.current = speedPenaltyRef.current * 0.65;
        };

        const handleBarrelHit = (index) => {
            if (isTrippingRef.current || isBarrelFlyingRef.current) return;
            const obs = obstaclesRef.current[index]; if (!obs) return;
            const canvas = refs.canvasRef.current; const p = playerRef.current;
            
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
            const canvas = refs.canvasRef.current;
            const p = playerRef.current;
            const diff = difficultyRef.current;
            const diffMult = diff === 'easy' ? 0.55 : diff === 'medium' ? 1.125 : 1.5;
            
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
                    isPitDeathDelayRef.current = false; onGameOver(); return;
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
                    if (healthRef.current <= 0) { onGameOver(); return; }
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
                    currentFrameRef.current = (currentFrameRef.current + 1) % window.GameUtils.FRAME_COUNT; lastFrameTimeRef.current = now;
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

        const draw = (ctx, canvas) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const p = playerRef.current;
            const bgImg = pickImg(timeOfDayRef.current, landscapeImg, landscapeNightImg);

            if (bgImg.complete && bgImg.naturalWidth > 0) {
                const scale = canvas.height / bgImg.naturalHeight; const exactWidth = Math.ceil(bgImg.naturalWidth * scale);
                let offsetX = Math.floor(bgOffsetRef.current % exactWidth);
                if (offsetX > 0) offsetX -= exactWidth;
                for (let i = offsetX; i < canvas.width; i += exactWidth) ctx.drawImage(bgImg, i, 0, exactWidth, canvas.height);
            } else {
                ctx.fillStyle = timeOfDayRef.current === 'night' ? '#0a0512' : '#1a0b2e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            if ((isFallingIntoPitRef.current || isPitDeathDelayRef.current) && pitTargetRef.current) {
                const obs = pitTargetRef.current; const pitDrawImg = pickImg(timeOfDayRef.current, pitImg, pitNightImg);
                if (pitDrawImg.complete && pitDrawImg.naturalWidth > 0) ctx.drawImage(pitDrawImg, obs.x, obs.y, obs.width, obs.height);
                else { ctx.fillStyle = 'black'; ctx.beginPath(); ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2); ctx.fill(); }
            }

            const crocImg = walkFramesRef.current[currentFrameRef.current];
            if (isFallingIntoPitRef.current || isPitDeathDelayRef.current) {
                if (crocImg && crocImg.complete && crocImg.naturalWidth > 0) {
                    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, canvas.width, GROUND_Y); ctx.clip();
                    ctx.save(); const centerX = p.x + p.width / 2; const centerY = p.y + p.height / 2;
                    ctx.translate(centerX, centerY); ctx.rotate(p.tilt); if (false) ctx.scale(-1, 1);
                    ctx.drawImage(crocImg, -p.width / 2, -p.height / 2, p.width, p.height); ctx.restore(); ctx.restore();
                }
            } else {
                if (crocImg && crocImg.complete && crocImg.naturalWidth > 0) {
                    ctx.save();
                    let fallAngle = 0, yOffset = 0, flyTilt = 0;
                    if (isBarrelFlyingRef.current) flyTilt = p.tilt;
                    if (isTrippingRef.current) {
                        const fallProgress = Math.min(1, tripTimerRef.current / 15); const standProgress = Math.max(0, (tripTimerRef.current - 40) / 80);
                        const flatAmount = fallProgress * (1 - standProgress);
                        let dir = isBarrelTripRef.current ? (false ? 1 : -1) : (false ? -1 : 1);
                        fallAngle = dir * (Math.PI / 2) * flatAmount; yOffset = -((p.width - p.height) / 2) * flatAmount;
                        if (Math.floor(tripTimerRef.current / 10) % 2 === 1) ctx.globalAlpha = 0.5;
                    }
                    const centerX = p.x + p.width / 2; const centerY = p.y + p.height / 2 + (p.isJumping ? 0 : (isTrippingRef.current ? yOffset : p.bob));
                    ctx.translate(centerX, centerY); ctx.rotate(p.tilt + fallAngle + flyTilt);
                    if (false) ctx.scale(-1, 1); 
                    ctx.drawImage(crocImg, -p.width / 2, -p.height / 2, p.width, p.height); ctx.restore();
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
                
                const drawObstacle = (dayImg, nightImg, fallbackColor) => {
                    const img = pickImg(timeOfDayRef.current, dayImg, nightImg);
                    if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, obs.x, obs.y, obs.width, obs.height);
                    else { ctx.fillStyle = fallbackColor; ctx.fillRect(obs.x, obs.y, obs.width, obs.height); }
                };

                if (obs.type === 'puddle') drawObstacle(puddleImg, puddleNightImg, 'rgba(0, 150, 255, 0.5)');
                else if (obs.type === 'pit') drawObstacle(pitImg, pitNightImg, 'black');
                else if (obs.type === 'rock') drawObstacle(rockImg, rockNightImg, '#888');
                else if (obs.type === 'barrel') drawObstacle(barrelImg, barrelNightImg, '#c97b2a');
                else if (obs.type === 'cactus') drawObstacle(cactusImg, cactusNightImg, '#2e8b3a');
            });
            
            if (isPitDeathDelayRef.current) {
                let fadeProgress;
                const a = pitAudioRef.current;
                if (a && isFinite(a.duration) && a.duration > 0.1) fadeProgress = Math.min(1, a.currentTime / a.duration);
                else fadeProgress = Math.min(1, pitDeathDelayTimerRef.current / 180);
                ctx.fillStyle = `rgba(0, 0, 0, ${fadeProgress})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        };

        return { updateLogic, draw, handleHit, handleBarrelHit };
    };

    return { create };
})();
