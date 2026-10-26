// Camada de acesso a API + fila offline das series (a academia nem sempre tem sinal)
const API_URL = 'api/index.php';

async function api(route, opts = {}) {
  let url = API_URL + '?r=' + route;
  if (opts.query) for (const k in opts.query) url += '&' + k + '=' + encodeURIComponent(opts.query[k]);
  const init = { method: 'GET', credentials: 'same-origin', headers: {} };
  if (opts.form) {
    init.method = 'POST';
    init.body = opts.form;
  } else if (opts.body !== undefined) {
    init.method = 'POST';
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  let res;
  try {
    res = await fetch(url, init);
  } catch (e) {
    const err = new Error('Sem conexão com o servidor');
    err.offline = true;
    throw err;
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* resposta sem JSON */ }
  if (res.status === 401 && route !== 'login') {
    if (window.App && App.onLoggedOut) App.onLoggedOut();
    throw new Error('Sessão expirada, entre novamente');
  }
  if (!res.ok || !data) throw new Error((data && data.error) || 'Erro ' + res.status);
  return data;
}

// ---- Fila offline de séries ----
const Outbox = {
  key: 'treino_outbox_v1',
  load() { try { return JSON.parse(localStorage.getItem(this.key) || '[]'); } catch (e) { return []; } },
  save(list) { try { localStorage.setItem(this.key, JSON.stringify(list)); } catch (e) { /* cheio */ } },
  id(p) { return [p.workout_id, p.exercise_name, p.set_number].join('|'); },
  push(item) {
    const list = this.load().filter((x) => this.id(x.body) !== this.id(item.body));
    list.push(item);
    this.save(list);
  },
  count() { return this.load().length; },
  async flush() {
    let list = this.load();
    if (!list.length || this.busy) return;
    this.busy = true;
    const rest = [];
    for (const it of list) {
      try {
        await api(it.route, { body: it.body });
      } catch (e) {
        if (e.offline) { rest.push(it); } // tenta de novo depois
        // erro de validacao ou treino ja encerrado: descarta
      }
    }
    this.save(rest);
    this.busy = false;
  },
};

async function saveSet(body) {
  try {
    await api('set_save', { body });
    return true;
  } catch (e) {
    if (e.offline) {
      Outbox.push({ route: 'set_save', body });
      return false;
    }
    throw e;
  }
}

window.addEventListener('online', () => Outbox.flush());
