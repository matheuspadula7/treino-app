<?php
declare(strict_types=1);

function own_workout(int $uid, int $id, bool $mustBeOpen = false): array
{
    $st = db()->prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?');
    $st->execute([$id, $uid]);
    $w = $st->fetch();
    if (!$w) {
        fail('Treino não encontrado', 404);
    }
    if ($mustBeOpen && $w['status'] !== 'em_andamento') {
        fail('Este treino já foi finalizado', 409);
    }
    return $w;
}

function last_performance(int $uid, string $name, int $excludeId): ?array
{
    $st = db()->prepare("SELECT w.id, w.finished_at FROM workouts w
        JOIN workout_sets s ON s.workout_id = w.id
        WHERE w.user_id = ? AND w.status = 'finalizado' AND w.id <> ? AND s.exercise_name = ?
        ORDER BY w.finished_at DESC, w.id DESC LIMIT 1");
    $st->execute([$uid, $excludeId, $name]);
    $w = $st->fetch();
    if (!$w) {
        return null;
    }
    $ss = db()->prepare('SELECT set_number, reps, weight_kg FROM workout_sets
        WHERE workout_id = ? AND exercise_name = ? ORDER BY set_number');
    $ss->execute([$w['id'], $name]);
    return ['date' => substr((string) $w['finished_at'], 0, 10), 'sets' => $ss->fetchAll()];
}

function suggest_progression(array $ex, ?array $last): array
{
    if ($ex['kind'] === 'cardio') {
        return ['weight' => null, 'reason' => ''];
    }
    if (!$last || !$last['sets']) {
        return ['weight' => null, 'reason' => 'Primeira vez neste exercício: comece leve e anote a carga.'];
    }
    $sets = $last['sets'];
    $weights = array_filter(array_map(fn($s) => $s['weight_kg'] !== null ? (float) $s['weight_kg'] : null, $sets),
        fn($v) => $v !== null);
    if (!$weights) {
        return ['weight' => null, 'reason' => ''];
    }
    $top = max($weights);
    $atTop = array_values(array_filter($sets, fn($s) => $s['weight_kg'] !== null && (float) $s['weight_kg'] === $top));
    $allMax = count($atTop) >= (int) $ex['sets']
        && count(array_filter($atTop, fn($s) => (int) $s['reps'] >= (int) $ex['rep_max'])) === count($atTop);
    $lower = in_array($ex['muscle'] ?? '', ['quadríceps', 'posterior', 'glúteos', 'panturrilha'], true);
    $inc = $lower ? 5.0 : 2.5;
    if ($allMax) {
        $new = $top + $inc;
        return ['weight' => $new, 'reason' => 'Você fechou todas as séries no topo da faixa. Suba para '
            . rtrim(rtrim(number_format($new, 2, ',', ''), '0'), ',') . ' kg.'];
    }
    $avg = array_sum(array_map(fn($s) => (int) $s['reps'], $atTop)) / max(1, count($atTop));
    if ($avg < (int) $ex['rep_min']) {
        return ['weight' => $top, 'reason' => 'Ficou abaixo da faixa de repetições. Mantenha a carga e busque '
            . $ex['rep_min'] . ' reps.'];
    }
    $best = max(array_map(fn($s) => (int) $s['reps'], $atTop));
    return ['weight' => $top, 'reason' => 'Mantenha a carga e tente chegar a ' . min($best + 1, (int) $ex['rep_max'])
        . ' reps em todas as séries.'];
}

function workout_payload(int $uid, array $w): array
{
    $snap = $w['plan_snapshot'] ? json_decode($w['plan_snapshot'], true) : [];
    $ss = db()->prepare('SELECT exercise_name, set_number, reps, weight_kg FROM workout_sets
        WHERE workout_id = ? ORDER BY exercise_name, set_number');
    $ss->execute([$w['id']]);
    $done = [];
    foreach ($ss->fetchAll() as $s) {
        $done[$s['exercise_name']][] = $s;
    }
    $exercises = [];
    foreach ($snap as $ex) {
        $last = $ex['kind'] === 'cardio' ? null : last_performance($uid, $ex['name'], (int) $w['id']);
        $ex['last'] = $last;
        $ex['suggestion'] = suggest_progression($ex, $last);
        $ex['sets_done'] = $done[$ex['name']] ?? [];
        $exercises[] = $ex;
    }
    return [
        'id' => (int) $w['id'], 'label' => $w['label'], 'title' => $w['title'], 'status' => $w['status'],
        'started_at' => $w['started_at'], 'finished_at' => $w['finished_at'], 'watch_image' => $w['watch_image'],
        'duration_min' => $w['duration_min'], 'calories' => $w['calories'], 'avg_hr' => $w['avg_hr'],
        'max_hr' => $w['max_hr'], 'distance_km' => $w['distance_km'], 'feedback' => $w['feedback'],
        'exercises' => $exercises,
    ];
}

function handle_workout_start(int $uid): void
{
    $pdo = db();
    $st = $pdo->prepare("SELECT * FROM workouts WHERE user_id = ? AND status = 'em_andamento' ORDER BY id DESC LIMIT 1");
    $st->execute([$uid]);
    $open = $st->fetch();
    $dayId = (int) param('day_id', 0);
    if ($open) {
        out(['workout' => workout_payload($uid, $open), 'resumed' => true]);
    }
    $plan = load_active_plan($uid);
    $day = null;
    foreach ($plan['days'] ?? [] as $d) {
        if ((int) $d['id'] === $dayId) {
            $day = $d;
        }
    }
    if (!$day) {
        fail('Dia da ficha não encontrado', 404);
    }
    $snap = array_map(fn($e) => [
        'name' => $e['name'], 'muscle' => $e['muscle'], 'kind' => $e['kind'], 'sets' => (int) $e['sets'],
        'rep_min' => (int) $e['rep_min'], 'rep_max' => (int) $e['rep_max'], 'rest_sec' => (int) $e['rest_sec'],
        'cardio_minutes' => $e['cardio_minutes'] !== null ? (int) $e['cardio_minutes'] : null,
    ], $day['exercises']);
    $pdo->prepare('INSERT INTO workouts (user_id, plan_day_id, label, title, started_at, status, plan_snapshot)
        VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([$uid, $day['id'], $day['label'], $day['title'], now(), 'em_andamento',
            json_encode($snap, JSON_UNESCAPED_UNICODE)]);
    $w = own_workout($uid, (int) $pdo->lastInsertId());
    out(['workout' => workout_payload($uid, $w), 'resumed' => false]);
}

function handle_workout_get(int $uid): void
{
    $w = own_workout($uid, (int) ($_GET['id'] ?? 0));
    out(['workout' => workout_payload($uid, $w)]);
}

function handle_workout_swap(int $uid): void
{
    $w = own_workout($uid, (int) param('workout_id', 0), true);
    $idx = (int) param('index', -1);
    $new = mb_substr(trim((string) param('name', '')), 0, 100);
    $remember = (bool) param('remember', false);
    $snap = $w['plan_snapshot'] ? json_decode($w['plan_snapshot'], true) : [];
    if ($new === '' || !isset($snap[$idx])) {
        fail('Exercício inválido');
    }
    foreach ($snap as $i => $e) {
        if ($i !== $idx && mb_strtolower($e['name']) === mb_strtolower($new)) {
            fail('Esse exercício já está neste treino');
        }
    }
    $old = $snap[$idx]['name'];
    if ($old === $new) {
        out(['workout' => workout_payload($uid, $w)]);
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $snap[$idx]['name'] = $new;
        $pdo->prepare('UPDATE workouts SET plan_snapshot = ? WHERE id = ?')
            ->execute([json_encode($snap, JSON_UNESCAPED_UNICODE), $w['id']]);
        // séries já feitas hoje acompanham o novo nome
        $pdo->prepare('UPDATE workout_sets SET exercise_name = ? WHERE workout_id = ? AND exercise_name = ?')
            ->execute([$new, $w['id'], $old]);
        if ($remember) {
            $plan = load_active_plan($uid);
            if ($plan) {
                $pdo->prepare('UPDATE plan_exercises pe JOIN plan_days d ON d.id = pe.day_id
                    SET pe.name = ? WHERE d.plan_id = ? AND d.label = ? AND pe.name = ?')
                    ->execute([$new, $plan['id'], $w['label'], $old]);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    out(['workout' => workout_payload($uid, own_workout($uid, (int) $w['id']))]);
}

function handle_workout_rest(int $uid): void
{
    $w = own_workout($uid, (int) param('workout_id', 0), true);
    $idx = (int) param('index', -1);
    $sec = max(0, min(600, (int) param('rest_sec', 60)));
    $snap = $w['plan_snapshot'] ? json_decode($w['plan_snapshot'], true) : [];
    if (!isset($snap[$idx])) {
        fail('Exercício inválido');
    }
    $name = $snap[$idx]['name'];
    $snap[$idx]['rest_sec'] = $sec;
    $pdo = db();
    $pdo->prepare('UPDATE workouts SET plan_snapshot = ? WHERE id = ?')
        ->execute([json_encode($snap, JSON_UNESCAPED_UNICODE), $w['id']]);
    // vale também para a ficha, nos próximos treinos
    $plan = load_active_plan($uid);
    if ($plan) {
        $pdo->prepare('UPDATE plan_exercises pe JOIN plan_days d ON d.id = pe.day_id
            SET pe.rest_sec = ? WHERE d.plan_id = ? AND d.label = ? AND pe.name = ?')
            ->execute([$sec, $plan['id'], $w['label'], $name]);
    }
    out(['ok' => true, 'rest_sec' => $sec]);
}

function handle_set_save(int $uid): void
{
    $w = own_workout($uid, (int) param('workout_id', 0), true);
    $name = mb_substr(trim((string) param('exercise_name', '')), 0, 100);
    $n = (int) param('set_number', 0);
    if ($name === '' || $n < 1 || $n > 20) {
        fail('Dados da série inválidos');
    }
    $reps = intval_or_null(param('reps'));
    $weight = num(param('weight_kg'), 2);
    $pdo = db();
    $st = $pdo->prepare('SELECT id FROM workout_sets WHERE workout_id = ? AND exercise_name = ? AND set_number = ?');
    $st->execute([$w['id'], $name, $n]);
    $row = $st->fetch();
    if ($row) {
        $pdo->prepare('UPDATE workout_sets SET reps = ?, weight_kg = ?, done_at = ? WHERE id = ?')
            ->execute([$reps, $weight, now(), $row['id']]);
    } else {
        $pdo->prepare('INSERT INTO workout_sets (workout_id, exercise_name, set_number, reps, weight_kg, done_at)
            VALUES (?, ?, ?, ?, ?, ?)')->execute([$w['id'], $name, $n, $reps, $weight, now()]);
    }
    out(['ok' => true]);
}

function handle_set_delete(int $uid): void
{
    $w = own_workout($uid, (int) param('workout_id', 0), true);
    db()->prepare('DELETE FROM workout_sets WHERE workout_id = ? AND exercise_name = ? AND set_number = ?')
        ->execute([$w['id'], (string) param('exercise_name', ''), (int) param('set_number', 0)]);
    out(['ok' => true]);
}

function handle_workout_watch(int $uid): void
{
    $w = own_workout($uid, (int) param('workout_id', 0));
    $name = save_upload('image');
    if ($name === null) {
        fail('Envie o print do relatório do relógio');
    }
    if ($w['watch_image'] && preg_match('/^[a-f0-9]{24}\.(jpg|png|webp)$/', $w['watch_image']) && $w['watch_image'] !== $name) {
        @unlink(storage_dir() . '/' . $w['watch_image']);
    }
    db()->prepare('UPDATE workouts SET watch_image = ? WHERE id = ?')->execute([$name, $w['id']]);
    $path = storage_dir() . '/' . $name;
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($path);
    $data = read_watch_report($path, $mime);
    out(['image' => $name, 'read' => $data]);
}

function workout_totals(int $workoutId): array
{
    $st = db()->prepare('SELECT COUNT(*) AS n, COALESCE(SUM(reps * weight_kg), 0) AS vol
        FROM workout_sets WHERE workout_id = ?');
    $st->execute([$workoutId]);
    $r = $st->fetch();
    return ['sets' => (int) $r['n'], 'volume' => (float) $r['vol']];
}

function kg(float $v): string
{
    return number_format($v, 0, ',', '.') . ' kg';
}

function build_feedback(int $uid, array $w): string
{
    $pdo = db();
    $t = workout_totals((int) $w['id']);
    $lines = [];
    $lines[] = 'Treino ' . $w['label'] . ' concluído: ' . $t['sets'] . ' séries registradas, volume total de ' . kg($t['volume']) . '.';

    $st = $pdo->prepare("SELECT * FROM workouts WHERE user_id = ? AND label = ? AND status = 'finalizado' AND id <> ?
        ORDER BY finished_at DESC, id DESC LIMIT 1");
    $st->execute([$uid, $w['label'], $w['id']]);
    $prev = $st->fetch();
    if ($prev) {
        $pt = workout_totals((int) $prev['id']);
        if ($pt['volume'] > 0 && $t['volume'] > 0) {
            $pct = round(($t['volume'] - $pt['volume']) / $pt['volume'] * 100);
            $lines[] = $pct === 0.0 ? 'Volume igual ao último treino ' . $w['label'] . '.'
                : 'Volume ' . ($pct > 0 ? '+' : '') . (int) $pct . '% em relação ao último treino ' . $w['label'] . '.';
        }
        $cur = $pdo->prepare('SELECT exercise_name, MAX(weight_kg) AS mw FROM workout_sets WHERE workout_id = ? GROUP BY exercise_name');
        $cur->execute([$w['id']]);
        $prevTop = $pdo->prepare('SELECT exercise_name, MAX(weight_kg) AS mw FROM workout_sets WHERE workout_id = ? GROUP BY exercise_name');
        $prevTop->execute([$prev['id']]);
        $pm = [];
        foreach ($prevTop->fetchAll() as $r) {
            $pm[$r['exercise_name']] = (float) $r['mw'];
        }
        $ups = [];
        foreach ($cur->fetchAll() as $r) {
            if (isset($pm[$r['exercise_name']]) && (float) $r['mw'] > $pm[$r['exercise_name']]) {
                $ups[] = $r['exercise_name'] . ' (' . rtrim(rtrim(number_format((float) $r['mw'], 2, ',', ''), '0'), ',') . ' kg)';
            }
        }
        if ($ups) {
            $lines[] = 'Carga maior em: ' . implode(', ', array_slice($ups, 0, 4)) . '.';
        }
    } else {
        $lines[] = 'Este foi o primeiro treino ' . $w['label'] . ' registrado. Ele vira a base para as próximas comparações.';
    }

    $watch = [];
    if ($w['duration_min']) {
        $watch[] = $w['duration_min'] . ' min';
    }
    if ($w['calories']) {
        $watch[] = $w['calories'] . ' kcal';
    }
    if ($w['avg_hr']) {
        $watch[] = 'FC media ' . $w['avg_hr'] . ' bpm';
    }
    if ($watch) {
        $line = 'Relógio: ' . implode(', ', $watch) . '.';
        if ($prev && $prev['calories'] && $w['calories']) {
            $d = (int) $w['calories'] - (int) $prev['calories'];
            $line .= ' Gasto ' . ($d >= 0 ? '+' : '') . $d . ' kcal em relação ao último ' . $w['label'] . '.';
        }
        $lines[] = $line;
    }
    return implode("\n", $lines);
}

function handle_workout_finish(int $uid): void
{
    $w = own_workout($uid, (int) param('workout_id', 0), true);
    $pdo = db();
    $dur = intval_or_null(param('duration_min'));
    if ($dur === null) {
        $dur = max(1, (int) round((time() - strtotime($w['started_at'])) / 60));
    }
    $watchData = param('watch_data');
    $pdo->prepare("UPDATE workouts SET status = 'finalizado', finished_at = ?, duration_min = ?, calories = ?,
        avg_hr = ?, max_hr = ?, distance_km = ?, notes = ?, watch_data = ? WHERE id = ?")
        ->execute([now(), $dur, intval_or_null(param('calories')), intval_or_null(param('avg_hr')),
            intval_or_null(param('max_hr')), num(param('distance_km'), 2),
            mb_substr((string) param('notes', ''), 0, 250) ?: null,
            is_array($watchData) ? json_encode($watchData, JSON_UNESCAPED_UNICODE) : null, $w['id']]);
    $w = own_workout($uid, (int) $w['id']);
    $fb = build_feedback($uid, $w);
    $pdo->prepare('UPDATE workouts SET feedback = ? WHERE id = ?')->execute([$fb, $w['id']]);
    out(['feedback' => $fb, 'workout_id' => (int) $w['id']]);
}

function handle_workout_edit(int $uid): void
{
    $w = own_workout($uid, (int) param('workout_id', 0));
    if ($w['status'] !== 'finalizado') {
        fail('Edite o treino pela tela de treino em andamento', 409);
    }
    $exs = param('exercises', []);
    if (!is_array($exs) || count($exs) > 40) {
        fail('Dados do treino inválidos');
    }
    $pdo = db();
    $when = $w['finished_at'] ?: now();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM workout_sets WHERE workout_id = ?')->execute([$w['id']]);
        $ins = $pdo->prepare('INSERT INTO workout_sets (workout_id, exercise_name, set_number, reps, weight_kg, done_at)
            VALUES (?, ?, ?, ?, ?, ?)');
        foreach ($exs as $ex) {
            $name = mb_substr(trim((string) ($ex['name'] ?? '')), 0, 100);
            $sets = is_array($ex['sets'] ?? null) ? array_slice($ex['sets'], 0, 20) : [];
            if ($name === '') {
                continue;
            }
            $n = 0;
            foreach ($sets as $s) {
                $reps = intval_or_null($s['reps'] ?? null);
                $weight = num($s['weight_kg'] ?? null, 2);
                if ($reps === null && $weight === null) {
                    continue;
                }
                $n++;
                $ins->execute([$w['id'], $name, $n, $reps, $weight, $when]);
            }
        }
        $notes = mb_substr((string) param('notes', ''), 0, 250);
        $pdo->prepare('UPDATE workouts SET duration_min = ?, calories = ?, avg_hr = ?, max_hr = ?, distance_km = ?, notes = ?
            WHERE id = ?')->execute([intval_or_null(param('duration_min')), intval_or_null(param('calories')),
            intval_or_null(param('avg_hr')), intval_or_null(param('max_hr')), num(param('distance_km'), 2),
            $notes !== '' ? $notes : null, $w['id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        fail('Não consegui salvar a edição', 500);
    }
    $w = own_workout($uid, (int) $w['id']);
    $fb = build_feedback($uid, $w);
    $pdo->prepare('UPDATE workouts SET feedback = ? WHERE id = ?')->execute([$fb, $w['id']]);
    out(['ok' => true, 'feedback' => $fb]);
}

function handle_workout_cancel(int $uid): void
{
    $w = own_workout($uid, (int) param('workout_id', 0), true);
    if ($w['watch_image'] && preg_match('/^[a-f0-9]{24}\.(jpg|png|webp)$/', $w['watch_image'])) {
        @unlink(storage_dir() . '/' . $w['watch_image']);
    }
    db()->prepare('DELETE FROM workouts WHERE id = ?')->execute([$w['id']]);
    out(['ok' => true]);
}

function handle_history(int $uid): void
{
    $st = db()->prepare("SELECT w.id, w.label, w.title, w.finished_at, w.duration_min, w.calories, w.avg_hr,
        (SELECT COUNT(*) FROM workout_sets s WHERE s.workout_id = w.id) AS sets,
        (SELECT COALESCE(SUM(s.reps * s.weight_kg), 0) FROM workout_sets s WHERE s.workout_id = w.id) AS volume
        FROM workouts w WHERE w.user_id = ? AND w.status = 'finalizado'
        ORDER BY w.finished_at DESC, w.id DESC LIMIT 80");
    $st->execute([$uid]);
    out(['workouts' => $st->fetchAll()]);
}

function handle_history_get(int $uid): void
{
    $w = own_workout($uid, (int) ($_GET['id'] ?? 0));
    $ss = db()->prepare('SELECT exercise_name, set_number, reps, weight_kg FROM workout_sets
        WHERE workout_id = ? ORDER BY id');
    $ss->execute([$w['id']]);
    $groups = [];
    foreach ($ss->fetchAll() as $s) {
        $groups[$s['exercise_name']][] = $s;
    }
    $list = [];
    foreach ($groups as $name => $sets) {
        $list[] = ['name' => $name, 'sets' => $sets];
    }
    $w['exercises'] = $list;
    $planned = [];
    $snap = $w['plan_snapshot'] ? json_decode($w['plan_snapshot'], true) : [];
    foreach (is_array($snap) ? $snap : [] as $ex) {
        $planned[] = ['name' => $ex['name'], 'kind' => $ex['kind'] ?? 'strength', 'sets' => (int) ($ex['sets'] ?? 3),
            'rep_max' => (int) ($ex['rep_max'] ?? 10)];
    }
    $w['planned'] = $planned;
    unset($w['plan_snapshot']);
    out(['workout' => $w]);
}

function handle_stats(int $uid): void
{
    $pdo = db();
    $st = $pdo->prepare("SELECT finished_at, calories FROM workouts WHERE user_id = ? AND status = 'finalizado'
        AND finished_at >= ? ORDER BY finished_at");
    $st->execute([$uid, date('Y-m-d', strtotime('-8 weeks'))]);
    $weeks = [];
    for ($i = 7; $i >= 0; $i--) {
        $weeks[date('Y-m-d', strtotime('monday this week -' . $i . ' weeks'))] = 0;
    }
    foreach ($st->fetchAll() as $r) {
        $key = date('Y-m-d', strtotime('monday this week', strtotime($r['finished_at'])));
        if (isset($weeks[$key])) {
            $weeks[$key]++;
        }
    }
    $weekly = [];
    foreach ($weeks as $d => $n) {
        $weekly[] = ['week' => $d, 'count' => $n];
    }
    $total = $pdo->prepare("SELECT COUNT(*) AS n FROM workouts WHERE user_id = ? AND status = 'finalizado'");
    $total->execute([$uid]);
    $sw = $pdo->prepare('SELECT log_date, weight_kg FROM body_logs WHERE user_id = ? AND weight_kg IS NOT NULL
        ORDER BY log_date DESC, id DESC LIMIT 60');
    $sw->execute([$uid]);
    $mon = date('Y-m-d', strtotime('monday this week'));
    $rd = $pdo->prepare("SELECT DISTINCT DATE(finished_at) AS d FROM workouts WHERE user_id = ? AND status = 'finalizado'
        AND finished_at >= ?");
    $rd->execute([$uid, $mon]);
    $recent = array_map(fn($r) => $r['d'], $rd->fetchAll());
    $tm = $pdo->prepare("SELECT COALESCE(SUM(duration_min), 0) AS m FROM workouts WHERE user_id = ? AND status = 'finalizado'");
    $tm->execute([$uid]);
    out(['weekly' => $weekly, 'total_workouts' => (int) $total->fetch()['n'],
         'recent_days' => $recent, 'total_minutes' => (int) $tm->fetch()['m'],
         'weight' => array_reverse($sw->fetchAll())]);
}
