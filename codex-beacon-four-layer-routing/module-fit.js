// Module placement is a local visual study. It never edits a KiCad board.
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { addPlaceholders } from './viewer3d.js';

// KiCad X/Y lie in Three X/Z; all exported geometry stays at its real scale.
export function centreModule(root, bounds) {
  root.position.x -= (bounds.min.x + bounds.max.x) / 2;
  root.position.z -= (bounds.min.z + bounds.max.z) / 2;
}

export function boardBounds(root) {
  // KiCad places PCB layer meshes directly inside its exported root node;
  // component assemblies are nested. Exclude connector overhangs from the origin.
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const frame of root.children) {
    for (const layer of frame.children) if (layer.isMesh) box.expandByObject(layer);
  }
  return box.isEmpty() ? new THREE.Box3().setFromObject(root) : box;
}

export function mountModulePlacement({ view, viewer: v, host, meta, site, board }) {
  const panel = document.createElement('details');
  panel.className = 'module-fit';
  panel.innerHTML = `<summary>Place module</summary>
    <div class="module-fit-body">
      <label>Module <select aria-label="Module to place"><option value="">Choose a board or module…</option></select></label>
      <p class="small" data-status role="status">Preview a module at its actual size.</p>
      <fieldset disabled><div class="module-fit-modes">
        <button class="btn primary" data-mode="drag">Drag on board</button>
        <button class="btn" data-mode="translate">Move axes</button>
        <button class="btn" data-mode="rotate">Rotate</button>
      </div>
      <div class="module-fit-fields">
        <label>X (mm)<input type="number" step="0.1" data-field="x" aria-label="Module X in mm"></label>
        <label>Y (mm)<input type="number" step="0.1" data-field="y" aria-label="Module Y in mm"></label>
        <label>Height (mm)<input type="number" step="0.1" data-field="height" aria-label="Module height in mm"></label>
        <label>Rotation (°)<input type="number" step="1" data-field="angle" aria-label="Module rotation in degrees"></label>
      </div>
      <p class="small">X/Y: module centre from board centre. Height: module PCB bottom above host PCB top.</p>
      <div class="row"><button class="btn" data-turn>Turn 90°</button><button class="btn" data-flip>Flip</button>
        <button class="btn" data-reset>Reset</button><button class="btn" data-remove>Remove</button></div>
      <label class="module-fit-opacity">Host opacity <input type="range" min="0.15" max="1" step="0.05" value="1" aria-label="Host board opacity"></label>
      </fieldset>
      <p class="small muted">Visual fit only. Missing models and solder/wire clearances need checking. Positions last for this 3D view; CAD is unchanged.</p>
    </div>`;
  view.append(panel);
  const $ = s => panel.querySelector(s);
  const select = $('select'), status = $('[data-status]'), fields = $('fieldset');
  const events = new AbortController();
  const listen = (el, name, fn, opts = {}) => el.addEventListener(name, fn, { ...opts, signal: events.signal });
  const pivot = new THREE.Group(); pivot.name = 'placed-module'; pivot.userData.fit = true;
  v.scene.add(pivot);
  const gizmo = new TransformControls(v.camera, v.renderer.domElement);
  gizmo.setSize(.75); gizmo.setSpace('world');
  v.scene.add(gizmo);
  const hostBox = boardBounds(host);
  const origin = hostBox.getCenter(new THREE.Vector3());
  const top = (meta.stack?.thickness || meta.thickness || 1.6) / 1000;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const surface = v.renderer.domElement;
  let alive = true, serial = 0, mode = 'drag', drag = null, flipped = false;
  let moduleRoot = null, moduleThickness = .0016;
  const original = new Map();
  host.traverse(o => {
    if (!o.isMesh) return;
    original.set(o, o.material);
    o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
  });
  function render() { v.requestRender(); }
  function sync() {
    const values = { x: (pivot.position.x-origin.x)*1000, y: (pivot.position.z-origin.z)*1000,
      height: (pivot.position.y-top)*1000, angle: THREE.MathUtils.radToDeg(pivot.rotation.y) };
    for (const [key,value] of Object.entries(values)) $('[data-field="'+key+'"]').value = value.toFixed(2);
    render();
  }
  function setMode(next) {
    mode = next; gizmo.detach();
    if (moduleRoot && panel.open && !view.classList.contains('ruler-active') && mode !== 'drag') {
      gizmo.setMode(mode); gizmo.attach(pivot);
    }
    panel.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('primary', b.dataset.mode === mode));
    render();
  }
  function release(root) {
    if (!root) return;
    const geometries = new Set(), materials = new Set(), textures = new Set();
    root.traverse(o => { if (o.geometry) geometries.add(o.geometry);
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m) materials.add(m); });
    for (const m of materials) { for (const value of Object.values(m)) if (value?.isTexture) textures.add(value); m.dispose(); }
    textures.forEach(t => t.dispose()); geometries.forEach(g => g.dispose());
  }
  function clear() {
    endDrag(); gizmo.detach();
    if (moduleRoot) { pivot.remove(moduleRoot); release(moduleRoot); moduleRoot = null; }
    fields.disabled = true; render();
  }
  function reset() {
    pivot.position.set(origin.x, top + .005, origin.z); pivot.rotation.set(0,0,0);
    flipped = false; if (moduleRoot) { moduleRoot.rotation.x=0; moduleRoot.position.y=0; }
    sync();
  }
  const entries = site.boards.filter(b => b.glb && b.id !== board.id)
    .sort((a,b) => Number(b.in_stack === false)-Number(a.in_stack === false) || a.name.localeCompare(b.name));
  for (const b of entries) { const option = document.createElement('option'); option.value = b.id; option.textContent=b.name; select.append(option); }
  if (!entries.length) status.textContent = 'No other published 3D models are available on this branch.';
  listen(select, 'change', async () => {
    const token = ++serial; clear();
    const entry = entries.find(b => b.id === select.value);
    if (!entry) { status.textContent='Preview a module at its actual size.'; return; }
    status.textContent = 'Loading module…';
    try {
      const base = new URL(entry.glb, location.href);
      const response = await fetch(new URL('meta.json', base));
      if (!response.ok) throw new Error('Module metadata unavailable');
      const moduleMeta = await response.json();
      base.searchParams.set('v', moduleMeta.source_hash || site.commit || '');
      const root = await v.load(base.href);
      if (!alive || token !== serial) { release(root); return; }
      const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
      addPlaceholders(root, moduleMeta.placeholders, moduleMeta.stack?.thickness || moduleMeta.thickness || 1.6);
      centreModule(root, boardBounds(root));
      // Flip a centred parent, otherwise a KiCad model far from (0,0) jumps
      // across the scene when its original absolute coordinates are inverted.
      moduleRoot = new THREE.Group(); moduleRoot.add(root);
      moduleThickness=(moduleMeta.stack?.thickness || moduleMeta.thickness || 1.6)/1000;
      pivot.add(moduleRoot); reset(); fields.disabled=false; setMode(mode);
      status.textContent = `${entry.name} · model envelope ${(size.x*1000).toFixed(1)} × ${(size.z*1000).toFixed(1)} mm` +
        (moduleMeta.missing_models?.length ? ' · some parts use placeholder outlines' : '');
    } catch(e) { if (alive && token===serial) status.textContent='Could not load module: '+e.message; }
  });
  listen(panel, 'click', e => {
    const b=e.target.closest('button'); if (!b) return;
    if (b.dataset.mode) setMode(b.dataset.mode);
    if (b.hasAttribute('data-turn')) { pivot.rotation.y+=Math.PI/2; sync(); }
    if (b.hasAttribute('data-flip')) {
      flipped=!flipped; moduleRoot.rotation.x=flipped ? Math.PI : 0;
      moduleRoot.position.y=flipped ? moduleThickness : 0; sync();
    }
    if (b.hasAttribute('data-reset')) reset();
    if (b.hasAttribute('data-remove')) { ++serial; clear(); select.value=''; status.textContent='Module removed.'; }
  });
  listen(panel, 'input', e => {
    const key=e.target.dataset.field; if (!key || !moduleRoot) return;
    const value=e.target.valueAsNumber; if (!Number.isFinite(value)) return;
    if (key==='x') pivot.position.x=origin.x+value/1000;
    if (key==='y') pivot.position.z=origin.z+value/1000;
    if (key==='height') pivot.position.y=top+value/1000;
    if (key==='angle') pivot.rotation.y=THREE.MathUtils.degToRad(value);
    render();
  });
  listen($('[type="range"]'), 'input', e => {
    const opacity=Number(e.target.value);
    for (const [o, source] of original) {
      const mats=Array.isArray(o.material)?o.material:[o.material], originals=Array.isArray(source)?source:[source];
      mats.forEach((m,i) => { m.opacity=originals[i].opacity*opacity; m.transparent=originals[i].transparent || opacity<1;
        m.depthWrite=opacity<1 ? false : originals[i].depthWrite; m.needsUpdate=true; });
    }
    render();
  });
  const change=() => sync(), dragging=e => { v.controls.enabled=!e.value; };
  gizmo.addEventListener('change', render); gizmo.addEventListener('objectChange',change); gizmo.addEventListener('dragging-changed',dragging);
  function pointer(e) {
    const r=surface.getBoundingClientRect();
    ndc.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);
    ray.setFromCamera(ndc,v.camera);
  }
  function planePoint() {
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-pivot.position.y),new THREE.Vector3());
  }
  function endDrag() { if (drag) { drag=null; v.controls.enabled=true; } }
  listen(surface,'pointerdown',e => {
    if (!panel.open || !moduleRoot || mode!=='drag' || e.button!==0 || view.classList.contains('ruler-active')) return;
    if (drag) { endDrag(); return; }
    pointer(e); if (!ray.intersectObject(pivot,true).length) return;
    const point=planePoint(); if (!point) return;
    drag={id:e.pointerId,offset:point.sub(pivot.position)};
    v.controls.enabled=false; surface.setPointerCapture(e.pointerId); e.stopImmediatePropagation();
  },{capture:true});
  listen(surface,'pointermove',e => {
    if (!drag || drag.id!==e.pointerId) return;
    pointer(e); const point=planePoint(); if (!point) return;
    pivot.position.x=point.x-drag.offset.x; pivot.position.z=point.z-drag.offset.z;
    sync(); e.stopImmediatePropagation();
  },{capture:true});
  for (const name of ['pointerup','pointercancel','lostpointercapture']) listen(surface,name,e => { if (drag?.id===e.pointerId) endDrag(); },{capture:true});
  listen(panel,'toggle',() => { if (!panel.open) { endDrag(); gizmo.detach(); } else setMode(mode); render(); });
  listen(document,'keydown',e => { if(e.key==='Escape') { endDrag(); panel.open=false; } });
  const observer = new MutationObserver(() => setMode(mode));
  observer.observe(view, { attributes:true, attributeFilter:['class'] });
  return { dispose() {
    alive=false; ++serial; clear(); events.abort(); observer.disconnect();
    gizmo.removeEventListener('change',render); gizmo.removeEventListener('objectChange',change); gizmo.removeEventListener('dragging-changed',dragging);
    gizmo.dispose(); v.scene.remove(gizmo,pivot);
    for (const [o,source] of original) { (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose()); o.material=source; }
    panel.remove();
  } };
}
