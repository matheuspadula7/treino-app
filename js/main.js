// Estado global + roteador
const App = {
  state: { name: '', profile: null, metrics: null, planData: null, workout: null, finish: null },

  async boot() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    let me;
    try {
      me = await api('me');
    } catch (e) {
      mount(el('div', { class: 'card center' }, el('h2', { style: 'margin-top:0' }, 'Sem conexão'),
        el('p', { class: 'mute' }, e.message), el('button', { class: 'btn', onclick: () => location.reload() }, 'Tentar de novo')));
      return;
    }
    if (!me.auth) return this.showLogin(me.name);
    this.state.name = me.name;
    await this.loadCore();
    Outbox.flush();
    route();
  },

  async loadCore() {
    const [p, pl] = await Promise.all([api('profile'), api('plan')]);
    this.state.profile = p.profile;
    this.state.metrics = p.metrics;
    this.state.planData = pl;
  },

  async refreshPlan() {
    this.state.planData = await api('plan');
    return this.state.planData;
  },

  showLogin(name) {
    document.body.classList.add('no-tabs');
    document.body.classList.remove('in-workout');
    document.getElementById('tabs').hidden = true;
    viewLogin(name);
  },

  onLoggedOut() { this.showLogin(this.state.name); },
  go(hash) { if (location.hash === hash) route(); else location.hash = hash; },
};

const TABS = [
  ['treino', 'Treino'], ['ficha', 'Ficha'], ['corpo', 'Corpo'], ['historico', 'Histórico'], ['perfil', 'Perfil'],
];

function renderTabs(active) {
  const nav = document.getElementById('tabs');
  nav.replaceChildren(...TABS.map(([id, label]) =>
    el('a', { href: '#/' + id, class: id === active ? 'on' : '', html: ICONS[id] + label })));
}

async function route() {
  const page = (location.hash || '#/treino').replace(/^#\//, '').split('?')[0];
  const nav = document.getElementById('tabs');
  const focus = page === 'workout' || page === 'finalizar';

  if (page !== 'workout') { Rest.stop(); Wake.off(); }
  document.body.classList.toggle('in-workout', page === 'workout');
  document.body.classList.toggle('no-tabs', focus);
  nav.hidden = focus;
  if (!focus) renderTabs(page);

  try {
    if (!App.state.profile && page !== 'perfil') return App.go('#/perfil');
    switch (page) {
      case 'treino': return await viewHome();
      case 'ficha': return await viewPlan();
      case 'corpo': return await viewBody();
      case 'historico': return await viewHistory();
      case 'perfil': return await viewProfile();
      case 'workout': return await viewWorkout();
      case 'finalizar': return await viewFinish();
      default: return App.go('#/treino');
    }
  } catch (e) {
    if (e.message && e.message.startsWith('Sessão expirada')) return;
    mount(el('div', { class: 'card' }, el('h2', { style: 'margin-top:0' }, 'Algo deu errado'),
      el('p', { class: 'mute' }, e.message),
      el('button', { class: 'btn', onclick: () => route() }, 'Tentar de novo')));
  }
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => App.boot());
