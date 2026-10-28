// Histórico de treinos
async function viewHistory() {
  const r = await api('history');
  const list = r.workouts;
  if (!list.length) {
    mount(el('h1', null, 'Histórico'),
      el('div', { class: 'card center' }, el('p', { class: 'mute', style: 'margin:0' }, 'Nenhum treino finalizado ainda. O primeiro vai aparecer aqui.')));
    return;
  }
  mount(
    el('h1', null, 'Histórico'),
    el('p', { class: 'mute' }, list.length + ' treinos registrados.'),
    el('div', { class: 'card list', style: 'padding:4px 14px' }, list.map((w) =>
      el('div', { class: 'item', style: 'cursor:pointer', onclick: () => openWorkoutDetail(w.id) },
        el('div', { class: 'dot' }, w.label),
        el('div', { class: 'grow' },
          el('div', { style: 'font-weight:700' }, w.title),
          el('div', { class: 'mute small' }, fmt.date(w.finished_at) + ' · ' + w.sets + ' séries · ' + fmt.num(w.volume, 0) + ' kg de volume')),
        el('div', { class: 'small mute', style: 'text-align:right' },
          w.duration_min ? w.duration_min + ' min' : '',
          w.calories ? el('div', null, w.calories + ' kcal') : null)))));
}

async function openWorkoutDetail(id) {
  let w;
  try { w = (await api('history_get', { query: { id } })).workout; } catch (e) { return toast(e.message, true); }
  const watch = [];
  if (w.duration_min) watch.push(['Duração', w.duration_min + ' min']);
  if (w.calories) watch.push(['Calorias', w.calories + ' kcal']);
  if (w.avg_hr) watch.push(['FC média', w.avg_hr + ' bpm']);
  if (w.max_hr) watch.push(['FC máx', w.max_hr + ' bpm']);
  if (w.distance_km) watch.push(['Distância', fmt.num(w.distance_km, 2) + ' km']);
  sheet((close) => [
    el('div', { class: 'row between' },
      el('h2', { style: 'margin:0' }, 'Treino ' + w.label + ' · ' + w.title),
      el('button', { class: 'btn ghost sm', onclick: close }, 'Fechar')),
    el('p', { class: 'mute small' }, fmt.dateLong(w.finished_at)),
    watch.length ? el('div', { class: 'grid3', style: 'margin-bottom:12px' }, watch.map(([k, v]) => statBox(v, k))) : null,
    w.feedback ? el('div', { class: 'hint', style: 'margin-bottom:12px' }, el('pre', { class: 'fb' }, w.feedback)) : null,
    el('div', { class: 'stack' }, w.exercises.map((e) =>
      el('div', null,
        el('div', { style: 'font-weight:700' }, e.name),
        el('div', { class: 'mute small' }, e.sets.map((s) =>
          (s.weight_kg !== null ? fmt.num(s.weight_kg, 2) + ' kg x ' : '') + s.reps).join('  |  '))))),
    el('button', { class: 'btn', style: 'margin-top:14px', onclick: () => { App.state.editWorkout = w; close(); App.go('#/editar'); } },
      'Editar treino (cargas, relógio, print)'),
    w.watch_image ? el('div', { style: 'margin-top:14px' },
      el('div', { class: 'mute small', style: 'margin-bottom:6px' }, 'Print do relógio'),
      el('img', { class: 'thumb', style: 'max-width:180px', src: 'api/index.php?r=photo&f=' + w.watch_image, alt: 'Relatório do relógio' })) : null,
  ]);
}


// Edição de um treino já finalizado: cargas, repetições, dados do relógio e print
async function viewEditWorkout() {
  const w0 = App.state.editWorkout;
  if (!w0) return App.go('#/historico');
  const sv = (v) => (v === null || v === undefined ? '' : String(v));
  const byName = {};
  w0.exercises.forEach((e) => { byName[e.name] = e; });
  const names = w0.planned.map((p) => p.name);
  w0.exercises.forEach((e) => { if (!names.includes(e.name)) names.push(e.name); });
  const kindOf = {};
  w0.planned.forEach((p) => { kindOf[p.name] = p; });

  const exs = names.map((name) => {
    const p = kindOf[name] || {};
    const sets = (byName[name] ? byName[name].sets : []).map((x) => ({ weight: sv(x.weight_kg), reps: sv(x.reps) }));
    return { name, kind: p.kind || 'strength', sets, rep_max: p.rep_max || 10, planned: p.sets || 3 };
  });

  const f = {
    duration: el('input', { type: 'number', inputmode: 'numeric', value: sv(w0.duration_min) }),
    calories: el('input', { type: 'number', inputmode: 'numeric', value: sv(w0.calories) }),
    avg: el('input', { type: 'number', inputmode: 'numeric', value: sv(w0.avg_hr) }),
    max: el('input', { type: 'number', inputmode: 'numeric', value: sv(w0.max_hr) }),
    dist: el('input', { type: 'number', inputmode: 'decimal', step: '0.01', value: sv(w0.distance_km) }),
    notes: el('input', { maxlength: 240, value: sv(w0.notes), placeholder: 'Observações (opcional)' }),
  };
  const status = el('div');
  const picker = el('input', { type: 'file', accept: 'image/*', hidden: true });
  const listBox = el('div', { class: 'stack' });

  async function editField(ex, i, field) {
    const s = ex.sets[i];
    const isW = field === 'weight';
    const cur = Number(String(s[field]).replace(',', '.'));
    const n = await pickNumber(ex.kind === 'cardio'
      ? { title: 'Minutos de cardio', value: cur || 20, step: 1, steps: [1, 5], max: 240, unit: 'MIN' }
      : isW
        ? { title: 'Carga da série ' + (i + 1), value: cur || 0, step: 2.5, steps: [0.5, 1, 2.5, 5], max: 500, unit: 'KG' }
        : { title: 'Repetições da série ' + (i + 1), value: cur || ex.rep_max, step: 1, steps: [1, 5], max: 100, unit: 'REPS' });
    if (n === null) return;
    s[field] = String(n);
    draw();
  }

  function draw() {
    listBox.replaceChildren(...exs.map((ex) => {
      const cardio = ex.kind === 'cardio';
      const rows = ex.sets.map((s, i) =>
        el('div', { class: 'set', style: cardio ? 'grid-template-columns:30px 1fr 46px' : '' },
          el('div', { class: 'n' }, i + 1),
          cardio ? null : pillIn(s.weight, 'KG', 'Carga da série ' + (i + 1), () => editField(ex, i, 'weight')),
          pillIn(s.reps, cardio ? 'MIN' : 'REPS', 'Repetições da série ' + (i + 1), () => editField(ex, i, 'reps')),
          el('button', { class: 'chk', 'aria-label': 'Remover série', html: ICONS.minus,
            onclick: () => { ex.sets.splice(i, 1); draw(); } })));
      return el('div', { class: 'card' },
        el('div', { style: 'font-weight:700;margin-bottom:8px' }, ex.name),
        ex.sets.length ? el('div', null, rows) : el('p', { class: 'mute small', style: 'margin:0 0 8px' }, 'Nenhuma série registrada.'),
        el('div', { class: 'setctl' },
          el('button', { class: 'round', 'aria-label': 'Adicionar série', html: ICONS.plus, onclick: () => {
            const prev = ex.sets[ex.sets.length - 1];
            ex.sets.push(prev ? { weight: prev.weight, reps: prev.reps } : { weight: '', reps: cardio ? '20' : String(ex.rep_max) });
            draw();
          } })));
    }));
  }

  picker.addEventListener('change', async () => {
    const file = picker.files && picker.files[0];
    if (!file) return;
    status.replaceChildren(el('div', { class: 'row', style: 'justify-content:center' }, el('span', { class: 'spin' }),
      el('span', { class: 'mute' }, 'Lendo o relatório...')));
    try {
      const blob = await resizeImage(file, 1600, 0.85);
      const form = new FormData();
      form.append('workout_id', w0.id);
      form.append('image', blob, 'print.jpg');
      const r = await api('workout_watch', { form });
      const d = r.read;
      if (!d.ok) {
        status.replaceChildren(el('p', { class: 'small', style: 'color:var(--warn);margin:0' }, d.error + ' Preencha os números abaixo.'));
        return;
      }
      const set = (inp, v) => { if (v !== null && v !== undefined) inp.value = v; };
      set(f.duration, d.duration_min); set(f.calories, d.calories); set(f.avg, d.avg_hr);
      set(f.max, d.max_hr); set(f.dist, d.distance_km);
      status.replaceChildren(el('p', { class: 'small', style: 'color:var(--ok);margin:0' },
        'Leitura concluída. Confira os números e toque em Salvar alterações.'));
    } catch (e) {
      status.replaceChildren(el('p', { class: 'small', style: 'color:var(--bad);margin:0' }, e.message + '. Você pode digitar os números na mão.'));
    }
  });

  const save = el('button', { class: 'btn acc', onclick: async () => {
    save.disabled = true;
    try {
      const r = await api('workout_edit', { body: {
        workout_id: w0.id,
        exercises: exs.map((ex) => ({ name: ex.name, sets: ex.sets.map((s) => ({ weight_kg: s.weight, reps: s.reps })) })),
        duration_min: f.duration.value, calories: f.calories.value, avg_hr: f.avg.value, max_hr: f.max.value,
        distance_km: f.dist.value, notes: f.notes.value } });
      App.state.editWorkout = null;
      toast('Treino atualizado');
      App.go('#/historico');
    } catch (e) { toast(e.message, true); save.disabled = false; }
  } }, 'Salvar alterações');

  const fld = (label, node) => el('div', null, el('label', { class: 'f' }, label), node);

  draw();
  mount(
    el('h1', null, 'Editar treino ' + w0.label),
    el('p', { class: 'mute' }, w0.title + ' · ' + fmt.dateLong(w0.finished_at)),
    el('h2', null, 'Séries'),
    listBox,
    el('h2', null, 'Dados do relógio'),
    el('div', { class: 'card stack' },
      el('button', { class: 'btn', onclick: () => picker.click() }, w0.watch_image ? 'Trocar print do Zepp' : 'Enviar print do Zepp'),
      picker, status,
      el('div', { class: 'grid2' }, fld('Duração (min)', f.duration), fld('Calorias (kcal)', f.calories)),
      el('div', { class: 'grid2' }, fld('FC média', f.avg), fld('FC máxima', f.max)),
      fld('Distância (km)', f.dist), fld('Observações', f.notes)),
    el('div', { class: 'stack', style: 'margin-top:14px' },
      save,
      el('button', { class: 'btn ghost', onclick: () => { App.state.editWorkout = null; App.go('#/historico'); } }, 'Cancelar')));
}
