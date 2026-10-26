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
    w.watch_image ? el('div', { style: 'margin-top:14px' },
      el('div', { class: 'mute small', style: 'margin-bottom:6px' }, 'Print do relógio'),
      el('img', { class: 'thumb', style: 'max-width:180px', src: 'api/index.php?r=photo&f=' + w.watch_image, alt: 'Relatório do relógio' })) : null,
  ]);
}
