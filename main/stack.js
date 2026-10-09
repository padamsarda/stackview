// 3D Stack: every PC/104 board in one scene, lined up on the shared PC104-Stack footprint.
//
// Each board is moved so its PC104-Stack footprint origin sits on the common vertical axis
// (that origin is a mounting hole, so the hole pattern lines up too). Boards are then spaced
// along that axis. Order, visibility and a small per-board height nudge are user-adjustable
// and remembered in the URL, so a link reproduces the exact stack.
import { createViewer, toolbar, addPlaceholders, CSS2DObject, THREE } from './viewer3d.js?v=eca52ea';

// Approximate Samtec ESQ-126-39-G-D stack-through header (the usual CubeSat Kit / PC/104 part).
const HEADER = { bodyH: 8.51, tail: 9.9, pin: 0.64 };   // mm
const DEFAULT_PITCH = 15.24;                             // 0.6 in board-to-board, standard PC/104
const NUDGE = 3;                                         // ± mm per-board fine adjustment

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mm = v => v / 1000;

const site = await (await fetch('site.json', { cache: 'no-cache' })).json();
$('#branch').textContent = site.branch;

const all = site.boards;
const stackable = all.filter(b => b.stack && b.glb && b.stack.side === 'top');
const byId = Object.fromEntries(stackable.map(b => [b.id, b]));
const reasons = all.filter(b => !stackable.includes(b)).map(b => [b,
  !b.project ? 'no KiCad project pushed yet'
    : b.error ? 'export failed'
    : !b.glb ? 'no 3D model exported'
    : !b.stack ? 'no PC104-Stack footprint on the PCB'
    : 'PC/104 footprint is on the bottom side (not supported yet)']);

/* ---------- state (URL hash > localStorage > defaults) ---------- */
const storeKey = `stackview-stack-${site.branch}`;
const defaults = () => ({
  order: stackable.map(b => b.id),                         // top -> bottom, folder order
  on: stackable.filter(b => b.in_stack !== false).map(b => b.id),
  nudge: {}, pitch: DEFAULT_PITCH, spread: 0, headers: true, labels: true,
});
function loadState() {
  let s = null;
  try { const m = location.hash.match(/s=([^&]+)/); if (m) s = JSON.parse(decodeURIComponent(m[1])); } catch {}
  if (!s) try { s = JSON.parse(localStorage.getItem(storeKey)); } catch {}
  const d = defaults();
  if (!s) return d;
  s = { ...d, ...s };
  s.order = [...s.order.filter(id => byId[id]), ...d.order.filter(id => !s.order.includes(id))];
  s.on = s.on.filter(id => byId[id]);
  return s;
}
let state = loadState();
function saveState() {
  try { localStorage.setItem(storeKey, JSON.stringify(state)); } catch {}
  history.replaceState(null, '', `#s=${encodeURIComponent(JSON.stringify(state))}`);
}

/* ---------- scene ---------- */
const view = $('#view');
const viewer = createViewer(view);
const [bar, help] = toolbar(viewer, () => visibleGroups());
view.append(bar, help);
const groups = {};   // id -> THREE.Group (board + headers + label)
window.stackview = { viewer, groups, state: () => state };   // handy from the browser console

const goldMat = new THREE.MeshStandardMaterial({ color: 0xd8b45a, metalness: 0.9, roughness: 0.32 });
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, metalness: 0.05, roughness: 0.65 });

function makeHeaders(anchor) {
  const g = new THREE.Group();
  g.name = 'headers';
  const t = anchor.thickness;
  // pins: from the board's top face down through the board to the tail tip
  const len = t + HEADER.tail, pinGeo = new THREE.BoxGeometry(mm(HEADER.pin), mm(len), mm(HEADER.pin));
  const pins = new THREE.InstancedMesh(pinGeo, goldMat, anchor.pads.length);
  const m = new THREE.Matrix4();
  anchor.pads.forEach(([, x, y], i) => pins.setMatrixAt(i, m.makeTranslation(mm(x), mm(t - len / 2), mm(y))));
  g.add(pins);
  // one insulator body per 2x26 block: pads 1-52 (H2) and 53-104 (H1)
  for (const [lo, hi] of [[1, 52], [53, 104]]) {
    const ps = anchor.pads.filter(p => p[0] >= lo && p[0] <= hi);
    if (!ps.length) continue;
    const xs = ps.map(p => p[1]), ys = ps.map(p => p[2]);
    const w = Math.max(...xs) - Math.min(...xs) + 2.54, d = Math.max(...ys) - Math.min(...ys) + 2.54;
    const body = new THREE.Mesh(new THREE.BoxGeometry(mm(w), mm(HEADER.bodyH), mm(d)), bodyMat);
    body.position.set(mm((Math.max(...xs) + Math.min(...xs)) / 2), mm(t + HEADER.bodyH / 2), mm((Math.max(...ys) + Math.min(...ys)) / 2));
    g.add(body);
  }
  return g;
}

function addLabel(group, b, box) {
  const el = document.createElement('div');
  el.className = 'v3d-label';
  el.textContent = b.name;
  el.title = 'Click to zoom to this board';
  el.onclick = () => viewer.fit([group]);
  const label = new CSS2DObject(el);
  // front-left corner of the board, just above the top face
  label.position.set(box.min.x, mm(b.stack.thickness) + 0.002, box.max.z);
  label.name = 'label';
  group.add(label);
}

async function loadBoard(b) {
  const group = new THREE.Group();
  group.userData.fit = true;
  group.visible = false;
  groups[b.id] = group;
  viewer.scene.add(group);
  const a = b.stack;
  const model = await viewer.load(`${b.glb}?v=${site.commit.slice(0, 7)}`, p => setProgress(b.id, p));
  // move the PC/104 footprint origin onto the stack axis and undo its rotation
  addPlaceholders(model, b.placeholders, a.thickness);
  model.position.set(-mm(a.x), 0, -mm(a.y));
  const aligned = new THREE.Group();
  aligned.add(model);
  aligned.rotation.y = THREE.MathUtils.degToRad(-a.rot);
  group.add(aligned);
  const headers = makeHeaders(a);
  group.add(headers);
  group.updateMatrixWorld(true);
  addLabel(group, b, new THREE.Box3().setFromObject(aligned));
  setProgress(b.id, null);
  layout();
}

function visibleGroups() { return state.order.filter(id => state.on.includes(id) && groups[id]).map(id => groups[id]); }

function layout() {
  const vis = state.order.filter(id => state.on.includes(id));
  const step = state.pitch + state.spread;
  for (const id of state.order) {
    const g = groups[id];
    if (!g) continue;
    const i = vis.indexOf(id);
    g.visible = i >= 0;
    if (i < 0) continue;
    const level = vis.length - 1 - i;                          // bottom board at level 0
    g.position.y = mm(level * step + (state.nudge[id] || 0));
    const h = g.getObjectByName('headers'); if (h) h.visible = state.headers;
  }
  // CSS2DRenderer ignores a parent's visibility, so hide labels of hidden boards explicitly
  for (const g of Object.values(groups)) { const l = g.getObjectByName('label'); if (l) l.visible = g.visible && state.labels; }
  viewer.requestRender();
}

/* ---------- side panel ---------- */
const side = $('#side');
if (matchMedia('(max-width: 760px)').matches) side.classList.add('collapsed');
$('#toggle-side').onclick = () => side.classList.toggle('collapsed');

function renderPanel() {
  side.innerHTML = `
    <div><h4>Stack · top to bottom</h4><div class="stack-list" id="list"></div>
      <p class="small muted" style="margin:6px 0 0">Drag a row (or use ▲▼) to change the order. The slider nudges one board up or down by up to ±${NUDGE} mm.</p></div>
    <div><h4>Spacing</h4>
      <label class="field">Board pitch <input type="number" id="pitch" min="5" max="60" step="0.01" value="${state.pitch}"> mm</label>
      <label class="field">Spread <input type="range" id="spread" min="0" max="60" step="1" value="${state.spread}"><span id="spreadv">${state.spread} mm</span></label>
    </div>
    <div><h4>Show</h4>
      <label class="field"><input type="checkbox" id="headers" ${state.headers ? 'checked' : ''}> Stack-through headers</label>
      <label class="field"><input type="checkbox" id="labels" ${state.labels ? 'checked' : ''}> Board names</label>
    </div>
    <div class="row"><button class="btn" id="reset">Reset</button><button class="btn" id="copy">Copy link</button></div>
    ${reasons.length ? `<div><h4>Not in the stack</h4>${reasons.map(([b, r]) => `<div class="na"><b>${esc(b.name)}</b>: ${r}</div>`).join('')}</div>` : ''}
    <p class="small muted">Headers are drawn as Samtec ESQ-126-39-G-D (≈ ${HEADER.bodyH} mm body, ${HEADER.tail} mm tails). Default pitch ${DEFAULT_PITCH} mm (0.6").</p>`;
  const list = $('#list');
  state.order.forEach((id, i) => {
    const b = byId[id], on = state.on.includes(id), n = state.nudge[id] || 0;
    const row = document.createElement('div');
    row.className = 'sb' + (on ? '' : ' off');
    row.draggable = true;
    row.dataset.id = id;
    row.innerHTML = `
      <div class="top">
        <input type="checkbox" ${on ? 'checked' : ''} title="Show / hide">
        <span class="name" title="Zoom to ${esc(b.name)}">${esc(b.name)}</span>
        <span class="prog small muted" id="prog-${id}"></span>
        <button class="mv" data-d="-1" ${i === 0 ? 'disabled' : ''} title="Move up">▲</button>
        <button class="mv" data-d="1" ${i === state.order.length - 1 ? 'disabled' : ''} title="Move down">▼</button>
      </div>
      <div class="off-row">↕ <input type="range" min="${-NUDGE}" max="${NUDGE}" step="0.1" value="${n}" ${on ? '' : 'disabled'}>
        <span class="val">${n > 0 ? '+' : ''}${n.toFixed(1)} mm</span></div>`;
    row.querySelector('input[type=checkbox]').onchange = e => {
      state.on = e.target.checked ? [...state.on, id] : state.on.filter(x => x !== id);
      changed(true);
    };
    row.querySelector('.name').onclick = () => groups[id]?.visible && viewer.fit([groups[id]]);
    row.querySelectorAll('.mv').forEach(btn => btn.onclick = () => move(id, +btn.dataset.d));
    const slider = row.querySelector('input[type=range]'), val = row.querySelector('.val');
    slider.oninput = () => {
      const v = +slider.value;
      state.nudge[id] = v; val.textContent = `${v > 0 ? '+' : ''}${v.toFixed(1)} mm`;
      layout(); saveState();
    };
    slider.ondblclick = () => { slider.value = 0; slider.oninput(); };
    // drag & drop reordering
    row.ondragstart = e => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; };
    row.ondragover = e => { e.preventDefault(); row.classList.add('drag-over'); };
    row.ondragleave = () => row.classList.remove('drag-over');
    row.ondrop = e => {
      e.preventDefault(); row.classList.remove('drag-over');
      const from = e.dataTransfer.getData('text/plain');
      if (!from || from === id) return;
      state.order = state.order.filter(x => x !== from);
      state.order.splice(state.order.indexOf(id) + (e.offsetY > row.offsetHeight / 2 ? 1 : 0), 0, from);
      changed(false);
    };
    list.append(row);
  });
  $('#pitch').onchange = e => { state.pitch = Math.max(5, +e.target.value || DEFAULT_PITCH); changed(false, true); };
  $('#spread').oninput = e => { state.spread = +e.target.value; $('#spreadv').textContent = `${state.spread} mm`; layout(); saveState(); };
  $('#spread').onchange = () => viewer.fit(visibleGroups());
  $('#headers').onchange = e => { state.headers = e.target.checked; layout(); saveState(); };
  $('#labels').onchange = e => { state.labels = e.target.checked; layout(); saveState(); };
  $('#reset').onclick = () => { state = defaults(); changed(true); };
  $('#copy').onclick = async () => {
    saveState();
    try { await navigator.clipboard.writeText(location.href); $('#copy').textContent = 'Copied ✓'; }
    catch { prompt('Copy this link:', location.href); }
    setTimeout(() => { const c = $('#copy'); if (c) c.textContent = 'Copy link'; }, 1500);
  };
  for (const [id, p] of Object.entries(progress)) setProgress(id, p);
}

function move(id, d) {
  const i = state.order.indexOf(id), j = i + d;
  if (j < 0 || j >= state.order.length) return;
  [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
  changed(false);
}

function changed(refit, refitAlways = false) {
  saveState(); renderPanel(); layout();
  if (refit || refitAlways) viewer.fit(visibleGroups());
}

const progress = {};
function setProgress(id, p) {
  progress[id] = p;
  const el = document.getElementById(`prog-${id}`);
  if (el) el.textContent = p === null ? '' : p === 'err' ? '⚠ failed' : `${Math.round(p * 100)}%`;
}

/* ---------- go ---------- */
renderPanel();
if (!stackable.length) {
  view.insertAdjacentHTML('beforeend', '<div class="notice" style="position:relative;z-index:2">No board has a PC104-Stack footprint yet.</div>');
} else {
  // start with the camera roughly framing a 3U stack so the first boards appear in a sensible spot
  viewer.camera.position.set(0.2, 0.15, 0.25);
  viewer.controls.target.set(0.04, 0.03, -0.04);
  let first = true;
  await Promise.all(stackable.map(b => loadBoard(b).then(() => {
    if (first && state.on.includes(b.id)) { first = false; viewer.fit(visibleGroups(), new THREE.Vector3(0.9, 0.7, 1.3), false); }
  }).catch(e => { console.error(b.id, e); setProgress(b.id, 'err'); })));
  viewer.fit(visibleGroups(), new THREE.Vector3(0.9, 0.7, 1.3));
}
