// Treino em andamento: um exercício por vez
const WK = { w: null, idx: 0 };

function numStr(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : '';
}

function prefillSet(ex, i) {
  const l = ex.last && ex.last.sets.length ? ex.last.sets[Math.min(i, ex.last.sets.length - 1)] : null;
  let weight = ex.suggestion && ex.suggestion.weight !== null ? ex.suggestion.weight : (l ? l.weight_kg : '');
  let reps = ex.rep_max;
  if (l && l.reps) {
    const raised = ex.suggestion && ex.suggestion.weight && l.weight_kg && ex.suggestion.weight > Number(l.weight_kg);
    reps = raised ? ex.rep_min : Math.min(ex.rep_max, Number(l.reps) + 1);
  }
  return { weight: numStr(weight), reps: numStr(reps), done: false };
}

function initWorkoutUi(w) {
  for (const ex of w.exercises) {
    const done = ex.sets_done || [];
    if (ex.kind === 'cardio') {
      const f = done[0];
      ex.ui = { sets: [f ? { reps: numStr(f.reps), done: true } : { reps: numStr(ex.cardio_minutes), done: false }] };
      continue;
    }
    const n = Math.max(ex.sets, done.length);
    ex.ui = { sets: [] };
    for (let i = 0; i < n; i++) {
      const f = done.find((s) => Number(s.set_number) === i + 1);
      ex.ui.sets.push(f ? { weight: numStr(f.weight_kg), reps: numStr(f.reps), done: true } : prefillSet(ex, i));
    }
  }
}

// Alternativas por grupo muscular, para quando a academia não tem o aparelho
const ALTS = {
  peito: ['Voador (peck deck)', 'Crossover na polia', 'Crucifixo com halteres', 'Supino reto com halteres', 'Supino inclinado com barra',
    'Supino inclinado na máquina', 'Supino reto na máquina', 'Flexão de braço', 'Crucifixo na máquina'],
  'tríceps': ['Tríceps na polia (barra)', 'Tríceps na polia (corda)', 'Tríceps testa', 'Tríceps francês com halter', 'Mergulho no banco',
    'Mergulho nas paralelas', 'Tríceps coice'],
  costas: ['Puxada frontal', 'Puxada com triângulo', 'Remada curvada com barra', 'Remada unilateral com halter', 'Remada baixa no cabo',
    'Remada na máquina', 'Remada cavalinho', 'Pulldown com corda', 'Barra fixa'],
  'bíceps': ['Rosca direta com barra', 'Rosca direta com halteres', 'Rosca martelo', 'Rosca alternada', 'Rosca scott', 'Rosca na polia', 'Rosca concentrada'],
  'quadríceps': ['Agachamento livre', 'Agachamento no smith', 'Agachamento hack', 'Leg press 45', 'Leg press horizontal', 'Cadeira extensora',
    'Afundo com halteres', 'Passada com halteres', 'Agachamento búlgaro'],
  posterior: ['Mesa flexora', 'Cadeira flexora', 'Stiff com barra', 'Stiff com halteres', 'Levantamento terra romeno', 'Flexora em pé'],
  'glúteos': ['Elevação pélvica', 'Cadeira abdutora', 'Glúteo na polia', 'Glúteo na máquina', 'Agachamento sumô', 'Stiff com halteres'],
  panturrilha: ['Panturrilha em pé', 'Panturrilha sentado', 'Panturrilha no leg press', 'Panturrilha no smith'],
  ombros: ['Desenvolvimento com halteres', 'Desenvolvimento com barra', 'Desenvolvimento na máquina', 'Elevação lateral', 'Elevação lateral na polia',
    'Elevação frontal', 'Crucifixo inverso', 'Crucifixo inverso na máquina', 'Face pull'],
  'trapézio': ['Encolhimento com halteres', 'Encolhimento com barra', 'Encolhimento na máquina', 'Remada alta'],
  'abdômen': ['Abdominal na máquina', 'Abdominal na polia', 'Abdominal supra no solo', 'Elevação de pernas', 'Prancha', 'Abdominal infra'],
};

function exDone(ex) {
  const n = ex.ui.sets.filter((s) => s.done).length;
  return ex.kind === 'cardio' ? n >= 1 : n >= ex.sets;
}

async function viewWorkout() {
  let w = App.state.workout;
  if (!w || w.status !== 'em_andamento') {
    if (Outbox.count()) await Outbox.flush();
    const pd = await App.refreshPlan();
    if (!pd.in_progress) return App.go('#/treino');
    const r = await api('workout_get', { query: { id: pd.in_progress.id } });
    w = r.workout;
    App.state.workout = w;
  }
  if (WK.w !== w) {
    WK.w = w;
    initWorkoutUi(w);
    const first = w.exercises.findIndex((e) => !exDone(e));
    WK.idx = first === -1 ? w.exercises.length - 1 : first;
  }
  Wake.on();
  drawWorkout();
}

function startElapsed(startedAt) {
  const start = new Date(startedAt.replace(' ', 'T')).getTime();
  clearInterval(window.__wkTimer);
  const tick = () => {
    const t = document.getElementById('elapsed');
    if (!t) return clearInterval(window.__wkTimer);
    t.textContent = fmt.mmss((Date.now() - start) / 1000);
  };
  window.__wkTimer = setInterval(tick, 1000);
  tick();
}

function drawWorkout() {
  const w = WK.w;
  const ex = w.exercises[WK.idx];
  const total = w.exercises.length;
  const isLast = WK.idx === total - 1;
  document.body.classList.add('in-workout');
  Rest.defaultSec = ex.rest_sec || 90;

  const top = el('div', { class: 'wk-top' },
    el('button', { class: 'round', 'aria-label': 'Exercício anterior', disabled: WK.idx === 0, html: ICONS.back, onclick: () => go(-1) }),
    el('div', { class: 'wk-mid' },
      el('span', { class: 'tag' }, 'Treino ' + w.label + ' · ' + w.title),
      el('div', { class: 'row', style: 'gap:8px' },
        el('span', { class: 'mute small' }, 'Exercício ' + (WK.idx + 1) + ' de ' + total),
        el('span', { class: 'mono small', id: 'elapsed' }, '00:00'))),
    el('button', { class: 'round', 'aria-label': 'Menu', html: ICONS.menu, onclick: workoutMenu }));

  const segs = el('div', { class: 'segs' }, w.exercises.map((e, i) =>
    el('i', { class: exDone(e) ? 'done' : i === WK.idx ? 'cur' : '' })));

  const body = ex.kind === 'cardio' ? cardioBody(ex) : strengthBody(ex);

  const foot = el('div', { class: 'wk-foot' }, el('div', { class: 'in' + (ex.kind === 'cardio' ? ' one' : '') },
    ex.kind === 'cardio' ? null : Rest.node(),
    el('button', { class: 'pillbtn main', onclick: () => (isLast ? finishWorkout() : go(1)) },
      el('span', null, isLast ? 'Finalizar treino' : (exDone(ex) ? 'Próximo exercício' : 'Pular para o próximo')),
      el('span', { html: isLast ? ICONS.check : ICONS.next }))));

  mount(top, segs, body, foot);
  startElapsed(w.started_at);
}

function go(d) {
  const n = WK.idx + d;
  if (n < 0 || n >= WK.w.exercises.length) return;
  WK.idx = n;
  drawWorkout();
}

function lastLine(ex) {
  if (!ex.last) return null;
  const parts = ex.last.sets.map((s) => (s.weight_kg !== null ? fmt.num(s.weight_kg, 2) + ' kg x ' : '') + s.reps);
  return 'Último treino (' + fmt.date(ex.last.date) + '): ' + parts.join(' | ');
}

function pillIn(value, unit, label, onTap) {
  return el('button', { class: 'pill-in', 'aria-label': label, onclick: onTap },
    el('b', null, value === '' ? '-' : fmt.num(value, 2)), el('em', null, unit));
}

async function editSetField(ex, i, field) {
  const s = ex.ui.sets[i];
  const isW = field === 'weight';
  const cur = Number(String(s[field]).replace(',', '.'));
  const n = await pickNumber(isW
    ? { title: 'Carga da série ' + (i + 1), value: cur || 0, step: 2.5, steps: [0.5, 1, 2.5, 5], max: 500, unit: 'KG' }
    : { title: 'Repetições da série ' + (i + 1), value: cur || ex.rep_max, step: 1, steps: [1, 5], max: 100, unit: 'REPS' });
  if (n === null) return;
  s[field] = numStr(n);
  s.touched = true;
  if (s.done) persistSet(ex, i);
  drawWorkout();
}

function strengthBody(ex) {
  const ui = ex.ui;
  const nextIdx = ui.sets.findIndex((s) => !s.done);
  const rows = ui.sets.map((s, i) =>
    el('div', { class: 'set' + (s.done ? ' done' : '') + (i === nextIdx ? ' next' : '') },
      el('div', { class: 'n' }, i + 1),
      pillIn(s.weight, 'KG', 'Carga da série ' + (i + 1), () => editSetField(ex, i, 'weight')),
      pillIn(s.reps, 'REPS', 'Repetições da série ' + (i + 1), () => editSetField(ex, i, 'reps')),
      el('button', { class: 'chk' + (s.done ? ' on' : ''), 'aria-label': s.done ? 'Desfazer série' : 'Concluir série',
        html: ICONS.check, onclick: () => toggleSet(ex, i) })));

  const sug = ex.suggestion && ex.suggestion.reason;
  return el('div', null,
    el('div', null,
      el('span', { class: 'tag' }, ex.muscle || 'exercício'),
      el('div', { class: 'ex-name' }, ex.name),
      el('div', { class: 'row wrap', style: 'margin:2px 0 8px' },
        el('button', { class: 'btn ghost sm', onclick: () => showGuide(ex) }, 'Como fazer'),
        el('button', { class: 'btn ghost sm', onclick: () => swapExercise(ex) }, 'Trocar exercício')),
      el('div', { class: 'row wrap small', style: 'gap:8px' },
        el('span', { class: 'mute' }, ex.sets + ' séries · ' + (ex.rep_min === ex.rep_max ? ex.rep_min : ex.rep_min + ' a ' + ex.rep_max) + ' reps'),
        el('button', { class: 'tag', style: 'border:0;font:inherit;font-size:11.5px;font-weight:600;cursor:pointer;color:var(--acc)',
          'aria-label': 'Mudar tempo de descanso', onclick: () => editRest(ex) }, 'Descanso ' + ex.rest_sec + 's'))),
    (lastLine(ex) || sug) ? el('div', { class: 'hint', style: 'margin:14px 0' },
      lastLine(ex) ? el('div', null, lastLine(ex)) : null,
      sug ? el('div', { style: lastLine(ex) ? 'margin-top:6px' : '' }, el('b', null, 'Sugestão: '), sug) : null) : el('div', { style: 'height:14px' }),
    el('div', null, rows),
    el('div', { class: 'setctl' },
      ui.sets.length > 1 ? el('button', { class: 'round', 'aria-label': 'Remover série', html: ICONS.minus, onclick: () => removeLastSet(ex) }) : null,
      el('button', { class: 'round', 'aria-label': 'Adicionar série', html: ICONS.plus, onclick: () => { ui.sets.push(prefillFromPrev(ex)); drawWorkout(); } })));
}

function showGuide(ex) {
  const g = guideFor(ex);
  sheet((close) => [
    el('h2', { style: 'margin-top:0' }, ex.name),
    g ? el('div', { class: 'stack' },
      el('div', null, el('h3', null, 'Como fazer'), el('p', { style: 'margin:0' }, g.how)),
      el('div', null, el('h3', null, 'Cuidado'), el('p', { class: 'mute', style: 'margin:0' }, g.care)))
      : el('p', { class: 'mute' }, 'Ainda não tenho um guia para este exercício.'),
    el('div', { class: 'stack', style: 'margin-top:16px' },
      el('a', { class: 'btn acc', href: videoUrl(ex.name), target: '_blank', rel: 'noopener noreferrer', style: 'text-decoration:none' }, 'Ver vídeo de execução'),
      el('button', { class: 'btn ghost', onclick: close }, 'Fechar')),
  ]);
}

async function editRest(ex) {
  const n = await pickNumber({ title: 'Descanso entre séries', value: ex.rest_sec || 60, step: 15, steps: [5, 15, 30], min: 0, max: 600, unit: 'SEGUNDOS' });
  if (n === null) return;
  try {
    await api('workout_rest', { body: { workout_id: WK.w.id, index: WK.w.exercises.indexOf(ex), rest_sec: n } });
    ex.rest_sec = n;
    Rest.defaultSec = n;
    toast('Descanso de ' + n + 's. Vale também para os próximos treinos');
    drawWorkout();
  } catch (e) { toast(e.message, true); }
}

function swapExercise(ex) {
  const w = WK.w;
  const idx = w.exercises.indexOf(ex);
  const taken = new Set(w.exercises.map((e) => e.name.toLowerCase()));
  const opts = (ALTS[ex.muscle] || []).filter((n) => !taken.has(n.toLowerCase()));
  const custom = el('input', { placeholder: 'Ou digite o nome do exercício', maxlength: 100 });
  let remember = true;
  const rememberBtn = el('button', { type: 'button', class: 'btn line', onclick: () => {
    remember = !remember;
    rememberBtn.textContent = remember ? 'Vale para os próximos treinos também' : 'Só para o treino de hoje';
  } }, 'Vale para os próximos treinos também');
  sheet((close) => {
    const apply = async (name) => {
      name = String(name || '').trim();
      if (!name) return toast('Escolha ou digite um exercício', true);
      try {
        const r = await api('workout_swap', { body: { workout_id: w.id, index: idx, name, remember } });
        const nx = r.workout.exercises[idx];
        ex.name = nx.name; ex.last = nx.last; ex.suggestion = nx.suggestion;
        ex.ui.sets.forEach((s, i) => { if (!s.done) Object.assign(s, prefillSet(ex, i)); });
        close();
        toast('Trocado por ' + name);
        drawWorkout();
      } catch (e) { toast(e.message, true); }
    };
    return [
      el('h2', { style: 'margin-top:0' }, 'Trocar ' + ex.name),
      el('p', { class: 'mute small' }, 'As séries e repetições continuam as mesmas. A carga sugerida vem do último treino deste novo exercício.'),
      el('div', { class: 'list' }, opts.map((n) =>
        el('div', { class: 'item', style: 'cursor:pointer', onclick: () => apply(n) },
          el('div', { class: 'grow' }, n), el('span', { class: 'chev', html: ICONS.next })))),
      el('div', { class: 'stack', style: 'margin-top:14px' },
        custom,
        el('button', { class: 'btn', onclick: () => apply(custom.value) }, 'Usar o nome digitado'),
        rememberBtn,
        el('button', { class: 'btn ghost', onclick: close }, 'Cancelar')),
    ];
  });
}

function prefillFromPrev(ex) {
  const prev = ex.ui.sets[ex.ui.sets.length - 1];
  return { weight: prev ? prev.weight : '', reps: prev ? prev.reps : numStr(ex.rep_max), done: false };
}

async function removeLastSet(ex) {
  const i = ex.ui.sets.length - 1;
  if (ex.ui.sets[i].done) {
    try { await api('set_delete', { body: { workout_id: WK.w.id, exercise_name: ex.name, set_number: i + 1 } }); } catch (e) { /* segue */ }
  }
  ex.ui.sets.pop();
  drawWorkout();
}

function cardioBody(ex) {
  const s = ex.ui.sets[0];
  return el('div', { class: 'stack' },
    el('div', null,
      el('span', { class: 'tag' }, 'cardio'),
      el('div', { class: 'ex-name' }, ex.name),
      el('button', { class: 'btn ghost sm', style: 'margin:2px 0 8px', onclick: () => showGuide(ex) }, 'Como fazer'),
      el('div', { class: 'mute small' }, 'Meta: ' + ex.cardio_minutes + ' minutos em ritmo moderado, conversando com esforço.')),
    el('div', { class: 'card stack' },
      el('label', { class: 'f' }, 'Minutos feitos'),
      pillIn(s.reps, 'MIN', 'Minutos de cardio', async () => {
        const n = await pickNumber({ title: 'Minutos de cardio', value: Number(s.reps) || ex.cardio_minutes || 20, step: 1, steps: [1, 5], max: 240, unit: 'MIN' });
        if (n === null) return;
        s.reps = numStr(n);
        if (s.done) persistSet(ex, 0);
        drawWorkout();
      }),
      el('button', { class: 'btn ' + (s.done ? '' : 'acc'), onclick: () => toggleSet(ex, 0) },
        s.done ? 'Cardio registrado (toque para desfazer)' : 'Concluir cardio')),
    el('p', { class: 'mute small' }, 'Os batimentos e as calorias reais vêm do relatório do relógio, no fim do treino.'));
}

async function persistSet(ex, i) {
  const s = ex.ui.sets[i];
  const ok = await saveSet({
    workout_id: WK.w.id, exercise_name: ex.name, set_number: i + 1,
    reps: s.reps === '' ? null : Number(String(s.reps).replace(',', '.')),
    weight_kg: ex.kind === 'cardio' || s.weight === '' ? null : Number(String(s.weight).replace(',', '.')),
  }).catch((e) => { toast(e.message, true); return true; });
  if (ok === false) toast('Sem sinal: série guardada no celular e enviada depois');
}

async function toggleSet(ex, i) {
  const s = ex.ui.sets[i];
  if (!s.done) {
    if (s.reps === '') return toast('Informe as repetições', true);
    s.done = true;
    vibrate(40);
    await persistSet(ex, i);
    const allDone = exDone(ex);
    if (ex.kind !== 'cardio') {
      // próxima série herda a carga da que acabou de fechar
      const nxt = ex.ui.sets[i + 1];
      if (nxt && !nxt.done && s.weight !== '' && !nxt.touched) nxt.weight = s.weight;
      Rest.start(ex.rest_sec);
      if (allDone) toast('Exercício concluído');
    } else toast('Cardio registrado');
  } else {
    s.done = false;
    try { await api('set_delete', { body: { workout_id: WK.w.id, exercise_name: ex.name, set_number: i + 1 } }); } catch (e) { /* offline */ }
    Rest.stop();
  }
  drawWorkout();
}

function workoutMenu() {
  const w = WK.w;
  sheet((close) => [
    el('h2', { style: 'margin-top:0' }, 'Exercícios'),
    el('div', { class: 'list' }, w.exercises.map((e, i) =>
      el('div', { class: 'item', style: 'cursor:pointer', onclick: () => { close(); WK.idx = i; drawWorkout(); } },
        el('div', { class: 'dot', style: exDone(e) ? 'background:var(--acc-grad);color:var(--acc-tx)' : '' }, exDone(e) ? '✓' : i + 1),
        el('div', { class: 'grow' }, e.name),
        el('span', { class: 'mute small' }, e.kind === 'cardio' ? '' : e.ui.sets.filter((s) => s.done).length + '/' + e.sets)))),
    el('div', { class: 'stack', style: 'margin-top:14px' },
      el('button', { class: 'btn bad', onclick: async () => {
        close();
        if (await confirmSheet('Cancelar este treino?', 'Tudo que foi registrado nele será apagado.', 'Cancelar treino', true)) {
          try {
            await api('workout_cancel', { body: { workout_id: w.id } });
            App.state.workout = null; WK.w = null;
            Rest.stop();
            App.go('#/treino');
          } catch (e) { toast(e.message, true); }
        }
      } }, 'Cancelar treino'),
      el('button', { class: 'btn ghost', onclick: close }, 'Fechar')),
  ]);
}

async function finishWorkout() {
  const w = WK.w;
  const missing = w.exercises.filter((e) => e.ui.sets.filter((s) => s.done).length === 0).length;
  if (missing) {
    const ok = await confirmSheet('Finalizar treino?', missing + (missing === 1 ? ' exercício ficou' : ' exercícios ficaram') + ' sem nenhuma série registrada.', 'Finalizar mesmo assim');
    if (!ok) return;
  }
  await Outbox.flush();
  App.state.finish = { workoutId: w.id, label: w.label };
  App.go('#/finalizar');
}
