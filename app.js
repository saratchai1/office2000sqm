import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Office 2000 executive presentation MVP.
 * All dimensions and systems in buildDemo() are illustrative only.
 * The real building is loaded locally from a self-contained .glb file.
 */

const el = (id) => document.getElementById(id);
const stage = el('viewer-stage');
const status = el('view-status');
const state = {
  mode: 'demo',
  floor: 'all',
  view: 'iso',
  layers: { architecture: true, structure: true, mep: true },
  exploded: false,
  modelName: 'อาคารสาธิต 4 ชั้น',
  importRoot: null,
  importMeshes: [],
  floorMetadata: false,
  layerMetadata: false,
};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
renderer.setClearColor(0xe0e9e8);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.domElement.setAttribute('aria-label', 'โมเดลสามมิติ สามารถลากเพื่อหมุนและซูมได้');
renderer.domElement.setAttribute('tabindex', '0');
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe0e9e8);
scene.fog = new THREE.Fog(0xe0e9e8, 90, 230);
const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 600);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 9;
controls.maxDistance = 240;
controls.maxPolarAngle = Math.PI * 0.495;
controls.screenSpacePanning = true;
controls.target.set(0, 8, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0xa6b0a8, 2.5));
const sunlight = new THREE.DirectionalLight(0xfff7e9, 3.0);
sunlight.position.set(-32, 55, 29);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
sunlight.shadow.camera.left = -65;
sunlight.shadow.camera.right = 65;
sunlight.shadow.camera.top = 65;
sunlight.shadow.camera.bottom = -65;
sunlight.shadow.camera.near = 0.5;
sunlight.shadow.camera.far = 160;
sunlight.shadow.bias = -0.00018;
scene.add(sunlight);

const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.74, metalness: 0.05, ...options });
const M = {
  concrete: mat(0xe5e9e5),
  white: mat(0xf7f9f4),
  stone: mat(0xc8d0cb),
  steel: mat(0x344e56, { metalness: 0.66, roughness: 0.35 }),
  glass: mat(0x8aafbd, { transparent: true, opacity: 0.40, roughness: 0.18, metalness: 0.26, depthWrite: false, side: THREE.DoubleSide }),
  doorGlass: mat(0x9cc3c4, { transparent: true, opacity: 0.58, roughness: 0.1, metalness: 0.3, depthWrite: false }),
  grass: mat(0xbdd1be),
  pavement: mat(0xbecbca),
  path: mat(0xf4f3eb),
  leaf: mat(0x6f9981),
  leafLight: mat(0x95b49a),
  trunk: mat(0x6c7166),
  wood: mat(0xbba789),
  blue: mat(0x4d95c4, { metalness: 0.3 }),
  red: mat(0xc97867, { metalness: 0.25 }),
  teal: mat(0x6bb7a1, { metalness: 0.3 }),
  duct: mat(0x86b1aa, { metalness: 0.55, roughness: 0.36 }),
  light: mat(0xfff8de, { emissive: 0xffeecc, emissiveIntensity: 0.17 }),
  accent: mat(0xa38e66),
};
const addBox = (parent, width, height, depth, material, x, y, z, name = '') => {
  const obj = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  obj.position.set(x, y, z);
  obj.castShadow = true;
  obj.receiveShadow = true;
  obj.name = name;
  parent.add(obj);
  return obj;
};
const addCylinder = (parent, radius, length, material, x, y, z, name = '', sides = 12) => {
  const obj = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, sides), material);
  obj.position.set(x, y, z);
  obj.castShadow = true;
  obj.name = name;
  parent.add(obj);
  return obj;
};
const addPipe = (parent, from, to, radius, material, name = '') => {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const middle = a.clone().add(b).multiplyScalar(0.5);
  const mesh = addCylinder(parent, radius, a.distanceTo(b), material, middle.x, middle.y, middle.z, name, 10);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return mesh;
};

const demo = new THREE.Group();
demo.name = 'SAMPLE ONLY — Not the real architectural design';
const floorGroups = new Map();
const roofArchitecture = new THREE.Group();
const roofMep = new THREE.Group();
const siteGroup = new THREE.Group();
demo.add(siteGroup);

function buildSite() {
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(165, 165), M.grass);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.43;
  plane.receiveShadow = true;
  siteGroup.add(plane);
  const grid = new THREE.GridHelper(160, 80, 0xb2c5bd, 0xb2c5bd);
  grid.position.y = -0.385;
  grid.material.transparent = true;
  grid.material.opacity = 0.14;
  siteGroup.add(grid);
  addBox(siteGroup, 28, 0.25, 22.5, M.pavement, 0, -0.22, 0, 'Site perimeter');
  addBox(siteGroup, 12, 0.08, 16, M.path, 0, -0.07, 18, 'Main walkway');
  addBox(siteGroup, 68, 0.06, 8, M.pavement, 0, -0.32, 31, 'Access road');
  addBox(siteGroup, 29, 0.1, 2, M.path, 0, -0.14, 12, 'Front apron');
  const lines = mat(0xf6f7f2);
  for (let i = -3; i <= 3; i++) addBox(siteGroup, 0.1, 0.07, 5.5, lines, 6.6 * i, -0.25, 31, 'Parking bay marking');
  for (const [x, z] of [[-20,-12],[-26,1],[-20,17],[-23,24],[23,19],[25,-7],[31,9],[-33,-16],[32,-18]]) {
    addCylinder(siteGroup, 0.16, 2.1, M.trunk, x, 0.8, z, 'Tree trunk');
    const canopy = new THREE.Group();
    canopy.position.set(x, 2.45, z);
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), (x < 0 ? M.leaf : M.leafLight));
    mesh.scale.set(1.1, 1.2, 1.1); mesh.castShadow = true; canopy.add(mesh); siteGroup.add(canopy);
  }
  // Minimal vehicle silhouettes for a sense of scale.
  for (const [x,z] of [[-18,31],[19,31]]) {
    addBox(siteGroup, 4.35, 0.75, 2.1, M.white, x, 0.25, z, 'Scale vehicle');
    addBox(siteGroup, 2.5, 0.72, 1.85, M.glass, x, 0.95, z, 'Scale vehicle roof');
    for (const dx of [-1.35,1.35]) for(const dz of [-1.0,1.0]) addCylinder(siteGroup,0.42,0.18,M.steel,x+dx,-0.05,z+dz,'Wheel');
  }
}

function makeArchitecture(parent, floor, y) {
  addBox(parent, 25.7, 0.36, 20.7, M.concrete, 0, y + 0.08, 0, `Floor ${floor} slab`);
  addBox(parent, 25.7, 0.18, 20.7, M.steel, 0, y + 3.67, 0, `Floor ${floor} spandrel band`);
  const facade = new THREE.Group();
  facade.name = `Floor ${floor} glass façade`;
  parent.add(facade);
  const faceTop = y + 3.42;
  for (let i = 0; i < 12; i++) {
    const x = -11 + i * 2.0;
    for (const z of [-10.2, 10.2]) {
      if (floor === 1 && z > 0 && (i === 5 || i === 6)) continue;
      addBox(facade, 1.89, 3.02, 0.07, M.glass, x, y + 1.94, z, 'Glazed panel');
      addBox(facade, 0.055, 3.18, 0.12, M.steel, x - 0.96, y + 1.94, z, 'Mullion');
      addBox(facade, 1.94, 0.048, 0.12, M.steel, x, y + 1.0, z, 'Window transom');
    }
  }
  for (let i = 0; i < 10; i++) {
    const z = -9 + 2 * i;
    for (const x of [-12.7, 12.7]) {
      addBox(facade, 0.07, 3.02, 1.9, M.glass, x, y + 1.94, z, 'Side glass panel');
      addBox(facade, 0.12, 3.2, 0.055, M.steel, x, y + 1.94, z - 0.96, 'Side mullion');
      addBox(facade, 0.12, 0.045, 1.9, M.steel, x, y + 1.0, z, 'Side transom');
    }
  }
  if(floor === 1){
    for(const x of [-1.0,1.0]) {
      addBox(parent, 1.91, 3, 0.07, M.doorGlass, x, y + 1.75, 10.22, 'Main entry door');
      addBox(parent, 0.065, 2.95, 0.10, M.steel, x - .95, y + 1.75, 10.28, 'Door frame');
      addBox(parent, 0.07, .65, .08, M.steel, x + (x > 0 ? -.72 : .72), y + 1.7, 10.45, 'Door handle');
    }
    addBox(parent, 8, 0.21, 2.7, M.white, 0, y + 3.34, 11.46, 'Entrance canopy');
    for(const x of [-3.8,3.8]) addBox(parent, 0.13, 3.1, 0.13, M.steel, x, y + 1.6, 12.3, 'Canopy support');
  }
  // A few schematic interior partitions, desks and lights.
  for (const z of [-3.5, 3.3]) {
    addBox(parent, 10.5, 2.6, 0.13, M.white, -5.4, y + 1.52, z, 'Interior partition');
    addBox(parent, 0.12, 2.6, 4, M.white, 6.5, y + 1.52, z + 1.5, 'Room divider');
  }
  for (const [x,z] of [[-7,-6.5],[-2,-6.5],[4.3,-6.5],[-7,6],[-2,6],[4.3,6]]) {
    addBox(parent, 2.0, .08, .9, M.wood, x, y + 1.05, z, 'Office desk');
    for (const dx of [-.85,.85]) addBox(parent, .06, 1, .06, M.steel, x+dx,y+.56,z-.3,'Desk leg');
    addBox(parent, .51, .1, .52, M.steel, x, y + .59, z + .88, 'Office chair seat');
    addBox(parent, .51, .69, .08, M.steel, x, y + 1.02, z + 1.12, 'Office chair back');
  }
  for(const x of [-8,-2,4,9])for (const z of [-6.8,0,6.8]) {
    addBox(parent, .75, .04, .75, M.light, x, faceTop -.02, z, 'Ceiling LED panel');
  }
}

function makeStructure(parent, floor, y) {
  for (const x of [-11.2, -3.73, 3.73, 11.2]) for (const z of [-8.5, 0, 8.5]) {
    addBox(parent, 0.48, 3.42, 0.48, M.stone, x, y + 1.94, z, `Floor ${floor} structural column`);
  }
  for(const z of [-8.5, 0, 8.5]) addBox(parent, 22.8, .46, .4, M.stone, 0, y + 3.42, z, 'Concrete structural beam');
  for(const x of [-11.2, -3.73, 3.73, 11.2]) addBox(parent, .4, .46, 17.7, M.stone, x, y + 3.42, 0, 'Concrete structural beam');
}

function makeMEP(parent, floor, y) {
  addBox(parent, .72, .42, 15.7, M.duct, 1.15, y + 3.02, 0, 'HVAC supply duct');
  for (const z of [-5, 0, 5]) {
    addBox(parent, 9, .30, .42, M.duct, -3.3, y + 3.05, z, 'HVAC branch duct');
    addBox(parent, 1.0, .15, 1.0, M.white, -7.3, y + 3.37, z, '4-way cassette air conditioner');
    addBox(parent, .58, .045, .58, M.steel, -7.3, y + 3.28, z, 'Air cassette return grille');
  }
  addPipe(parent, [-9.4, y + 2.84, -7.9], [9.6, y + 2.84, -7.9], .075, M.red, 'Fire protection piping');
  addPipe(parent, [-9.4, y + 2.63, -7.25], [9.6, y + 2.63, -7.25], .06, M.blue, 'Domestic water piping');
  addPipe(parent, [9.6, y + 2.84, -7.9], [9.6, y + 2.84, 7.3], .075, M.red, 'Fire protection branch');
  addPipe(parent, [9.1, y + 2.63, -7.25], [9.1, y + 2.63, 7.3], .06, M.blue, 'Water branch');
  for(const x of [-7, -2, 3, 8]) {
    addPipe(parent, [x, y + 2.84,-7.9],[x,y+2.84,-5.1],.045,M.red,'Sprinkler branch');
    addPipe(parent,[x,y+2.84,-5.1],[x,y+2.45,-5.1],.03,M.red,'Sprinkler head');
    addCylinder(parent,.095,.045,M.red,x,y+2.43,-5.1,'Sprinkler deflector');
  }
  addPipe(parent, [10.8, y + .34,-8.5],[10.8,y+3.65,-8.5],.13,M.teal,'Plumbing riser');
  addPipe(parent, [9.85, y + .34,-8.5],[9.85,y+3.65,-8.5],.095,M.red,'Fire riser');
  addBox(parent,.33,.18,12,M.steel, -10.5,y+3.2,0,'Electrical cable tray');
}

function buildRoof() {
  roofArchitecture.name = 'Roof architecture';
  roofMep.name = 'Roof MEP equipment';
  const y = 4 * 3.8;
  addBox(roofArchitecture, 26.1, .35, 21.1, M.concrete, 0, .16, 0, 'Roof slab');
  for(const z of [-10.2,10.2]) addBox(roofArchitecture,25.9,.85,.25,M.white,0,.6,z,'Roof parapet');
  for(const x of [-12.85,12.85]) addBox(roofArchitecture,.25,.85,20.8,M.white,x,.6,0,'Roof parapet');
  for(const [x,z] of [[-6,-5],[5,-5]]){
    addBox(roofMep,4.4,1.45,2.3,M.steel,x,1.15,z,'VRF outdoor unit');
    for(const dx of [-1.1,1.1]){
      addCylinder(roofMep,.66,.06,M.stone,x+dx,1.93,z,'VRF axial fan',14);
      addCylinder(roofMep,.12,.08,M.steel,x+dx,1.99,z,'VRF fan hub',10);
    }
    for(let i = 0;i < 7;i++)addBox(roofMep,4.1,.07,.04,M.duct,x,.47+i*.17,z+1.17,'VRF grille');
  }
  addBox(roofMep,3.7,.24,2.6,M.blue,0,.72,6,'Solar sample panel');
  roofArchitecture.position.y = y;
  roofMep.position.y = y;
  demo.add(roofArchitecture,roofMep);
}

function buildDemo() {
  buildSite();
  for(let floor = 1; floor <= 4; floor++){
    const grp = new THREE.Group();
    grp.name = `Floor ${floor} | Demonstration geometry`;
    const architecture = new THREE.Group(); architecture.name = 'Architecture';
    const structure = new THREE.Group(); structure.name = 'Structure';
    const mep = new THREE.Group(); mep.name = 'MEP';
    grp.add(architecture,structure,mep);
    const y = (floor - 1) * 3.8;
    makeArchitecture(architecture,floor,0);
    makeStructure(structure,floor,0);
    makeMEP(mep,floor,0);
    grp.position.y = y;
    floorGroups.set(floor,{root:grp, architecture, structure, mep, baseY:y});
    demo.add(grp);
  }
  buildRoof();
  scene.add(demo);
}

function setStatus(message, permanent = false) {
  status.hidden = !message;
  if (message) status.textContent = message;
  clearTimeout(setStatus.timeout);
  if (message && !permanent) setStatus.timeout = setTimeout(() => { status.hidden = true; }, 4200);
}

function setFloorEnabled(enabled) {
  document.querySelectorAll('[data-floor]').forEach((btn) => { btn.disabled = !enabled && btn.dataset.floor !== 'all'; });
}
function setLayerEnabled(enabled) {
  document.querySelectorAll('[data-layer]').forEach((input) => { input.disabled = !enabled; });
}
function applyDemoVisibility() {
  const step = state.exploded ? 1.25 : 0;
  siteGroup.visible = state.floor === 'all';
  for(const [floor,g] of floorGroups) {
    g.root.visible = state.floor === 'all' || state.floor === String(floor);
    g.root.position.y = g.baseY + (floor - 1) * step;
    g.architecture.visible = state.layers.architecture;
    g.structure.visible = state.layers.structure;
    g.mep.visible = state.layers.mep;
  }
  roofArchitecture.position.y = 4*3.8 + 4*step;
  roofMep.position.y = 4*3.8 + 4*step;
  // Hide the roof when isolating the top floor, so its interior can be inspected.
  const roofVisible = state.floor === 'all';
  roofArchitecture.visible = roofVisible && state.layers.architecture;
  roofMep.visible = roofVisible && state.layers.mep;
}
const FLOOR_RX = /(?:^|[\s_\-\/])(?:floor|level|storey|story|fl|ชั้น)[\s_\-]*0?([1-4])(?=$|[\s_\-\/])/i;
const MEP_RX = /(?:^|[\s_\-\/])(?:mep|hvac|mechanical|electrical|plumbing|piping|pipe|duct|fire.?fighting|sanitary)(?=$|[\s_\-\/])/i;
const STR_RX = /(?:^|[\s_\-\/])(?:structure|structural|column|beam|foundation)(?=$|[\s_\-\/])/i;
const ARCH_RX = /(?:^|[\s_\-\/])(?:architecture|architectural|arch|walls|doors|windows|facade)(?=$|[\s_\-\/])/i;
function classifyMesh(mesh, root){
  const names = [];
  let current = mesh;
  while(current && current !== root.parent) { if(current.name) names.push(current.name); if(current === root) break; current=current.parent; }
  const tokens = names.join(' / ');
  const floor = tokens.match(FLOOR_RX)?.[1] || null;
  let layer = null;
  if(MEP_RX.test(tokens)) layer = 'mep';
  else if(STR_RX.test(tokens)) layer = 'structure';
  else if(ARCH_RX.test(tokens)) layer = 'architecture';
  return {floor,layer};
}
function applyImportedVisibility(){
  for (const mesh of state.importMeshes) {
    const {floor,layer} = mesh.userData.viewerTag;
    mesh.visible = (state.floor === 'all' || !floor || state.floor === floor) && (!layer || state.layers[layer]);
  }
}
function updatePresentation() {
  const demoMode = state.mode === 'demo';
  if(demoMode) applyDemoVisibility(); else applyImportedVisibility();
  document.querySelectorAll('[data-floor]').forEach(btn=>{
    const active = btn.dataset.floor === state.floor;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed', String(active));
  });
  if(demoMode){
    el('view-name').textContent = state.floor === 'all' ? 'มุมมองอาคารโดยรวม' : `รายละเอียดชั้น ${state.floor}`;
    el('view-description').textContent = 'อาคารตัวอย่าง 4 ชั้น • ยังไม่ใช่แบบก่อสร้างจริง';
  } else {
    el('view-name').textContent = state.floor === 'all' ? 'โมเดลอาคารจากไฟล์ GLB' : `โมเดลจริง • ชั้น ${state.floor}`;
    el('view-description').textContent = state.floorMetadata ? 'อ่านชื่อกลุ่มชั้นจากไฟล์ GLB แล้ว' : 'ไฟล์ GLB นี้ยังไม่มีชื่อกลุ่มสำหรับเลือกชั้น';
  }
}
function getFocus() {
  if(state.mode === 'demo'){
    if(state.floor === 'all') return {center: new THREE.Vector3(0,9,0),scale:34};
    const n = Number(state.floor);
    return {center:new THREE.Vector3(0,(n-1)*(state.exploded?5.05:3.8)+2,0),scale:27};
  }
  const bounds = new THREE.Box3().setFromObject(state.importRoot);
  if(bounds.isEmpty()) return {center:new THREE.Vector3(),scale:35};
  const size = bounds.getSize(new THREE.Vector3());
  return {center:bounds.getCenter(new THREE.Vector3()),scale:Math.max(10,size.length()*1.08)};
}
function cameraView(view='iso'){
  state.view=view;
  const {center,scale}=getFocus();
  let offset;
  if(view==='top')offset=new THREE.Vector3(.001,1.75,.001);
  else if(view==='front')offset=new THREE.Vector3(0,.18,1.7);
  else if(view==='right')offset=new THREE.Vector3(1.7,.18,0);
  else offset=new THREE.Vector3(1.22,.90,1.33);
  offset.normalize().multiplyScalar(scale*1.5);
  camera.position.copy(center).add(offset);
  controls.target.copy(center);
  camera.lookAt(center);
  controls.update();
  document.querySelectorAll('[data-view]').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===view));
}
function selectFloor(floor){
  if(state.mode==='imported' && !state.floorMetadata && floor!=='all')return;
  state.floor=floor;
  updatePresentation();
  cameraView(state.view);
  if(window.innerWidth<=900)closeMenu();
}

async function importGLB(file){
  if(!file) return;
  if(!/\.glb$/i.test(file.name)){setStatus('โปรดเลือกไฟล์ .glb ที่ส่งออกจาก IngeTrazo',true);return;}
  if(file.size>300*1024*1024){setStatus('ไฟล์ใหญ่เกิน 300 MB สำหรับ Viewer เวอร์ชันสาธิต กรุณาลดขนาดโมเดลก่อน',true);return;}
  setStatus(`กำลังอ่าน ${file.name} ...`,true);
  try{
    const buffer=await file.arrayBuffer();
    const gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(buffer,'',resolve,reject));
    const root=gltf.scene;
    const meshes=[];
    root.updateMatrixWorld(true);
    root.traverse(object=>{
      if(object.isMesh){
        object.userData.viewerTag=classifyMesh(object,root);
        object.castShadow=false; // Large GLB scenes stay responsive on mobile.
        object.receiveShadow=true;
        meshes.push(object);
      }
    });
    if(meshes.length===0)throw new Error('ไม่พบ Geometry แบบ Mesh ภายในไฟล์');
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    if(bounds.isEmpty() || !Number.isFinite(size.length()) || size.length()===0 || size.length()>1e8)throw new Error('ขนาดหรือพิกัดโมเดลผิดปกติ');
    if(state.importRoot) scene.remove(state.importRoot);
    state.importRoot=root; scene.remove(demo); scene.add(root);
    state.importMeshes=meshes;
    state.floorMetadata=meshes.some(m=>!!m.userData.viewerTag.floor);
    state.layerMetadata=meshes.some(m=>!!m.userData.viewerTag.layer);
    state.mode='imported';state.floor='all';state.exploded=false;state.modelName=file.name;
    el('explode-toggle').checked=false;el('explode-toggle').disabled=true;
    setFloorEnabled(state.floorMetadata);setLayerEnabled(state.layerMetadata);
    el('model-title').textContent=file.name;
    el('model-subtitle').textContent=`เปิดเฉพาะบนอุปกรณ์นี้ • ${meshes.length.toLocaleString('th-TH')} meshes • ${(file.size/1024/1024).toFixed(1)} MB`;
    el('mode-indicator').textContent='LOCAL GLB • ไม่อัปโหลดขึ้นเซิร์ฟเวอร์';
    el('geometry-status').innerHTML='<span class="online-circle"></span> LOCAL MODEL LOADED';
    document.querySelector('.demo-badge').innerHTML='<span class="demo-dot"></span> LOCAL GLB';
    updatePresentation();cameraView('iso');
    if(!state.floorMetadata || !state.layerMetadata) setStatus('เปิด GLB สำเร็จ • การแยกชั้น/ระบบต้องมีชื่อกลุ่มในโมเดล',false);
    else setStatus('เปิด GLB สำเร็จ • เลือกชั้นและระบบได้แล้ว',false);
    el('reset-demo').hidden=false;
  }catch(error){
    console.error('Unable to load GLB:',error);
    setStatus(`เปิด GLB ไม่สำเร็จ: ${error?.message||'ไฟล์ไม่ถูกต้อง'}`,true);
  }finally{el('file-input').value='';}
}
function resetDemo(){
  if(state.importRoot){scene.remove(state.importRoot);state.importRoot=null;}
  scene.add(demo);state.mode='demo';state.floor='all';state.modelName='อาคารสาธิต 4 ชั้น';state.exploded=false;
  state.floorMetadata=false;state.layerMetadata=false;state.importMeshes=[];
  setFloorEnabled(true);setLayerEnabled(true);
  el('explode-toggle').disabled=false;el('explode-toggle').checked=false;
  el('model-title').textContent='อาคารสาธิต 4 ชั้น';
  el('model-subtitle').textContent='โมเดลจำลองเพื่อทดสอบการนำเสนอ ก่อนใช้ไฟล์ IGZ จริง';
  el('mode-indicator').textContent='ตัวอย่างจำลอง • 25 × 20 ม.';
  el('geometry-status').innerHTML='<span class="online-circle"></span> DEMONSTRATION SCENE';
  document.querySelector('.demo-badge').innerHTML='<span class="demo-dot"></span> DEMO MODEL';
  el('reset-demo').hidden=true;
  updatePresentation();cameraView('iso');setStatus('กลับสู่โมเดลสาธิตแล้ว');
}

function closeMenu(){el('sidebar').classList.remove('is-open');el('menu-btn').setAttribute('aria-expanded','false');}
function attachControls(){
  document.querySelectorAll('[data-floor]').forEach(btn=>btn.addEventListener('click',()=>selectFloor(btn.dataset.floor)));
  document.querySelectorAll('[data-layer]').forEach(input=>input.addEventListener('change',()=>{state.layers[input.dataset.layer]=input.checked;updatePresentation();}));
  el('explode-toggle').addEventListener('change',(event)=>{state.exploded=event.target.checked;updatePresentation();cameraView(state.view);});
  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>cameraView(btn.dataset.view)));
  el('home-view').addEventListener('click',()=>cameraView('iso'));
  el('fullscreen-btn').addEventListener('click',()=>{
    if(document.fullscreenElement)document.exitFullscreen?.();
    else stage.requestFullscreen?.().catch(()=>setStatus('เบราว์เซอร์นี้ไม่รองรับโหมดเต็มหน้าจอ'));
  });
  el('screenshot-btn').addEventListener('click',()=>{
    try{
      renderer.render(scene,camera);
      const a=document.createElement('a');a.download='office2000-3d-view.png';a.href=renderer.domElement.toDataURL('image/png');a.click();
    }catch(error){setStatus('ไม่สามารถบันทึกภาพได้บนอุปกรณ์นี้');}
  });
  el('file-input').addEventListener('change',(event)=>importGLB(event.target.files?.[0]));
  el('reset-demo').addEventListener('click',resetDemo);
  el('menu-btn').addEventListener('click',()=>{
    const open=el('sidebar').classList.toggle('is-open');el('menu-btn').setAttribute('aria-expanded',String(open));
  });
  document.querySelector('.workspace').addEventListener('click',(event)=>{
    if(el('sidebar').classList.contains('is-open') && !event.target.closest('#menu-btn'))closeMenu();
  });
  document.addEventListener('keydown',event=>{
    if(/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName||''))return;
    if(event.key==='Escape')closeMenu();
    if(event.key==='0')selectFloor('all');
    if(/^[1-4]$/.test(event.key))selectFloor(event.key);
    if(event.key.toLowerCase()==='r')cameraView('iso');
  });
}

function onResize(){
  const w=stage.clientWidth,h=stage.clientHeight;
  if(!w||!h)return;
  camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);
}
window.addEventListener('resize',onResize);
if('ResizeObserver' in window)new ResizeObserver(onResize).observe(stage);

buildDemo();attachControls();updatePresentation();cameraView('iso');onResize();
setStatus('');
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
