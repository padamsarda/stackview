// Two-point ruler. Adapters pick/project PCB-plane coordinates in millimetres.
function createPcbRuler(view, { surface, pick, project, subscribe = () => () => {} }) {
  const panel = document.createElement('div');
  panel.className = 'ruler-panel';
  panel.innerHTML = `<div class="row"><button class="btn" aria-pressed="false">Ruler</button>
    <button class="btn" data-clear disabled>Clear</button></div>
    <output aria-live="polite" hidden></output><span class="ruler-hint" hidden></span>`;
  const toggle = panel.querySelector('button'), clear = panel.querySelector('[data-clear]');
  const output = panel.querySelector('output'), hint = panel.querySelector('.ruler-hint');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('ruler-overlay');
  svg.setAttribute('aria-hidden', 'true');
  view.append(svg, panel);
  let active = false, points = [], hover = null, down = null;
  const pointers = new Set();
  const events = new AbortController();
  const listen = (target, name, fn, options = {}) => target.addEventListener(name, fn, { ...options, signal: events.signal });
  const valid = p => p && p.every(Number.isFinite);
  const fmt = n => Math.abs(n).toFixed(2);

  function redraw() {
    svg.replaceChildren();
    if (!active) return;
    const end = points[1] || hover;
    const ps = end && points.length ? [points[0], end] : points;
    const screen = ps.map(project);
    if (screen.some(p => !valid(p))) return;
    function shape(tag, attrs) {
      const el = document.createElementNS(svg.namespaceURI, tag);
      for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
      svg.append(el);
    }
    if (screen.length === 2) {
      shape('line', { x1: screen[0][0], y1: screen[0][1], x2: screen[1][0], y2: screen[1][1] });
      const dx = end[0] - points[0][0], dy = end[1] - points[0][1];
      output.textContent = `${fmt(Math.hypot(dx, dy))} mm · ΔX ${fmt(dx)} · ΔY ${fmt(dy)} mm`;
    } else output.textContent = '';
    for (const [cx, cy] of screen) shape('circle', { cx, cy, r: 5 });
  }
  function update() {
    toggle.setAttribute('aria-pressed', String(active));
    toggle.classList.toggle('primary', active);
    view.classList.toggle('ruler-active', active);
    clear.disabled = !points.length;
    output.hidden = hint.hidden = !active;
    hint.textContent = points.length === 2 ? 'Click to start another measurement. Esc to exit.'
      : points.length ? 'Choose the second point. Drag to move; wheel or pinch to zoom.'
      : 'Choose two points on the PCB. In 3D, use Top or Bottom for precise picking.';
    redraw();
  }
  listen(toggle, 'click', () => { active = !active; hover = null; down = null; update(); });
  listen(clear, 'click', () => { points = []; hover = null; update(); });
  listen(document, 'keydown', e => {
    if (e.key === 'Escape' && active) { active = false; down = null; hover = null; update(); }
  });
  listen(surface, 'pointerdown', e => {
    pointers.add(e.pointerId);
    down = active && e.button === 0 && pointers.size === 1
      ? { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false } : null;
  }, { capture: true });
  listen(surface, 'pointermove', e => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) down.moved = true;
    if (active && points.length === 1 && pointers.size < 2) {
      hover = pick(e.clientX, e.clientY); redraw();
    }
  });
  listen(surface, 'pointerleave', () => { hover = null; redraw(); });
  listen(window, 'pointerup', e => {
    pointers.delete(e.pointerId);
    if (down?.id !== e.pointerId) return;
    const click = !down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 5;
    down = null;
    if (!click || !active) return;
    const p = pick(e.clientX, e.clientY);
    if (!valid(p)) return;
    points = points.length === 1 ? [points[0], p] : [p];
    hover = null; update();
  }, { capture: true });
  listen(window, 'pointercancel', e => { pointers.delete(e.pointerId); down = null; });
  // Double-click retains its usual focus/zoom behaviour outside ruler mode.
  listen(surface, 'dblclick', e => { if (active) e.stopImmediatePropagation(); }, { capture: true });
  const unsubscribe = subscribe(redraw);
  const ro = new ResizeObserver(redraw); ro.observe(surface);
  update();
  return { redraw, dispose() {
    events.abort(); unsubscribe(); ro.disconnect(); svg.remove(); panel.remove();
    view.classList.remove('ruler-active');
  } };
}
