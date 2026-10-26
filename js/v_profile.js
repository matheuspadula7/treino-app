// Perfil inicial: peso, altura e idade -> IMC, gasto estimado e metas
async function viewProfile() {
  const st = App.state;
  const p = st.profile || {};
  const first = !st.profile;

  const f = {
    sex: el('select', { value: p.sex || 'M' }, el('option', { value: 'M' }, 'Masculino'), el('option', { value: 'F' }, 'Feminino')),
    birth: el('input', { type: 'date', value: p.birth_date || '' }),
    height: el('input', { type: 'number', inputmode: 'decimal', step: '0.1', placeholder: '175', value: p.height_cm || '' }),
    weight: el('input', { type: 'number', inputmode: 'decimal', step: '0.1', placeholder: '85,0', value: p.weight_kg || '' }),
    activity: el('select', { value: p.activity || 'moderado' },
      el('option', { value: 'baixo' }, 'Baixo: trabalho sentado, pouco movimento'),
      el('option', { value: 'moderado' }, 'Moderado: alguma movimentação no dia'),
      el('option', { value: 'alto' }, 'Alto: trabalho físico ou muito ativo')),
    days: el('select', { value: String(p.days_per_week || 4) },
      ['3', '4', '5', '6'].map((n) => el('option', { value: n }, n + ' dias por semana'))),
  };
  const field = (label, node) => el('div', null, el('label', { class: 'f' }, label), node);

  const save = el('button', { class: 'btn acc', type: 'submit' }, first ? 'Salvar e criar minha ficha' : 'Salvar perfil');
  const form = el('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    if (!f.birth.value || !f.height.value || !f.weight.value) return toast('Preencha nascimento, altura e peso', true);
    save.disabled = true;
    try {
      const r = await api('profile', { body: {
        sex: f.sex.value, birth_date: f.birth.value, height_cm: f.height.value, weight_kg: f.weight.value,
        activity: f.activity.value, days_per_week: f.days.value } });
      st.profile = r.profile; st.metrics = r.metrics;
      toast('Perfil salvo');
      const pd = await App.refreshPlan();
      if (!pd.plan) App.go('#/ficha'); else viewProfile();
    } catch (err) { toast(err.message, true); }
    save.disabled = false;
  } },
    field('Sexo', f.sex), field('Data de nascimento', f.birth),
    el('div', { class: 'grid2' }, field('Altura (cm)', f.height), field('Peso atual (kg)', f.weight)),
    field('Nível de atividade fora do treino', f.activity),
    field('Frequência de treino', f.days), save);

  const m = st.metrics;
  const metrics = m && m.bmi ? el('div', { class: 'card stack' },
    el('h3', { style: 'margin:0' }, 'Como está seu corpo hoje'),
    el('div', { class: 'grid2' },
      statBox(fmt.num(m.bmi) + ' (' + m.bmi_label + ')', 'IMC'),
      statBox(fmt.num(m.age, 0) + ' anos', 'idade')),
    m.tdee ? el('div', { class: 'grid3' },
      statBox(fmt.num(m.bmr, 0), 'metabolismo basal'),
      statBox(fmt.num(m.tdee, 0), 'gasto diário'),
      statBox(fmt.num(m.target_kcal, 0), 'meta kcal')) : null,
    el('p', { class: 'mute small', style: 'margin:0' },
      'O IMC é só uma referência e não separa gordura de músculo, por isso o app também acompanha medidas e fotos. Meta calórica com déficit de cerca de 20%, e proteína em torno de 2 g por kg.')) : null;

  mount(
    el('h1', null, first ? 'Vamos começar' : 'Perfil'),
    el('p', { class: 'mute' }, first
      ? 'Preciso de alguns dados para entender seu corpo e montar uma ficha para perder gordura.'
      : 'Atualize quando mudar de peso ou de rotina.'),
    el('div', { class: 'card' }, form),
    metrics,
    first ? null : el('div', { class: 'stack', style: 'margin-top:16px' },
      el('p', { class: 'mute small center' }, 'Dica: no navegador do celular, use "Adicionar à tela inicial" para abrir como app.'),
      el('button', { class: 'btn ghost', onclick: async () => { await api('logout'); App.state.profile = null; App.showLogin(st.name); } }, 'Sair')));
}
