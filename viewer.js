import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const $ = (id) => document.getElementById(id);
const stage = $('viewer-stage');
const state = { root: null, meshes: [], floor: 'all', systems: {}, config: null, published: true, loading: false, view: 'iso', generation: 0, controller: null, raw: null, bounds: null, fullBounds: null, dirty: true };
let renderer, camera, scene, controls;
function status(text) { $('view-status').textContent = text; }
function progress(title, detail, value = 0) { $('loading-panel').hidden = false; $('loading-title').textContent = title; $('loading-detail').textContent = detail; $('load-progress').value = value; }
function init() {
  try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); }
  catch (e) { progress('อุปกรณ์นี้เปิด WebGL 2 ไม่ได้', 'ลองเปิดด้วย Chrome หรือ Safari รุ่นใหม่ และเปิดการเร่งด้วยกราฟิก'); throw e; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;
  renderer.domElement.setAttribute('aria-label', 'โมเดลอาคารสามมิติ ลากเพื่อหมุน');
  renderer.domElement.tabIndex = 0;
  stage.prepend(renderer.domElement);
  scene = new THREE.Scene(); scene.background = new THREE.Color(0xe2eae8);
  camera = new THREE.PerspectiveCamera(42, 1, .05, 1000);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .12;
  controls.minDistance = .25; controls.maxDistance = 500;
  controls.maxPolarAngle = Math.PI * .98;
  controls.addEventListener('change', () => state.dirty = true);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa0aaa4, 2.4));
  const key = new THREE.DirectionalLight(0xfff8eb, 2.5); key.position.set(18, 42, 20); scene.add(key);
  const fill = new THREE.DirectionalLight(0xddeaff, 1); fill.position.set(-28, 12, -32); scene.add(fill);
  new ResizeObserver(resize).observe(stage);
  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); progress('หน่วยความจำกราฟิกไม่เพียงพอ', 'ปิดแท็บอื่นแล้วกดโหลดใหม่'); $('retry-btn').hidden = false; });
  renderer.domElement.addEventListener('webglcontextrestored', () => location.reload());
  resize();
  function frame() { requestAnimationFrame(frame); controls.update(); if (state.dirty) { renderer.render(scene, camera); state.dirty = false; } }
  frame();
}
function resize() { if (!renderer) return; const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); state.dirty = true; }
function meshSystem(object) { for (let n = object; n; n = n.parent) { const s = n.userData?.system; if (state.config.systems.some(x => x.id === s)) return s; } return 'unclassified'; }
function materials(mesh) { return Array.isArray(mesh.material) ? mesh.material : [mesh.material]; }
function disposeRoot(root) {
  if (!root) return;
  const geometries = new Set(), mats = new Set(), textures = new Set();
  root.traverse(n => { if (!n.isMesh) return; geometries.add(n.geometry); for (const m of materials(n)) { mats.add(m); for (const value of Object.values(m)) if (value?.isTexture) textures.add(value); } });
  geometries.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); textures.forEach(t => { t.dispose(); t.source?.data?.close?.(); });
  scene.remove(root);
}
function resetOptions() { state.floor = 'all'; for (const s of state.config.systems) state.systems[s.id] = true; for (const id of ['xray', 'roof-cut', 'system-colors']) $(id).checked = false; }
function buildSystemControls() {
  const host = $('layers'); host.replaceChildren();
  for (const s of state.config.systems) {
    const count = state.meshes.filter(m => m.userData.viewerSystem === s.id).length;
    const row = document.createElement('div'); row.className = 'system-row';
    const label = document.createElement('label');
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !!state.systems[s.id]; checkbox.dataset.system = s.id; checkbox.disabled = !count;
    const dot = document.createElement('span'); dot.className = 'system-dot'; dot.style.backgroundColor = s.color;
    const text = document.createElement('span'); text.textContent = s.label;
    label.title = `${count} กลุ่ม mesh · จำแนกเพื่อการแสดงผล ไม่ใช่จำนวนอุปกรณ์`;
    label.append(checkbox, dot, text);
    const solo = document.createElement('button'); solo.className = 'solo-btn'; solo.textContent = 'เฉพาะ'; solo.disabled = !count; solo.dataset.solo = s.id; solo.setAttribute('aria-label', `แสดงเฉพาะ${s.label}`);
    checkbox.addEventListener('change', () => { state.systems[s.id] = checkbox.checked; apply(); });
    solo.addEventListener('click', () => { for (const key of Object.keys(state.systems)) state.systems[key] = key === s.id; apply(); });
    row.append(label, solo); host.append(row);
  }
}
function floorRange() {
  if (state.floor === 'all') return null;
  const levels = state.config.floorLevels;
  const index = state.floor === 'roof' ? 4 : Number(state.floor) - 1;
  return [levels[index] - .2, index === 4 ? Math.max(20, (state.fullBounds?.max.y || 20) + .5) : levels[index + 1] - .2];
}
function apply() {
  let visible = 0, triangles = 0;
  const range = state.published ? floorRange() : null;
  const planes = [];
  if (range) planes.push(new THREE.Plane(new THREE.Vector3(0, 1, 0), -range[0]), new THREE.Plane(new THREE.Vector3(0, -1, 0), range[1]));
  else if ($('roof-cut').checked && state.published) planes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), 15.8));
  for (const mesh of state.meshes) {
    const sys = mesh.userData.viewerSystem;
    mesh.visible = !!state.systems[sys];
    if (mesh.visible) { visible++; triangles += (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3; }
    const system = state.config.systems.find(s => s.id === sys);
    for (const m of materials(mesh)) {
      const original = m.userData.viewerOriginal;
      const ghost = $('xray').checked && ['building', 'ceilings'].includes(sys);
      m.clippingPlanes = planes;
      m.opacity = ghost ? Math.min(.12, original.opacity) : original.opacity;
      m.transparent = ghost || original.transparent; m.depthWrite = ghost ? false : original.depthWrite;
      if ($('system-colors').checked) { m.color.set(system.color); m.map = null; m.transmission = 0; }
      else { m.color.copy(original.color); m.map = original.map; if ('transmission' in m) m.transmission = original.transmission; }
      m.needsUpdate = true;
    }
  }
  document.querySelectorAll('[data-system]').forEach(input => input.checked = !!state.systems[input.dataset.system]);
  document.querySelectorAll('[data-floor]').forEach(button => { const selected = button.dataset.floor === state.floor; button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected)); button.disabled = !state.published; });
  const availableSystems = state.config.systems.filter(s => state.meshes.some(m => m.userData.viewerSystem === s.id));
  $('system-count').textContent = `${availableSystems.filter(s => state.systems[s.id]).length} / ${availableSystems.length} กลุ่ม`;
  $('roof-cut').disabled = !state.published || state.floor !== 'all';
  const label = state.floor === 'all' ? 'ทุกชั้น' : state.floor === 'roof' ? 'หลังคา / ดาดฟ้า' : `ชั้น ${state.floor}`;
  $('view-name').textContent = label;
  $('view-description').textContent = range ? `ตัดตามความสูง ${range[0].toFixed(1)} – ${range[1].toFixed(1)} ม. · ${visible} กลุ่ม` : `${visible} / ${state.meshes.length} กลุ่ม mesh ที่เปิดแสดง`;
  $('geometry-status').textContent = `${visible} กลุ่ม · ${(triangles / 1e6).toFixed(2)} ล้านสามเหลี่ยมก่อนตัด`;
  status(visible ? '' : 'ไม่มีระบบเปิดแสดง — กด “แสดงทั้งหมด”');
  state.dirty = true;
}
function cameraView(view = 'iso', wholeSite = false) {
  if (!state.bounds) return;
  state.view = view;
  const box = (wholeSite ? state.fullBounds : state.bounds).clone(), range = state.published ? floorRange() : null;
  if (range && !wholeSite) { box.min.y = range[0]; box.max.y = range[1]; }
  const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const fov = camera.fov * Math.PI / 180;
  const span = Math.max(size.y, size.x / camera.aspect, size.z / camera.aspect, 8);
  const distance = Math.max(size.length() * .85, span / (2 * Math.tan(fov / 2))) * 1.35;
  const direction = { iso: [1, .7, 1.35], front: [0, .03, 1], right: [1, .03, 0], top: [0, 1, .0001] }[view] || [1, .7, 1.35];
  camera.position.copy(center).add(new THREE.Vector3(...direction).normalize().multiplyScalar(distance));
  controls.target.copy(center); camera.near = .03; camera.far = Math.max(1000, distance * 8); camera.updateProjectionMatrix(); controls.update();
  document.querySelectorAll('[data-view]').forEach(b => { const selected = b.dataset.view === view; b.classList.toggle('active', selected); b.setAttribute('aria-pressed', String(selected)); });
  state.dirty = true;
}
async function downloadBytes(url, signal) {
  const response = await fetch(url, { signal }); if (!response.ok) throw new Error(`โหลดไฟล์ไม่สำเร็จ (HTTP ${response.status})`);
  const total = Number(response.headers.get('content-length')) || state.config.gzipBytes;
  if (!response.body) return response.arrayBuffer();
  const reader = response.body.getReader(), chunks = []; let received = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); received += value.byteLength; progress('กำลังโหลดโมเดลจริง', `${(received / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB`, Math.min(85, received / total * 85)); }
  return new Blob(chunks).arrayBuffer();
}
async function loadModel(file = null) {
  if (!state.config) return;
  const generation = ++state.generation; state.controller?.abort(); const controller = new AbortController(); state.controller = controller;
  const timeout = setTimeout(() => controller.abort(), 240000);
  state.loading = true; $('retry-btn').hidden = true;
  progress(file ? 'กำลังเปิดไฟล์ในเครื่อง' : 'กำลังโหลดโมเดลโครงการ', 'กำลังอ่านข้อมูล...', 0);
  try {
    let bytes = file ? await file.arrayBuffer() : await downloadBytes(state.config.asset, controller.signal);
    if (generation !== state.generation) return;
    const magic = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
    if (magic[0] === 31 && magic[1] === 139) {
      if (!('DecompressionStream' in window)) throw new Error('เบราว์เซอร์นี้ไม่รองรับการคลายไฟล์ กรุณาอัปเดต Safari หรือ Chrome');
      progress('กำลังคลายข้อมูลโมเดล', 'ขั้นตอนนี้ใช้หน่วยความจำกราฟิก กรุณาปิดแท็บอื่นที่ไม่จำเป็น', 88);
      bytes = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    }
    if (bytes.byteLength < 20 || new DataView(bytes).getUint32(0, true) !== 0x46546c67) throw new Error('ไฟล์ไม่ใช่ GLB ที่สมบูรณ์');
    progress('กำลังเตรียมรูปทรงและวัสดุ', 'กำลังสร้างมุมมอง 3D...', 94);
    await new Promise(resolve => setTimeout(resolve, 40));
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => { if (/^(blob:|data:)/.test(url)) return url; throw new Error('รองรับเฉพาะ GLB ที่ฝังทรัพยากรทั้งหมดในไฟล์'); });
    const gltf = await new GLTFLoader(manager).parseAsync(bytes, '');
    if (generation !== state.generation) { disposeRoot(gltf.scene); return; }
    const next = gltf.scene, nextMeshes = [];
    next.traverse(n => {
      if (!n.isMesh) return;
      n.userData.viewerSystem = meshSystem(n);
      n.castShadow = false; n.receiveShadow = false;
      const old = materials(n);
      const clones = old.map(m => { const c = m.clone(); c.userData.viewerOriginal = { color: m.color.clone(), opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite, map: m.map, transmission: m.transmission || 0 }; return c; });
      n.material = Array.isArray(n.material) ? clones : clones[0]; nextMeshes.push(n);
    });
    if (!nextMeshes.length) { disposeRoot(next); throw new Error('ไม่พบรูปทรงสามมิติในไฟล์'); }
    disposeRoot(state.root); state.root = next; state.meshes = nextMeshes; state.published = !file; state.raw = bytes;
    scene.add(next); next.updateMatrixWorld(true);
    state.fullBounds = new THREE.Box3().setFromObject(next);
    if (state.fullBounds.isEmpty()) throw new Error('ขอบเขตโมเดลไม่ถูกต้อง');
    state.bounds = file ? state.fullBounds.clone() : new THREE.Box3(new THREE.Vector3(...state.config.buildingBounds.min), new THREE.Vector3(...state.config.buildingBounds.max));
    resetOptions(); buildSystemControls(); apply(); cameraView('iso');
    $('mode-indicator').textContent = file ? 'LOCAL FILE · ไม่อัปโหลด' : 'PUBLIC MODEL · P03';
    $('loading-panel').hidden = true; state.loading = false;
    renderer.render(scene, camera);
  } catch (error) {
    if (generation !== state.generation) return;
    state.loading = false; progress('เปิดโมเดลไม่สำเร็จ', error.name === 'AbortError' ? 'การโหลดหมดเวลา ลองใหม่หรือใช้เครือข่ายที่เร็วขึ้น' : error.message); $('retry-btn').hidden = false; status('โมเดลยังโหลดไม่สำเร็จ'); console.error(error);
  } finally { clearTimeout(timeout); }
}
function saveBlob(blob, filename) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; a.style.display = 'none'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
function exportScreenshot() {
  if (!state.root || state.loading) return;
  const button = $('screenshot-btn'); button.disabled = true; status('กำลังเตรียมภาพ...');
  // Use the preserved frame instead of submitting the entire large scene again.
  // Defer readback so the initiating click can finish even on software renderers.
  setTimeout(() => {
    try { renderer.domElement.toBlob(blob => { button.disabled = false; if (blob) { saveBlob(blob, `office2000-p03-${state.floor}.png`); status('บันทึกภาพแล้ว'); } else status('อ่านภาพจากกราฟิกไม่ได้ ลองรีเฟรชหน้าเว็บ'); }, 'image/png'); }
    catch (error) { button.disabled = false; status(`บันทึกภาพไม่ได้: ${error.message}`); }
  }, 100);
}
// The panel is independent of loading and does not remount the renderer.
const compactScreen = window.matchMedia('(max-width: 900px)');
const layoutState = { desktopOpen: true, mobileOpen: false };
function panelIsOpen() { return compactScreen.matches ? layoutState.mobileOpen : layoutState.desktopOpen; }
function syncLayout() {
  const open = panelIsOpen();
  $('app-shell').classList.toggle('sidebar-collapsed', !compactScreen.matches && !open);
  $('sidebar').classList.toggle('is-open', compactScreen.matches && open);
  $('sidebar').inert = !open;
  $('menu-btn').setAttribute('aria-expanded', String(open));
  $('menu-btn').setAttribute('aria-label', open ? 'ซ่อนรายการระบบ' : 'เปิดรายการระบบ');
  $('menu-label').textContent = open ? 'ซ่อนรายการ' : 'ระบบ';
}
function closeMenu(restoreFocus = false) {
  if (compactScreen.matches) layoutState.mobileOpen = false;
  else layoutState.desktopOpen = false;
  syncLayout();
  if (restoreFocus) $('menu-btn').focus({ preventScroll: true });
}
function setupLayout() {
  syncLayout();
  $('menu-btn').addEventListener('click', () => {
    if (compactScreen.matches) layoutState.mobileOpen = !layoutState.mobileOpen;
    else layoutState.desktopOpen = !layoutState.desktopOpen;
    syncLayout();
    if (panelIsOpen() && compactScreen.matches) $('close-panel').focus({ preventScroll: true });
  });
  $('close-panel').addEventListener('click', () => closeMenu(true));
  compactScreen.addEventListener('change', () => {
    const focusWasInPanel = $('sidebar').contains(document.activeElement);
    syncLayout();
    if (focusWasInPanel && !panelIsOpen()) $('menu-btn').focus({ preventScroll: true });
  });
  const info = $('classification-dialog');
  $('classification-btn').addEventListener('click', () => info.showModal());
  $('close-info').addEventListener('click', () => info.close());
  info.addEventListener('click', e => {
    const r = info.getBoundingClientRect();
    if (e.target === info && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) info.close();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !info.open && panelIsOpen()) { e.preventDefault(); closeMenu(true); }
  });
}
function bind() {
  document.querySelectorAll('[data-floor]').forEach(b => b.addEventListener('click', () => { if (!state.root) return; state.floor = b.dataset.floor; apply(); cameraView(state.view); }));
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => cameraView(b.dataset.view)));
  for (const id of ['roof-cut', 'xray', 'system-colors']) $(id).addEventListener('change', apply);
  $('show-all').addEventListener('click', () => { if (!state.root) return; resetOptions(); apply(); cameraView('iso'); });
  $('mep-only').addEventListener('click', () => { if (!state.root) return; for (const s of state.config.systems) state.systems[s.id] = !['building', 'ceilings', 'furniture'].includes(s.id); apply(); });
  $('home-view').addEventListener('click', () => cameraView('iso'));
  $('fit-all').addEventListener('click', () => cameraView('iso', true));
  $('fullscreen-btn').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (stage.requestFullscreen) await stage.requestFullscreen(); else status('ใช้การหมุนจอเป็นแนวนอนบนอุปกรณ์นี้'); } catch { status('เบราว์เซอร์ไม่อนุญาตให้แสดงเต็มหน้าจอ'); } });
  $('screenshot-btn').addEventListener('click', exportScreenshot);
  $('retry-btn').addEventListener('click', () => loadModel());
}
// Read-only diagnostics for browser smoke tests. No mutation or remote endpoints.
window.officeViewer = { snapshot: () => ({ loading: state.loading, published: state.published, floor: state.floor, meshes: state.meshes.length, visible: state.meshes.filter(m => m.visible).length, visibleSystems: [...new Set(state.meshes.filter(m => m.visible).map(m => m.userData.viewerSystem))], clippingPlanes: state.meshes[0] ? materials(state.meshes[0])[0].clippingPlanes?.length || 0 : 0, render: renderer?.info.render, systems: Object.fromEntries((state.config?.systems || []).map(s => [s.id, state.meshes.filter(m => m.userData.viewerSystem === s.id).length])) }) };
setupLayout();
try { init(); const response = await fetch('./model-config.json'); if (!response.ok) throw new Error('โหลดข้อมูลโครงการไม่ได้'); state.config = await response.json(); bind(); await loadModel(); } catch (error) { progress('เริ่มโปรแกรมไม่สำเร็จ', error.message); status('ไม่สามารถเริ่ม 3D Viewer ได้'); console.error(error); }
