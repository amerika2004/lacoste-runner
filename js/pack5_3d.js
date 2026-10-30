/* ==================================================================
   PACK 5 — 3D Model Loader (ABSOLUTE DEBUG)
   ================================================================== */
window.GameEvents = window.GameEvents || { listeners: {}, on(e,c){ if(!this.listeners[e]) this.listeners[e]=[]; this.listeners[e].push(c); }, emit(e,d){ if(this.listeners[e]) this.listeners[e].forEach(cb=>cb(d)); } };
window.PackUIs = window.PackUIs || [];

(function () {
    'use strict';
    if (!window.THREE) { console.error('❌ Three.js не загружен!'); return; }

    let currentCharacter = localStorage.getItem('lacosteCharacter') || 'crocodile';
    let settings3DEnabled = true;
    let isModelLoaded = false;
    let modelCache = {};

    function loadModelForCharacter(charId, onLoaded) {
        if (modelCache[charId]) {
            onLoaded(modelCache[charId]);
            return;
        }
        
        const checkConfig = setInterval(() => {
            if (window.GAME_CONFIG && window.GAME_CONFIG.characters) {
                clearInterval(checkConfig);
                const charConf = window.GAME_CONFIG.characters[charId];
                
                if (!charConf || !charConf.model3d) {
                    onLoaded(null);
                    return;
                }

                const { obj, mtl } = charConf.model3d;
                // Загружаем БЕЗ MTL, чтобы исключить проблемы с текстурами
                const objLoader = new THREE.OBJLoader();
                objLoader.load(obj, (object) => {
                    
                    // 1. Принудительно центрируем модель в точке (0,0,0)
                    const box = new THREE.Box3().setFromObject(object);
                    const center = box.getCenter(new THREE.Vector3());
                    object.position.sub(center);
                    
                    // 2. Вычисляем размер и жестко масштабируем
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    object.scale.setScalar(2 / (maxDim || 1)); 
                    
                    // 3. Красим в радужный цвет, чтобы точно увидеть
                    object.traverse((child) => {
                        if (child.isMesh) {
                            child.material = new THREE.MeshNormalMaterial();
                        }
                    });

                    // 4. Пока НЕ поворачиваем (rotation.y = 0), чтобы увидеть, как она смотрит изначально
                    
                    modelCache[charId] = object;
                    onLoaded(object);
                }, undefined, (err) => { console.error('[3D] Ошибка OBJ:', err); onLoaded(null); });
            }
        }, 100);
    }

    window.ThreePreview = function ThreePreview({ charId, emoji }) {
        // Для меню оставляем как было (пропускаем для краткости, можно использовать старый код)
        return React.createElement('span', { style: { fontSize: '24px' } }, emoji || '❓');
    };

    // ==========================================
    // ВНЕДРЕНИЕ 3D В ГЕЙМПЛЕЙ
    // ==========================================
    const threeCanvas = document.createElement('canvas');
    threeCanvas.width = 256;
    threeCanvas.height = 256;
    threeCanvas.style.position = 'absolute';
    threeCanvas.style.left = '-9999px';
    document.body.appendChild(threeCanvas);

    // Убираем зеленый фон, делаем прозрачным
    const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(256, 256);
    renderer.setClearColor(0x000000, 0); 

    const scene3D = new THREE.Scene();
    // Камера смотрит ровно в центр (0,0,0)
    const camera3D = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera3D.position.set(0, 0, 4); 
    camera3D.lookAt(0, 0, 0);

    // Базовый свет (на всякий случай)
    scene3D.add(new THREE.AmbientLight(0xffffff, 1.0));

    const modelGroup = new THREE.Group();
    scene3D.add(modelGroup);

    window.GameEvents.on('start', (data) => {
        currentCharacter = data.character;
        settings3DEnabled = data.settings.use3DCharacters !== false;
        
        if (settings3DEnabled) {
            loadModelForCharacter(currentCharacter, (model) => {
                if (model) {
                    modelGroup.clear();
                    modelGroup.add(model.clone());
                    isModelLoaded = true;
                } else {
                    isModelLoaded = false;
                }
            });
        }
    });

    const patchEngine = () => {
        if (!window.RenderEngine || window.__3dPatched) return;
        window.__3dPatched = true;

        const originalDraw = window.RenderEngine.draw;

        window.RenderEngine.draw = function (ctx, canvas, scene) {
            if (!settings3DEnabled || !isModelLoaded || !scene.player) {
                return originalDraw.call(this, ctx, canvas, scene);
            }

            // Отключаем все пляски (наклоны при беге, прыжке), чтобы модель стояла ровно
            modelGroup.position.set(0, 0, 0);
            modelGroup.rotation.set(0, 0, 0);

            renderer.render(scene3D, camera3D);

            const originalImg = scene.player.img;
            scene.player.img = threeCanvas;

            if (!threeCanvas.complete) {
                threeCanvas.complete = true;
                threeCanvas.naturalWidth = 256;
                threeCanvas.naturalHeight = 256;
            }

            originalDraw.call(this, ctx, canvas, scene);
            scene.player.img = originalImg;
        };
    };

    const waitForEngine = setInterval(() => {
        if (window.RenderEngine) {
            patchEngine();
            clearInterval(waitForEngine);
        }
    }, 100);

})();
