import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.0/build/three.module.js';
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.152.0/examples/jsm/webxr/VRButton.js';

let scene, camera, renderer;
let player;
let spikes = [];    // pinchos
let coins = [];     // monedas

let ground;         // suelo
let lightningLight;
let lightningTimer = 0;
let nextLightning = 5 + Math.random() * 5;
let lightningDecay = 0;

let panelMode = null;          // 'pause' | 'gameover'

let groundHue = 0;  // tono del color del suelo

let clock;
let gameRunning = false;
let isPaused = false;
let score = 0;
let startTime = 0;

// velocidad
let speed = 0.25;
let speedBase = 0.28;
let speedGrowth = 0.015;
let speedModifier = 1.0; // se reduce un poco en cada celebración

let laneWidth = 2;
let maxX = 4;

let spikeTimer = 0;
let coinTimer = 0;

// 🎉 celebraciones por tiempo
let milestoneStep = 60;     // cada 60s
let nextMilestone = 60;     // siguiente objetivo
let confettiPieces = [];
let confettiActive = false;
let confettiTime = 0;
const CONFETTI_DURATION = 3; // segundos

// 🎵 música
let bgMusic1 = null; // stereo madness
let bgMusic2 = null; // electroman adventures
let currentMusicIndex = 1; // 1 ó 2

// efectos de sonido
let sfxCoin = null;
let sfxHit = null;

const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const statusEl = document.getElementById('status');
const panelEl = document.getElementById('gamePanel');
const panelSubtitleEl = document.getElementById('panelSubtitle');
const musicSlider = document.getElementById('musicSlider');
const sfxSlider = document.getElementById('sfxSlider');
const panelPlayBtn = document.getElementById('panelPlayBtn');
const panelRestartBtn = document.getElementById('panelRestartBtn');

// ========= PERSONAJE =========
function createPlayer() {
    const group = new THREE.Group();

    // Cuerpo (camisa azul claro)
    const bodyGeo = new THREE.BoxGeometry(0.6, 1.0, 0.3);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.3
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.1;
    group.add(body);

    // "ITP" en el pecho usando canvas
    const badgeGeo = new THREE.PlaneGeometry(0.4, 0.3);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ITP', canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const badgeMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const badge = new THREE.Mesh(badgeGeo, badgeMat);
    badge.position.set(0, 1.1, 0.16);
    group.add(badge);

    // Cabeza
    const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.7;
    group.add(head);

    // Piernas
    const legGeo = new THREE.BoxGeometry(0.2, 0.6, 0.25);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.15, 0.55, 0);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.15, 0.55, 0);
    group.add(leftLeg, rightLeg);

    // Brazos
    const armGeo = new THREE.BoxGeometry(0.15, 0.6, 0.25);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.45, 1.25, 0);
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.45, 1.25, 0);
    group.add(leftArm, rightArm);

    group.position.set(0, 0, -8);
    return group;
}

// ========= ESCENARIO =========
function createGround() {
    const geo = new THREE.PlaneGeometry(20, 220, 10, 10);

    // Canvas para textura tipo cuadritos
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const cell = size / 8; // 8x8 cuadros
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const even = (x + y) % 2 === 0;
            ctx.fillStyle = even ? '#0f172a' : '#1d4ed8'; // azul oscuro / azul fuerte
            ctx.fillRect(x * cell, y * cell, cell, cell);
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 20);  // se repite a lo largo del camino

    const mat = new THREE.MeshStandardMaterial({
        map: tex,
        color: 0xffffff,
        emissive: 0x16a34a,
        emissiveIntensity: 0.4
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.z = -70;
    mesh.receiveShadow = true;
    return mesh;
}

function createSky() {
    const geo = new THREE.SphereGeometry(100, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x050018,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(geo, mat);
    scene.add(sky);

    // Estrellas
    const starGeo = new THREE.BufferGeometry();
    const starCount = 400;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        positions[i * 3 + 0] = (Math.random() - 0.5) * 120;
        positions[i * 3 + 1] = Math.random() * 60 + 10;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({ size: 0.4, color: 0xffffff });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);
}

// ========= CÁMARA =========
function updateCamera() {
    if (!renderer.xr.isPresenting && player) {
        camera.position.set(
            player.position.x,
            player.position.y + 3.0,
            player.position.z + 10.0
        );
        camera.lookAt(
            player.position.x,
            player.position.y + 1.0,
            player.position.z - 15.0
        );
    }
}

// ========= OBJETOS =========
function spawnSpike() {
    const geo = new THREE.ConeGeometry(0.7, 1.2, 4);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        emissive: 0x1e293b,
        emissiveIntensity: 0.4
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = Math.PI / 4;
    const lanes = [-laneWidth, 0, laneWidth];
    mesh.position.x = lanes[Math.floor(Math.random() * lanes.length)];
    mesh.position.y = 0.6;
    mesh.position.z = -80;
    scene.add(mesh);
    spikes.push(mesh);
}

function spawnCoin() {
    const geo = new THREE.TorusGeometry(0.5, 0.15, 16, 32);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xfacc15,
        emissiveIntensity: 0.8
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = Math.PI / 2;
    const lanes = [-laneWidth, 0, laneWidth];
    mesh.position.x = lanes[Math.floor(Math.random() * lanes.length)];
    mesh.position.y = 1.5;
    mesh.position.z = -85 - Math.random() * 20;
    scene.add(mesh);
    coins.push(mesh);
}

// ========= CONFETI + MENSAJE + VELOCIDAD =========
function startCelebration(milestoneSeconds) {
    let mensaje;
    if (milestoneSeconds === 60) {
        mensaje = 'Primeros 60 segundos superados';
    } else {
        mensaje = `${milestoneSeconds} segundos superados`;
    }
    statusEl.textContent = `🎉 ${mensaje} 🎉`;

    // bajar un poco la velocidad del juego cuando se celebra
    speedModifier *= 0.9;           // 10% más lento
    if (speedModifier < 0.5) {
        speedModifier = 0.5;        // no bajar de la mitad
    }

    confettiPieces.forEach(p => scene.remove(p));
    confettiPieces = [];

    const geo = new THREE.BoxGeometry(0.15, 0.03, 0.08);

    for (let i = 0; i < 120; i++) {
        const color = new THREE.Color().setHSL(Math.random(), 0.9, 0.6);
        const mat = new THREE.MeshStandardMaterial({
            color,
            emissive: color.clone().multiplyScalar(0.4)
        });
        const piece = new THREE.Mesh(geo, mat);

        const spread = 6;
        piece.position.set(
            player.position.x + (Math.random() - 0.5) * spread,
            player.position.y + 4 + Math.random() * 2,
            player.position.z - 2 + (Math.random() - 0.5) * 4
        );

        piece.userData.vx = (Math.random() - 0.5) * 4;
        piece.userData.vy = Math.random() * 4 + 2;
        piece.userData.vz = (Math.random() - 0.5) * 4;
        piece.userData.rx = (Math.random() - 0.5) * 6;
        piece.userData.ry = (Math.random() - 0.5) * 6;

        scene.add(piece);
        confettiPieces.push(piece);
    }

    confettiActive = true;
    confettiTime = 0;
}

function updateConfetti(delta) {
    if (!confettiActive) return;

    confettiTime += delta;
    const gravity = 9.8;

    confettiPieces.forEach(p => {
        p.position.x += p.userData.vx * delta;
        p.position.y += p.userData.vy * delta;
        p.position.z += p.userData.vz * delta;

        p.userData.vy -= gravity * delta;

        p.rotation.x += p.userData.rx * delta;
        p.rotation.y += p.userData.ry * delta;
    });

    if (confettiTime > CONFETTI_DURATION) {
        confettiPieces.forEach(p => scene.remove(p));
        confettiPieces = [];
        confettiActive = false;
        statusEl.textContent = "";
    }
}

// ========= AUDIO =========
function resetPlaylist() {
    currentMusicIndex = 1;
    if (bgMusic1) {
        bgMusic1.pause();
        bgMusic1.currentTime = 0;
    }
    if (bgMusic2) {
        bgMusic2.pause();
        bgMusic2.currentTime = 0;
    }
}

function playCurrentMusic() {
    const volume = parseFloat(musicSlider.value || '0.5');
    if (currentMusicIndex === 1 && bgMusic1) {
        bgMusic1.volume = volume;
        bgMusic1.play().catch(() => {});
    } else if (currentMusicIndex === 2 && bgMusic2) {
        bgMusic2.volume = volume;
        bgMusic2.play().catch(() => {});
    }
}

function pauseAllMusic() {
    if (bgMusic1) bgMusic1.pause();
    if (bgMusic2) bgMusic2.pause();
}

// ========= GAME STATE =========
function resetGame() {
    // limpiar objetos
    spikes.forEach(o => scene.remove(o));
    coins.forEach(o => scene.remove(o));
    spikes = [];
    coins = [];

    score = 0;
    scoreEl.textContent = score.toString();
    statusEl.textContent = "";
    startTime = performance.now();
    speedModifier = 1.0;
    speed = speedBase;
    gameRunning = true;
    isPaused = false;

    // reset de milestones
    nextMilestone = milestoneStep;
    confettiActive = false;
    confettiPieces.forEach(p => scene.remove(p));
    confettiPieces = [];

    player.position.x = 0;
    player.position.z = -8;

    updateCamera();
    hidePanel();
}

function endGame(message) {
    gameRunning = false;
    isPaused = false;
    statusEl.textContent = message;
    pauseAllMusic();
    showPanel('gameover');
}

// ========= INIT =========
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.015);

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        250
    );

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);
    document.body.appendChild(VRButton.createButton(renderer));

    const hemi = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.2);
    scene.add(hemi);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(8, 12, 4);
    scene.add(dirLight);

    // relámpagos
    lightningLight = new THREE.PointLight(0xeeeeff, 0, 100, 2);
    lightningLight.position.set(0, 25, -40);
    scene.add(lightningLight);

    ground = createGround();
    scene.add(ground);
    createSky();

    player = createPlayer();
    scene.add(player);

    clock = new THREE.Clock();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onWindowResize);

    // música
    bgMusic1 = new Audio('assets/audio/stereo_madness.mp3');
    bgMusic2 = new Audio('assets/audio/electroman_adventures.mp3');

    bgMusic1.loop = false;
    bgMusic2.loop = true;

    bgMusic1.onended = () => {
        if (currentMusicIndex === 1) {
            currentMusicIndex = 2;
            playCurrentMusic();
        }
    };

    // efectos de sonido
    sfxCoin = new Audio('assets/audio/coin.wav');
    sfxHit  = new Audio('assets/audio/hit.wav');
    const initialSfxVol = parseFloat(sfxSlider?.value || "0.7");
    sfxCoin.volume = initialSfxVol;
    sfxHit.volume  = initialSfxVol;

    // slider música
    musicSlider.addEventListener('input', () => {
        const v = parseFloat(musicSlider.value || "0.5");
        if (bgMusic1) bgMusic1.volume = v;
        if (bgMusic2) bgMusic2.volume = v;
    });

    // slider efectos de sonido (SFX)
    if (sfxSlider) {
        sfxSlider.addEventListener('input', () => {
            const sv = parseFloat(sfxSlider.value || "0.7");
            if (sfxCoin) sfxCoin.volume = sv;
            if (sfxHit)  sfxHit.volume  = sv;
        });
    }

    // botones del panel
    panelPlayBtn.addEventListener('click', () => {
        if (panelMode === 'pause') {
            isPaused = false;
            hidePanel();
            playCurrentMusic();
        } else {
            resetPlaylist();
            playCurrentMusic();
            resetGame();
        }
    });

    panelRestartBtn.addEventListener('click', () => {
        resetPlaylist();
        playCurrentMusic();
        resetGame();
    });

    renderer.setAnimationLoop(loop);
    updateCamera();
}

// ========= PANEL =========
function showPanel(mode) {
    panelMode = mode;
    if (mode === 'pause') {
        panelSubtitleEl.textContent = 'Pausa';
    } else {
        panelSubtitleEl.textContent = 'Has perdido';
    }
    panelEl.style.display = 'flex';
}

function hidePanel() {
    panelEl.style.display = 'none';
    panelMode = null;
}

// ========= EVENTOS =========
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    const key = event.key;

    // ESC -> pausa
    if (key === 'Escape') {
        if (gameRunning && !isPaused) {
            window.pauseGame();
        }
        return;
    }

    // Espacio -> Play cuando está en pausa
    if (key === ' ' || key === 'Spacebar') {
        if (gameRunning && isPaused) {
            isPaused = false;
            hidePanel();
            playCurrentMusic();
        }
        return;
    }

    // movimiento solo si está corriendo y no pausado
    if (!gameRunning || isPaused) return;

    if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
        player.position.x -= laneWidth;
    } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
        player.position.x += laneWidth;
    }

    if (player.position.x > maxX) player.position.x = maxX;
    if (player.position.x < -maxX) player.position.x = -maxX;

    updateCamera();
}

// ========= LOOP =========
function loop() {
    const delta = clock.getDelta();

    if (gameRunning && !isPaused) {
        const elapsed = (performance.now() - startTime) / 1000;
        timeEl.textContent = elapsed.toFixed(0);

        // velocidad depende del tiempo pero con modificador
        speed = (speedBase + elapsed * speedGrowth) * speedModifier;

        spikeTimer += delta;
        coinTimer += delta;

        if (spikeTimer > 1.2) {
            spawnSpike();
            spikeTimer = 0;
        }

        if (coinTimer > 1.6) {
            spawnCoin();
            coinTimer = 0;
        }

        const moveDist = speed;

        // 🔄 cambio de color del suelo
        if (ground && ground.material) {
            groundHue = (groundHue + delta * 0.1) % 1;
            ground.material.color.setHSL(groundHue, 0.8, 0.5);
        }

        // movimiento de objetos
        spikes.forEach(o => {
            o.position.z += moveDist;
        });
        coins.forEach(o => {
            o.position.z += moveDist;
            o.rotation.y += delta * 4.0; // giro de coins
        });

        // colisiones pinchos
        spikes = spikes.filter(o => {
            if (o.position.z > player.position.z + 10) {
                scene.remove(o);
                return false;
            }
            const dx = o.position.x - player.position.x;
            const dz = o.position.z - player.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist < 1.0) {
                if (sfxHit) sfxHit.play().catch(()=>{});
                scene.remove(o);
                endGame('💀 Game Over: tocaste un pincho');
                return false;
            }
            return true;
        });

        // colisiones coins
        coins = coins.filter(o => {
            if (o.position.z > player.position.z + 10) {
                scene.remove(o);
                return false;
            }
            const dx = o.position.x - player.position.x;
            const dz = o.position.z - player.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist < 1.0) {
                score += 1;
                scoreEl.textContent = score.toString();

                if (sfxCoin) sfxCoin.play().catch(()=>{});

                scene.remove(o);
                return false;
            }
            return true;
        });

        // piso infinito
        ground.position.z += moveDist;
        if (ground.position.z > -40) {
            ground.position.z = -90;
        }

        // relámpagos
        lightningTimer += delta;
        if (lightningTimer > nextLightning) {
            lightningLight.intensity = 8;
            lightningDecay = 1.0;
            lightningTimer = 0;
            nextLightning = 4 + Math.random() * 6;
        }
        if (lightningDecay > 0) {
            lightningDecay -= delta * 2.5;
            if (lightningDecay <= 0) {
                lightningDecay = 0;
                lightningLight.intensity = 0;
            } else {
                lightningLight.intensity = 8 * lightningDecay;
            }
        }

        // 🎉 celebraciones cada 60s (60,120,180,...)
        if (elapsed >= nextMilestone) {
            startCelebration(nextMilestone);
            nextMilestone += milestoneStep;
        }

        updateCamera();
    }

    // actualizar confeti aunque esté pausado
    updateConfetti(delta);

    renderer.render(scene, camera);
}

/******** funciones globales para botones ********/

window.startGame = function () {
    const menu = document.getElementById('menu');
    if (menu) menu.style.display = 'none';

    if (!scene) {
        init();
    }

    resetPlaylist();
    playCurrentMusic();
    resetGame();
};

window.restartGame = function () {
    if (scene && player) {
        resetPlaylist();
        playCurrentMusic();
        resetGame();
    }
};

window.pauseGame = function () {
    if (!scene || !gameRunning) return;
    if (!isPaused) {
        isPaused = true;
        showPanel('pause');
        pauseAllMusic();
    }
};
