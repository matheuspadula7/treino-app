<?php
declare(strict_types=1);

function load_active_plan(int $uid): ?array
{
    $pdo = db();
    $st = $pdo->prepare('SELECT * FROM plans WHERE user_id = ? AND active = 1 ORDER BY id DESC LIMIT 1');
    $st->execute([$uid]);
    $plan = $st->fetch();
    if (!$plan) {
        return null;
    }
    $sd = $pdo->prepare('SELECT * FROM plan_days WHERE plan_id = ? ORDER BY position');
    $sd->execute([$plan['id']]);
    $days = $sd->fetchAll();
    $se = $pdo->prepare('SELECT * FROM plan_exercises WHERE day_id = ? ORDER BY position');
    foreach ($days as &$d) {
        $se->execute([$d['id']]);
        $d['exercises'] = $se->fetchAll();
    }
    unset($d);
    $plan['days'] = $days;
    return $plan;
}

function next_day_id(int $uid, ?array $plan): ?int
{
    if (!$plan || !$plan['days']) {
        return null;
    }
    $st = db()->prepare("SELECT label FROM workouts WHERE user_id = ? AND status = 'finalizado'
        ORDER BY finished_at DESC, id DESC LIMIT 1");
    $st->execute([$uid]);
    $last = $st->fetch();
    $labels = array_column($plan['days'], 'label');
    $idx = 0;
    if ($last) {
        $pos = array_search($last['label'], $labels, true);
        $idx = $pos === false ? 0 : ($pos + 1) % count($labels);
    }
    return (int) $plan['days'][$idx]['id'];
}

function plan_payload(int $uid): array
{
    $plan = load_active_plan($uid);
    $st = db()->prepare('SELECT days_per_week FROM profiles WHERE user_id = ?');
    $st->execute([$uid]);
    $p = $st->fetch();
    $sw = db()->prepare("SELECT id, label, title, started_at FROM workouts
        WHERE user_id = ? AND status = 'em_andamento' ORDER BY id DESC LIMIT 1");
    $sw->execute([$uid]);
    return [
        'plan' => $plan,
        'next_day_id' => next_day_id($uid, $plan),
        'in_progress' => $sw->fetch() ?: null,
        'suggested_split' => suggest_split((int) ($p['days_per_week'] ?? 4)),
    ];
}

function handle_plan(int $uid): void
{
    out(plan_payload($uid));
}

function handle_plan_generate(int $uid): void
{
    $split = (string) param('split', '');
    if (!in_array($split, ['ABC', 'ABCD', 'ABCDE'], true)) {
        $st = db()->prepare('SELECT days_per_week FROM profiles WHERE user_id = ?');
        $st->execute([$uid]);
        $p = $st->fetch();
        $split = suggest_split((int) ($p['days_per_week'] ?? 4));
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        save_plan($pdo, $uid, $split, generate_plan($split, 'perder_gordura'));
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    out(plan_payload($uid));
}

function handle_plan_save(int $uid): void
{
    $plan = load_active_plan($uid);
    if (!$plan) {
        fail('Nenhuma ficha ativa', 404);
    }
    $days = input()['days'] ?? null;
    if (!is_array($days) || !$days) {
        fail('Ficha vazia');
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM plan_days WHERE plan_id = ?')->execute([$plan['id']]);
        $stDay = $pdo->prepare('INSERT INTO plan_days (plan_id, position, label, title) VALUES (?, ?, ?, ?)');
        $stEx = $pdo->prepare('INSERT INTO plan_exercises
            (day_id, position, name, muscle, kind, sets, rep_min, rep_max, rest_sec, cardio_minutes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        foreach (array_values($days) as $pos => $d) {
            $label = mb_substr(trim((string) ($d['label'] ?? chr(65 + $pos))), 0, 4);
            $title = mb_substr(trim((string) ($d['title'] ?? 'Treino')), 0, 80);
            $stDay->execute([$plan['id'], $pos, $label, $title]);
            $dayId = (int) $pdo->lastInsertId();
            foreach (array_values($d['exercises'] ?? []) as $p => $e) {
                $name = mb_substr(trim((string) ($e['name'] ?? '')), 0, 100);
                if ($name === '') {
                    continue;
                }
                $kind = ($e['kind'] ?? '') === 'cardio' ? 'cardio' : 'strength';
                $min = max(1, min(60, (int) ($e['rep_min'] ?? 8)));
                $max = max($min, min(60, (int) ($e['rep_max'] ?? $min)));
                $stEx->execute([$dayId, $p, $name, mb_substr((string) ($e['muscle'] ?? ''), 0, 40) ?: null,
                    $kind, max(1, min(10, (int) ($e['sets'] ?? 3))), $min, $max,
                    max(0, min(600, (int) ($e['rest_sec'] ?? 60))),
                    $kind === 'cardio' ? max(1, min(240, (int) ($e['cardio_minutes'] ?? 20))) : null]);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    out(plan_payload($uid));
}
