// Utilidades de interface
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false || k === 'value') continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else n.setAttribute(k, v);
    }
  }
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else n.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  if (attrs && attrs.value !== undefined && attrs.value !== null) n.value = attrs.value;
  return n;
}

function mount(...nodes) {
  const app = document.getElementById('app');
  app.replaceChildren(...nodes.flat().filter(Boolean));
  window.scrollTo(0, 0);
}

let toastTimer;
function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast on' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, isErr ? 4200 : 2200);
}

function sheet(build, onClose) {
  const root = document.getElementById('sheet-root');
  let closed = false;
  const close = () => { root.replaceChildren(); if (!closed) { closed = true; if (onClose) onClose(); } };
  const box = el('div', { class: 'sheet' });
  const back = el('div', { class: 'back', onclick: (e) => { if (e.target === back) close(); } }, box);
  box.append(...[].concat(build(close)));
  root.replaceChildren(back);
  return close;
}

function confirmSheet(title, text, okLabel, danger) {
  return new Promise((resolve) => {
    sheet((close) => [
      el('h2', { style: 'margin-top:0' }, title),
      text ? el('p', { class: 'mute' }, text) : null,
      el('div', { class: 'stack' },
        el('button', { class: 'btn ' + (danger ? 'bad' : 'acc'), onclick: () => { close(); resolve(true); } }, okLabel || 'Confirmar'),
        el('button', { class: 'btn ghost', onclick: () => { close(); resolve(false); } }, 'Cancelar')),
    ]);
  });
}

const fmt = {
  num(v, d = 1) {
    if (v === null || v === undefined || v === '') return '';
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
  },
  date(s) {
    if (!s) return '';
    const d = new Date(String(s).replace(' ', 'T'));
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  },
  dateLong(s) {
    const d = new Date(String(s).replace(' ', 'T'));
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  },
  mmss(sec) {
    sec = Math.max(0, Math.floor(sec));
    return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  },
  today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
};

const ICONS = {
  treino: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>',
  ficha: '<svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
  corpo: '<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="2.5"/><path d="M12 9v6M8 11l4 1 4-1M9.5 21l2.5-6 2.5 6"/></svg>',
  historico: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4M12 8v4l3 2"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  skip: '<svg viewBox="0 0 24 24"><path d="M6 6l8 6-8 6zM18 6v12"/></svg>',
  timer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 1.5M9.5 3h5"/></svg>',
  perfil: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-5.5 7-5.5s6 1.5 7 5.5"/></svg>',
};

// Reduz a foto antes de enviar (economiza dados e custo da leitura por IA)
function resizeImage(file, maxDim = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao preparar a imagem'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não consegui abrir a imagem')); };
    img.src = url;
  });
}

// ---- Alerta sonoro e vibração ----
let audioCtx;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.22, 0.44].forEach((t) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.18);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.2);
    });
  } catch (e) { /* sem audio */ }
}
function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* ignora */ }
}
function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignora */ } }

// ---- Tela sempre acesa durante o treino ----
const Wake = {
  lock: null,
  async on() {
    try { if ('wakeLock' in navigator) this.lock = await navigator.wakeLock.request('screen'); } catch (e) { /* ignora */ }
  },
  off() { try { if (this.lock) this.lock.release(); } catch (e) { /* ignora */ } this.lock = null; },
};
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && document.body.classList.contains('in-workout')) Wake.on();
});

// ---- Seletor de número com roda (arraste, toque nos botões ou use a roda do mouse) ----
function pickNumber(o) {
  return new Promise((resolve) => {
    const step0 = o.step || 1;
    let step = step0;
    let v = Number(o.value) || 0;
    const min = o.min === undefined ? 0 : o.min, max = o.max === undefined ? 999 : o.max;
    let result = null;
    const clamp = (x) => Math.min(max, Math.max(min, Math.round(x * 100) / 100));
    const wheel = el('div', { class: 'wheel', role: 'spinbutton', 'aria-label': o.title });
    const draw = () => {
      wheel.replaceChildren(...[-2, -1, 0, 1, 2].map((k) => {
        const x = v + k * step;
        const ok = x >= min && x <= max;
        return el('div', { class: 'w-n k' + (k < 0 ? 'm' : '') + Math.abs(k) }, ok ? fmt.num(x, 2) : '');
      }));
    };
    const set = (x) => { const n = clamp(x); if (n !== v) { v = n; draw(); } };
    let y0 = null, acc = 0;
    wheel.addEventListener('pointerdown', (e) => { y0 = e.clientY; acc = 0; try { wheel.setPointerCapture(e.pointerId); } catch (_) { /* ok */ } });
    wheel.addEventListener('pointermove', (e) => {
      if (y0 === null) return;
      acc += y0 - e.clientY; y0 = e.clientY;
      const n = Math.trunc(acc / 34);
      if (n) { acc -= n * 34; set(v + n * step); vibrate(8); }
    });
    const end = () => { y0 = null; };
    wheel.addEventListener('pointerup', end); wheel.addEventListener('pointercancel', end);
    wheel.addEventListener('wheel', (e) => { e.preventDefault(); set(v + (e.deltaY < 0 ? step : -step)); }, { passive: false });
    const stepsRow = el('div', { class: 'steps' });
    const drawSteps = () => {
      stepsRow.replaceChildren(...(o.steps || [step0]).map((st) =>
        el('button', { type: 'button', class: st === step ? 'on' : '', onclick: () => { step = st; drawSteps(); draw(); } }, '±' + fmt.num(st, 2))));
    };
    drawSteps(); draw();
    sheet((close) => [
      el('div', { class: 'row between' },
        el('h2', { style: 'margin:0' }, o.title),
        el('button', { class: 'round', 'aria-label': 'Fechar', html: ICONS.back.replace('M15 5l-7 7 7 7', 'M6 6l12 12M18 6L6 18'), onclick: close })),
      el('div', { class: 'picker', style: 'margin-top:14px' },
        el('button', { class: 'round', 'aria-label': 'Diminuir', html: ICONS.minus, onclick: () => set(v - step) }),
        el('div', null, wheel, el('div', { class: 'unit' }, o.unit || '')),
        el('button', { class: 'round', 'aria-label': 'Aumentar', html: ICONS.plus, onclick: () => set(v + step) })),
      stepsRow,
      el('button', { class: 'btn acc', onclick: () => { result = v; close(); } }, 'Confirmar'),
    ], () => resolve(result));
  });
}

// ---- Descanso: a pílula do rodapé mostra o tempo e pula com um toque ----
const Rest = {
  end: 0, total: 0, timer: null, state: 'idle', defaultSec: 90,
  start(sec) {
    if (!sec) return;
    unlockAudio();
    this.total = sec; this.end = Date.now() + sec * 1000; this.state = 'run';
    clearInterval(this.timer); clearTimeout(this.doneTimer);
    this.timer = setInterval(() => this.tick(), 250);
    this.paint();
  },
  tap() { if (this.state === 'run' || this.state === 'done') this.stop(); else this.start(this.defaultSec); },
  tick() {
    if (this.state !== 'run') return;
    if (this.end - Date.now() <= 0) return this.finish();
    this.paint();
  },
  finish() {
    clearInterval(this.timer);
    this.state = 'done';
    vibrate([300, 120, 300, 120, 300]);
    beep();
    this.doneTimer = setTimeout(() => this.stop(), 8000);
    this.paint();
  },
  stop() {
    clearInterval(this.timer); clearTimeout(this.doneTimer);
    this.state = 'idle';
    this.paint();
  },
  // pílula usada no rodapé do treino
  node() {
    const b = el('button', { class: 'pillbtn rest-pill', onclick: () => this.tap() });
    this.paint(b);
    return b;
  },
  paint(b) {
    const nodes = b ? [b] : [...document.querySelectorAll('.rest-pill')];
    const left = Math.max(0, Math.ceil((this.end - Date.now()) / 1000));
    for (const n of nodes) {
      const pct = this.state === 'run' ? Math.round((1 - left / this.total) * 100) : this.state === 'done' ? 100 : 0;
      n.className = 'pillbtn rest-pill' + (this.state === 'run' ? ' run' : this.state === 'done' ? ' done' : '');
      n.replaceChildren(
        el('span', { class: 'fill', style: 'width:' + pct + '%' }),
        el('span', null, this.state === 'run' ? 'Pular' : this.state === 'done' ? 'Descanso acabou' : 'Descanso'),
        el('span', { class: 'tm' }, this.state === 'run' ? fmt.mmss(left) : this.state === 'done' ? 'Ok' : fmt.mmss(this.defaultSec)));
    }
  },
};
