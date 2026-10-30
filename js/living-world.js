import * as THREE from 'three';

export class LivingWorld {
  constructor(sceneInstance, contentData) {
    this.isleScene = sceneInstance;
    this.scene = sceneInstance.scene;
    this.content = contentData;

    this.timeOfDay = 'day'; // 'day', 'dusk', 'night', 'auto'
    this.dayTime = 0.35; // 0.0 to 1.0 (0.0=dawn, 0.3=noon, 0.75=dusk, 0.9=night)
    this.isAutoFlow = true;

    this.npcs = [];
    this.animals = [];
    this.clouds = [];
    this.birds = [];
    this.shells = [];
    this.fireflies = [];

    this.initDayNightElements();
    this.buildClouds();
    this.buildBirds();
    this.buildSailboat();
    this.buildFireflies();
    this.spawnNPCs();
    this.spawnAnimals();
    this.spawnBeachShells();

    this.animate();
  }

  initDayNightElements() {
    // Starfield for night
    const starGeo = new THREE.BufferGeometry();
    const starCount = 350;
    const starPos = [];
    for (let i = 0; i < starCount; i++) {
      const u = (Math.random() - 0.5) * 500;
      const v = 60 + Math.random() * 200;
      const w = (Math.random() - 0.5) * 500;
      starPos.push(u, v, w);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, transparent: true, opacity: 0.0 })
    );
    this.scene.add(this.stars);
  }

  setTimeOfDay(mode) {
    this.timeOfDay = mode;
    this.isAutoFlow = (mode === 'auto');

    if (mode === 'day') this.dayTime = 0.35;
    if (mode === 'dusk') this.dayTime = 0.75;
    if (mode === 'night') this.dayTime = 0.95;

    this.applyDayNightLighting();
  }

  applyDayNightLighting() {
    const t = this.dayTime;
    let skyCol, fogCol, hemiSky, hemiGround, dirCol, dirIntensity, starsOpacity;
    let isNight = false;

    if (t >= 0.2 && t < 0.65) {
      // Day
      skyCol = new THREE.Color(0xa6d8d4);
      fogCol = new THREE.Color(0xdcece8);
      hemiSky = new THREE.Color(0xfff6e6);
      hemiGround = new THREE.Color(0x3d5a54);
      dirCol = new THREE.Color(0xfff1d6);
      dirIntensity = 1.4;
      starsOpacity = 0.0;
      isNight = false;
    } else if (t >= 0.65 && t < 0.85) {
      // Dusk
      skyCol = new THREE.Color(0xf0a882);
      fogCol = new THREE.Color(0xf0c59e);
      hemiSky = new THREE.Color(0xffcca0);
      hemiGround = new THREE.Color(0x56382d);
      dirCol = new THREE.Color(0xff8844);
      dirIntensity = 0.95;
      starsOpacity = 0.2;
      isNight = false;
    } else {
      // Night
      skyCol = new THREE.Color(0x0a111a);
      fogCol = new THREE.Color(0x131d27);
      hemiSky = new THREE.Color(0x22384d);
      hemiGround = new THREE.Color(0x0b1319);
      dirCol = new THREE.Color(0x7395b8);
      dirIntensity = 0.45;
      starsOpacity = 0.95;
      isNight = true;
    }

    // Smooth lerp
    this.isleScene.skyDome.material.color.copy(skyCol);
    this.isleScene.scene.fog.color.copy(fogCol);
    this.isleScene.hemiLight.color.copy(hemiSky);
    this.isleScene.hemiLight.groundColor.copy(hemiGround);
    this.isleScene.dirLight.color.copy(dirCol);
    this.isleScene.dirLight.intensity = dirIntensity;
    this.stars.material.opacity = starsOpacity;

    // Toggle lights & rainbow
    this.isleScene.setNightLights(isNight);
    if (this.isleScene.rainbow) {
      this.isleScene.rainbow.visible = !isNight;
    }
    this.fireflies.forEach(f => f.visible = isNight);
    this.birds.forEach(b => b.visible = !isNight);

    // Update Live Clock display
    const clockEl = document.getElementById('live-clock-badge');
    if (clockEl) {
      let label = isNight ? '夜晚' : (t >= 0.65 && t < 0.85 ? '黃昏' : '白天');
      const hours = Math.floor(t * 24);
      const mins = Math.floor((t * 24 - hours) * 60);
      const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      clockEl.textContent = `${label} ${timeStr}`;
    }
  }

  buildClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      flatShading: true,
      transparent: true,
      opacity: 0.88
    });

    for (let c = 0; c < 10; c++) {
      const cloud = new THREE.Group();
      const numBlobs = 3 + Math.floor(Math.random() * 3);
      for (let b = 0; b < numBlobs; b++) {
        const r = 2.4 + Math.random() * 1.8;
        const blob = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), cloudMat);
        blob.position.set((b - 1.5) * 2.2, (Math.random() - 0.5) * 1.0, (Math.random() - 0.5) * 1.5);
        cloud.add(blob);
      }
      const angle = (c / 10) * Math.PI * 2;
      const dist = 75 + Math.random() * 25;
      const height = 30 + Math.random() * 14;
      cloud.position.set(Math.cos(angle) * dist, height, Math.sin(angle) * dist);
      cloud.userData = { angle, dist, height, speed: 0.0008 + Math.random() * 0.0006 };

      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  buildBirds() {
    // V-shaped flock of birds
    const birdGeo = new THREE.ConeGeometry(0.35, 1.0, 3);
    birdGeo.rotateX(Math.PI / 2);
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x334455 });

    const flock = new THREE.Group();
    const offsets = [
      [0, 0, 0],
      [-1.5, 0, -1.2],
      [1.5, 0, -1.2],
      [-3.0, 0, -2.4],
      [3.0, 0, -2.4],
      [-4.5, 0, -3.6],
      [4.5, 0, -3.6]
    ];

    offsets.forEach(pos => {
      const b = new THREE.Mesh(birdGeo, birdMat);
      b.position.set(pos[0], pos[1], pos[2]);
      flock.add(b);
    });

    flock.position.set(0, 32, 0);
    flock.userData = { angle: 0, radius: 55, speed: 0.012, height: 32 };
    this.scene.add(flock);
    this.birds.push(flock);
  }

  buildSailboat() {
    const boatGroup = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 5.5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
    hull.position.y = 0.5;
    boatGroup.add(hull);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.0), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
    mast.position.set(0, 3.2, 0);
    boatGroup.add(mast);

    const sailGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 1.2, 0,
      0, 5.2, 0,
      2.4, 2.2, 0
    ]);
    sailGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    sailGeo.computeVertexNormals();
    const sailMesh = new THREE.Mesh(sailGeo, new THREE.MeshBasicMaterial({ color: 0xd9792f, side: THREE.DoubleSide }));
    boatGroup.add(sailMesh);

    boatGroup.position.set(55, 0, 0);
    boatGroup.userData = { angle: 0, radius: 68, speed: 0.005 };
    this.scene.add(boatGroup);
    this.sailboat = boatGroup;
  }

  buildFireflies() {
    const fireflyGeo = new THREE.SphereGeometry(0.12, 4, 4);
    const fireflyMat = new THREE.MeshBasicMaterial({ color: 0xaaff55 });

    for (let i = 0; i < 28; i++) {
      const f = new THREE.Mesh(fireflyGeo, fireflyMat);
      const isld = this.isleScene.islandPositions[Math.floor(Math.random() * this.isleScene.islandPositions.length)];
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * (isld.r * 0.7);
      f.position.set(isld.x + Math.cos(ang) * r, 3.5 + Math.random() * 2.5, isld.z + Math.sin(ang) * r);
      f.userData = { baseX: f.position.x, baseY: f.position.y, baseZ: f.position.z, seed: Math.random() * 10 };
      f.visible = false;
      this.scene.add(f);
      this.fireflies.push(f);
    }
  }

  spawnNPCs() {
    const residents = this.content.residents || [];

    residents.forEach((res, idx) => {
      const npcGroup = this.createHumanoidMesh(res.avatar, idx);
      const isld = this.isleScene.islandPositions.find(i => i.id === res.islandId) || this.isleScene.islandPositions[0];

      // Place in circular patrol area around island center
      const angle = (idx * 1.6) % (Math.PI * 2);
      const radius = 3.5 + (idx % 3) * 1.5;
      npcGroup.position.set(isld.x + Math.cos(angle) * radius, 3.2, isld.z + Math.sin(angle) * radius);

      npcGroup.userData = {
        type: 'npc',
        data: res,
        islandPos: isld,
        currentAngle: angle,
        patrolRadius: radius,
        speed: 0.008 + (idx % 3) * 0.003,
        state: 'walk', // 'walk', 'idle', 'talking'
        stateTimer: 0
      };

      this.scene.add(npcGroup);
      this.npcs.push(npcGroup);
      this.isleScene.interactiveTargets.push(npcGroup);
    });

    // 3 Delivery workers walking back & forth over bridges
    const deliveries = this.content.deliveryPersons || [];
    deliveries.forEach((del, i) => {
      const worker = this.createHumanoidMesh('📦', 20 + i);
      // Give worker a parcel box
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0xc89666 }));
      box.position.set(0, 1.4, 0.5);
      worker.add(box);

      worker.position.set(0, 2.2, 0);
      worker.userData = {
        type: 'npc',
        data: { name: del.name, title: '物流運送員', avatar: '📦', dialogues: [`正在運送物資前往各島！`, `今天配送的物品是：${del.item}`] },
        isDelivery: true,
        routeIndex: i,
        progress: Math.random(),
        targetIslandIndex: (i * 2 + 1) % 6 + 1,
        forward: true
      };

      this.scene.add(worker);
      this.npcs.push(worker);
      this.isleScene.interactiveTargets.push(worker);
    });
  }

  createHumanoidMesh(avatar, seed) {
    const group = new THREE.Group();

    // Body/Torso
    const shirtColors = [0x2f7a6b, 0xd9792f, 0x4fa5a3, 0xd9534f, 0xffbb33, 0x5a6873];
    const shirtCol = shirtColors[seed % shirtColors.length];
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.45), new THREE.MeshStandardMaterial({ color: shirtCol, roughness: 0.6 }));
    body.position.y = 1.1;
    body.castShadow = true;
    group.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.5 }));
    head.position.y = 1.85;
    head.castShadow = true;
    group.add(head);

    // Hat / Hair (Yellow Hard Hat or Cap)
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0xffcc00 }));
    hat.position.y = 2.15;
    group.add(hat);

    // Limbs: Arms & Legs
    const armGeo = new THREE.BoxGeometry(0.18, 0.65, 0.18);
    const limbMat = new THREE.MeshStandardMaterial({ color: shirtCol });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x334455 });

    const leftArm = new THREE.Mesh(armGeo, limbMat);
    leftArm.position.set(-0.45, 1.1, 0);
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, limbMat);
    rightArm.position.set(0.45, 1.1, 0);
    group.add(rightArm);

    const legGeo = new THREE.BoxGeometry(0.22, 0.7, 0.22);
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.2, 0.35, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.2, 0.35, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    group.userData.limbs = { leftArm, rightArm, leftLeg, rightLeg };

    return group;
  }

  spawnAnimals() {
    const animalDefs = this.content.animals || [];

    animalDefs.forEach((anim, i) => {
      let animalMesh;
      if (anim.type === 'rabbit') animalMesh = this.createRabbitMesh();
      else if (anim.type === 'duck') animalMesh = this.createDuckMesh();
      else if (anim.type === 'pig') animalMesh = this.createPigMesh();
      else animalMesh = this.createWhaleMesh();

      const isld = this.isleScene.islandPositions.find(x => x.id === anim.islandId) || this.isleScene.islandPositions[0];

      if (anim.type === 'whale') {
        animalMesh.position.set(45, 0.2, 35);
        animalMesh.userData = {
          type: 'animal',
          data: anim,
          isWhale: true,
          angle: 0,
          orbitR: 62,
          speed: 0.008
        };
      } else {
        const ang = (i * 2.1) % (Math.PI * 2);
        const rad = isld.r * (anim.type === 'duck' ? 0.95 : 0.6); // Ducks on shore
        animalMesh.position.set(isld.x + Math.cos(ang) * rad, (anim.type === 'duck' ? 0.8 : 3.0), isld.z + Math.sin(ang) * rad);
        animalMesh.userData = {
          type: 'animal',
          data: anim,
          islandPos: isld,
          angle: ang,
          radius: rad,
          speed: 0.012
        };
      }

      this.scene.add(animalMesh);
      this.animals.push(animalMesh);
      this.isleScene.interactiveTargets.push(animalMesh);
    });
  }

  createRabbitMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    body.position.y = 0.35;
    g.add(body);

    const earGeo = new THREE.BoxGeometry(0.1, 0.45, 0.08);
    const ear1 = new THREE.Mesh(earGeo, new THREE.MeshStandardMaterial({ color: 0xffcccc }));
    ear1.position.set(-0.12, 0.75, 0);
    const ear2 = ear1.clone();
    ear2.position.set(0.12, 0.75, 0);
    g.add(ear1);
    g.add(ear2);
    return g;
  }

  createDuckMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.6), new THREE.MeshStandardMaterial({ color: 0xffea00 }));
    body.position.y = 0.25;
    g.add(body);

    const bill = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.25), new THREE.MeshStandardMaterial({ color: 0xff6600 }));
    bill.position.set(0, 0.4, 0.35);
    g.add(bill);
    return g;
  }

  createPigMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.85), new THREE.MeshStandardMaterial({ color: 0xffb6c1 }));
    body.position.y = 0.35;
    g.add(body);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.15), new THREE.MeshStandardMaterial({ color: 0xff8da1 }));
    snout.position.set(0, 0.35, 0.48);
    g.add(snout);
    return g;
  }

  createWhaleMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(2.4, 7.5, 8), new THREE.MeshStandardMaterial({ color: 0x1f4e78, flatShading: true }));
    body.rotation.x = Math.PI / 2;
    g.add(body);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x1f4e78 }));
    tail.position.set(0, 0, -3.8);
    g.add(tail);
    return g;
  }

  spawnBeachShells() {
    const shellGeo = new THREE.SphereGeometry(0.35, 6, 4);
    shellGeo.scale(1, 0.4, 1.2);
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xfff0d0, roughness: 0.3 });

    this.isleScene.islandPositions.forEach((isld, i) => {
      const shell = new THREE.Mesh(shellGeo, shellMat);
      const angle = (i * 1.4 + 0.8) % (Math.PI * 2);
      const dist = isld.r * 1.15; // on the black sand beach
      shell.position.set(isld.x + Math.cos(angle) * dist, 0.3, isld.z + Math.sin(angle) * dist);

      shell.userData = {
        type: 'shell',
        islandId: isld.id,
        isCollected: false,
        respawnTimer: 0
      };

      this.scene.add(shell);
      this.shells.push(shell);
      this.isleScene.interactiveTargets.push(shell);
    });
  }

  respawnShell(shell) {
    shell.visible = false;
    shell.userData.isCollected = true;
    setTimeout(() => {
      shell.visible = true;
      shell.userData.isCollected = false;
    }, 20000); // 20s respawn
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.isleScene.clock.getDelta ? this.isleScene.clock.getDelta() : 0.016;
    const time = performance.now() * 0.001;

    // Auto day-night progression
    if (this.isAutoFlow && !this.isleScene.reducedMotion) {
      this.dayTime = (this.dayTime + delta * 0.005) % 1.0;
      this.applyDayNightLighting();
    }

    if (this.isleScene.reducedMotion) return;

    // Clouds drifting
    this.clouds.forEach(c => {
      c.userData.angle += c.userData.speed;
      c.position.x = Math.cos(c.userData.angle) * c.userData.dist;
      c.position.z = Math.sin(c.userData.angle) * c.userData.dist;
    });

    // Birds circling
    this.birds.forEach(b => {
      b.userData.angle += b.userData.speed;
      b.position.x = Math.cos(b.userData.angle) * b.userData.radius;
      b.position.z = Math.sin(b.userData.angle) * b.userData.radius;
      b.rotation.y = -b.userData.angle + Math.PI / 2;
    });

    // Sailboat
    if (this.sailboat) {
      this.sailboat.userData.angle += this.sailboat.userData.speed;
      this.sailboat.position.x = Math.cos(this.sailboat.userData.angle) * this.sailboat.userData.radius;
      this.sailboat.position.z = Math.sin(this.sailboat.userData.angle) * this.sailboat.userData.radius;
      this.sailboat.rotation.y = -this.sailboat.userData.angle + Math.PI;
      this.sailboat.rotation.z = Math.sin(time * 2) * 0.05;
    }

    // Fireflies bobbing
    this.fireflies.forEach(f => {
      if (f.visible) {
        f.position.y = f.userData.baseY + Math.sin(time * 3 + f.userData.seed) * 0.6;
        f.position.x = f.userData.baseX + Math.cos(time * 2 + f.userData.seed) * 0.4;
      }
    });

    // NPCs walking & limbs swing
    this.npcs.forEach(npc => {
      if (npc.userData.isDelivery) {
        // Delivery worker traversing bridge
        const isld = this.isleScene.islandPositions[npc.userData.targetIslandIndex];
        const center = new THREE.Vector3(0, 2.2, 0);
        const dest = new THREE.Vector3(isld.x, 2.8, isld.z);

        if (npc.userData.forward) {
          npc.userData.progress += 0.002;
          if (npc.userData.progress >= 1.0) {
            npc.userData.forward = false;
          }
        } else {
          npc.userData.progress -= 0.002;
          if (npc.userData.progress <= 0.0) {
            npc.userData.forward = true;
            npc.userData.targetIslandIndex = ((npc.userData.targetIslandIndex + 1) % 6) + 1;
          }
        }
        npc.position.lerpVectors(center, dest, npc.userData.progress);
        npc.lookAt(npc.userData.forward ? dest.x : center.x, 2.5, npc.userData.forward ? dest.z : center.z);
      } else if (npc.userData.state === 'walk') {
        npc.userData.currentAngle += npc.userData.speed;
        const isld = npc.userData.islandPos;
        const r = npc.userData.patrolRadius;
        const prevX = npc.position.x;
        const prevZ = npc.position.z;
        npc.position.x = isld.x + Math.cos(npc.userData.currentAngle) * r;
        npc.position.z = isld.z + Math.sin(npc.userData.currentAngle) * r;
        npc.lookAt(npc.position.x + (npc.position.x - prevX), npc.position.y, npc.position.z + (npc.position.z - prevZ));

        // Swing limbs
        if (npc.userData.limbs) {
          const swing = Math.sin(time * 6) * 0.4;
          npc.userData.limbs.leftArm.rotation.x = swing;
          npc.userData.limbs.rightArm.rotation.x = -swing;
          npc.userData.limbs.leftLeg.rotation.x = -swing;
          npc.userData.limbs.rightLeg.rotation.x = swing;
        }
      }
    });

    // Animals animation
    this.animals.forEach(a => {
      if (a.userData.isWhale) {
        a.userData.angle += a.userData.speed;
        a.position.x = Math.cos(a.userData.angle) * a.userData.orbitR;
        a.position.z = Math.sin(a.userData.angle) * a.userData.orbitR;
        a.rotation.y = -a.userData.angle + Math.PI;
        // Periodic breach / jump
        const jump = Math.sin(a.userData.angle * 4);
        a.position.y = Math.max(-0.6, jump * 2.2);
        a.rotation.x = -jump * 0.3;
      } else {
        a.userData.angle += a.userData.speed;
        const isld = a.userData.islandPos;
        a.position.x = isld.x + Math.cos(a.userData.angle) * a.userData.radius;
        a.position.z = isld.z + Math.sin(a.userData.angle) * a.userData.radius;
        a.rotation.y = -a.userData.angle;
        // Hopping
        a.position.y = 2.8 + Math.abs(Math.sin(time * 6)) * 0.4;
      }
    });
  }
}
