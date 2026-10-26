// Login e tela inicial (próximo treino)
function viewLogin(name) {
  const pass = el('input', { type: 'password', placeholder: 'Senha', autocomplete: 'current-password', autofocus: true });
  const btn = el('button', { class: 'btn acc', type: 'submit' }, 'Entrar');
  const form = el('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    btn.disabled = true;
    try {
      const r = await api('login', { body: { password: pass.value } });
      App.state.name = r.name;
      await App.loadCore();
      Outbox.flush();
      location.hash = '#/treino';
      route();
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
    }
  } }, pass, btn);
  mount(el('div', { style: 'padding-top:12vh' },
    el('h1', null, 'Treino'),
    el('p', { class: 'mute' }, 'Seu personal no bolso.'),
    el('div', { class: 'card' }, form)));
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function estimateMinutes(day) {
  let sec = 0;
  for (const e of day.exercises) {
    if (e.kind === 'cardio') sec += (e.cardio_minutes || 20) * 60;
    else sec += e.sets * (40 + e.rest_sec);
  }
  return Math.round(sec / 60);
}

async function startWorkout(dayId) {
  try {
    const r = await api('workout_start', { body: { day_id: dayId } });
    App.state.workout = r.workout;
    if (r.resumed) toast('Retomando o treino em andamento');
    App.go('#/workout');
  } catch (e) { toast(e.message, true); }
}

function ticksNode(pct, n = 28) {
  const on = Math.round((Math.min(100, pct) / 100) * n);
  return el('div', { class: 'ticks' }, Array.from({ length: n }, (_, i) => el('i', { class: i < on ? 'on' : '' })));
}

function weekStrip(recent) {
  const names = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
  const set = new Set(recent || []);
  return el('div', { class: 'days' }, names.map((n, i) => {
    const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const done = set.has(key);
    return el('div', { class: 'day' + (done ? ' done' : '') + (i === dow ? ' today' : '') },
      el('span', null, n),
      done ? el('span', { class: 'ic', html: ICONS.check }) : el('span', { class: 'n' }, d.getDate()));
  }));
}

async function viewHome() {
  const pd = await App.refreshPlan();
  const st = App.state;
  const head = el('div', { style: 'margin-bottom:16px' },
    el('p', { class: 'mute small', style: 'margin:0' }, fmt.dateLong(new Date().toISOString())),
    el('h1', null, greeting() + ', ' + (st.name || '') + '.'));

  if (!pd.plan) {
    mount(head, el('div', { class: 'card hero stack' },
      el('h2', { style: 'margin:0' }, 'Vamos montar sua ficha'),
      el('p', { class: 'mute' }, 'Gero uma ficha com base no seu perfil e objetivo. Depois você ajusta o que quiser.'),
      el('button', { class: 'btn dark', onclick: () => App.go('#/ficha') }, 'Criar ficha')));
    return;
  }

  const days = pd.plan.days;
  const day = days.find((d) => d.id === pd.next_day_id) || days[0];
  const open = pd.in_progress;
  const target = (st.profile && st.profile.days_per_week) || 4;
  const pctNode = el('div', { class: 'big' }, '0%');
  const ticksHold = el('div', null, ticksNode(0));
  const hero = el('div', { class: 'card hero stack' },
    el('div', { class: 'row between' },
      el('span', { class: 'tag' }, open ? 'Em andamento' : 'Próximo treino'),
      el('span', { class: 'mute small' }, '~' + estimateMinutes(day) + ' min')),
    el('div', null,
      el('div', { class: 'big' }, open ? open.label : day.label),
      el('div', { style: 'font-size:18px;font-weight:600;margin-top:6px' }, open ? open.title : day.title),
      el('div', { class: 'mute small' }, day.exercises.length + ' exercícios')),
    el('div', { class: 'row between', style: 'align-items:flex-end' },
      el('div', null, pctNode, el('div', { class: 'mute small' }, 'da meta da semana')),
      el('div', { style: 'width:55%' }, ticksHold)),
    el('button', { class: 'btn dark', onclick: () => startWorkout(open ? 0 : day.id) },
      open ? 'Continuar treino' : 'Iniciar treino'),
    open ? null : el('button', { class: 'btn ghost sm', style: 'color:#fff;border-color:rgba(255,255,255,.4)', onclick: () => pickDay(days) }, 'Treinar outro dia da ficha'));

  const weekCard = el('div', { class: 'card' },
    el('div', { class: 'row between' },
      el('h3', { style: 'margin:0' }, 'Sua semana'),
      el('span', { class: 'tag', id: 'wk-tag' }, '... de ' + target)),
    weekStrip([]));
  const statsRow = el('div', { class: 'cards2' });
  const m = st.metrics;
  const goalCard = m && m.target_kcal ? el('div', { class: 'card' },
    el('h3', null, 'Metas para perder gordura'),
    el('div', { class: 'grid3' },
      statBox(fmt.num(m.target_kcal, 0), 'kcal por dia'),
      statBox(fmt.num(m.protein_g, 0) + ' g', 'proteína'),
      statBox(fmt.num(m.loss_week_min, 2) + ' a ' + fmt.num(m.loss_week_max, 2), 'kg por semana')),
    el('p', { class: 'mute small', style: 'margin:10px 0 0' }, 'Estimativas por fórmula. Use como ponto de partida e ajuste pela evolução real.')) : null;
  if (goalCard) goalCard.style.marginTop = '12px';

  mount(head, hero, weekCard, statsRow, goalCard);

  api('stats').then((s) => {
    const thisWeek = s.weekly[s.weekly.length - 1].count;
    const pct = Math.round((thisWeek / target) * 100);
    pctNode.textContent = Math.min(100, pct) + '%';
    ticksHold.replaceChildren(ticksNode(pct));
    document.getElementById('wk-tag').textContent = thisWeek + ' de ' + target + ' treinos';
    weekCard.lastChild.replaceWith(weekStrip(s.recent_days));
    const hrs = Math.floor((s.total_minutes || 0) / 60), mn = (s.total_minutes || 0) % 60;
    statsRow.append(
      el('div', { class: 'card stat' }, el('div', { class: 'v' }, s.total_workouts), el('div', { class: 'k' }, 'treinos registrados')),
      el('div', { class: 'card stat' }, el('div', { class: 'v' }, hrs + 'h' + (mn ? String(mn).padStart(2, '0') : '')), el('div', { class: 'k' }, 'tempo treinando')));
  }).catch(() => { statsRow.remove(); });
}

function statBox(value, label) {
  return el('div', { class: 'statbox' }, el('b', null, value), el('span', null, label));
}

function pickDay(days) {
  sheet((close) => [
    el('h2', { style: 'margin-top:0' }, 'Qual treino fazer hoje?'),
    el('div', { class: 'stack' }, days.map((d) =>
      el('button', { class: 'btn', style: 'text-align:left', onclick: () => { close(); startWorkout(d.id); } },
        d.label + ' · ' + d.title))),
  ]);
}
