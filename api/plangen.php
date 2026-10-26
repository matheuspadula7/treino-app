<?php
declare(strict_types=1);

/**
 * Gerador de ficha por regras (sem IA, sem custo).
 * Foco em perda de gordura: séries de 10 a 15 repetições nos acessorios,
 * 8 a 12 nos compostos, descanso curto e fechamento com cardio.
 */

function ex(string $name, string $muscle, int $sets, int $min, int $max, int $rest): array
{
    return ['name' => $name, 'muscle' => $muscle, 'kind' => 'strength', 'sets' => $sets,
            'rep_min' => $min, 'rep_max' => $max, 'rest_sec' => $rest, 'cardio_minutes' => null];
}

function cardio(string $name, int $minutes): array
{
    return ['name' => $name, 'muscle' => 'cardio', 'kind' => 'cardio', 'sets' => 1,
            'rep_min' => 1, 'rep_max' => 1, 'rest_sec' => 0, 'cardio_minutes' => $minutes];
}

function day_library(): array
{
    return [
        'peito_tríceps' => ['title' => 'Peito e Tríceps', 'items' => [
            ex('Supino reto com barra', 'peito', 4, 8, 12, 90),
            ex('Supino inclinado com halteres', 'peito', 3, 10, 12, 75),
            ex('Crucifixo na máquina', 'peito', 3, 12, 15, 60),
            ex('Tríceps na polia (corda)', 'tríceps', 3, 10, 15, 60),
            ex('Tríceps testa', 'tríceps', 3, 10, 12, 60),
            ex('Mergulho no banco', 'tríceps', 2, 12, 15, 60),
        ]],
        'costas_bíceps' => ['title' => 'Costas e Bíceps', 'items' => [
            ex('Puxada frontal', 'costas', 4, 8, 12, 90),
            ex('Remada curvada com barra', 'costas', 3, 8, 12, 90),
            ex('Remada baixa no cabo', 'costas', 3, 10, 12, 75),
            ex('Pulldown com corda', 'costas', 3, 12, 15, 60),
            ex('Rosca direta com barra', 'bíceps', 3, 10, 12, 60),
            ex('Rosca martelo', 'bíceps', 3, 10, 15, 60),
        ]],
        'pernas' => ['title' => 'Pernas completas', 'items' => [
            ex('Agachamento livre', 'quadríceps', 4, 8, 12, 90),
            ex('Leg press 45', 'quadríceps', 3, 10, 15, 90),
            ex('Cadeira extensora', 'quadríceps', 3, 12, 15, 60),
            ex('Stiff com barra', 'posterior', 3, 10, 12, 75),
            ex('Mesa flexora', 'posterior', 3, 10, 15, 60),
            ex('Panturrilha em pe', 'panturrilha', 4, 12, 20, 45),
        ]],
        'quadríceps' => ['title' => 'Quadríceps e Panturrilha', 'items' => [
            ex('Agachamento livre', 'quadríceps', 4, 8, 12, 90),
            ex('Leg press 45', 'quadríceps', 4, 10, 15, 90),
            ex('Afundo com halteres', 'quadríceps', 3, 10, 12, 75),
            ex('Cadeira extensora', 'quadríceps', 3, 12, 15, 60),
            ex('Panturrilha sentado', 'panturrilha', 4, 12, 20, 45),
        ]],
        'posterior' => ['title' => 'Posterior e Glúteos', 'items' => [
            ex('Levantamento terra romeno', 'posterior', 4, 8, 12, 90),
            ex('Elevação pélvica', 'glúteos', 4, 10, 12, 75),
            ex('Mesa flexora', 'posterior', 3, 10, 15, 60),
            ex('Cadeira abdutora', 'glúteos', 3, 12, 15, 60),
            ex('Panturrilha em pe', 'panturrilha', 4, 12, 20, 45),
        ]],
        'ombros_abdômen' => ['title' => 'Ombros e Abdômen', 'items' => [
            ex('Desenvolvimento com halteres', 'ombros', 4, 8, 12, 90),
            ex('Elevação lateral', 'ombros', 4, 12, 15, 60),
            ex('Elevação frontal', 'ombros', 3, 12, 15, 60),
            ex('Crucifixo inverso', 'ombros', 3, 12, 15, 60),
            ex('Encolhimento com halteres', 'trapézio', 3, 10, 15, 60),
            ex('Abdominal na máquina', 'abdômen', 3, 12, 20, 45),
            ex('Prancha', 'abdômen', 3, 1, 1, 45),
        ]],
    ];
}

function split_layout(string $split): array
{
    switch ($split) {
        case 'ABCDE':
            return ['A' => 'peito_tríceps', 'B' => 'costas_bíceps', 'C' => 'quadríceps',
                    'D' => 'ombros_abdômen', 'E' => 'posterior'];
        case 'ABCD':
            return ['A' => 'peito_tríceps', 'B' => 'costas_bíceps', 'C' => 'pernas', 'D' => 'ombros_abdômen'];
        default:
            return ['A' => 'peito_tríceps', 'B' => 'costas_bíceps', 'C' => 'pernas'];
    }
}

function suggest_split(int $days): string
{
    if ($days >= 5) {
        return 'ABCDE';
    }
    return $days === 4 ? 'ABCD' : 'ABC';
}

function generate_plan(string $split, string $goal = 'perder_gordura'): array
{
    $lib = day_library();
    $layout = split_layout($split);
    $days = [];
    $i = 0;
    foreach ($layout as $label => $key) {
        $items = $lib[$key]['items'];
        if ($goal === 'perder_gordura') {
            $machine = ($i % 2 === 0) ? 'Esteira inclinada' : 'Bicicleta';
            $items[] = cardio($machine, $i % 2 === 0 ? 20 : 25);
        }
        $days[] = ['label' => $label, 'title' => $lib[$key]['title'], 'exercises' => $items];
        $i++;
    }
    return $days;
}

function save_plan(PDO $pdo, int $userId, string $split, array $days): int
{
    $pdo->prepare('UPDATE plans SET active = 0 WHERE user_id = ?')->execute([$userId]);
    $pdo->prepare('INSERT INTO plans (user_id, name, split, active, created_at) VALUES (?, ?, ?, 1, ?)')
        ->execute([$userId, 'Ficha ' . $split, $split, now()]);
    $planId = (int) $pdo->lastInsertId();
    $stDay = $pdo->prepare('INSERT INTO plan_days (plan_id, position, label, title) VALUES (?, ?, ?, ?)');
    $stEx = $pdo->prepare('INSERT INTO plan_exercises
        (day_id, position, name, muscle, kind, sets, rep_min, rep_max, rest_sec, cardio_minutes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($days as $pos => $d) {
        $stDay->execute([$planId, $pos, $d['label'], $d['title']]);
        $dayId = (int) $pdo->lastInsertId();
        foreach ($d['exercises'] as $p => $e) {
            $stEx->execute([$dayId, $p, $e['name'], $e['muscle'] ?? null, $e['kind'] ?? 'strength',
                (int) $e['sets'], (int) $e['rep_min'], (int) $e['rep_max'], (int) $e['rest_sec'],
                $e['cardio_minutes'] ?? null]);
        }
    }
    return $planId;
}
