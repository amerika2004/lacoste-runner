/* ==================================================================
   PACK 5 — 3D Model Loader (DEBUG VERSION)
   ================================================================== */
window.GameEvents = window.GameEvents || { listeners: {}, on(e,c){ if(!this.listeners[e]) this.listeners[e]=[]; this.listeners[e].push(c); }, emit(e,d){ if(this.listeners[e]) this.listeners[e].forEach(cb=>cb(d)); } };
window.PackUIs = window.PackUIs || [];

(function () {
    'use strict';
    if (!window.THREE) { console.error('❌ Three.js не загружен!'); return; }

    let currentCharacter = localStorage.getItem('lacosteCharacter') || 'crocodile';
    let settings3DEnabled = true;
    let isModelLoaded = false;
    let currentState = 'run';
    let modelCache = {};

    // Загрузчик модели
    function loadModelForCharacter(charId, onLoaded) {
        if (modelCache[charId]) {
            onLoaded(modelCache[charId]);
            return;
        }
        
        // Ждем, пока GAME_CONFIG загрузится (на случай, если скрипты подключены не в том порядке)
        const checkConfig = setInterval(() => {
            if (window.GAME_CONFIG && window.GAME_CONFIG.characters) {
                clearInterval(checkConfig);
                const charConf = window.GAME_CONFIG.characters[charId];
                
                if (!charConf || !charConf.model3d) {
                    console.warn(`[3D] У персонажа ${charId} нет модели в config.js`);
                    onLoaded(null);
                    return;
                }

                console.log(`[3D] Начинаю загрузку модели для ${charId}...`);
                const { obj, mtl } = charConf.model3d;
                
                const mtlLoader = new THREE.MTLLoader();
                mtlLoader.load(mtl, (materials) => {
                    materials.preload();
                    const objLoader = new THREE.OBJLoader();
                    objLoader.setMaterials(materials);
                    objLoader.load(obj, (object) => {
                        console.log(`[3D] Модель ${charId} успешно загружена!`);
                        const box = new THREE.Box3().setFromObject(object);
                        const center = box.getCenter(new THREE.Vector3());
                        object.position.sub(center);
                        
                        const size = box.getSize(new THREE.Vector3());
                        const maxDim = Math.max(size.x, size.y, size.z);
                        object.scale.setScalar(2 / maxDim); 
                        
                        object.rotation.y = Math.PI / 2; 

                        modelCache[charId] = object;
                        onLoaded(object);
                    }, undefined, (err) => { console.error('[3D] Ошибка загрузки OBJ:', err); onLoaded(null); });
                }, undefined, (err) => { console.error('[3D] Ошибка загрузки MTL:', err); onLoaded(null); });
            }
        }, 100);
    }

    // ==========================================
    // 1. КОМПОНЕНТ ДЛЯ 3D ПРЕВЬЮ В МЕНЮ
    // ==========================================
    window.ThreePreview = function ThreePreview({ charId, emoji }) {
        const containerRef = React.useRef(null);
        const [loaded, setLoaded] = React.useState(false);
        
        React.useEffect(() => {
            if (!window.THREE || !containerRef.current) return;
            
            const container = containerRef.current;
            const width = 100, height = 100;
            
            const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
            renderer.setSize(width, height);
            renderer.setClearColor(0x000000, 0);
            container.appendChild(renderer.domElement);
            
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
            camera.position.set(0, 0, 5); 
            camera.lookAt(0, 0, 0);
            
            scene.add(new THREE.AmbientLight(0xffffff, 0.8));
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
            dirLight.position.set(5, 10, 7);
            scene.add(dirLight);
            
            const group = new THREE.Group();
            scene.add(group);
            
            let animId;
            let isActive = true;

            loadModelForCharacter(charId, (model) => {
                if (!isActive) return;
                if (model) {
                    const clonedModel = model.clone();
                    clonedModel.scale.multiplyScalar(1.2); 
                    group.add(clonedModel);
                    setLoaded(true);
                }
            });

            const animate = () => {
                if (!isActive) return;
                animId = requestAnimationFrame(animate);
                group.rotation.y += 0.02; 
                renderer.render(scene, camera);
            };
            animate();
            
            return () => {
                isActive = false;
                cancelAnimationFrame(animId);
                renderer.dispose();
                if (container.contains(renderer.domElement)) {
                    container.removeChild(renderer.domElement);
                }
            };
        }, [charId]);
        
        return React.createElement('div', { style: { position: 'relative', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
            !loaded && React.createElement('span', { style: { fontSize: '24px' } }, emoji || '❓'),
            React.createElement('div', { 
                ref: containerRef, 
                style: { position: 'absolute', inset: 0, opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' } 
            })
        );
    };

    // ==========================================
    // 2. ВНЕДРЕНИЕ 3D В САМ ГЕЙМПЛЕЙ
    // ==========================================
    const threeCanvas = document.createElement('canvas');
    threeCanvas.width = 256;
    threeCanvas.height = 256;
    threeCanvas.complete = true;
    threeCanvas.naturalWidth = 256;
    threeCanvas.naturalHeight = 256;

    const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(256, 256);
    renderer.setClearColor(0x000000, 0);

    const scene3D = new THREE.Scene();
    const camera3D = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera3D.position.set(0, 0, 5);
    camera3D.lookAt(0, 0, 0);

    scene3D.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene3D.add(dirLight);

    const modelGroup = new THREE.Group();
    scene3D.add(modelGroup);

    window.GameEvents.on('start', (data) => {
        currentCharacter = data.character;
        // Важно: проверяем настройку из игры
        settings3DEnabled = data.settings.use3DCharacters !== false;
        currentState = 'run';
        
        console.log(`[3D] Игра началась. Персонаж: ${currentCharacter}, 3D включено: ${settings3DEnabled}`);
        
        if (settings3DEnabled) {
            loadModelForCharacter(currentCharacter, (model) => {
                if (model) {
                    modelGroup.clear();
                    const cloned = model.clone();
                    modelGroup.add(cloned);
                    isModelLoaded = true;
                    console.log(`[3D] Модель готова к рендеру!`);
                } else {
                    isModelLoaded = false;
                }
            });
        } else {
            isModelLoaded = false;
        }
    });

    window.GameEvents.on('jump', () => { currentState = 'jump'; });
    window.GameEvents.on('land', () => { currentState = 'run'; });
    window.GameEvents.on('eat', () => { currentState = 'eat'; setTimeout(()=> currentState='run', 500); });
    window.GameEvents.on('hit', () => { currentState = 'trip'; setTimeout(()=> currentState='run', 1500); });
    window.GameEvents.on('barrel_hit', () => { currentState = 'trip'; });

    const patchEngine = () => {
        if (!window.RenderEngine || window.__3dPatched) return;
        window.__3dPatched = true;

        const originalDraw = window.RenderEngine.draw;

        window.RenderEngine.draw = function (ctx, canvas, scene) {
            if (!settings3DEnabled || !isModelLoaded || !scene.player) {
                return originalDraw.call(this, ctx, canvas, scene);
            }

            const time = Date.now() * 0.005;
            
            if (currentState === 'run') {
                modelGroup.position.y = Math.sin(time * 4) * 0.1;
                modelGroup.rotation.x = 0.2; 
                modelGroup.rotation.z = Math.sin(time * 2) * 0.1; 
            } else if (currentState === 'jump') {
                modelGroup.position.y = 0;
                modelGroup.rotation.x = -0.4; 
                modelGroup.rotation.z = 0;
            } else if (currentState === 'eat') {
                modelGroup.position.y = 0;
                modelGroup.rotation.x = 0.4; 
                modelGroup.rotation.z = Math.sin(time * 15) * 0.15; 
            } else if (currentState === 'trip') {
                modelGroup.position.y = -0.3;
                modelGroup.rotation.x = 1.2; 
                modelGroup.rotation.z = 0.5;
            }

            renderer.render(scene3D, camera3D);

            const originalImg = scene.player.img;
            scene.player.img = threeCanvas;

            originalDraw.call(this, ctx, canvas, scene);

            scene.player.img = originalImg;
        };
        console.log('%c🐊 3D Render Bridge ПАТЧНУТ', 'color:#00FFCC;font-weight:bold');
    };

    const waitForEngine = setInterval(() => {
        if (window.RenderEngine) {
            patchEngine();
            clearInterval(waitForEngine);
        }
    }, 100);

})();
