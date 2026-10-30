/* ==================================================================
   PACK 5 — 3D Model Loader (OBJ/MTL to 2D Canvas Bridge)
   ================================================================== */
window.GameEvents = window.GameEvents || { listeners: {}, on(e,c){...}, emit(e,d){...} };
window.PackUIs = window.PackUIs || [];

(function () {
    'use strict';
    if (!window.THREE) { console.error('❌ Three.js не загружен!'); return; }

    // 1. Создаем скрытый 3D-движок
    const threeCanvas = document.createElement('canvas');
    threeCanvas.width = 256;
    threeCanvas.height = 256;
    // Обманываем игру, делая вид, что это обычная картинка
    threeCanvas.complete = true;
    threeCanvas.naturalWidth = 256;
    threeCanvas.naturalHeight = 256;

    const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true, antialias: true });
    renderer.setSize(256, 256);
    renderer.setClearColor(0x000000, 0); // Прозрачный фон

    const scene3D = new THREE.Scene();
    const camera3D = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera3D.position.set(0, 0, 5);

    // Свет
    scene3D.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene3D.add(dirLight);

    const modelGroup = new THREE.Group();
    scene3D.add(modelGroup);

    let isModelLoaded = false;
    let currentState = 'run'; // run, jump, eat, trip

    // 2. Загружаем твою модель .obj и .mtl
    const mtlLoader = new THREE.MTLLoader();
    mtlLoader.load('source/characters/crocodile_3d/model.mtl', (materials) => {
        materials.preload();
        const objLoader = new THREE.OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.load('source/characters/crocodile_3d/model.obj', (object) => {
            
            // Центрируем и масштабируем модель
            const box = new THREE.Box3().setFromObject(object);
            const center = box.getCenter(new THREE.Vector3());
            object.position.sub(center);
            
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            object.scale.setScalar(2 / maxDim); // Вписываем в куб

            // Поворачиваем модель в нужную сторону (по умолчанию крокодил может смотреть не туда)
            // Поиграй с этими значениями, если модель смотрит вверх ногами или задом наперед
            modelGroup.rotation.y = Math.PI / 2; 

            modelGroup.add(object);
            isModelLoaded = true;
            console.log('🐊 3D Модель успешно загружена и внедрена!');
        }, undefined, (err) => console.error('Ошибка загрузки OBJ:', err));
    }, undefined, (err) => console.error('Ошибка загрузки MTL:', err));

    // 3. Слушаем события игры для анимации
    window.GameEvents.on('start', () => { currentState = 'run'; });
    window.GameEvents.on('jump', () => { currentState = 'jump'; });
    window.GameEvents.on('land', () => { currentState = 'run'; });
    window.GameEvents.on('eat', () => { currentState = 'eat'; setTimeout(()=> currentState='run', 500); });
    window.GameEvents.on('hit', () => { currentState = 'trip'; setTimeout(()=> currentState='run', 1500); });
    window.GameEvents.on('barrel_hit', () => { currentState = 'trip'; });

    // 4. Перехватываем рендер игры
    const patchEngine = () => {
        if (!window.RenderEngine || window.__3dPatched) return;
        window.__3dPatched = true;

        const originalDraw = window.RenderEngine.draw;

        window.RenderEngine.draw = function (ctx, canvas, scene) {
            if (!isModelLoaded || !scene.player) {
                return originalDraw.call(this, ctx, canvas, scene);
            }

            // --- АНИМАЦИЯ 3D МОДЕЛИ ---
            const time = Date.now() * 0.005;
            
            if (currentState === 'run') {
                modelGroup.position.y = Math.sin(time * 4) * 0.1; // Покачивание
                modelGroup.rotation.x = 0.2; // Наклон вперед
                modelGroup.rotation.z = Math.sin(time * 2) * 0.1; // Виляние
            } else if (currentState === 'jump') {
                modelGroup.position.y = 0;
                modelGroup.rotation.x = -0.4; // Наклон назад
                modelGroup.rotation.z = 0;
            } else if (currentState === 'eat') {
                modelGroup.position.y = 0;
                modelGroup.rotation.x = 0.4; // Наклон вниз
                modelGroup.rotation.z = Math.sin(time * 15) * 0.15; // Жевание
            } else if (currentState === 'trip') {
                modelGroup.position.y = -0.3;
                modelGroup.rotation.x = 1.2; // Падение лицом вниз
                modelGroup.rotation.z = 0.5;
            }

            // Рендерим 3D сцену в скрытый canvas
            renderer.render(scene3D, camera3D);

            // --- ВНЕДРЕНИЕ В ИГРУ ---
            // Подменяем стандартную картинку игрока на наш 3D-рендер
            const originalImg = scene.player.img;
            scene.player.img = threeCanvas;

            // Вызываем оригинальный рендер (он нарисует фон, нас на месте игрока, а затем препятствия)
            originalDraw.call(this, ctx, canvas, scene);

            // Возвращаем всё как было
            scene.player.img = originalImg;
        };
        console.log('%c🐊 3D Render Bridge активен', 'color:#00FFCC;font-weight:bold');
    };

    // Ждем, пока game.js инициализирует RenderEngine
    const waitForEngine = setInterval(() => {
        if (window.RenderEngine) {
            patchEngine();
            clearInterval(waitForEngine);
        }
    }, 100);

})();
