// Board page: schematic / PCB / 3D / BOM viewer for one board.
const MARGIN = 24;

const $ = (sel, el = document) => el.querySelector(sel);
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

let site, board, meta, base, tab, viewer, v3d;
const state = { sheet: 0, pcbSide: 'top', layersOn: null };

/* ---------- pan / zoom over stacked <img> layers ---------- */
class PanZoom {
  constructor(view) {
    this.view = view;
    this.scroller = h('<div class="scroller"></div>');
    this.stage = h('<div class="stage"></div>');
    this.scroller.append(this.stage);
    view.append(this.scroller, h(`<div class="zoombar">
      <button class="btn" data-z="out" title="Zoom out">−</button>
      <button class="btn" data-z="fit" title="Fit">Fit</button>
      <button class="btn" data-z="in" title="Zoom in">+</button></div>`));
    view.querySelector('.zoombar').addEventListener('click', e => {
      const z = e.target.closest('button')?.dataset.z; if (!z) return;
      const r = this.scroller.getBoundingClientRect();
      if (z === 'fit') this.fit(); else this.zoomAt(z === 'in' ? 1.6 : 1 / 1.6, r.left + r.width / 2, r.top + r.height / 2);
    });
    this.zoom = 1; this.mirror = false;
    this.bindInput();
    new ResizeObserver(() => this.zoom === 1 && this.fit()).observe(view);
  }
  setContent(viewBox, mirror = false) {
    this.vb = viewBox; this.aspect = viewBox[2] / viewBox[3]; this.mirror = mirror;
    this.stage.classList.toggle('mirror', mirror);
    this.fit();
  }
  baseWidth() {
    const w = this.view.clientWidth - 2 * MARGIN - 4, hgt = this.view.clientHeight - 2 * MARGIN - 4;
    return Math.max(100, Math.min(w, hgt * this.aspect));
  }
  apply() {
    const w = this.baseWidth() * this.zoom;
    this.stage.style.width = w + 'px';
    this.stage.style.height = w / this.aspect + 'px';
    // centre the sheet while it is smaller than the viewport
    // floor and -2 px: an exact fit rounds over by a pixel and shows pointless scrollbars
    const padX = Math.max(MARGIN, Math.floor((this.view.clientWidth - w) / 2) - 2);
    const padY = Math.max(MARGIN, Math.floor((this.view.clientHeight - w / this.aspect) / 2) - 2);
    this.stage.style.margin = `${padY}px ${padX}px`;
  }
  fit() { this.zoom = 1; this.apply(); this.scroller.scrollTo(0, 0); }
  // fraction (0..1) of the stage under a client point, in visual (on-screen) space
  fracAt(cx, cy) {
    const r = this.stage.getBoundingClientRect();
    return [(cx - r.left) / r.width, (cy - r.top) / r.height];
  }
  scrollToFrac(fx, fy, cx, cy) {
    const sr = this.scroller.getBoundingClientRect();
    const st = this.stage;
    this.scroller.scrollLeft = st.offsetLeft + fx * st.offsetWidth - (cx - sr.left);
    this.scroller.scrollTop = st.offsetTop + fy * st.offsetHeight - (cy - sr.top);
  }
  zoomAt(factor, cx, cy) {
    const [fx, fy] = this.fracAt(cx, cy);
    this.zoom = Math.min(80, Math.max(0.5, this.zoom * factor));
    this.apply();
    this.scrollToFrac(fx, fy, cx, cy);
  }
  // centre on a point given in SVG (viewBox) coordinates and drop a marker there
  focus(x, y, zoom = 6) {
    const fx0 = (x - this.vb[0]) / this.vb[2], fy = (y - this.vb[1]) / this.vb[3];
    this.stage.querySelectorAll('.marker').forEach(m => m.remove());
    const m = h('<div class="marker"></div>');
    m.style.left = fx0 * 100 + '%'; m.style.top = fy * 100 + '%';
    this.stage.append(m);
    this.zoom = zoom; this.apply();
    const sr = this.scroller.getBoundingClientRect();
    this.scrollToFrac(this.mirror ? 1 - fx0 : fx0, fy, sr.left + sr.width / 2, sr.top + sr.height / 2);
  }
  // current view centre in SVG coordinates (for comment links)
  centre() {
    const sr = this.scroller.getBoundingClientRect();
    let [fx, fy] = this.fracAt(sr.left + sr.width / 2, sr.top + sr.height / 2);
    if (this.mirror) fx = 1 - fx;
    return [this.vb[0] + fx * this.vb[2], this.vb[1] + fy * this.vb[3]].map(v => Math.round(v * 10) / 10);
  }
  bindInput() {
    const sc = this.scroller;
    sc.addEventListener('wheel', e => {
      e.preventDefault();
      this.zoomAt(Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0015)), e.clientX, e.clientY);
    }, { passive: false });
    let drag = null;
    sc.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop };
      sc.classList.add('dragging'); sc.setPointerCapture(e.pointerId);
    });
    sc.addEventListener('pointermove', e => {
      if (!drag) return;
      sc.scrollLeft = drag.l - (e.clientX - drag.x); sc.scrollTop = drag.t - (e.clientY - drag.y);
    });
    const end = () => { drag = null; sc.classList.remove('dragging'); };
    sc.addEventListener('pointerup', end); sc.addEventListener('pointercancel', end);
    sc.addEventListener('dblclick', e => this.zoomAt(2, e.clientX, e.clientY));
    // two-finger pinch; one finger falls through to native scrolling
    let pinch = null;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = t => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
    sc.addEventListener('touchstart', e => { if (e.touches.length === 2) pinch = dist(e.touches); }, { passive: true });
    sc.addEventListener('touchmove', e => {
      if (e.touches.length !== 2 || !pinch) return;
      e.preventDefault();
      const d = dist(e.touches), [cx, cy] = mid(e.touches);
      this.zoomAt(d / pinch, cx, cy); pinch = d;
    }, { passive: false });
    sc.addEventListener('touchend', () => { pinch = null; });
  }
}

/* ---------- layout helpers ---------- */
const isPhone = () => matchMedia('(max-width: 760px)').matches;

function clearWorkspace() {
  if (v3d) { v3d.dispose(); v3d = null; }
  const ws = $('#workspace'); ws.innerHTML = '';
  return ws;
}

function workspace(withSide = true) {
  const ws = clearWorkspace();
  const side = withSide ? h(`<aside class="side${isPhone() ? ' collapsed' : ''}"></aside>`) : null;
  const view = h('<div class="view"></div>');
  if (side) ws.append(side);
  ws.append(view);
  $('#toggle-side').style.visibility = withSide ? '' : 'hidden';
  return { side, view };
}

function searchBox(side, placeholder, entries, onPick) {
  const box = h(`<div><h4>Find</h4><input type="search" placeholder="${placeholder}"><div class="list" style="margin-top:6px"></div></div>`);
  const input = $('input', box), list = $('.list', box);
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    list.innerHTML = '';
    if (!q) return;
    const hits = entries.filter(e => e.t.toLowerCase().includes(q))
      .sort((a, b) => (b.t.toLowerCase() === q) - (a.t.toLowerCase() === q) || a.t.length - b.t.length)
      .slice(0, 80);
    if (!hits.length) list.append(h('<span class="muted small">No matches</span>'));
    for (const e of hits) {
      const b = h(`<button><span>${esc(e.t)}</span><span class="hint">${esc(e.where || '')}</span></button>`);
      b.onclick = () => {
        list.querySelectorAll('.on').forEach(x => x.classList.remove('on')); b.classList.add('on');
        if (isPhone()) side.classList.add('collapsed');  // give the drawing the whole screen
        onPick(e);
      };
      list.append(b);
    }
  });
  side.append(box);
  return input;
}

function noData(view, what) {
  view.append(h(`<div class="notice">No ${what} was exported for this board.</div>`));
}

/* ---------- tabs ---------- */
function showSch(restore) {
  const { side, view } = workspace();
  view.classList.add('paper');
  if (!meta.sheets.length) return noData(view, 'schematic');
  viewer = new PanZoom(view);
  viewer.stage.classList.add('paper');
  const entries = meta.sheets.flatMap((s, i) => s.texts.map(([t, x, y]) => ({ t, x, y, sheet: i, where: meta.sheets.length > 1 ? s.name : '' })));
  searchBox(side, 'Ref, value or net (e.g. U3, SDA)', entries, e => { showSheet(e.sheet); viewer.focus(e.x, e.y, 6); });
  const sheets = h('<div><h4>Sheets</h4><div class="list"></div></div>');
  meta.sheets.forEach((s, i) => {
    const b = h(`<button data-i="${i}">${esc(s.name)}</button>`);
    b.onclick = () => showSheet(i);
    $('.list', sheets).append(b);
  });
  side.append(sheets);
  side.append(h(`<a class="btn" href="${base}/schematic.pdf" target="_blank">Open PDF</a>`));
  state.sheet = -1;
  showSheet(Math.min(restore?.s ?? 0, meta.sheets.length - 1));
  if (restore?.x != null) viewer.focus(restore.x, restore.y, restore.z || 4);

  function showSheet(i) {
    if (i === state.sheet) return;
    state.sheet = i;
    const s = meta.sheets[i];
    viewer.stage.innerHTML = `<img src="${base}/${s.file}" alt="${esc(s.name)}">`;
    viewer.setContent(s.viewBox);
    side.querySelectorAll('[data-i]').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
  }
}

function showPcb(restore) {
  const { side, view } = workspace();
  if (!meta.layers.length) return noData(view, 'PCB');
  viewer = new PanZoom(view);
  const imgs = {};
  for (const l of meta.layers) {
    const img = h(`<img src="${base}/${l.file}" alt="${esc(l.name)}" loading="lazy">`);
    if (/\.(Cu|Mask)$/.test(l.name)) img.style.opacity = 0.78;  // see through pours, like KiCad
    imgs[l.name] = img; viewer.stage.append(img);
  }
  if (!state.layersOn) {
    state.layersOn = new Set(meta.layers.filter(l => l.on).map(l => l.name));
    if (state.pcbSide === 'bottom') state.layersOn.add('B.Silkscreen').delete('F.Silkscreen');
  }

  const sides = h(`<div><h4>View</h4><div class="row">
    <button class="btn" data-side="top">Top</button><button class="btn" data-side="bottom">Bottom (mirrored)</button></div></div>`);
  side.append(sides);
  const fab = meta.layers.flatMap(l => (l.texts || []).map(([t, x, y]) => ({ t, x, y, where: l.name })));
  searchBox(side, 'Reference or value (e.g. C8, 470nF)', fab, e => viewer.focus(e.x, e.y, 5));
  const layerBox = h('<div><h4>Layers</h4></div>');
  for (const l of meta.layers) {
    const row = h(`<label class="layer"><input type="checkbox"><span class="sw" style="background:${l.color}"></span>${esc(l.name)}</label>`);
    const cb = $('input', row);
    cb.checked = state.layersOn.has(l.name);
    cb.onchange = () => { cb.checked ? state.layersOn.add(l.name) : state.layersOn.delete(l.name); paint(); };
    l.cb = cb; layerBox.append(row);
  }
  side.append(layerBox);

  sides.addEventListener('click', e => {
    const s = e.target.closest('[data-side]')?.dataset.side;
    if (!s || s === state.pcbSide) return;
    state.pcbSide = s;
    // flipping sides swaps F.x <-> B.x so the same kind of view shows on the other face
    const flip = n => n.startsWith('F.') ? 'B.' + n.slice(2) : n.startsWith('B.') ? 'F.' + n.slice(2) : n;
    state.layersOn = new Set([...state.layersOn].map(flip));
    meta.layers.forEach(l => l.cb.checked = state.layersOn.has(l.name));
    viewer.setContent(meta.layers[0].viewBox, s === 'bottom');
    paint();
  });

  function paint() {
    const n = meta.layers.length;
    meta.layers.forEach((l, i) => {
      imgs[l.name].style.display = state.layersOn.has(l.name) ? '' : 'none';
      // looking from the bottom, back layers sit on top
      imgs[l.name].style.zIndex = state.pcbSide === 'bottom' ? (l.name.startsWith('B.') ? n + i : i) : i;
    });
    sides.querySelectorAll('[data-side]').forEach(b => b.classList.toggle('primary', b.dataset.side === state.pcbSide));
  }
  viewer.setContent(meta.layers[0].viewBox, state.pcbSide === 'bottom');
  paint();
  if (restore?.x != null) viewer.focus(restore.x, restore.y, restore.z || 4);
}

function show3d() {
  const { view } = workspace(false);
  viewer = null;
  const f = meta.files;
  if (!f.glb && !f.top) return noData(view, '3D model');
  // the render shows instantly; the interactive model replaces it once loaded
  const ph = h(`<div class="v3d-placeholder">${f.top ? `<img src="${base}/${f.top}" alt="">` : ''}<span>Loading 3D model…</span></div>`);
  view.append(ph);
  if (meta.missing_models?.length) {
    const n = meta.missing_models.reduce((s, m) => s + m.refs.length, 0);
    view.append(h(`<details class="v3d-missing"><summary>⚠ ${n} part${n > 1 ? 's' : ''} without a 3D model</summary>
      <p class="small">KiCad could not find these model files, so they are drawn as <b style="color:#f0a030">amber boxes</b>
      (courtyard size). Commit the file to the repository, or fix the path in the footprint, to see the real part.</p>
      <ul>${meta.missing_models.map(m => `<li><b>${esc(m.refs.join(', '))}</b><br><code>${esc(m.path)}</code></li>`).join('')}</ul></details>`));
  }
  if (!f.glb) { ph.querySelector('span').textContent = '3D model export failed, see Files tab.'; return; }
  import('./viewer3d.js?v=eca52ea').then(async ({ createViewer, toolbar, addPlaceholders }) => {
    if (!view.isConnected) return;
    const v = v3d = createViewer(view);
    view.append(...toolbar(v));
    try {
      const model = await v.load(`${base}/${f.glb}?v=${meta.source_hash?.slice(-12) || ''}`,
        p => { ph.querySelector('span').textContent = `Loading 3D model… ${Math.round(p * 100)}%`; });
      model.userData.fit = true;
      addPlaceholders(model, meta.placeholders, meta.stack?.thickness || 1.6);
      v.scene.add(model);
      v.fit(undefined, new v.THREE.Vector3(0.9, 1.1, 1.3), false);
      ph.remove();
    } catch (e) {
      ph.querySelector('span').textContent = 'Could not load the 3D model: ' + e.message;
    }
  }).catch(e => { ph.querySelector('span').textContent = 'Could not start the 3D viewer: ' + e.message; });
}

function btn(label, fn, cls = '') { const b = h(`<button class="btn ${cls}">${esc(label)}</button>`); b.onclick = fn; return b; }

function showBom() {
  const ws = clearWorkspace(); viewer = null;
  $('#toggle-side').style.visibility = 'hidden';
  const pane = h('<div class="pane"></div>'); ws.append(pane);
  if (!meta.bom?.length) return pane.append(h('<div class="notice">No BOM exported.</div>'));
  const [head, ...rows] = meta.bom;
  const qi = head.indexOf('Qty'), mi = head.indexOf('MPN'), di = head.indexOf('DNP'), fi = head.indexOf('Footprint');
  // "Capacitor_SMD:C_0805_..." -> "C_0805_..." on screen; the CSV keeps the full name
  const cell = (c, i) => i === fi && c.includes(':') ? `<td title="${esc(c)}">${esc(c.split(':')[1])}</td>` : `<td>${esc(c)}</td>`;
  const parts = rows.reduce((s, r) => s + (+r[qi] || 0), 0);
  const noMpn = rows.filter(r => !r[mi] && !r[di]).length;
  pane.append(h(`<p class="small">${rows.length} lines · ${parts} parts · <span style="color:var(--warn)">${noMpn} lines without MPN</span>
    · <a href="${base}/bom.csv" download>Download CSV</a></p>`));
  const input = h('<input type="search" placeholder="Filter" style="padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--panel);margin-bottom:10px;width:min(100%,320px)">');
  pane.append(input);
  const table = h(`<table class="bom"><thead><tr>${head.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody></tbody></table>`);
  pane.append(table);
  const tbody = $('tbody', table);
  const render = () => {
    const q = input.value.toLowerCase();
    tbody.innerHTML = rows.filter(r => !q || r.join(' ').toLowerCase().includes(q))
      .map(r => `<tr class="${r[di] ? 'dnp' : ''}">${r.map(cell).join('')}</tr>`).join('');
  };
  input.oninput = render; render();
}

function showFiles() {
  const ws = clearWorkspace(); viewer = null;
  $('#toggle-side').style.visibility = 'hidden';
  const f = meta.files;
  const links = [
    f.pdf && ['Schematic PDF', f.pdf], meta.bom && ['BOM (CSV)', 'bom.csv'],
    f.glb && ['3D model (GLB)', f.glb], f.top && ['Top render (PNG)', f.top], f.bottom && ['Bottom render (PNG)', f.bottom],
  ].filter(Boolean);
  const pane = h(`<div class="pane"><div class="notice">
    <p><b>${esc(board.name)}</b> · <code>${esc(board.project)}</code></p>
    <p class="small muted">Generated from commit <a href="${site.repo_url}/commit/${site.commit}">${site.commit.slice(0, 7)}</a> on <b>${esc(site.branch)}</b>.</p>
    <ul>${links.map(([n, p]) => `<li><a href="${base}/${p}" target="_blank">${n}</a></li>`).join('')}</ul></div></div>`);
  if (meta.warnings?.length) pane.append(h(`<div class="notice"><b>Export warnings</b><pre class="err">${esc(meta.warnings.join('\n\n'))}</pre></div>`));
  ws.append(pane);
}

const TABS = { sch: showSch, pcb: showPcb, '3d': show3d, bom: showBom, files: showFiles };

function openTab(name, restore) {
  tab = name;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  TABS[name](restore);
}

/* ---------- comment = prefilled GitHub issue ---------- */
function currentLink() {
  const p = new URLSearchParams({ b: board.id });
  const hash = new URLSearchParams({ t: tab });
  if (viewer && (tab === 'sch' || tab === 'pcb')) {
    const [x, y] = viewer.centre();
    if (tab === 'sch') hash.set('s', state.sheet);
    if (tab === 'pcb') hash.set('side', state.pcbSide);
    hash.set('x', x); hash.set('y', y); hash.set('z', Math.round(viewer.zoom * 10) / 10);
  }
  return `${location.origin}${location.pathname}?${p}#${hash}`;
}

function comment() {
  const where = tab === 'sch' ? `Schematic, sheet "${meta.sheets[state.sheet]?.name}"`
    : tab === 'pcb' ? `PCB, ${state.pcbSide} side` : tab.toUpperCase();
  const body = [
    `**Board:** ${board.name} (\`${board.folder}\`)`,
    `**Branch / commit:** \`${site.branch}\` @ ${site.commit.slice(0, 7)}`,
    `**Where:** ${where} · [open this exact view](${currentLink()})`,
    '', '<!-- Write your comment below. Screenshots welcome. -->', '',
  ].join('\n');
  const q = new URLSearchParams({ title: `[${board.name}] `, body, labels: 'review' });
  window.open(`${site.repo_url}/issues/new?${q}`, '_blank', 'noopener');
}

/* ---------- boot ---------- */
(async () => {
  site = await loadSite();
  const id = new URLSearchParams(location.search).get('b');
  board = site.boards.find(b => b.id === id);
  if (!board) { $('#workspace').innerHTML = '<div class="notice bad">Unknown board.</div>'; return; }
  base = `boards/${board.id}`;
  document.title = `${board.name} · Stackview`;
  $('#title').textContent = board.name;
  $('#branch').textContent = site.branch;
  $('#history').href = `${site.repo_url}/commits/${encodeURIComponent(site.branch)}/${board.folder}`;
  $('#comment').onclick = comment;
  $('#toggle-side').onclick = () => $('.side')?.classList.toggle('collapsed');
  meta = await (await fetch(`${base}/meta.json`, { cache: 'no-cache' })).json();
  if (meta.error) {
    $('#workspace').innerHTML = `<div class="pane"><div class="notice bad"><b>Export failed for this board.</b>
      Open it in KiCad and check it loads cleanly.<pre class="err">${esc(meta.error)}</pre></div></div>`;
    return;
  }
  $('#tabs').addEventListener('click', e => { const t = e.target.closest('[data-tab]')?.dataset.tab; if (t) openTab(t); });
  openFromHash();
  window.addEventListener('hashchange', openFromHash);
})();

// #t=pcb&side=top&x=..&y=..&z=..  (written by the comment button)
function openFromHash() {
  const hp = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
  const num = k => hp[k] != null ? +hp[k] : undefined;
  if (hp.side && hp.side !== state.pcbSide) { state.pcbSide = hp.side; state.layersOn = null; }
  const first = TABS[hp.t] ? hp.t : meta.sheets.length ? 'sch' : 'pcb';
  openTab(first, { s: num('s'), x: num('x'), y: num('y'), z: num('z') });
}
