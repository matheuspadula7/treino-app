// Evolução do corpo: peso, medidas e fotos
function lineChart(points, color) {
  // points: [{label, value}] em ordem cronológica
  if (points.length < 2) return el('p', { class: 'mute small', style: 'margin:6px 0 0' }, 'Registre mais uma vez para ver a curva.');
  const W = 320, H = 110, P = 8;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i) => P + (i * (W - 2 * P)) / (points.length - 1);
  const y = (v) => H - P - ((v - min) / span) * (H - 2 * P);
  const d = points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.value).toFixed(1)).join(' ');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('class', 'svgchart');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d); path.setAttribute('fill', 'none');
  path.setAttribute('style', 'stroke:' + color + ';stroke-width:3;stroke-linecap:round;stroke-linejoin:round');
  svg.appendChild(path);
  const last = document.createElementNS(ns, 'circle');
  last.setAttribute('cx', x(points.length - 1)); last.setAttribute('cy', y(points[points.length - 1].value));
  last.setAttribute('r', '5'); last.setAttribute('style', 'fill:' + color);
  svg.appendChild(last);
  return el('div', null, svg,
    el('div', { class: 'row between mute small' }, el('span', null, points[0].label), el('span', null, points[points.length - 1].label)));
}

function deltaText(first, last, unit) {
  if (first === null || last === null) return '';
  const d = last - first;
  return (d > 0 ? '+' : '') + fmt.num(d, 1) + ' ' + unit + ' desde o início';
}

async function viewBody() {
  const r = await api('body');
  const logs = r.logs; // mais recente primeiro
  const chrono = logs.slice().reverse();
  const series = (key) => chrono.filter((l) => l[key] !== null).map((l) => ({ label: fmt.date(l.log_date), value: Number(l[key]) }));
  const w = series('weight_kg'), c = series('waist_cm');

  const f = {
    date: el('input', { type: 'date', value: fmt.today() }),
    weight: el('input', { type: 'number', inputmode: 'decimal', step: '0.1', placeholder: 'kg' }),
    waist: el('input', { type: 'number', inputmode: 'decimal', step: '0.1', placeholder: 'cm' }),
    chest: el('input', { type: 'number', inputmode: 'decimal', step: '0.1', placeholder: 'cm' }),
    arm: el('input', { type: 'number', inputmode: 'decimal', step: '0.1', placeholder: 'cm' }),
    thigh: el('input', { type: 'number', inputmode: 'decimal', step: '0.1', placeholder: 'cm' }),
    hip: el('input', { type: 'number', inputmode: 'decimal', step: '0.1', placeholder: 'cm' }),
    photo: el('input', { type: 'file', accept: 'image/*', hidden: true }),
  };
  let photoBlob = null;
  const photoBtn = el('button', { type: 'button', class: 'btn ghost', onclick: () => f.photo.click() }, 'Adicionar foto de evolução');
  f.photo.addEventListener('change', async () => {
    const file = f.photo.files && f.photo.files[0];
    if (!file) return;
    try { photoBlob = await resizeImage(file, 1280, 0.82); photoBtn.textContent = 'Foto pronta (toque para trocar)'; }
    catch (e) { toast(e.message, true); }
  });

  const fld = (label, node) => el('div', null, el('label', { class: 'f' }, label), node);
  const save = el('button', { class: 'btn acc', type: 'submit' }, 'Salvar registro');
  const form = el('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    const any = [f.weight, f.waist, f.chest, f.arm, f.thigh, f.hip].some((i) => i.value) || photoBlob;
    if (!any) return toast('Preencha ao menos uma medida ou foto', true);
    save.disabled = true;
    try {
      const form = new FormData();
      form.append('log_date', f.date.value);
      [['weight_kg', f.weight], ['waist_cm', f.waist], ['chest_cm', f.chest], ['arm_cm', f.arm],
        ['thigh_cm', f.thigh], ['hip_cm', f.hip]].forEach(([k, i]) => { if (i.value) form.append(k, i.value); });
      if (photoBlob) form.append('photo', photoBlob, 'foto.jpg');
      await api('body', { form });
      if (f.weight.value && App.state.profile) App.state.profile.weight_kg = f.weight.value;
      toast('Registro salvo');
      viewBody();
    } catch (err) { toast(err.message, true); save.disabled = false; }
  } },
    fld('Data', f.date),
    el('div', { class: 'grid2' }, fld('Peso (kg)', f.weight), fld('Cintura (cm)', f.waist)),
    el('div', { class: 'grid3' }, fld('Peito', f.chest), fld('Braço', f.arm), fld('Coxa', f.thigh)),
    fld('Quadril (cm, opcional)', f.hip),
    photoBtn, f.photo, save);

  const withPhoto = logs.filter((l) => l.photo);
  const cmp = withPhoto.length >= 2 ? el('div', { class: 'card' },
    el('h3', null, 'Antes e agora'),
    el('div', { class: 'grid2' },
      el('div', null, el('img', { class: 'thumb', src: 'api/index.php?r=photo&f=' + withPhoto[withPhoto.length - 1].photo, alt: 'Primeira foto' }),
        el('div', { class: 'mute small center', style: 'margin-top:4px' }, fmt.date(withPhoto[withPhoto.length - 1].log_date))),
      el('div', null, el('img', { class: 'thumb', src: 'api/index.php?r=photo&f=' + withPhoto[0].photo, alt: 'Foto mais recente' }),
        el('div', { class: 'mute small center', style: 'margin-top:4px' }, fmt.date(withPhoto[0].log_date))))) : null;

  const rowText = (l) => [l.weight_kg !== null ? fmt.num(l.weight_kg) + ' kg' : null,
    l.waist_cm !== null ? 'cintura ' + fmt.num(l.waist_cm) : null, l.chest_cm !== null ? 'peito ' + fmt.num(l.chest_cm) : null,
    l.arm_cm !== null ? 'braço ' + fmt.num(l.arm_cm) : null, l.thigh_cm !== null ? 'coxa ' + fmt.num(l.thigh_cm) : null,
    l.hip_cm !== null ? 'quadril ' + fmt.num(l.hip_cm) : null].filter(Boolean).join(' · ');

  mount(
    el('h1', null, 'Corpo'),
    el('p', { class: 'mute' }, 'Peso, medidas e fotos mostram mais que a balança sozinha. Registre uma vez por semana, no mesmo dia e horário.'),
    el('div', { class: 'card' },
      el('div', { class: 'row between' }, el('h3', { style: 'margin:0' }, 'Peso'),
        el('span', { class: 'mute small' }, w.length ? deltaText(w[0].value, w[w.length - 1].value, 'kg') : '')),
      lineChart(w, 'var(--acc)')),
    el('div', { class: 'card' },
      el('div', { class: 'row between' }, el('h3', { style: 'margin:0' }, 'Cintura'),
        el('span', { class: 'mute small' }, c.length ? deltaText(c[0].value, c[c.length - 1].value, 'cm') : '')),
      c.length ? lineChart(c, '#c9c9cf') : el('p', { class: 'mute small', style: 'margin:6px 0 0' }, 'Sem medidas de cintura ainda.')),
    cmp,
    el('h2', null, 'Novo registro'),
    el('div', { class: 'card' }, form),
    logs.length ? el('h2', null, 'Registros') : null,
    logs.length ? el('div', { class: 'card list', style: 'padding:4px 14px' }, logs.map((l) =>
      el('div', { class: 'item' },
        l.photo ? el('img', { class: 'thumb sm', src: 'api/index.php?r=photo&f=' + l.photo, alt: '' }) : el('div', { class: 'dot' }, '•'),
        el('div', { class: 'grow' },
          el('div', { style: 'font-weight:700' }, fmt.date(l.log_date)),
          el('div', { class: 'mute small' }, rowText(l) || 'Somente foto')),
        el('button', { class: 'btn ghost sm', onclick: async () => {
          if (await confirmSheet('Apagar este registro?', null, 'Apagar', true)) {
            try { await api('body_delete', { body: { id: l.id } }); viewBody(); } catch (e) { toast(e.message, true); }
          }
        } }, 'Apagar')))) : null);
}
