// Ficha de treino: gerar sugestão e editar
const SPLIT_INFO = {
  ABC: ['ABC', 'Peito e tríceps, costas e bíceps, pernas. Repete o ciclo na semana (como você já treinava).'],
  ABCD: ['ABCD', 'Peito e tríceps, costas e bíceps, pernas, ombros e abdômen. Ideal para 4 dias.'],
  ABCDE: ['ABCDE', 'Uma divisão a mais separando quadríceps e posterior/glúteos. Ideal para 5 dias.'],
};

async function viewPlan() {
  const pd = await App.refreshPlan();
  if (!pd.plan) return planGenerator(pd.suggested_split);
  planEditor(pd.plan);
}

function planGenerator(suggested, replacing) {
  let chosen = suggested;
  const box = el('div', { class: 'stack' });
  const draw = () => box.replaceChildren(...Object.keys(SPLIT_INFO).map((k) =>
    el('button', { class: 'card', style: 'width:100%;text-align:left;color:inherit;font:inherit;cursor:pointer;'
        + (k === chosen ? 'border-color:var(--acc);background:var(--acc-soft)' : ''),
      onclick: () => { chosen = k; draw(); } },
      el('div', { class: 'row between' },
        el('b', { style: 'font-size:18px' }, SPLIT_INFO[k][0]),
        k === suggested ? el('span', { class: 'tag acc' }, 'Sugerido para você') : null),
      el('div', { class: 'mute small', style: 'margin-top:4px' }, SPLIT_INFO[k][1]))));
  draw();
  const go = el('button', { class: 'btn acc', onclick: async () => {
    go.disabled = true;
    try {
      await api('plan_generate', { body: { split: chosen } });
      toast('Ficha criada');
      await App.refreshPlan();
      viewPlan();
    } catch (e) { toast(e.message, true); go.disabled = false; }
  } }, 'Gerar minha ficha');
  mount(
    el('h1', null, replacing ? 'Nova ficha' : 'Sua ficha'),
    el('p', { class: 'mute' }, 'Escolha a divisão. Monto os exercícios para perder gordura, com séries de 10 a 15 repetições, descanso curto e cardio no final. Depois você edita tudo.'),
    box, el('div', { style: 'margin-top:16px' }, go),
    replacing ? el('button', { class: 'btn ghost', style: 'margin-top:10px', onclick: () => viewPlan() }, 'Voltar') : null);
}

function planEditor(plan) {
  const draft = JSON.parse(JSON.stringify(plan.days));
  let tab = 0;
  let dirty = false;
  const root = el('div');

  const markDirty = () => { dirty = true; draw(); };

  function editExercise(day, idx) {
    const isNew = idx === -1;
    const e = isNew ? { name: '', muscle: '', kind: 'strength', sets: 3, rep_min: 10, rep_max: 12, rest_sec: 60, cardio_minutes: null }
      : Object.assign({}, day.exercises[idx]);
    const name = el('input', { value: e.name, placeholder: 'Nome do exercício' });
    const sets = el('input', { type: 'number', inputmode: 'numeric', value: e.sets });
    const rmin = el('input', { type: 'number', inputmode: 'numeric', value: e.rep_min });
    const rmax = el('input', { type: 'number', inputmode: 'numeric', value: e.rep_max });
    const rest = el('input', { type: 'number', inputmode: 'numeric', value: e.rest_sec });
    const mins = el('input', { type: 'number', inputmode: 'numeric', value: e.cardio_minutes || 20 });
    const kind = el('select', { value: e.kind }, el('option', { value: 'strength' }, 'Musculação'), el('option', { value: 'cardio' }, 'Cardio'));
    const strengthBox = el('div', { class: 'stack' },
      el('div', { class: 'grid3' }, fld('Séries', sets), fld('Reps mín', rmin), fld('Reps máx', rmax)),
      fld('Descanso (segundos)', rest));
    const cardioBox = el('div', null, fld('Minutos', mins));
    const sync = () => { strengthBox.hidden = kind.value === 'cardio'; cardioBox.hidden = kind.value !== 'cardio'; };
    kind.addEventListener('change', sync); sync();

    sheet((close) => [
      el('h2', { style: 'margin-top:0' }, isNew ? 'Novo exercício' : 'Editar exercício'),
      el('div', { class: 'stack' },
        fld('Nome', name), fld('Tipo', kind), strengthBox, cardioBox,
        el('button', { class: 'btn acc', onclick: () => {
          if (!name.value.trim()) return toast('Dê um nome ao exercício', true);
          const mn = Math.max(1, +rmin.value || 8);
          const out = Object.assign(e, {
            name: name.value.trim(), kind: kind.value, sets: Math.max(1, +sets.value || 3), rep_min: mn,
            rep_max: Math.max(mn, +rmax.value || mn), rest_sec: Math.max(0, +rest.value || 0),
            cardio_minutes: kind.value === 'cardio' ? Math.max(1, +mins.value || 20) : null,
            muscle: kind.value === 'cardio' ? 'cardio' : e.muscle });
          if (isNew) day.exercises.push(out); else day.exercises[idx] = out;
          close(); markDirty();
        } }, 'Aplicar'),
        isNew ? null : el('div', { class: 'grid3' },
          el('button', { class: 'btn ghost sm', onclick: () => { move(day, idx, -1); close(); markDirty(); } }, 'Subir'),
          el('button', { class: 'btn ghost sm', onclick: () => { move(day, idx, 1); close(); markDirty(); } }, 'Descer'),
          el('button', { class: 'btn bad sm', onclick: () => { day.exercises.splice(idx, 1); close(); markDirty(); } }, 'Remover'))),
    ]);
  }

  function fld(label, node) { return el('div', null, el('label', { class: 'f' }, label), node); }
  function move(day, i, d) {
    const j = i + d;
    if (j < 0 || j >= day.exercises.length) return;
    [day.exercises[i], day.exercises[j]] = [day.exercises[j], day.exercises[i]];
  }

  function renameDay(day) {
    const t = el('input', { value: day.title });
    sheet((close) => [
      el('h2', { style: 'margin-top:0' }, 'Nome do treino ' + day.label),
      el('div', { class: 'stack' }, t,
        el('button', { class: 'btn acc', onclick: () => { day.title = t.value.trim() || day.title; close(); markDirty(); } }, 'Aplicar')),
    ]);
  }

  async function save() {
    try {
      await api('plan_save', { body: { days: draft } });
      dirty = false;
      toast('Ficha salva');
      viewPlan();
    } catch (e) { toast(e.message, true); }
  }

  function volBlock(day) {
    const by = {};
    day.exercises.forEach((e) => { if (e.kind !== 'cardio') by[e.muscle || 'outros'] = (by[e.muscle || 'outros'] || 0) + (e.sets || 0); });
    const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (!top.length) return null;
    return el('div', { class: 'vols' }, top.map(([m, n], gi) =>
      el('div', { class: 'g' + gi },
        el('div', { class: 'ticks g' + gi }, Array.from({ length: 12 }, (_, k) => el('i', { class: k < Math.min(12, n) ? 'on' : '' }))),
        el('div', { class: 'nm' }, el('b', null, m)),
        el('div', { class: 'sub' }, n + ' séries'))));
  }

  function draw() {
    const day = draft[tab];
    root.replaceChildren(
      el('div', { class: 'row between' },
        el('h1', { style: 'margin:0' }, 'Ficha ' + plan.split),
        el('button', { class: 'btn ghost sm', onclick: async () => {
          if (await confirmSheet('Gerar nova ficha?', 'A ficha atual será substituída. Seu histórico de treinos continua guardado.', 'Continuar', true))
            planGenerator(plan.split, true);
        } }, 'Nova')),
      el('p', { class: 'mute small' }, 'Toque em um exercício para ajustar séries, repetições e descanso.'),
      el('div', { class: 'chips' }, draft.map((d, i) =>
        el('button', { class: 'chip' + (i === tab ? ' on' : ''), onclick: () => { tab = i; draw(); } }, d.label))),
      el('div', { class: 'row between', style: 'margin:14px 0 4px' },
        el('h2', { style: 'margin:0' }, day.title),
        el('button', { class: 'btn ghost sm', onclick: () => renameDay(day) }, 'Renomear')),
      volBlock(day),
      el('div', null, day.exercises.map((e, i) =>
        el('div', { class: 'ex-row', onclick: () => editExercise(day, i) },
          el('div', { class: 'ix' }, i + 1),
          el('div', { class: 'grow' },
            el('div', { class: 'nm' }, e.name),
            el('div', { class: 'mute small' }, e.kind === 'cardio'
              ? e.cardio_minutes + ' minutos'
              : e.sets + ' x ' + (e.rep_min === e.rep_max ? e.rep_min : e.rep_min + '-' + e.rep_max) + ' · descanso ' + e.rest_sec + 's')),
          el('span', { class: 'chev', html: ICONS.next })))),
      el('button', { class: 'btn ghost', style: 'margin-top:12px', onclick: () => editExercise(day, -1) }, '+ Adicionar exercício'),
      dirty ? el('div', { class: 'stack', style: 'margin-top:16px;position:sticky;bottom:calc(var(--nav) + var(--safe-b) + 8px)' },
        el('button', { class: 'btn acc', onclick: save }, 'Salvar alterações')) : null);
  }

  draw();
  mount(root);
}
