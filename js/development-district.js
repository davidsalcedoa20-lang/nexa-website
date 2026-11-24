import * as THREE from './vendor/three-r187/three.module.min.js';

const CYAN = 0x2cddff;
const PINK = 0xf54ad9;

// The overview is a small architectural scene; the existing HTML demos remain
// mounted on the device screens when the visitor enters a service.
export function createDevelopmentDistrict({ metal, dark, rim, accents, glowMap, volume, previewTexture }) {
  const group = new THREE.Group();
  const building = new THREE.Group();
  building.position.set(.1, .03, -1.15);
  group.add(building);
  const pulses = [];
  const glows = [];
  const glowMaterial = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x426689, metalness: .28, roughness: .15, transparent: true, opacity: .19, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 });
  const pinkGlass = new THREE.MeshPhysicalMaterial({ color: 0xd354d2, metalness: .25, roughness: .16, transparent: true, opacity: .14, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 });
  const warm = new THREE.MeshBasicMaterial({ color: 0xffc894 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x60738f, metalness: .9, roughness: .25 });
  const surface = new THREE.MeshPhysicalMaterial({ color: 0x111b2d, metalness: .7, roughness: .32, clearcoat: .8 });
  const slab = new THREE.MeshPhysicalMaterial({ color: 0x080d19, metalness: .62, roughness: .34, clearcoat: .7 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x65505c, metalness: .1, roughness: .5 });
  const monitor = new THREE.MeshBasicMaterial({ color: 0x376b82 });
  const edge = new THREE.MeshBasicMaterial({ color: 0x5e789b, transparent: true, opacity: .45 });
  const batches = new Map();
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  function box(parent, material, size, position, category) {
    if (!batches.has(parent)) batches.set(parent, new Map());
    const materials = batches.get(parent);
    if (!materials.has(material)) materials.set(material, []);
    materials.get(material).push({ size, position, category });
  }
  function tube(parent, points, radius, material) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), false, 'centripetal');
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(32, points.length * 14), radius, 6, false), material);
    parent.add(mesh);
    return curve;
  }
  function halo(parent, position, color, scale, opacity = .32) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    sprite.position.set(...position);
    sprite.scale.setScalar(scale);
    parent.add(sprite);
    return sprite;
  }
  function horizontalPlate(parent, width, depth, height, y, material, x = 0, z = 0, radius = .2) {
    const plate = volume(width, depth, height, radius, material);
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(x, y, z);
    parent.add(plate);
    return plate;
  }
  function border(parent, width, depth, y, x, z, color) {
    const radius = .28;
    const points = [];
    for (let side = 0; side < 4; side++) {
      const cx = (side === 0 || side === 3 ? 1 : -1) * (width / 2 - radius);
      const cz = (side < 2 ? 1 : -1) * (depth / 2 - radius);
      const start = side * Math.PI / 2;
      for (let step = 0; step <= 8; step++) {
        const angle = start + step * Math.PI / 16;
        points.push([x + cx + Math.cos(angle) * radius, y, z + cz + Math.sin(angle) * radius]);
      }
    }
    points.push(points[0]);
    tube(parent, points, .012, color === PINK ? accents[1] : accents[0]);
    tube(parent, points, .07, glowMaterial(color, .10));
  }

  // One continuous dark platform gives the three services a shared foundation.
  horizontalPlate(group, 14.4, 8.1, .4, -.39, dark, 0, .4, .8);
  horizontalPlate(group, 14.4, 8.1, .055, -.16, surface, 0, .4, .8);
  border(group, 14.1, 7.8, -.30, 0, .4, CYAN);
  tube(group, [[-6.6,-.25,4.2],[-3,-.25,4.3],[1,-.25,4.3],[5,-.25,4.1],[6.8,-.25,3.4]], .018, accents[1]);
  halo(group, [-5, -.12, 2.8], CYAN, 5.2, .19);
  halo(group, [4, -.12, 3], PINK, 5.8, .2);

  // Three floors with visible slabs, mullions, desks and warm interior details.
  horizontalPlate(building, 5.1, 3.45, .16, 0, metal, 0, 0, .15);
  for (let floor = 0; floor < 4; floor++) {
    const y = .24 + floor * 1.05;
    box(building, floor === 3 ? glass : slab, [4.7, .07, 3], [0, y, 0], 'business');
    box(building, edge, [4.73, .015, 3.03], [0, y + .065, 0], 'business');
    if (floor === 3) continue;
    // Office islands and chairs, visible through the glass facade.
    for (const x of [-1.55, -.55, .55, 1.55]) {
      box(building, wood, [.72, .045, .42], [x, y + .38, .55], 'business');
      box(building, rim, [.045, .33, .045], [x, y + .18, .55], 'business');
      box(building, frame, [.27, .23, .025], [x, y + .53, .53], 'business');
      box(building, monitor, [.23, .18, .01], [x, y + .53, .548], 'business');
      box(building, dark, [.22, .20, .22], [x, y + .22, .92], 'business');
    }
    for (const x of [-1.7, 0, 1.7]) {
      box(building, warm, [.7, .012, .055], [x, y + .94, .75], 'business');
      box(building, frame, [.035, .90, .035], [x, y + .5, 1.51], 'business');
    }
    box(building, glass, [4.6, .91, .015], [0, y + .52, 1.52], 'business');
    box(building, pinkGlass, [.015, .91, 2.95], [2.36, y + .52, 0], 'business');
    box(building, glass, [.015, .91, 2.95], [-2.36, y + .52, 0], 'business');
    box(building, accents[1], [4.65, .018, .02], [0, y + .01, 1.56], 'business');
  }
  for (const x of [-2.36, -1.18, 0, 1.18, 2.36]) {
    box(building, frame, [.028, 3.17, .028], [x, 1.83, 1.55], 'business');
    box(building, frame, [.028, 3.17, .028], [x, 1.83, -1.5], 'business');
  }
  for (const z of [-1.5, -.5, .5, 1.5]) for (const x of [-2.36, 2.36]) box(building, frame, [.028, 3.17, .028], [x, 1.83, z], 'business');
  horizontalPlate(building, 4.95, 3.2, .10, 3.53, glass, 0, 0, .08);
  border(building, 4.8, 3.05, 3.49, 0, 0, PINK);
  for(const x of [-1.2,0,1.2])box(building,frame,[.018,.018,3.05],[x,3.6,0],'business');
  for(const z of [-.8,.8])box(building,frame,[4.75,.018,.018],[0,3.6,z],'business');
  for(let rack=0;rack<3;rack++){
    const x=1.25+rack*.33;
    box(building,dark,[.27,.78,.40],[x,2.82,-.8],'business');
    for(let row=0;row<6;row++){
      box(building,frame,[.22,.026,.015],[x,2.55+row*.105,-.59],'business');
      box(building,accents[row%2],[.032,.025,.018],[x+.065,2.59+row*.105,-.58],'business');
    }
  }
  for (let step = 0; step < 4; step++) {
    const y = -.04 + step * .065;
    box(building, metal, [1.8, .065, .25], [0, y, 2.4 - step * .23], 'business');
    box(building, accents[1], [1.8, .012, .025], [0, y + .034, 2.53 - step * .23], 'business');
  }

  // A translucent process panel and a small 3D bar chart identify the business.
  const dashboard = new THREE.Group();
  dashboard.position.set(.35, 2.20, 1.82);
  const dashFrame = volume(2.5, 1.55, .08, .12, dark);
  dashboard.add(dashFrame);
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 700;
  textureCanvas.height = 430;
  const ctx = textureCanvas.getContext('2d');
  ctx.fillStyle = '#14223bf2'; ctx.fillRect(0,0,700,430);
  ctx.font = '600 32px Arial'; ctx.fillStyle = '#eef6ff'; ctx.fillText('Todo, conectado.', 40, 65);
  for (let row = 0; row < 3; row++) {
    const y = 120 + row * 95;
    ctx.strokeStyle = '#48e6ff'; ctx.lineWidth = 4; ctx.strokeRect(40, y, 38, 38);
    ctx.beginPath(); ctx.moveTo(48,y+18); ctx.lineTo(58,y+29); ctx.lineTo(77,y+5); ctx.stroke();
    ctx.fillStyle = '#728aa8'; ctx.beginPath(); ctx.roundRect(110,y+4,460-row*65,12,6); ctx.fill();
    ctx.fillStyle = row === 1 ? '#ed74d4' : '#2ecce7'; ctx.beginPath(); ctx.roundRect(110,y+26,230+row*55,8,4); ctx.fill();
  }
  const dashTexture = new THREE.CanvasTexture(textureCanvas); dashTexture.colorSpace = THREE.SRGBColorSpace;
  const dashScreen = new THREE.Mesh(new THREE.PlaneGeometry(2.38, 1.43), new THREE.MeshBasicMaterial({map:dashTexture}));
  dashScreen.position.z = .09; dashboard.add(dashScreen);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(dashFrame.geometry), accents[1]); dashboard.add(outline);
  dashboard.traverse(object => { if (object.isMesh) object.userData.category = 'business'; });
  building.add(dashboard);
  for (let index = 0; index < 3; index++) {
    box(building, index === 2 ? accents[1] : accents[0], [.26, .4+index*.25, .3], [-1.85+index*.35, 1.65+index*.125, 1.73], 'business');
  }
  halo(building, [0,3.5,1], PINK, 3.4, .32);

  // The web and app pavilions sit on their own low pedestals.
  horizontalPlate(group, 4.6, 1.6, .17, .01, metal, -4.25, 2.4, .3);
  border(group, 4.4, 1.5, .11, -4.25, 2.4, CYAN);
  const browser = new THREE.Group();
  browser.position.set(-4.25, 1.88, 2.25);
  browser.rotation.y = .12;
  const browserFrame = volume(4.1, 2.9, .14, .18, glass);
  browser.add(browserFrame);
  const browserRim = new THREE.LineSegments(new THREE.EdgesGeometry(browserFrame.geometry, 25), accents[0]); browser.add(browserRim);
  const webTexture = new THREE.CanvasTexture(webPreview()); webTexture.colorSpace = THREE.SRGBColorSpace;
  const webScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.9,2.68), new THREE.MeshBasicMaterial({map:webTexture,transparent:true,opacity:.88}));
  webScreen.position.z = .13; browser.add(webScreen);
  browser.traverse(object => { if (object.isMesh) object.userData.category = 'web'; });
  group.add(browser);
  halo(group, [-4.25, .6, 2.5], CYAN, 3.6, .3);

  const appBase = new THREE.Mesh(new THREE.CylinderGeometry(2.13,2.22,.20,64), surface);
  appBase.position.set(4.15,.03,2); group.add(appBase);
  const appRing = new THREE.Mesh(new THREE.TorusGeometry(2.13,.015,6,80),accents[1]);
  appRing.rotation.x = -Math.PI/2; appRing.position.set(4.15,.15,2); group.add(appRing);
  const phones = [];
  for (let index=0; index<2; index++) {
    const phone = new THREE.Group();
    phone.position.set(3.45+index*1.35,1.64,1.95+index*.22);
    phone.rotation.set(.025,index === 0 ? -.13 : .1,index === 0 ? -.07 : .10);
    const body = volume(1.44,2.83,.17,.20,metal); phone.add(body);
    const bezel = volume(1.36,2.74,.035,.18,dark); bezel.position.z=.12; phone.add(bezel);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.23,2.53),new THREE.MeshBasicMaterial({map:appPreview(index)}));
    screen.position.z=.215; phone.add(screen);
    const notch = volume(.53,.12,.02,.055,dark); notch.position.set(0,1.18,.25);phone.add(notch);
    const side = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry,25),accents[index]);phone.add(side);
    phone.traverse(object => { if (object.isMesh) object.userData.category='apps'; });
    group.add(phone); phones.push(phone);
  }
  halo(group,[4,.45,2.6],PINK,3.3,.23);

  // Planters and deterministic leaf clusters add scale without external assets.
  const leafGeometry = new THREE.IcosahedronGeometry(.09,1);
  const leafMaterial = new THREE.MeshStandardMaterial({color:0x276b7a,metalness:.2,roughness:.6,emissive:0x06323a,emissiveIntensity:.3});
  const plants = [[-5.8,1.7,CYAN],[-2.6,-1.1,PINK],[-2.9,1.0,PINK],[2.5,-1.9,PINK],[5.8,2.7,PINK]];
  const leafMesh = new THREE.InstancedMesh(leafGeometry,leafMaterial,plants.length*100);
  let leafIndex=0;
  for (const [x,z,color] of plants) {
    horizontalPlate(group,.75,.75,.3,.13,dark,x,z,.15);
    box(group,frame,[.045,.8,.045],[x,.65,z]);
    for (let index=0;index<100;index++) {
      const angle=index*2.39996;
      const radius=.17+Math.sin(index*7.12)*.20;
      const y=.65+(index%9)*.058;
      matrix.compose(new THREE.Vector3(x+Math.cos(angle)*radius,y,z+Math.sin(angle)*radius),rotation,new THREE.Vector3(1.45,.5,.9));
      leafMesh.setMatrixAt(leafIndex,matrix);
      leafMesh.setColorAt(leafIndex++,new THREE.Color(color).multiplyScalar(.24+(index%4)*.06));
    }
    halo(group,[x,.75,z],color,1.1,.17);
  }
  group.add(leafMesh);

  // Each road has a dim rail, a bright filament, and a moving white-hot pulse.
  const routes = [
    {color:CYAN,speed:.14,phase:.08,points:[[-4.25,.03,2.1],[-4.1,.03,3.4],[-2.8,.03,3.6],[-1.55,.03,2.9],[-1.65,.03,1.8],[-.8,.03,1.0]]},
    {color:CYAN,speed:.11,phase:.44,points:[[1.4,.03,.6],[2.05,.03,1.05],[1.95,.03,2.5],[2.6,.03,3.4],[3.85,.03,3.6],[4.3,.03,2.45]]},
    {color:PINK,speed:.09,phase:.73,points:[[-5.35,.035,2.4],[-5.25,.035,.25],[-3.5,.035,-2.1],[-1.55,.035,-3],[2.5,.035,-2.8],[4.7,.035,-.6],[4.85,.035,2]]}
  ];
  for (const route of routes) {
    const curve = tube(group,route.points,.020,new THREE.MeshBasicMaterial({color:route.color,toneMapped:false}));
    tube(group,route.points,.055,glowMaterial(route.color,.13));
    tube(group,route.points,.12,glowMaterial(route.color,.035));
    const material = new THREE.ShaderMaterial({
      uniforms:{uTime:{value:0},uSpeed:{value:route.speed},uPhase:{value:route.phase},uColor:{value:new THREE.Color(route.color)}},
      vertexShader:'varying float vDistance; void main(){vDistance=uv.x;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'uniform float uTime;uniform float uSpeed;uniform float uPhase;uniform vec3 uColor;varying float vDistance;void main(){float d=fract(uTime*uSpeed+uPhase-vDistance);float trail=pow(max(0.0,1.0-d/0.18),2.8);float head=exp(-d*d/0.00008);float strength=max(trail*0.85,head);if(strength<0.005)discard;gl_FragColor=vec4(mix(uColor,vec3(1.0),head*0.92),strength);}',
      transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false
    });
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve,180,.048,6,false),material));
    const head=halo(group,route.points[0],route.color,.76,.85);
    const whiteHead=halo(group,route.points[0],0xffffff,.22,.92);
    pulses.push({curve,material,head,whiteHead,speed:route.speed,phase:route.phase});
    const endpoint=halo(group,route.points[route.points.length-1],route.color,.55,.5);
    glows.push({sprite:endpoint,phase:route.phase,speed:route.speed});
  }

  // Batch office details and structural bars to keep draw calls bounded on phones.
  for (const [parent,materials] of batches) for (const [material,items] of materials) {
    const mesh=new THREE.InstancedMesh(unitBox,material,items.length);
    items.forEach((item,index)=>{
      matrix.compose(new THREE.Vector3(...item.position),rotation,new THREE.Vector3(...item.size));
      mesh.setMatrixAt(index,matrix);
    });
    mesh.castShadow=!material.transparent; mesh.receiveShadow=true;
    const category=items.find(item=>item.category)?.category;
    if(category) mesh.userData.category=category;
    parent.add(mesh);
  }
  const anchors={web:new THREE.Vector3(-3.4,3.65,2.25),business:new THREE.Vector3(.1,4.15,-1.15),apps:new THREE.Vector3(4.15,3.5,2)};
  return {
    group,anchors,
    update(time){
      for(const pulse of pulses){
        pulse.material.uniforms.uTime.value=time;
        const progress=(time*pulse.speed+pulse.phase)%1;
        pulse.head.position.copy(pulse.curve.getPointAt(progress));
        pulse.head.position.y+=.06;
        pulse.whiteHead.position.copy(pulse.head.position);
      }
      for(const glow of glows){
        const phase=(time*glow.speed+glow.phase)%1;
        glow.sprite.material.opacity=.20+Math.pow(phase,8)*.55;
      }
    }
  };

  function webPreview(){
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=680;
    const c=canvas.getContext('2d');
    c.fillStyle='#0c1c32';c.fillRect(0,0,1000,680);
    c.fillStyle='#173a56';c.fillRect(0,0,1000,74);
    for(let i=0;i<3;i++){c.fillStyle=['#5ae9ff','#eb6fdf','#b9b1e9'][i];c.beginPath();c.arc(35+i*36,37,9,0,Math.PI*2);c.fill();}
    c.fillStyle='#487690';c.beginPath();c.roundRect(190,25,680,24,10);c.fill();
    c.fillStyle='#d1edff';c.font='600 42px Arial';c.fillText('Tu negocio. Sin límites.',50,158);
    c.strokeStyle='#48deff';c.lineWidth=3;c.beginPath();c.moveTo(50,335);c.bezierCurveTo(170,420,220,210,370,320);c.bezierCurveTo(490,410,540,230,650,292);c.bezierCurveTo(770,360,820,222,950,260);c.stroke();
    const g=c.createLinearGradient(0,270,0,460);g.addColorStop(0,'#2ae5ff44');g.addColorStop(1,'#e755d90c');c.lineTo(950,450);c.lineTo(50,450);c.fillStyle=g;c.fill();
    for(let i=0;i<3;i++){c.fillStyle='#1d324c';c.beginPath();c.roundRect(50+i*312,490,280,130,15);c.fill();c.fillStyle=i===2?'#d56fcb':'#4aafca';c.beginPath();c.roundRect(72+i*312,516,150,12,6);c.fill();c.fillStyle='#38536b';c.fillRect(72+i*312,551,220,8);c.fillRect(72+i*312,577,170,8);}
    return canvas;
  }
  function appPreview(index){
    if(index===0)return previewTexture('apps');
    const canvas=document.createElement('canvas');canvas.width=420;canvas.height=840;
    const c=canvas.getContext('2d');c.fillStyle='#101c32';c.fillRect(0,0,420,840);
    c.fillStyle='#e7f5ff';c.font='600 30px Arial';c.fillText('Tu negocio',35,145);
    c.strokeStyle='#263a56';c.lineWidth=45;c.beginPath();c.arc(210,345,105,0,Math.PI*2);c.stroke();
    const grad=c.createLinearGradient(100,200,300,470);grad.addColorStop(0,'#29dfff');grad.addColorStop(1,'#f358db');c.strokeStyle=grad;c.beginPath();c.arc(210,345,105,-Math.PI/2,Math.PI*.92);c.stroke();
    c.fillStyle='#f5f8ff';c.font='600 48px Arial';c.fillText('86%',163,360);
    for(let i=0;i<3;i++){c.fillStyle='#233b56';c.beginPath();c.roundRect(42,525+i*70,336,42,10);c.fill();c.fillStyle=i===1?'#ce65ca':'#3aabc9';c.beginPath();c.roundRect(60,540+i*70,190-i*25,10,5);c.fill();}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
  }
}
