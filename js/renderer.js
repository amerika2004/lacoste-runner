window.GameRenderer = {
    draw: function(ctx, canvas, refs, timeOfDay, FLIP_CROC) {
        const { 
            playerRef, bgOffsetRef, explosionsRef, foodsRef, obstaclesRef, 
            pitTargetRef, currentFrameRef, isFallingIntoPitRef, isPitDeathDelayRef, 
            isBarrelFlyingRef, isTrippingRef, isBarrelTripRef, tripTimerRef, 
            pitDeathDelayTimerRef, pitAudioRef, images 
        } = refs;

        const { GROUND_Y } = window.GameConfig;
        
        const p = playerRef.current;
        const pickImg = (dayImg, nightImg) => timeOfDay === 'night' ? nightImg.current : dayImg.current;
        const drawObstacleImage = (obs, dayImg, nightImg, fallbackColor) => {
            const img = pickImg(dayImg, nightImg);
            if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, obs.x, obs.y, obs.width, obs.height);
            else { ctx.fillStyle = fallbackColor; ctx.fillRect(obs.x, obs.y, obs.width, obs.height); }
        };

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const bgImg = pickImg(images.landscape, images.landscapeNight);
        if (bgImg.complete && bgImg.naturalWidth > 0) {
            const scale = canvas.height / bgImg.naturalHeight; const exactWidth = Math.ceil(bgImg.naturalWidth * scale);
            let offsetX = Math.floor(bgOffsetRef.current % exactWidth);
            if (offsetX > 0) offsetX -= exactWidth;
            for (let i = offsetX; i < canvas.width; i += exactWidth) ctx.drawImage(bgImg, i, 0, exactWidth, canvas.height);
        } else {
            ctx.fillStyle = timeOfDay === 'night' ? '#0a0512' : '#1a0b2e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        if ((isFallingIntoPitRef.current || isPitDeathDelayRef.current) && pitTargetRef.current) {
            const obs = pitTargetRef.current; const pitDrawImg = pickImg(images.pit, images.pitNight);
            if (pitDrawImg.complete && pitDrawImg.naturalWidth > 0) ctx.drawImage(pitDrawImg, obs.x, obs.y, obs.width, obs.height);
            else { ctx.fillStyle = 'black'; ctx.beginPath(); ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2); ctx.fill(); }
        }

        const crocImg = images.walkFrames.current[currentFrameRef.current];
        if (isFallingIntoPitRef.current || isPitDeathDelayRef.current) {
            if (crocImg && crocImg.complete && crocImg.naturalWidth > 0) {
                ctx.save(); ctx.beginPath(); ctx.rect(0, 0, canvas.width, GROUND_Y); ctx.clip();
                ctx.save(); const centerX = p.x + p.width / 2; const centerY = p.y + p.height / 2;
                ctx.translate(centerX, centerY); ctx.rotate(p.tilt); if (FLIP_CROC) ctx.scale(-1, 1);
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
                    let dir = isBarrelTripRef.current ? (FLIP_CROC ? 1 : -1) : (FLIP_CROC ? -1 : 1);
                    fallAngle = dir * (Math.PI / 2) * flatAmount; yOffset = -((p.width - p.height) / 2) * flatAmount;
                    if (Math.floor(tripTimerRef.current / 10) % 2 === 1) ctx.globalAlpha = 0.5;
                }
                const centerX = p.x + p.width / 2; const centerY = p.y + p.height / 2 + (p.isJumping ? 0 : (isTrippingRef.current ? yOffset : p.bob));
                ctx.translate(centerX, centerY); ctx.rotate(p.tilt + fallAngle + flyTilt);
                if (FLIP_CROC) ctx.scale(-1, 1); 
                ctx.drawImage(crocImg, -p.width / 2, -p.height / 2, p.width, p.height); ctx.restore();
            } else { ctx.fillStyle = 'red'; ctx.fillRect(p.x, p.y, p.width, p.height); }
        }

        explosionsRef.current.forEach(expl => {
            const progress = expl.timer / expl.maxTimer; const scale = 1 + progress * 0.5; const alpha = 1 - progress; const size = expl.size * scale;
            const x = expl.x - size / 2; const y = expl.y - size / 2;
            if (images.explosion.current.complete && images.explosion.current.naturalWidth > 0) {
                ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(images.explosion.current, x, y, size, size); ctx.restore();
            } else {
                ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = 'orange'; ctx.beginPath(); ctx.arc(expl.x, expl.y, size / 2, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'yellow'; ctx.beginPath(); ctx.arc(expl.x, expl.y, size / 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            }
        });

        ctx.textBaseline = 'bottom';
        foodsRef.current.forEach(food => { ctx.font = `40px Arial`; ctx.fillText(food.emoji, food.x, food.y + food.height); });

        obstaclesRef.current.forEach(obs => {
            if ((isFallingIntoPitRef.current || isPitDeathDelayRef.current) && obs === pitTargetRef.current) return;
            if (obs.type === 'puddle') drawObstacleImage(obs, images.puddle, images.puddleNight, 'rgba(0, 150, 255, 0.5)');
            else if (obs.type === 'pit') drawObstacleImage(obs, images.pit, images.pitNight, 'black');
            else if (obs.type === 'rock') drawObstacleImage(obs, images.rock, images.rockNight, '#888');
            else if (obs.type === 'barrel') drawObstacleImage(obs, images.barrel, images.barrelNight, '#c97b2a');
            else if (obs.type === 'cactus') drawObstacleImage(obs, images.cactus, images.cactusNight, '#2e8b3a');
        });
        
        if (isPitDeathDelayRef.current) {
            let fadeProgress;
            const a = pitAudioRef.current;
            if (a && isFinite(a.duration) && a.duration > 0.1) fadeProgress = Math.min(1, a.currentTime / a.duration);
            else fadeProgress = Math.min(1, pitDeathDelayTimerRef.current / 180);
            ctx.fillStyle = `rgba(0, 0, 0, ${fadeProgress})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }
};
