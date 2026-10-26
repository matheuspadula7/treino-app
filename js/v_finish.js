// Fim do treino: print do relatório do relógio -> leitura por IA -> feedback
async function viewFinish() {
  const fin = App.state.finish;
  if (!fin) return App.go('#/treino');

  const f = {
    duration: el('input', { type: 'number', inputmode: 'numeric', placeholder: 'min' }),
    calories: el('input', { type: 'number', inputmode: 'numeric', placeholder: 'kcal' }),
    avg: el('input', { type: 'number', inputmode: 'numeric', placeholder: 'bpm' }),
    max: el('input', { type: 'number', inputmode: 'numeric', placeholder: 'bpm' }),
    dist: el('input', { type: 'number', inputmode: 'decimal', step: '0.01', placeholder: 'km (opcional)' }),
    notes: el('input', { placeholder: 'Como foi o treino? (opcional)', maxlength: 240 }),
  };
  let watchData = null;
  const status = el('div');
  const preview = el('img', { class: 'thumb', style: 'max-width:160px;margin:0 auto;display:none' });
  const picker = el('input', { type: 'file', accept: 'image/*', hidden: true });

  picker.addEventListener('change', async () => {
    const file = picker.files && picker.files[0];
    if (!file) return;
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
    status.replaceChildren(el('div', { class: 'row', style: 'justify-content:center' }, el('span', { class: 'spin' }),
      el('span', { class: 'mute' }, 'Lendo o relatório...')));
    try {
      const blob = await resizeImage(file, 1600, 0.85);
      const form = new FormData();
      form.append('workout_id', fin.workoutId);
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
      watchData = { activity: d.activity, notes: d.notes };
      status.replaceChildren(
        el('p', { class: 'small', style: 'color:var(--ok);margin:0' }, 'Leitura concluída. Confira os números e corrija se algo estiver errado.'),
        d.notes ? el('p', { class: 'mute small', style: 'margin:6px 0 0' }, d.notes) : null);
    } catch (e) {
      status.replaceChildren(el('p', { class: 'small', style: 'color:var(--bad);margin:0' }, e.message + '. Você pode digitar os números na mão.'));
    }
  });

  const save = el('button', { class: 'btn acc', onclick: async () => {
    save.disabled = true;
    try {
      const r = await api('workout_finish', { body: {
        workout_id: fin.workoutId, duration_min: f.duration.value, calories: f.calories.value,
        avg_hr: f.avg.value, max_hr: f.max.value, distance_km: f.dist.value, notes: f.notes.value,
        watch_data: watchData } });
      App.state.workout = null; WK.w = null; App.state.finish = null;
      Rest.stop(); Wake.off();
      showFeedback(r.feedback);
    } catch (e) { toast(e.message, true); save.disabled = false; }
  } }, 'Salvar treino');

  const fld = (label, node) => el('div', null, el('label', { class: 'f' }, label), node);

  mount(
    el('h1', null, 'Treino ' + fin.label + ' finalizado'),
    el('p', { class: 'mute' }, 'Envie o print do relatório do relógio para fechar o registro de hoje.'),
    el('div', { class: 'card stack' },
      el('button', { class: 'btn', onclick: () => picker.click() }, 'Escolher print do Zepp'),
      picker, preview, status),
    el('h2', null, 'Dados do relógio'),
    el('div', { class: 'card stack' },
      el('div', { class: 'grid2' }, fld('Duração (min)', f.duration), fld('Calorias (kcal)', f.calories)),
      el('div', { class: 'grid2' }, fld('FC média', f.avg), fld('FC máxima', f.max)),
      fld('Distância (km)', f.dist), fld('Observações', f.notes)),
    el('p', { class: 'mute small' }, 'Sem print agora? Pode salvar assim. A duração é calculada pelo horário do treino.'),
    save,
    el('button', { class: 'btn ghost', style: 'margin-top:10px', onclick: () => App.go('#/workout') }, 'Voltar ao treino'));
}

function showFeedback(text) {
  mount(
    el('div', { class: 'card hero stack', style: 'margin-top:8vh' },
      el('span', { class: 'tag acc', style: 'width:fit-content' }, 'Treino salvo'),
      el('h1', { style: 'margin:0' }, 'Bom trabalho!'),
      el('pre', { class: 'fb' }, text)),
    el('div', { class: 'stack', style: 'margin-top:14px' },
      el('button', { class: 'btn acc', onclick: () => App.go('#/treino') }, 'Voltar ao início'),
      el('button', { class: 'btn ghost', onclick: () => App.go('#/historico') }, 'Ver histórico')));
}
