window.GameUtils = (() => {
    const GRAVITY = 0.75;        
    const JUMP_FORCE = -10.5;    
    const HOLD_THRUST = 0.45;    
    const BASE_HEIGHT = 110.3;   
    const GROUND_Y = 530; 
    const BASE_SPEED = 4.0; 
    const FRAME_COUNT = 12; 

    const calculateJumpMultiplier = (playerHeight, gameSpeed, penalty = 1.0) => {
        const sizeFactor = Math.sqrt(playerHeight / BASE_HEIGHT);
        const speedFactor = 1 + (gameSpeed - 1) * 0.10;
        return Math.max(1.0, sizeFactor * speedFactor * penalty);
    };

    const pickImg = (timeOfDay, dayImg, nightImg) => timeOfDay === 'night' ? nightImg.current : dayImg.current;

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

    const formatScore = (num) => num.toString().padStart(5, '0');

    return {
        GRAVITY, JUMP_FORCE, HOLD_THRUST, BASE_HEIGHT, GROUND_Y, BASE_SPEED, FRAME_COUNT,
        calculateJumpMultiplier, pickImg, toggleFullscreen, formatScore
    };
})();
