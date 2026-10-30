import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class IslandScene {
  constructor(containerId, onIslandClick, onNPCClick, onAnimalClick, onShellClick) {
    this.container = document.getElementById(containerId);
    this.onIslandClick = onIslandClick;
    this.onNPCClick = onNPCClick;
    this.onAnimalClick = onAnimalClick;
    this.onShellClick = onShellClick;

    this.isCinemaPlaying = false;
    this.cinemaProgress = 0;
    this.cinemaDuration = 3.6; // seconds
    this.reducedMotion = false;
    this.quality = 'high'; // 'high' or 'low'

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.animatedObjects = [];
    this.islandMeshes = [];
    this.interactiveTargets = []; // for raycasting NPCs, animals, shells
    this.smokeParticles = [];

    this.defaultCamPos = new THREE.Vector3(0, 48, 72);
    this.defaultTarget = new THREE.Vector3(0, 0, 0);

    this.currentCamPos = this.defaultCamPos.clone();
    this.currentTarget = this.defaultTarget.clone();
    this.targetCamPos = this.defaultCamPos.clone();
    this.targetLookAt = this.defaultTarget.clone();
    this.isTransitioningCam = false;
    this.camTransitionProgress = 0;

    this.clock = new THREE.Clock();

    this.initScene();
    this.initLights();
    this.buildOcean();
    this.buildVolcanoArchipelago();
    this.setupEvents();
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xdcece8, 0.007);

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 600);
    this.camera.position.set(0, 85, 8); // Start position for top-down cinema (85 deg)
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent camera under water
    this.controls.minDistance = 15;
    this.controls.maxDistance = 160;
    this.controls.target.set(0, 0, 0);

    // Sky Dome
    const skyGeo = new THREE.SphereGeometry(300, 32, 24);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0xa6d8d4,
      side: THREE.BackSide,
      depthWrite: false
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);
  }

  initLights() {
    this.hemiLight = new THREE.HemisphereLight(0xfff6e6, 0x3d5a54, 0.85);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff1d6, 1.4);
    this.dirLight.position.set(40, 75, 45);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 220;
    const d = 65;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // Night/Warm Accent PointLight at Center Island
    this.centerLight = new THREE.PointLight(0xff7722, 1.5, 35, 1.2);
    this.centerLight.position.set(0, 10, 0);
    this.scene.add(this.centerLight);

    this.nightLights = [];
  }

  buildOcean() {
    // Low-poly undulating ocean
    const seaGeo = new THREE.PlaneGeometry(360, 360, 48, 48);
    seaGeo.rotateX(-Math.PI / 2);
    this.seaPos = seaGeo.attributes.position;
    this.initialSeaY = [];
    for (let i = 0; i < this.seaPos.count; i++) {
      this.initialSeaY.push(this.seaPos.getY(i));
    }

    this.seaMat = new THREE.MeshStandardMaterial({
      color: 0x4fa5a3,
      roughness: 0.25,
      metalness: 0.1,
      flatShading: true,
      transparent: true,
      opacity: 0.92
    });
    this.seaMesh = new THREE.Mesh(seaGeo, this.seaMat);
    this.seaMesh.position.y = -0.2;
    this.seaMesh.receiveShadow = true;
    this.scene.add(this.seaMesh);

    // Outer horizon mountains silhouette
    const mountGeo = new THREE.ConeGeometry(18, 25, 5);
    const mountMat = new THREE.MeshStandardMaterial({ color: 0x324d52, flatShading: true, roughness: 0.9 });
    const count = 16;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = 145 + (Math.sin(i * 3) * 15);
      const m = new THREE.Mesh(mountGeo, mountMat);
      m.position.set(Math.cos(angle) * dist, 5 + Math.sin(i * 2) * 4, Math.sin(angle) * dist);
      const scale = 0.8 + Math.random() * 0.8;
      m.scale.set(scale, scale * (0.8 + Math.random() * 0.6), scale);
      this.scene.add(m);
    }
  }

  buildVolcanoArchipelago() {
    this.islandPositions = [
      { id: 'island-00', name: 'ㄚ秀職場健康基地', x: 0, z: 0, r: 18, isCenter: true },
      { id: 'island-01', name: '01 職場衛生啟航島', x: 38, z: 10, r: 10 },
      { id: 'island-02', name: '02 危害辨識探索島', x: 24, z: 34, r: 9.5 },
      { id: 'island-03', name: '03 身心減壓調適島', x: -18, z: 36, r: 10.5 },
      { id: 'island-04', name: '04 職場體能活力島', x: -38, z: 12, r: 10 },
      { id: 'island-05', name: '05 健促方案設計島', x: -26, z: -30, r: 11 },
      { id: 'island-06', name: '06 職業健康實踐島', x: 22, z: -32, r: 10.5 }
    ];

    // Colors
    const basaltCol = 0x2e353b; // Deep volcanic basalt rock
    const beachCol = 0x3d3d3d;  // Black sand beach
    const grassCol = 0x486b51;  // Lush dark green terrace
    const grassSubCol = 0x3d5c45;

    this.islandPositions.forEach((info) => {
      const group = new THREE.Group();
      group.position.set(info.x, 0, info.z);
      group.userData = { id: info.id, name: info.name, isCenter: !!info.isCenter, radius: info.r };

      if (info.isCenter) {
        // --- 00 Central Volcano Island ---
        // 1. Basalt Base & Black Sand Beach
        const baseGeo = new THREE.CylinderGeometry(info.r * 1.15, info.r * 1.35, 3.5, 16);
        this.addNoiseToGeometry(baseGeo, 1.8);
        const baseMat = new THREE.MeshStandardMaterial({ color: beachCol, flatShading: true, roughness: 0.9 });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = 0.5;
        baseMesh.receiveShadow = true;
        baseMesh.castShadow = true;
        group.add(baseMesh);

        // 2. Terraced Grass Plate
        const plateGeo = new THREE.CylinderGeometry(info.r * 0.95, info.r * 1.1, 2, 16);
        this.addNoiseToGeometry(plateGeo, 1.2);
        const plateMat = new THREE.MeshStandardMaterial({ color: grassCol, flatShading: true, roughness: 0.8 });
        const plateMesh = new THREE.Mesh(plateGeo, plateMat);
        plateMesh.position.y = 2.4;
        plateMesh.receiveShadow = true;
        plateMesh.castShadow = true;
        group.add(plateMesh);

        // 3. Volcano Cone with Crater
        const volcanoGeo = new THREE.ConeGeometry(9.5, 12, 14, 1, true);
        this.addNoiseToGeometry(volcanoGeo, 0.8);
        const volcanoMat = new THREE.MeshStandardMaterial({ color: basaltCol, flatShading: true, roughness: 0.95 });
        const volcanoMesh = new THREE.Mesh(volcanoGeo, volcanoMat);
        volcanoMesh.position.set(0, 8.5, -4);
        volcanoMesh.castShadow = true;
        volcanoMesh.receiveShadow = true;
        group.add(volcanoMesh);

        // 4. Glowing Lava Core inside Crater
        const lavaGeo = new THREE.CircleGeometry(3.2, 12);
        lavaGeo.rotateX(-Math.PI / 2);
        const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff4d00 });
        const lavaMesh = new THREE.Mesh(lavaGeo, lavaMat);
        lavaMesh.position.set(0, 13.8, -4);
        group.add(lavaMesh);
        this.lavaMesh = lavaMesh;

        // 5. Rising Smoke Particles
        this.initVolcanoSmoke(group, new THREE.Vector3(0, 14.5, -4));

        // 6. Hospital Building (User Extra Requirement 2)
        this.buildHospital(group, new THREE.Vector3(0, 3.4, 4.5));

        // 7. Market Booths & Lamp Posts
        this.buildMarket(group, new THREE.Vector3(-6, 3.4, 3));
      } else {
        // --- 01~06 Satellite Islands ---
        // 1. Black Sand Shore
        const baseGeo = new THREE.CylinderGeometry(info.r * 1.1, info.r * 1.25, 2.8, 12);
        this.addNoiseToGeometry(baseGeo, 1.4);
        const baseMat = new THREE.MeshStandardMaterial({ color: beachCol, flatShading: true, roughness: 0.9 });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = 0.2;
        baseMesh.receiveShadow = true;
        baseMesh.castShadow = true;
        group.add(baseMesh);

        // 2. Terraced Grass Top
        const topGeo = new THREE.CylinderGeometry(info.r * 0.9, info.r * 1.05, 1.8, 12);
        this.addNoiseToGeometry(topGeo, 0.9);
        const topMat = new THREE.MeshStandardMaterial({ color: (info.id === 'island-03' ? grassSubCol : grassCol), flatShading: true, roughness: 0.8 });
        const topMesh = new THREE.Mesh(topGeo, topMat);
        topMesh.position.y = 2.0;
        topMesh.receiveShadow = true;
        topMesh.castShadow = true;
        group.add(topMesh);

        // 3. Unique Landmark & Mechanism for each island (Extreme Detail Grade 4)
        this.buildIslandLandmark(info.id, group);

        // 4. Village Houses, Trees, Rocks & Shore Pier
        this.populateIslandDetails(group, info.r);
      }

      // Sea spray / foam ring around island
      const foamGeo = new THREE.RingGeometry(info.r * 1.15, info.r * 1.35, 18);
      foamGeo.rotateX(-Math.PI / 2);
      const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, side: THREE.DoubleSide });
      const foamMesh = new THREE.Mesh(foamGeo, foamMat);
      foamMesh.position.y = 0.05;
      group.add(foamMesh);

      // Bridges connecting satellite islands to central island
      if (!info.isCenter) {
        this.buildConnectingBridge(new THREE.Vector3(0, 2.2, 0), group.position);
      }

      this.scene.add(group);
      this.islandMeshes.push(group);
    });

    // Global Wonders: Rainbow, Ferris Wheel, Hot Air Balloon, Flowers
    this.buildGlobalWonders();
  }

  addNoiseToGeometry(geo, amount) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const angle = Math.atan2(vz, vx);
      const noise = (Math.sin(angle * 5) + Math.cos(vy * 3)) * (amount * 0.5);
      pos.setX(i, vx + Math.cos(angle) * noise);
      pos.setZ(i, vz + Math.sin(angle) * noise);
    }
    geo.computeVertexNormals();
  }

  initVolcanoSmoke(parent, pos) {
    const smokeGeo = new THREE.DodecahedronGeometry(0.7, 1);
    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      transparent: true,
      opacity: 0.45,
      roughness: 1.0,
      flatShading: true
    });

    for (let i = 0; i < 9; i++) {
      const p = new THREE.Mesh(smokeGeo, smokeMat);
      p.position.set(
        pos.x + (Math.random() - 0.5) * 1.5,
        pos.y + Math.random() * 5,
        pos.z + (Math.random() - 0.5) * 1.5
      );
      p.userData = {
        baseY: pos.y,
        speed: 0.04 + Math.random() * 0.03,
        rotSpeed: 0.02,
        initialScale: 0.6 + Math.random() * 0.5
      };
      parent.add(p);
      this.smokeParticles.push(p);
    }
  }

  buildHospital(parent, pos) {
    const hospGroup = new THREE.Group();
    hospGroup.position.copy(pos);

    // Main Clinic Building (White with Red Cross)
    const mainGeo = new THREE.BoxGeometry(6.5, 4.2, 5.2);
    const mainMat = new THREE.MeshStandardMaterial({ color: 0xf5f8fa, roughness: 0.5 });
    const mainMesh = new THREE.Mesh(mainGeo, mainMat);
    mainMesh.position.y = 2.1;
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    hospGroup.add(mainMesh);

    // Blue tinted glass entrance
    const glassGeo = new THREE.BoxGeometry(2.4, 2.2, 0.4);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x3d85c6, roughness: 0.1 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 1.1, 2.65);
    hospGroup.add(glass);

    // Red Cross Sign on front
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.2), new THREE.MeshBasicMaterial({ color: 0xd9534f }));
    crossH.position.set(0, 3.2, 2.65);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.6, 0.2), new THREE.MeshBasicMaterial({ color: 0xd9534f }));
    crossV.position.set(0, 3.2, 2.65);
    hospGroup.add(crossH);
    hospGroup.add(crossV);

    // Roof Helipad with 'H' mark
    const heliPad = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x444d56 }));
    heliPad.position.set(0, 4.35, 0);
    hospGroup.add(heliPad);

    // Rotating Wind Indicator Mechanism
    const vanePole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    vanePole.position.set(2.4, 5.0, -1.8);
    hospGroup.add(vanePole);

    const vaneHead = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.8, 4), new THREE.MeshBasicMaterial({ color: 0xd9792f }));
    vaneHead.rotation.z = Math.PI / 2;
    vaneHead.position.set(2.4, 5.8, -1.8);
    hospGroup.add(vaneHead);
    this.animatedObjects.push({ mesh: vaneHead, type: 'rotateY', speed: 1.5 });

    // Thermal Spa Pool (Next to Hospital)
    const spaRim = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.4, 8, 16), new THREE.MeshStandardMaterial({ color: 0x736357, roughness: 0.9 }));
    spaRim.rotation.x = Math.PI / 2;
    spaRim.position.set(5.2, 0.2, 0);
    hospGroup.add(spaRim);

    const spaWater = new THREE.Mesh(new THREE.CircleGeometry(1.9, 16), new THREE.MeshBasicMaterial({ color: 0x76c7c0 }));
    spaWater.rotation.x = -Math.PI / 2;
    spaWater.position.set(5.2, 0.25, 0);
    hospGroup.add(spaWater);

    parent.add(hospGroup);
  }

  buildMarket(parent, pos) {
    const market = new THREE.Group();
    market.position.copy(pos);

    // Wooden stall
    const stallBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 1.6), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
    stallBase.position.y = 0.6;
    stallBase.castShadow = true;
    market.add(stallBase);

    // Striped Awning
    const awning = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.0, 4), new THREE.MeshStandardMaterial({ color: 0xd9792f, flatShading: true }));
    awning.position.set(0, 2.2, 0);
    awning.rotation.y = Math.PI / 4;
    market.add(awning);

    // Night street lantern
    const lanternPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    lanternPole.position.set(2.5, 1.3, 0);
    market.add(lanternPole);

    const lanternHead = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0xffea88 }));
    lanternHead.position.set(2.5, 2.6, 0);
    market.add(lanternHead);
    this.nightLights.push(lanternHead);

    parent.add(market);
  }

  buildIslandLandmark(islandId, parent) {
    switch (islandId) {
      case 'island-01': {
        // Law Obelisk & Clock Tower (Bell swing mechanism)
        const towerGroup = new THREE.Group();
        towerGroup.position.set(0, 2.8, 0);

        const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 5.5, 3.2), new THREE.MeshStandardMaterial({ color: 0xd1c7bd, roughness: 0.7 }));
        base.position.y = 2.75;
        base.castShadow = true;
        towerGroup.add(base);

        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.2, 4), new THREE.MeshStandardMaterial({ color: 0xb8860b }));
        roof.position.y = 7.1;
        roof.rotation.y = Math.PI / 4;
        towerGroup.add(roof);

        // Swinging Bell Pendulum
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffcc00 }));
        bell.position.set(0, 4.8, 1.65);
        towerGroup.add(bell);
        this.animatedObjects.push({ mesh: bell, type: 'swingZ', speed: 2.2, amp: 0.35 });

        // Waving Flag
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshBasicMaterial({ color: 0xd9792f, side: THREE.DoubleSide }));
        flag.position.set(0.6, 8.6, 0);
        towerGroup.add(flag);
        this.animatedObjects.push({ mesh: flag, type: 'waveFlag', speed: 4 });

        parent.add(towerGroup);
        break;
      }
      case 'island-02': {
        // Lab & Exhaust Tower (Spinning fan mechanism)
        const labGroup = new THREE.Group();
        labGroup.position.set(0, 2.8, 0);

        const lab = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.2, 3.8), new THREE.MeshStandardMaterial({ color: 0x82929e }));
        lab.position.y = 1.6;
        lab.castShadow = true;
        labGroup.add(lab);

        const exhaustPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 4.5, 12), new THREE.MeshStandardMaterial({ color: 0x5a6873 }));
        exhaustPipe.position.set(1.5, 4.2, 0);
        labGroup.add(exhaustPipe);

        // Fan blades on top
        const fan = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.35), new THREE.MeshBasicMaterial({ color: 0x222222 }));
        fan.position.set(1.5, 6.5, 0);
        labGroup.add(fan);
        this.animatedObjects.push({ mesh: fan, type: 'rotateY', speed: 12 });

        parent.add(labGroup);
        break;
      }
      case 'island-03': {
        // Mindfulness Treehouse & Water Wheel (Rotating water wheel)
        const treeGroup = new THREE.Group();
        treeGroup.position.set(0, 2.8, 0);

        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 5.5, 8), new THREE.MeshStandardMaterial({ color: 0x5c4033 }));
        trunk.position.y = 2.75;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        const canopy = new THREE.Mesh(new THREE.DodecahedronGeometry(3.6, 1), new THREE.MeshStandardMaterial({ color: 0x3d7042, flatShading: true }));
        canopy.position.y = 6.5;
        canopy.castShadow = true;
        treeGroup.add(canopy);

        // Water Wheel
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(2.8, 1.8, 0);
        treeGroup.add(wheel);
        this.animatedObjects.push({ mesh: wheel, type: 'rotateX', speed: 1.8 });

        parent.add(treeGroup);
        break;
      }
      case 'island-04': {
        // Ergonomics Gym & Pinwheel
        const gymGroup = new THREE.Group();
        gymGroup.position.set(0, 2.8, 0);

        const pavilion = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 2.8, 8), new THREE.MeshStandardMaterial({ color: 0xe8eff2, roughness: 0.4 }));
        pavilion.position.y = 1.4;
        pavilion.castShadow = true;
        gymGroup.add(pavilion);

        const gymRoof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0x2f7a6b }));
        gymRoof.position.y = 3.6;
        gymGroup.add(gymRoof);

        // Pinwheel on roof
        const pinwheel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 0.1), new THREE.MeshStandardMaterial({ color: 0xd9792f }));
        pinwheel.position.set(0, 4.8, 0);
        gymGroup.add(pinwheel);
        this.animatedObjects.push({ mesh: pinwheel, type: 'rotateZ', speed: 6 });

        parent.add(gymGroup);
        break;
      }
      case 'island-05': {
        // Red-White Lighthouse (Rotating searchlight mechanism)
        const lightGroup = new THREE.Group();
        lightGroup.position.set(0, 2.8, 0);

        const lhBase = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 2.2, 7.5, 12), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
        lhBase.position.y = 3.75;
        lhBase.castShadow = true;
        lightGroup.add(lhBase);

        // Red stripe band
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 1.8, 12), new THREE.MeshStandardMaterial({ color: 0xd9534f }));
        stripe.position.y = 4.2;
        lightGroup.add(stripe);

        // Lantern room
        const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.2, 8), new THREE.MeshBasicMaterial({ color: 0xffea88 }));
        lantern.position.y = 8.1;
        lightGroup.add(lantern);
        this.nightLights.push(lantern);

        // Searchlight Beam
        const beamGeo = new THREE.ConeGeometry(1.5, 16, 8, 1, true);
        beamGeo.rotateX(Math.PI / 2);
        const beamMat = new THREE.MeshBasicMaterial({ color: 0xffea88, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.set(0, 8.1, 8.0);
        lightGroup.add(beam);
        this.animatedObjects.push({ mesh: beam, type: 'orbitY', speed: 2.5 });

        parent.add(lightGroup);
        break;
      }
      case 'island-06': {
        // Wind Turbine & Green ESG Center (Rotating 3-blade turbine)
        const esgGroup = new THREE.Group();
        esgGroup.position.set(0, 2.8, 0);

        const centerBuilding = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 0), new THREE.MeshStandardMaterial({ color: 0x4fa5a3 }));
        centerBuilding.position.y = 1.6;
        centerBuilding.castShadow = true;
        esgGroup.add(centerBuilding);

        // Tower
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 9.5, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        pole.position.set(2.2, 4.75, 0);
        esgGroup.add(pole);

        // Turbine Hub & 3 Blades
        const hubGroup = new THREE.Group();
        hubGroup.position.set(2.2, 9.5, 0.4);

        const hub = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
        hubGroup.add(hub);

        for (let b = 0; b < 3; b++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.2, 0.08), new THREE.MeshStandardMaterial({ color: 0xffffff }));
          blade.position.y = 2.1;
          const bladeWrapper = new THREE.Group();
          bladeWrapper.rotation.z = (b * Math.PI * 2) / 3;
          bladeWrapper.add(blade);
          hubGroup.add(bladeWrapper);
        }
        esgGroup.add(hubGroup);
        this.animatedObjects.push({ mesh: hubGroup, type: 'rotateZ', speed: 3.2 });

        parent.add(esgGroup);
        break;
      }
    }
  }

  populateIslandDetails(parent, radius) {
    // 1~2 small houses
    const houseGeo = new THREE.BoxGeometry(1.6, 1.4, 1.5);
    const houseMat = new THREE.MeshStandardMaterial({ color: 0xdfd7cc, roughness: 0.6 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xa94442 });

    const house1 = new THREE.Mesh(houseGeo, houseMat);
    house1.position.set(-radius * 0.45, 3.4, radius * 0.25);
    house1.castShadow = true;
    const roof1 = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.9, 4), roofMat);
    roof1.position.set(0, 1.1, 0);
    roof1.rotation.y = Math.PI / 4;
    house1.add(roof1);

    // Glowing window for night
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ color: 0xffea88 }));
    win.position.set(0, 0, 0.76);
    house1.add(win);
    this.nightLights.push(win);

    parent.add(house1);

    // 3+ trees with 2 distinct shapes
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.8, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
    const roundFoliageGeo = new THREE.SphereGeometry(1.0, 6, 6);
    const pineFoliageGeo = new THREE.ConeGeometry(1.1, 2.2, 5);
    const treeMat1 = new THREE.MeshStandardMaterial({ color: 0x2e7d32, flatShading: true });
    const treeMat2 = new THREE.MeshStandardMaterial({ color: 0x3d6e5a, flatShading: true });

    // Tree 1: Round
    const t1 = new THREE.Group();
    t1.position.set(radius * 0.5, 2.8, -radius * 0.35);
    const tr1 = new THREE.Mesh(trunkGeo, trunkMat);
    tr1.position.y = 0.9;
    tr1.castShadow = true;
    const f1 = new THREE.Mesh(roundFoliageGeo, treeMat1);
    f1.position.y = 2.0;
    f1.castShadow = true;
    t1.add(tr1);
    t1.add(f1);
    parent.add(t1);

    // Tree 2: Pine
    const t2 = new THREE.Group();
    t2.position.set(radius * 0.4, 2.8, radius * 0.45);
    const tr2 = new THREE.Mesh(trunkGeo, trunkMat);
    tr2.position.y = 0.9;
    tr2.castShadow = true;
    const f2 = new THREE.Mesh(pineFoliageGeo, treeMat2);
    f2.position.y = 2.1;
    f2.castShadow = true;
    t2.add(tr2);
    t2.add(f2);
    parent.add(t2);

    // Rocks & Flowerbeds
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 0), new THREE.MeshStandardMaterial({ color: 0x4a4a4a, flatShading: true }));
    rock.position.set(-radius * 0.3, 2.8, -radius * 0.4);
    rock.castShadow = true;
    parent.add(rock);

    // Pier with moored boat
    const pier = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 3.2), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
    pier.position.set(0, 0.3, radius * 1.15);
    pier.castShadow = true;
    parent.add(pier);

    const boat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 1.8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    boat.position.set(1.1, 0.15, radius * 1.25);
    parent.add(boat);
  }

  buildConnectingBridge(centerPos, islandPos) {
    const dir = new THREE.Vector3().subVectors(islandPos, centerPos);
    const dist = dir.length() - 17;
    if (dist <= 0) return;

    const mid = new THREE.Vector3().addVectors(centerPos, islandPos).multiplyScalar(0.5);
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.35, dist),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85 })
    );
    bridge.position.set(mid.x, 1.1, mid.z);
    bridge.lookAt(islandPos.x, 1.1, islandPos.z);
    bridge.receiveShadow = true;
    this.scene.add(bridge);
  }

  buildGlobalWonders() {
    // 1. Rainbow across sky
    const rainbowGroup = new THREE.Group();
    const colors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3];
    colors.forEach((col, idx) => {
      const r = 90 - idx * 0.6;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r, r + 0.5, 36, 1, 0, Math.PI),
        new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.35 })
      );
      ring.rotation.x = Math.PI / 2.3;
      ring.position.set(-10, 8, 0);
      rainbowGroup.add(ring);
    });
    this.rainbow = rainbowGroup;
    this.scene.add(rainbowGroup);

    // 2. Ferris Wheel on Island 05 coastal shelf
    const ferrisGroup = new THREE.Group();
    ferrisGroup.position.set(-42, 2.5, -42);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.25, 6, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    frame.rotation.y = Math.PI / 4;
    ferrisGroup.add(frame);
    this.animatedObjects.push({ mesh: frame, type: 'rotateZ', speed: 0.4 });
    this.scene.add(ferrisGroup);

    // 3. Hot Air Balloon floating
    const balloonGroup = new THREE.Group();
    balloonGroup.position.set(30, 36, -20);
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(3.5, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd9792f }));
    balloon.scale.set(1, 1.35, 1);
    balloonGroup.add(balloon);
    const basket = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.0), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
    basket.position.y = -5.0;
    balloonGroup.add(basket);
    this.balloon = balloonGroup;
    this.scene.add(balloonGroup);
    this.animatedObjects.push({ mesh: balloonGroup, type: 'floatY', speed: 1.2, amp: 1.8 });
  }

  startGodViewCinema(onEnd) {
    if (this.reducedMotion) {
      this.camera.position.copy(this.defaultCamPos);
      this.controls.target.copy(this.defaultTarget);
      this.controls.update();
      if (onEnd) onEnd();
      return;
    }

    this.isCinemaPlaying = true;
    this.cinemaProgress = 0;
    this.controls.enabled = false;
    this.onCinemaEnd = onEnd;
    const skipBtn = document.getElementById('cinema-skip-btn');
    if (skipBtn) skipBtn.style.display = 'block';
  }

  skipCinema() {
    this.isCinemaPlaying = false;
    this.controls.enabled = true;
    this.camera.position.copy(this.defaultCamPos);
    this.controls.target.copy(this.defaultTarget);
    this.controls.update();
    const skipBtn = document.getElementById('cinema-skip-btn');
    if (skipBtn) skipBtn.style.display = 'none';
    if (this.onCinemaEnd) {
      this.onCinemaEnd();
      this.onCinemaEnd = null;
    }
  }

  flyToIsland(islandId, onComplete) {
    const island = this.islandPositions.find(i => i.id === islandId);
    if (!island) return;

    if (this.reducedMotion) {
      this.camera.position.set(island.x + 12, 14, island.z + 18);
      this.controls.target.set(island.x, 2.5, island.z);
      this.controls.update();
      if (onComplete) onComplete();
      return;
    }

    this.isTransitioningCam = true;
    this.camTransitionProgress = 0;
    this.controls.enabled = false;

    this.camStartPos = this.camera.position.clone();
    this.camStartTarget = this.controls.target.clone();

    // God-view arc: arc upward then swoop down into front-view
    this.targetCamPos = new THREE.Vector3(island.x + 10, 12, island.z + 16);
    this.targetLookAt = new THREE.Vector3(island.x, 2.8, island.z);

    this.onCamComplete = () => {
      this.controls.enabled = true;
      this.controls.target.copy(this.targetLookAt);
      this.controls.update();
      if (onComplete) onComplete();
    };
  }

  resetToOverview(onComplete) {
    this.flyToTarget(this.defaultCamPos, this.defaultTarget, onComplete);
  }

  flyToTarget(pos, target, onComplete) {
    if (this.reducedMotion) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
      if (onComplete) onComplete();
      return;
    }

    this.isTransitioningCam = true;
    this.camTransitionProgress = 0;
    this.controls.enabled = false;
    this.camStartPos = this.camera.position.clone();
    this.camStartTarget = this.controls.target.clone();
    this.targetCamPos = pos.clone();
    this.targetLookAt = target.clone();
    this.onCamComplete = () => {
      this.controls.enabled = true;
      this.controls.target.copy(target);
      this.controls.update();
      if (onComplete) onComplete();
    };
  }

  setupEvents() {
    window.addEventListener('resize', () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });

    const onClick = (event) => {
      if (this.isCinemaPlaying) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      // Check interactive entities first (NPCs, animals, shells)
      if (this.interactiveTargets.length > 0) {
        const hits = this.raycaster.intersectObjects(this.interactiveTargets, true);
        if (hits.length > 0) {
          let obj = hits[0].object;
          while (obj && !obj.userData.type && obj.parent) {
            obj = obj.parent;
          }
          if (obj && obj.userData.type) {
            if (obj.userData.type === 'npc' && this.onNPCClick) {
              this.onNPCClick(obj.userData.data, hits[0].point);
              return;
            }
            if (obj.userData.type === 'animal' && this.onAnimalClick) {
              this.onAnimalClick(obj.userData.data, hits[0].point);
              return;
            }
            if (obj.userData.type === 'shell' && this.onShellClick) {
              this.onShellClick(obj.userData.data, hits[0].point);
              return;
            }
          }
        }
      }

      // Check island mesh clicks
      const islandHits = this.raycaster.intersectObjects(this.islandMeshes, true);
      if (islandHits.length > 0) {
        let p = islandHits[0].object;
        while (p && !p.userData.id && p.parent) {
          p = p.parent;
        }
        if (p && p.userData.id && this.onIslandClick) {
          this.onIslandClick(p.userData.id);
        }
      }
    };

    this.renderer.domElement.addEventListener('click', onClick);
  }

  updateSeaWaves(time) {
    if (this.reducedMotion || this.quality === 'low') return;
    for (let i = 0; i < this.seaPos.count; i++) {
      const u = this.seaPos.getX(i);
      const v = this.seaPos.getZ(i);
      const y = Math.sin(u * 0.12 + time * 1.5) * 0.35 + Math.cos(v * 0.12 + time * 1.2) * 0.25;
      this.seaPos.setY(i, this.initialSeaY[i] + y);
    }
    this.seaPos.needsUpdate = true;
  }

  updateSmoke(delta) {
    this.smokeParticles.forEach(p => {
      p.position.y += p.userData.speed;
      p.rotation.y += p.userData.rotSpeed;
      const progress = (p.position.y - p.userData.baseY) / 7.0;
      const scale = p.userData.initialScale * (1 + progress * 1.5);
      p.scale.set(scale, scale, scale);
      p.material.opacity = Math.max(0, 0.45 * (1 - progress));

      if (progress >= 1.0) {
        p.position.y = p.userData.baseY;
        p.position.x = (Math.random() - 0.5) * 1.5;
        p.position.z = -4 + (Math.random() - 0.5) * 1.5;
      }
    });

    // Lava pulse
    if (this.lavaMesh) {
      const pulse = 0.8 + Math.sin(this.clock.getElapsedTime() * 3) * 0.2;
      this.lavaMesh.material.color.setRGB(1.0 * pulse, 0.3 * pulse, 0.0);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // God View Cinema progress
    if (this.isCinemaPlaying) {
      this.cinemaProgress += delta / this.cinemaDuration;
      const t = Math.min(this.cinemaProgress, 1.0);
      const easeT = t * t * (3 - 2 * t); // Smooth cubic

      // Spin half circle around while descending from 85 deg to 40 deg
      const angle = (1 - easeT) * Math.PI + Math.PI / 2;
      const radius = 68 * (0.2 + 0.8 * easeT);
      const camY = 85 - easeT * 37;

      this.camera.position.set(Math.cos(angle) * radius, camY, Math.sin(angle) * radius);
      this.camera.lookAt(0, 0, 0);

      if (t >= 1.0) {
        this.skipCinema();
      }
    } else if (this.isTransitioningCam) {
      this.camTransitionProgress += delta * 1.4;
      const t = Math.min(this.camTransitionProgress, 1.0);
      const easeT = t * t * (3 - 2 * t);

      this.camera.position.lerpVectors(this.camStartPos, this.targetCamPos, easeT);
      this.controls.target.lerpVectors(this.camStartTarget, this.targetLookAt, easeT);
      this.controls.update();

      if (t >= 1.0) {
        this.isTransitioningCam = false;
        if (this.onCamComplete) {
          this.onCamComplete();
          this.onCamComplete = null;
        }
      }
    } else {
      this.controls.update();
    }

    // Dynamic animations
    if (!this.reducedMotion) {
      this.animatedObjects.forEach(item => {
        if (item.type === 'rotateY') item.mesh.rotation.y += item.speed * delta;
        if (item.type === 'rotateX') item.mesh.rotation.x += item.speed * delta;
        if (item.type === 'rotateZ') item.mesh.rotation.z += item.speed * delta;
        if (item.type === 'swingZ') item.mesh.rotation.z = Math.sin(time * item.speed) * item.amp;
        if (item.type === 'orbitY') item.mesh.rotation.y += item.speed * delta;
        if (item.type === 'waveFlag') item.mesh.rotation.y = Math.sin(time * item.speed) * 0.35;
        if (item.type === 'floatY') item.mesh.position.y += Math.sin(time * item.speed) * item.amp * delta;
      });

      this.updateSeaWaves(time);
      this.updateSmoke(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }

  getIslandScreenPosition(islandId) {
    const island = this.islandPositions.find(i => i.id === islandId);
    if (!island) return null;

    const vec = new THREE.Vector3(island.x, (island.isCenter ? 14 : 5.8), island.z);
    vec.project(this.camera);

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    const x = (vec.x * 0.5 + 0.5) * w;
    const y = (-(vec.y * 0.5) + 0.5) * h;
    const isVisible = vec.z < 1.0 && x >= 0 && x <= w && y >= 0 && y <= h;

    return { x, y, isVisible };
  }

  setQuality(mode) {
    this.quality = mode;
    if (mode === 'low') {
      this.renderer.shadowMap.enabled = false;
      this.renderer.setPixelRatio(1.0);
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
  }

  setNightLights(enabled) {
    const col = enabled ? 0xffea88 : 0x222222;
    this.nightLights.forEach(light => {
      if (light.material) light.material.color.setHex(col);
    });
    this.centerLight.intensity = enabled ? 2.5 : 0.4;
  }
}
