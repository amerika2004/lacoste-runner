/* ==================================================================
   PACK 5 — 3D Model Loader (ИСПРАВЛЕННАЯ ВЕРСИЯ)
   ================================================================== */
window.GameEvents = window.GameEvents || { listeners: {}, on(e,c){ if(!this.listeners[e]) this.listeners[e]=[]; this.listeners[e].push(c); }, emit(e,d){ if(this.listeners[e]) this.listeners[e].forEach(cb=>cb(d)); } };
window.PackUIs = window.PackUIs || [];

(function () {
    'use strict';
    if (!window.THREE) { console.error('❌ Three.js не загружен!'); return; }

    let currentCharacter = localStorage.getItem('lacosteCharacter') || 'crocodile';

    window.GameEvents.on('pack4_character_changed', (data) => {
        currentCharacter = data.charId;
    });
    window.GameEvents.on('start', (data) => {
        currentCharacter = data.character;
    });

    // ==========================================
    // 1. КОМПОНЕНТ ДЛЯ 3D ПРЕВЬЮ В МЕНЮ
    // ==========================================
    window.ThreePreview = function ThreePreview() {
        const containerRef = React.useRef(null);
        
        React.useEffect(() => {
            if (!window.THREE || !containerRef.current) return;
            
            const container = containerRef.current;
            // Делаем холст побольше (100x100), а в CSS уменьшим
            const width = 100, height = 100;
            
            const renderer = new THREE.WebGLRenderer({ 
                alpha: true, 
                antialias: true,
                preserveDrawingBuffer: true 
            });
            renderer.setSize(width, height);
            renderer.setClearColor(0x000000, 0);
            container.appendChild(renderer.domElement);
            
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
            
            // Ставим камеру ровно напротив центра (0,0,0)
            camera.position.set(0, 0, 5); 
            camera.lookAt(0, 0, 0);
            
            scene.add(new THREE.AmbientLight(0xffffff, 0.8));
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
            dirLight.position.set(5, 10, 7);
            scene.add(dirLight);
            
            let group = null;
            let isLoaded = false;
            
            const mtlLoader = new THREE.MTLLoader();
            mtlLoader.load('https://github.com/amerika2004/lacoste-runner/blob/lacoste-runner/source/characters/crocodile_3d/Kip.mtl', (materials) => {
                materials.preload();
                const objLoader = new THREE.OBJLoader();
                objLoader.setMaterials(materials);
                objLoader.load('https://github.com/amerika2004/lacoste-runner/blob/lacoste-runner/source/characters/crocodile_3d/Kip.obj', (object) => {
                    const box = new THREE.Box3().setFromObject(object);
                    const center = box.getCenter(new THREE.Vector3());
                    object.position.sub(center);
                    
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    // Увеличиваем масштаб до 2.5, чтобы модель была крупной
                    object.scale.setScalar(2.5 / maxDim);
                    
                    group = new THREE.Group();
                    group.add(object);
                    // Поворот (если нужно)
                    group.rotation.y = Math.PI / 2; 
                    scene.add(group);
                    isLoaded = true;
                });
            });
            
            let animId;
            const animate = () => {
                animId = requestAnimationFrame(animate);
                if (isLoaded && group) {
                    group.rotation.y += 0.02; 
                }
                renderer.render(scene, camera);
            };
            animate();
            
            return () => {
                cancelAnimationFrame(animId);
                renderer.dispose();
                if (container.contains(renderer.domElement)) {
                    container.removeChild(renderer.domElement);
                }
            };
        }, []);
        
        // Задаем жесткие размеры контейнеру, чтобы он не схлопывался в 0
        return React.createElement('div', { 
            ref: containerRef, 
            style: { 
                width: '40px', 
                height: '40px', 
                minWidth: '40px',
                display: 'inline-block', 
                verticalAlign: 'middle',
                overflow: 'hidden'
            } 
        });
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

    // ВОТ ГЛАВНЫЙ ФИКС: preserveDrawingBuffer: true (без него холст мигает)
    const renderer = new THREE.WebGLRenderer({ 
        canvas: threeCanvas, 
        alpha: true, 
        antialias: true,
        preserveDrawingBuffer: true 
    });
    renderer.setSize(256, 256);
    renderer.setClearColor(0x000000, 0);

    const scene3D = new THREE.Scene();
    const camera3D = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera3D.position.set(0, 0, 5);
    camera3D.lookAt(0, 0, 0); // Камера смотрит в центр

    scene3D.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene3D.add(dirLight);

    const modelGroup = new THREE.Group();
    scene3D.add(modelGroup);

    let isModelLoaded = false;
    let currentState = 'run';

    const mtlLoader = new THREE.MTLLoader();
    mtlLoader.load('https://github.com/amerika2004/lacoste-runner/blob/lacoste-runner/source/characters/crocodile_3d/Kip.mtl', (materials) => {
        materials.preload();
        const objLoader = new THREE.OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.load('https://github.com/amerika2004/lacoste-runner/blob/lacoste-runner/source/characters/crocodile_3d/Kip.obj', (object) => {
            const box = new THREE.Box3().setFromObject(object);
            const center = box.getCenter(new THREE.Vector3());
            object.position.sub(center);
            
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            object.scale.setScalar(2 / maxDim); 

            modelGroup.rotation.y = Math.PI / 2; 
            modelGroup.add(object);
            isModelLoaded = true;
            console.log('🐊 3D Модель для геймплея загружена!');
        }, undefined, (err) => console.error('Ошибка загрузки OBJ:', err));
    }, undefined, (err) => console.error('Ошибка загрузки MTL:', err));

    window.GameEvents.on('start', () => { currentState = 'run'; });
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
            // Если выбран не крокодил, или модель не загрузилась — рисуем 2D спрайт
            if (currentCharacter !== 'crocodile' || !isModelLoaded || !scene.player) {
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

            // Рендерим 3D
            renderer.render(scene3D, camera3D);

            // Подменяем картинку и вызываем оригинальный рендер
            const originalImg = scene.player.img;
            scene.player.img = threeCanvas;

            originalDraw.call(this, ctx, canvas, scene);

            // Возвращаем как было
            scene.player.img = originalImg;
        };
        console.log('%c🐊 3D Render Bridge активен', 'color:#00FFCC;font-weight:bold');
    };

    const waitForEngine = setInterval(() => {
        if (window.RenderEngine) {
            patchEngine();
            clearInterval(waitForEngine);
        }
    }, 100);

})();
