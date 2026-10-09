// Shared three.js viewer for one board (3D tab) and the whole stack (stack.html).
//
// Coordinates follow KiCad's GLB export: metres, X = KiCad X, Z = KiCad Y (down the page),
// Y = up out of the board's top face. Board bottom at Y = 0, top at Y = thickness.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export { THREE, CSS2DObject };

const DRACO = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';

// view name -> camera direction (from target towards camera) and the screen-up hint
const VIEWS = {
  iso:    [new THREE.Vector3(0.9, 1.1, 1.3)],
  top:    [new THREE.Vector3(0, 1, 0.0004)],    // tiny tilt: keeps KiCad's "up" at the top of the screen
  bottom: [new THREE.Vector3(0, -1, -0.0004)],  // mirrored left-right, like KiCad's bottom view
  front:  [new THREE.Vector3(0, 0.0004, 1)],
  back:   [new THREE.Vector3(0, 0.0004, -1)],
  left:   [new THREE.Vector3(-1, 0.0004, 0)],
  right:  [new THREE.Vector3(1, 0.0004, 0)],
};

export function createViewer(container) {
  container.classList.add('v3d');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.append(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'v3d-labels';
  container.append(labels.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(0.3, 1, 0.5);
  scene.add(sun);
  const under = new THREE.DirectionalLight(0xdde6ff, 0.9);   // so the bottom view isn't a silhouette
  under.position.set(-0.3, -1, -0.4);
  scene.add(under);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.0005, 50);
  camera.position.set(0.15, 0.2, 0.25);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.rotateSpeed = 0.9;
  controls.panSpeed = 1.0;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;      // allow looking at the underside
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO);
  loader.setDRACOLoader(draco);

  let dirty = true, alive = true, anim = null;
  const requestRender = () => { dirty = true; };
  controls.addEventListener('change', requestRender);

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  function loop(t) {
    if (!alive) return;
    requestAnimationFrame(loop);
    if (anim) stepAnim(t);
    if (controls.update() || dirty) {
      renderer.render(scene, camera);
      labels.render(scene, camera);
      dirty = false;
    }
  }
  requestAnimationFrame(loop);

  // smooth camera moves (fit / views / double-click focus)
  function animateTo(target, position, up = camera.up.clone(), ms = 450) {
    anim = { t0: null, ms, fromT: controls.target.clone(), fromP: camera.position.clone(), toT: target, toP: position, up };
  }
  function stepAnim(t) {
    if (anim.t0 === null) anim.t0 = t;
    const k = Math.min(1, (t - anim.t0) / anim.ms), e = 1 - Math.pow(1 - k, 3);
    controls.target.lerpVectors(anim.fromT, anim.toT, e);
    camera.position.lerpVectors(anim.fromP, anim.toP, e);
    if (k >= 1) anim = null;
    dirty = true;
  }

  function boundsOf(objs) {
    const box = new THREE.Box3();
    for (const o of objs) if (o.visible !== false) box.expandByObject(o);
    return box;
  }

  // frame `objs` (default: everything) from `dir` (default: current direction)
  function fit(objs = scene.children.filter(o => o.userData.fit), dir = null, animate = true) {
    const box = boundsOf(objs);
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const d = (dir || camera.position.clone().sub(controls.target)).clone().normalize();
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const dist = sphere.radius / Math.sin(Math.min(fov, fov * camera.aspect) / 2) * 1.08;
    camera.near = dist / 200; camera.far = dist * 20; camera.updateProjectionMatrix();
    const pos = sphere.center.clone().addScaledVector(d, dist);
    if (animate) animateTo(sphere.center.clone(), pos);
    else { controls.target.copy(sphere.center); camera.position.copy(pos); dirty = true; }
  }

  function setView(name, objs) { fit(objs, VIEWS[name][0], true); }

  // double-click: orbit around the clicked point from now on
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  renderer.domElement.addEventListener('dblclick', e => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(scene.children.filter(o => o.userData.fit), true).find(h => h.object.visible);
    if (!hit) return;
    const shift = hit.point.clone().sub(controls.target);
    animateTo(hit.point.clone(), camera.position.clone().add(shift.multiplyScalar(0.6)));
  });

  // pan mode for trackpads: left-drag pans instead of rotating
  function setPanMode(on) {
    controls.mouseButtons.LEFT = on ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    controls.touches.ONE = on ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
  }

  async function load(url, onProgress) {
    const gltf = await loader.loadAsync(url, e => onProgress?.(e.total ? e.loaded / e.total : 0));
    const root = gltf.scene;
    root.traverse(o => {
      if (o.isMesh) {
        o.material.side = THREE.DoubleSide;   // KiCad meshes are not always closed / consistently wound
        if (o.material.transparent && o.material.opacity > 0.9) o.material.transparent = false;
      }
    });
    return root;
  }

  function dispose() {
    alive = false; ro.disconnect(); controls.dispose(); renderer.dispose(); draco.dispose(); pmrem.dispose();
    container.innerHTML = '';
  }

  return { THREE, scene, camera, controls, renderer, load, fit, setView, setPanMode, requestRender, dispose, boundsOf };
}

/* ---------- stand-ins for parts whose 3D model file is missing ---------- */
const phMat = new THREE.MeshStandardMaterial({ color: 0xf0a030, transparent: true, opacity: 0.55, roughness: 0.6, depthWrite: false });
const phEdge = new THREE.LineBasicMaterial({ color: 0xffc261 });

// boxes: [{ref, x, y, rot, side, cx, cy, w, d, h}] in KiCad mm (from build.py). Added to `root`,
// which must be in GLB board coordinates (i.e. the loaded model itself).
export function addPlaceholders(root, boxes, thicknessMm = 1.6) {
  const g = new THREE.Group();
  g.name = 'placeholders';
  for (const b of boxes || []) {
    const geo = new THREE.BoxGeometry(b.w / 1000, b.h / 1000, b.d / 1000);
    const box = new THREE.Mesh(geo, phMat);
    box.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), phEdge));
    const top = b.side !== 'bottom';
    box.position.set(b.cx / 1000, (top ? thicknessMm + b.h / 2 : -b.h / 2) / 1000, b.cy / 1000);
    const fp = new THREE.Group();   // footprint frame: origin at (x, y), rotated like KiCad (CCW on screen)
    fp.position.set(b.x / 1000, 0, b.y / 1000);
    fp.rotation.y = THREE.MathUtils.degToRad(b.rot);
    fp.add(box);
    box.userData.placeholder = b.ref;
    g.add(fp);
  }
  root.add(g);
  return g;
}

/* ---------- small UI helpers shared by both pages ---------- */

export function toolbar(viewer, getFitObjs = () => undefined) {
  const bar = document.createElement('div');
  bar.className = 'v3d-bar';
  bar.innerHTML = `
    <div class="seg">
      <button data-v="iso" title="3D view">3D</button><button data-v="top">Top</button><button data-v="bottom">Bottom</button>
      <button data-v="front">Front</button><button data-v="back">Back</button>
      <button data-v="left">Left</button><button data-v="right">Right</button>
    </div>
    <button data-a="fit" title="Fit everything in view">Fit</button>
    <button data-a="pan" title="Left-drag pans instead of rotating (useful on trackpads)">✥ Pan</button>
    <button data-a="help" title="Mouse & touch controls">?</button>`;
  bar.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.v) viewer.setView(b.dataset.v, getFitObjs());
    if (b.dataset.a === 'fit') viewer.fit(getFitObjs());
    if (b.dataset.a === 'pan') { b.classList.toggle('on'); viewer.setPanMode(b.classList.contains('on')); }
    if (b.dataset.a === 'help') bar.parentElement.querySelector('.v3d-help')?.classList.toggle('show');
  });
  const help = document.createElement('div');
  help.className = 'v3d-help';
  help.innerHTML = `<b>Mouse</b>: drag = rotate · right-drag or Shift+drag = move · wheel = zoom (towards the cursor)
    · double-click a part = rotate around it<br><b>Touch</b>: one finger = rotate · two fingers = zoom &amp; move
    · <b>✥ Pan</b> = one finger moves<br><b>Trackpad</b>: turn on <b>✥ Pan</b> to move with a normal drag.`;
  return [bar, help];
}
