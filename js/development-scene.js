import * as THREE from './vendor/three-r187/three.module.min.js';
import { CSS3DObject, CSS3DRenderer } from './vendor/three-r187/CSS3DRenderer.js';
import { createDevelopmentDistrict } from './development-district.js?v=20261124-2';

const CYAN = 0x24dfff;
const PINK = 0xea51d8;

function roundedShape(width, height, radius) {
  const x = -width / 2;
  const y = -height / 2;
  return new THREE.Shape()
    .moveTo(x + radius, y)
    .lineTo(x + width - radius, y)
    .quadraticCurveTo(x + width, y, x + width, y + radius)
    .lineTo(x + width, y + height - radius)
    .quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    .lineTo(x + radius, y + height)
    .quadraticCurveTo(x, y + height, x, y + height - radius)
    .lineTo(x, y + radius)
    .quadraticCurveTo(x, y, x + radius, y);
}

function volume(width, height, depth, radius, material) {
  const geometry = new THREE.ExtrudeGeometry(roundedShape(width, height, radius), {
    depth,
    bevelEnabled: true,
    bevelThickness: .035,
    bevelSize: .025,
    bevelSegments: 3,
    curveSegments: 10,
    steps: 1
  });
  geometry.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function previewTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = kind === 'apps' ? 420 : 800;
  canvas.height = kind === 'apps' ? 840 : 510;
  const context = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const fill = context.createLinearGradient(0, 0, width, height);
  fill.addColorStop(0, '#17253e');
  fill.addColorStop(1, '#070d18');
  context.fillStyle = fill;
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#eef6ff';
  context.font = '600 32px Arial';
  context.fillText(kind === 'apps' ? 'Tu próxima app' : kind === 'web' ? 'Tu plataforma' : 'Mi empresa', 35, 90);
  context.fillStyle = '#a1b5d1';
  context.font = '20px Arial';
  context.fillText(kind === 'apps' ? 'Todo, a tu alcance.' : 'Diseñada alrededor de tu negocio.', 35, 130);
  if (kind === 'apps') {
    for (let index = 0; index < 3; index++) {
      context.fillStyle = '#182e48';
      context.beginPath();
      context.roundRect(35, 185 + index * 150, width - 70, 120, 18);
      context.fill();
      context.fillStyle = index === 0 ? '#35ddef' : '#e7f0ff';
      context.font = '600 26px Arial';
      context.fillText(['Reserva tu cita', 'Haz tu pedido', 'Sigue tu solicitud'][index], 55, 245 + index * 150);
    }
    context.fillStyle = '#10d7ed';
    context.beginPath();
    context.roundRect(35, 690, width - 70, 65, 19);
    context.fill();
    context.fillStyle = '#031626';
    context.font = '600 24px Arial';
    context.fillText('Explorar aplicación', 85, 732);
  } else {
    const labels = kind === 'business' ? ['Recibidas', 'En proceso', 'Completadas'] : ['Tu catálogo', 'Reservas', 'Tu portal'];
    labels.forEach((label, index) => {
      const x = 35 + index * 245;
      context.fillStyle = '#172c45';
      context.beginPath();
      context.roundRect(x, 180, 222, 255, 17);
      context.fill();
      context.fillStyle = index === 1 ? '#35e0ef' : '#cbdcf2';
      context.font = '600 22px Arial';
      context.fillText(label, x + 15, 218);
      for (let line = 0; line < 3; line++) {
        context.fillStyle = index === 1 ? '#1a5a70' : '#29445f';
        context.beginPath();
        context.roundRect(x + 15, 245 + line * 52, 190, 34, 8);
        context.fill();
      }
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function environment(renderer) {
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x172036, side: THREE.BackSide })));
  for (const [color, position, size] of [
    [0xdceaff, [0, 6, 5], [8, 3]],
    [0x83eaff, [-6, 1, 3], [3, 8]],
    [0xe69af8, [6, 2, 1], [2, 7]],
    [0xffffff, [1, -3, 6], [5, 1]]
  ]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    room.add(panel);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(room, .04);
  generator.dispose();
  room.traverse(object => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
  return target.texture;
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, '#ffffff90');
  gradient.addColorStop(.22, '#ffffff38');
  gradient.addColorStop(1, '#ffffff00');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export function createDevelopmentScene(root, screenElements, onSelect) {
  const art = root.querySelector('.dev-art');
  const canvasHost = root.querySelector('[data-dev-canvas]');
  const interfaceHost = root.querySelector('[data-dev-interface]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 761 ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  canvasHost.append(renderer.domElement);

  const cssRenderer = new CSS3DRenderer();
  cssRenderer.domElement.style.position = 'absolute';
  cssRenderer.domElement.style.inset = '0';
  cssRenderer.domElement.style.pointerEvents = 'none';
  interfaceHost.append(cssRenderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = environment(renderer);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 70);
  camera.position.set(0, .1, 12);
  const assembly = new THREE.Group();
  scene.add(assembly);
  scene.add(new THREE.HemisphereLight(0xc4deff, 0x100d25, 1.4));
  const key = new THREE.DirectionalLight(0xe7f4ff, 3.6);
  key.position.set(-3, 5, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -8;
  key.shadow.camera.right = key.shadow.camera.top = 8;
  key.shadow.normalBias = .035;
  scene.add(key);
  const cyanLight = new THREE.PointLight(CYAN, 42, 20, 2);
  cyanLight.position.set(-4, .5, 4);
  const pinkLight = new THREE.PointLight(PINK, 48, 20, 2);
  pinkLight.position.set(4, 1, 2);
  scene.add(cyanLight, pinkLight);

  const metal = new THREE.MeshPhysicalMaterial({ color: 0x263344, metalness: .92, roughness: .24, clearcoat: 1, clearcoatRoughness: .1 });
  const rim = new THREE.MeshPhysicalMaterial({ color: 0x91a8c9, metalness: 1, roughness: .2, clearcoat: 1 });
  const dark = new THREE.MeshPhysicalMaterial({ color: 0x080e1a, metalness: .7, roughness: .3, clearcoat: .8 });
  const accents = [
    new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false }),
    new THREE.MeshBasicMaterial({ color: PINK, toneMapped: false })
  ];

  const glowMap = glowTexture();

  const devices = {};
  const configs = {
    apps: { width: 2.04, height: 4.06, radius: .28, depth: .2, screenWidth: 1.85, screenHeight: 3.77, pixels: [320, 652], overview: [-2.85, .6, .5], rotation: [.02, .34, -.15], scale: .65 },
    web: { width: 5.75, height: 3.85, radius: .24, depth: .2, screenWidth: 5.48, screenHeight: 3.58, pixels: [900, 588], overview: [2.5, 1.26, -.5], rotation: [.04, -.32, .08], scale: .46 },
    business: { width: 6.05, height: 4.05, radius: .24, depth: .22, screenWidth: 5.78, screenHeight: 3.78, pixels: [1050, 686], overview: [2.65, -1.22, .25], rotation: [.05, -.24, .04], scale: .43 }
  };
  for (const [name, config] of Object.entries(configs)) {
    const group = new THREE.Group();
    const casing = volume(config.width, config.height, config.depth, config.radius, metal);
    group.add(casing);
    const silver = volume(config.width - .04, config.height - .04, .045, config.radius, rim);
    silver.position.z = config.depth / 2 + .03;
    group.add(silver);
    const bezel = volume(config.width - .11, config.height - .11, .025, config.radius - .04, dark);
    bezel.position.z = config.depth / 2 + .069;
    group.add(bezel);
    const edgePoints = roundedShape(config.width - .015, config.height - .015, config.radius).getPoints(80).map(point => new THREE.Vector3(point.x, point.y, config.depth / 2 + .05));
    const middle = Math.floor(edgePoints.length / 2);
    for (let side = 0; side < 2; side++) {
      const points = side ? edgePoints.slice(middle) : edgePoints.slice(0, middle + 1);
      const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 80, .009, 6, false), accents[side]);
      group.add(line);
    }
    if (name === 'apps') {
      const button = volume(.045, .42, .07, .02, rim);
      button.position.set(config.width / 2 + .035, .66, -.005);
      group.add(button);
      const cameraBump = volume(.6, .66, .14, .1, rim);
      cameraBump.position.set(-.5, 1.38, -.17);
      group.add(cameraBump);
      for (const y of [1.25, 1.52]) {
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(.105, .105, .04, 22), dark);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(-.5, y, -.27);
        group.add(lens);
      }
    }
    const preview = new THREE.Mesh(new THREE.PlaneGeometry(config.screenWidth, config.screenHeight), new THREE.MeshBasicMaterial({ map: previewTexture(name) }));
    preview.position.z = config.depth / 2 + .145;
    group.add(preview);
    const element = screenElements[name];
    element.style.width = config.pixels[0] + 'px';
    element.style.height = config.pixels[1] + 'px';
    const ui = new CSS3DObject(element);
    ui.position.copy(preview.position);
    ui.position.z += .006;
    ui.scale.set(config.screenWidth / config.pixels[0], config.screenHeight / config.pixels[1], 1);
    ui.visible = false;
    group.add(ui);
    group.traverse(object => { if (object.isMesh) object.userData.category = name; });
    group.position.set(...config.overview);
    group.rotation.set(...config.rotation);
    group.scale.setScalar(config.scale);
    assembly.add(group);
    devices[name] = { group, config, ui, preview, element };
  }

  const district = createDevelopmentDistrict({ metal, dark, rim, accents, glowMap, volume, previewTexture });
  assembly.add(district.group);
  for (const device of Object.values(devices)) device.group.visible = false;
  const cameraPosition = new THREE.Vector3();
  const cameraFocus = new THREE.Vector3();
  const cameraMatrix = new THREE.Matrix4();
  const cameraRotation = new THREE.Quaternion();
  const cameraUp = new THREE.Vector3(0, 1, 0);

  let active = null;
  let paused = reducedMotion.matches;
  let visible = true;
  let frameId = 0;
  let lastTime = 0;
  let elapsed = 0;
  let compact = false;
  let cameraTarget = 12;
  let selectionStarted = 0;
  let orbitRotation = 0;
  let dragStart;
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const projected = new THREE.Vector3();
  const aim = { x: 0, y: 0 };
  const pins = [...root.querySelectorAll('[data-dev-pin]')];

  function measure() {
    const width = art.clientWidth;
    const height = art.clientHeight;
    if (!width || !height) return;
    compact = matchMedia('(max-width: 760px)').matches;
    renderer.setSize(width, height);
    cssRenderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    for (const [name, device] of Object.entries(devices)) {
      const pixels = compact && name !== 'apps' ? [540, 740] : device.config.pixels;
      device.element.dataset.compact = String(compact && name !== 'apps');
      device.element.style.width = pixels[0] + 'px';
      device.element.style.height = pixels[1] + 'px';
      device.ui.scale.set(device.config.screenWidth / pixels[0], device.config.screenHeight / pixels[1], 1);
    }
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    if (active) {
      const config = configs[active];
      const scaleX = compact && active !== 'apps' ? .62 : 1;
      const scaleY = compact && active !== 'apps' ? 1.19 : 1;
      cameraTarget = Math.max(config.height * scaleY * 1.12 / (2 * tangent), config.width * scaleX * 1.14 / (2 * tangent * camera.aspect)) + .7;
    } else {
      cameraTarget = Math.max(16.5, 7.65 / (tangent * camera.aspect));
    }
    requestFrame();
  }

  function select(category) {
    if (category !== active) selectionStarted = performance.now();
    active = category;
    for (const [name, device] of Object.entries(devices)) {
      device.group.visible = name === active;
      device.ui.visible = name === active;
      device.preview.visible = name !== active;
      device.element.inert = name !== active;
    }
    district.group.visible = !active;
    measure();
  }

  function render(now) {
    frameId = 0;
    if (!visible || document.hidden) { lastTime = 0; return; }
    const delta = lastTime ? Math.min((now - lastTime) / 1000, .05) : .016;
    lastTime = now;
    if (!paused) elapsed += delta;
    const easing = reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 6);
    cameraPosition.set(active ? 0 : cameraTarget * .29, active ? .1 : cameraTarget * .48 + 1, cameraTarget);
    cameraFocus.set(0, active ? .1 : 1, 0);
    camera.position.lerp(cameraPosition, easing);
    cameraMatrix.lookAt(camera.position, cameraFocus, cameraUp);
    cameraRotation.setFromRotationMatrix(cameraMatrix);
    camera.quaternion.slerp(cameraRotation, easing);
    assembly.rotation.y = THREE.MathUtils.lerp(assembly.rotation.y, active ? 0 : orbitRotation + aim.x * .07, easing);
    assembly.rotation.x = THREE.MathUtils.lerp(assembly.rotation.x, active ? 0 : aim.y * .035, easing);
    district.update(elapsed);
    for (const [index, [name, device]] of Object.entries(devices).entries()) {
      const { config, group } = device;
      let position;
      let rotation;
      let scale;
      if (!active) {
        position = compact ? [[-1.65, .7, .45], [1.35, 1.42, -.4], [1.2, -1.55, .25]][index].slice() : [...config.overview];
        position[1] += Math.sin(elapsed * .8 + index * 1.7) * .075;
        rotation = [...config.rotation];
        rotation[1] += Math.sin(elapsed * .45 + index) * .06;
        const overviewScale = compact ? [.5, .35, .34][index] : config.scale;
        scale = [overviewScale, overviewScale, overviewScale];
      } else if (active === name) {
        position = [0, 0, .7];
        const entrance = reducedMotion.matches ? 1 : Math.min(1, (now - selectionStarted) / 1000);
        rotation = [.02, (compact ? -.035 : -.16) + Math.sin(entrance * Math.PI) * .55, name === 'apps' ? -.045 : .015];
        scale = compact && name !== 'apps' ? [.62, 1.19, 1] : [1, 1, 1];
      } else {
        position = [index === 0 ? -8 : 9, index === 2 ? -5 : 4, -4];
        rotation = config.rotation;
        scale = [.2, .2, .2];
      }
      group.position.lerp(new THREE.Vector3(...position), easing);
      group.scale.lerp(new THREE.Vector3(...scale), easing);
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, rotation[0], easing);
      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, rotation[1], easing);
      group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, rotation[2], easing);
    }

    renderer.render(scene, camera);
    cssRenderer.render(scene, camera);
    if (!active) {
      const width = art.clientWidth;
      const height = art.clientHeight;
      for (const pin of pins) {
        projected.copy(district.anchors[pin.dataset.devPin]);
        district.group.localToWorld(projected);
        projected.project(camera);
        const halfWidth = pin.offsetWidth / 2 + 4;
        const x = Math.max(halfWidth, Math.min(width - halfWidth, (projected.x * .5 + .5) * width));
        const offsetY = compact ? ({ business: -24, web: 10, apps: 20 }[pin.dataset.devPin]) : 0;
        const y = Math.max(28, Math.min(height - 28, (-projected.y * .5 + .5) * height + offsetY));
        pin.style.left = x + 'px';
        pin.style.top = y + 'px';
      }
    }
    root.dataset.sceneFrame = String(Math.floor(elapsed * 10));
    root.dataset.sceneState = active || 'overview';
    const settling = camera.position.distanceTo(cameraPosition) > .004 || (active && now - selectionStarted < 1600);
    if (!paused || settling) requestFrame();
  }

  function requestFrame() {
    if (!frameId && visible && !document.hidden) frameId = requestAnimationFrame(render);
  }

  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', event => {
    dragStart = { x: event.clientX, y: event.clientY, moved: false };
    if (event.pointerType === 'mouse') canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    const bounds = canvas.getBoundingClientRect();
    aim.x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    aim.y = (event.clientY - bounds.top) / bounds.height * 2 - 1;
    if (dragStart && !active && Math.abs(event.clientX - dragStart.x) > 8) {
      orbitRotation += (event.clientX - dragStart.x) * .003;
      orbitRotation = THREE.MathUtils.clamp(orbitRotation, -.4, .4);
      dragStart.x = event.clientX;
      dragStart.moved = true;
    }
    pointer.set(aim.x, -aim.y);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(district.group, true).find(intersection => intersection.object.userData.category);
    canvas.style.cursor = hit && !active ? 'pointer' : 'grab';
    requestFrame();
  });
  canvas.addEventListener('pointerup', event => {
    if (!active && dragStart && !dragStart.moved) {
      const bounds = canvas.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(district.group, true).find(intersection => intersection.object.userData.category);
      if (hit) onSelect(hit.object.userData.category);
    }
    dragStart = null;
  });
  canvas.addEventListener('pointercancel', () => { dragStart = null; });
  canvas.addEventListener('pointerleave', () => { aim.x = aim.y = 0; requestFrame(); });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    root.querySelector('.dev-loading').textContent = 'La vista 3D se está recuperando…';
    root.classList.remove('is-ready');
  });
  canvas.addEventListener('webglcontextrestored', () => { root.classList.add('is-ready'); measure(); });
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
      lastTime = 0;
    } else requestFrame();
  }, { rootMargin: '120px' });
  observer.observe(art);
  new ResizeObserver(measure).observe(art);
  document.addEventListener('visibilitychange', () => { lastTime = 0; requestFrame(); });
  measure();
  return {
    select,
    setPaused(value) { paused = value; requestFrame(); }
  };
}
