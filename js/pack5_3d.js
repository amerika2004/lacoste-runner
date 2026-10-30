/* ==================================================================
   PACK 5 — 3D Model Loader (FORCED DEBUG)
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
                const mtlLoader = new THREE.MTLLoader();
                
                mtlLoader.load(mtl, (materials) => {
                    materials.preload();
                    const objLoader = new THREE.OBJLoader();
                    objLoader.setMaterials(materials);
                    
                    objLoader.load(obj, (object) => {
                        const box = new THREE.Box3().setFromObject(object);
                        const center = box.getCenter(new THREE.Vector3());
                        object.position.sub(center);
                        
                        const size = box.getSize(new THREE.Vector3());
                        const maxDim = Math.max(size.x, size.y, size.z);
                        
                        // ЖЕСТКИЙ МАСШТАБ (чтобы точно влезло в камеру)
                        object.scale.setScalar(1.5 / (maxDim || 1)); 
                        
                        // ВРЕМЕННО КРАСИМ В КРАСНЫЙ, ЧТОБЫ УВИДЕТЬ
                        object.traverse((child) => {
                            if (child.isMesh) {
                                child.material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                            }
                        });

                        object.rotation.y = Math.PI / 2; 

                        modelCache[charId] = object;
                        onLoaded(object);
                    }, undefined, (err) => { console.error('[3D] Ошибка OBJ:', err); onLoaded(null); });
                }, undefined, (err) => { console.error('[3D] Ошибка MTL:', err); onLoaded(null); });
            }
        }, 100);
    }

    // ==========================================
    // КОМПОНЕНТ ДЛЯ 3D ПРЕВЬЮ В МЕНЮ
    // ==========================================
    window.ThreePreview = function ThreePreview({ charId, emoji }) {
        const containerRef = React.useRef(null);
        const [loaded, setLoaded] = React.useState(false);
        
        React.useEffect(() => {
            if (!window.THREE || !containerRef.current) return;
            
            const container = containerRef.current;
            const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
            renderer.setSize(100, 100);
            renderer.setClearColor(0x000000, 0);
            container.appendChild(renderer.domElement);
            
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
            camera.position.set(0, 0, 5); 
            camera.lookAt(0, 0, 0);
            
            scene.add(new THREE.AmbientLight(0xffffff, 1.0));
            
            const group = new THREE.Group();
            scene.add(group);
            
            let animId;
            let isActive = true;

            loadModelForCharacter(charId, (model) => {
                if (!isActive) return;
                if (model) {
                    group.add(model.clone());
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
                style: { position: 'absolute', inset: 0, opacity: loaded ? 1 : 0 } 
            })
        );
    };

    // ==========================================
    // ВНЕДРЕНИЕ 3D В ГЕЙМПЛЕЙ
    // ==========================================
    const threeCanvas = document.createElement('canvas');
    threeCanvas.width = 256;
    threeCanvas.height = 256;
    // Добавляем на страницу, чтобы браузер не останавливал WebGL (скрываем визуально)
    threeCanvas.style.position = 'absolute';
    threeCanvas.style.left = '-9999px';
    document.body.appendChild(threeCanvas);

    const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: false, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(256, 256);
    // ДЕЛАЕМ ЗЕЛЕНЫЙ ФОН, ЧТОБЫ ВИДЕТЬ, ЧТО ПАТЧ РАБОТАЕТ
    renderer.setClearColor(0x00ff00, 1); 

    const scene3D = new THREE.Scene();
    const camera3D = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera3D.position.set(0, 0, 5);
    camera3D.lookAt(0, 0, 0);

    const modelGroup = new THREE.Group();
    scene3D.add(modelGroup);

    window.GameEvents.on('start', (data) => {
        currentCharacter = data.character;
        settings3DEnabled = data.settings.use3DCharacters !== false;
        currentState = 'run';
        
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

            // Чтобы игра не выдала ошибку из-за отсутствия свойств картинки
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
