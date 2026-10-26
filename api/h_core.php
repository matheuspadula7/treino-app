<?php
declare(strict_types=1);

function param(string $key, $default = null)
{
    if (isset($_POST[$key])) {
        return $_POST[$key];
    }
    $in = input();
    return $in[$key] ?? $default;
}

function handle_login(): void
{
    start_session();
    $pass = (string) (input()['password'] ?? '');
    if (!check_password($pass)) {
        sleep(1);
        fail('Senha incorreta', 401);
    }
    session_regenerate_id(true);
    $_SESSION['uid'] = ensure_user();
    out(['ok' => true, 'name' => cfg('user_name', 'Atleta')]);
}

function handle_me(): void
{
    start_session();
    out(['auth' => !empty($_SESSION['uid']), 'name' => cfg('user_name', 'Atleta')]);
}

function handle_logout(): void
{
    start_session();
    $_SESSION = [];
    session_destroy();
    out(['ok' => true]);
}

function compute_metrics(array $p): array
{
    $m = ['age' => null, 'bmi' => null, 'bmi_label' => null, 'bmr' => null, 'tdee' => null,
          'target_kcal' => null, 'protein_g' => null, 'loss_week_min' => null, 'loss_week_max' => null];
    $w = isset($p['weight_kg']) ? (float) $p['weight_kg'] : 0;
    $h = isset($p['height_cm']) ? (float) $p['height_cm'] : 0;
    if (!empty($p['birth_date'])) {
        $m['age'] = (int) (new DateTime($p['birth_date']))->diff(new DateTime('today'))->y;
    }
    if ($w > 0 && $h > 0) {
        $bmi = $w / (($h / 100) ** 2);
        $m['bmi'] = round($bmi, 1);
        $m['bmi_label'] = $bmi < 18.5 ? 'Abaixo do peso' : ($bmi < 25 ? 'Peso normal'
            : ($bmi < 30 ? 'Sobrepeso' : 'Obesidade'));
    }
    if ($w > 0 && $h > 0 && $m['age'] !== null) {
        $bmr = 10 * $w + 6.25 * $h - 5 * $m['age'] + (($p['sex'] ?? 'M') === 'F' ? -161 : 5);
        $factor = ['baixo' => 1.375, 'moderado' => 1.55, 'alto' => 1.725][$p['activity'] ?? 'moderado'] ?? 1.55;
        $tdee = $bmr * $factor;
        $m['bmr'] = (int) round($bmr);
        $m['tdee'] = (int) round($tdee);
        $m['target_kcal'] = (int) round(max($tdee * 0.80, $bmr * 1.1));
        $m['protein_g'] = (int) round($w * 2.0);
        $m['loss_week_min'] = round($w * 0.005, 2);
        $m['loss_week_max'] = round($w * 0.0075, 2);
    }
    return $m;
}

function latest_weight(int $uid): ?float
{
    $st = db()->prepare('SELECT weight_kg FROM body_logs WHERE user_id = ? AND weight_kg IS NOT NULL
        ORDER BY log_date DESC, id DESC LIMIT 1');
    $st->execute([$uid]);
    $r = $st->fetch();
    return $r ? (float) $r['weight_kg'] : null;
}

function handle_profile(int $uid): void
{
    $pdo = db();
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $sex = param('sex') === 'F' ? 'F' : 'M';
        $birth = param('birth_date') ?: null;
        $height = num(param('height_cm'));
        $weight = num(param('weight_kg'));
        $activity = in_array(param('activity'), ['baixo', 'moderado', 'alto'], true) ? param('activity') : 'moderado';
        $days = max(3, min(6, (int) param('days_per_week', 4)));
        $pdo->prepare('INSERT INTO profiles (user_id, sex, birth_date, height_cm, weight_kg, activity, goal, days_per_week, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE sex = VALUES(sex), birth_date = VALUES(birth_date), height_cm = VALUES(height_cm),
              weight_kg = VALUES(weight_kg), activity = VALUES(activity), goal = VALUES(goal),
              days_per_week = VALUES(days_per_week), updated_at = VALUES(updated_at)')
            ->execute([$uid, $sex, $birth, $height, $weight, $activity, 'perder_gordura', $days, now()]);
        if ($weight !== null) {
            $today = date('Y-m-d');
            $st = $pdo->prepare('SELECT id FROM body_logs WHERE user_id = ? AND log_date = ? LIMIT 1');
            $st->execute([$uid, $today]);
            $row = $st->fetch();
            if ($row) {
                $pdo->prepare('UPDATE body_logs SET weight_kg = ? WHERE id = ?')->execute([$weight, $row['id']]);
            } else {
                $pdo->prepare('INSERT INTO body_logs (user_id, log_date, weight_kg) VALUES (?, ?, ?)')
                    ->execute([$uid, $today, $weight]);
            }
        }
    }
    $st = $pdo->prepare('SELECT * FROM profiles WHERE user_id = ?');
    $st->execute([$uid]);
    $p = $st->fetch() ?: null;
    if ($p) {
        $lw = latest_weight($uid);
        if ($lw !== null) {
            $p['weight_kg'] = $lw;
        }
    }
    out(['profile' => $p, 'metrics' => $p ? compute_metrics($p) : null]);
}

function save_upload(string $field): ?string
{
    if (empty($_FILES[$field]) || $_FILES[$field]['error'] !== UPLOAD_ERR_OK) {
        return null;
    }
    $f = $_FILES[$field];
    if ($f['size'] > 10 * 1024 * 1024) {
        fail('Imagem maior que 10 MB', 413);
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
    if ($ext === null) {
        fail('Formato de imagem não suportado (use JPG, PNG ou WEBP)');
    }
    $name = bin2hex(random_bytes(12)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], storage_dir() . '/' . $name)) {
        fail('Não consegui salvar a imagem', 500);
    }
    return $name;
}

function handle_body(int $uid): void
{
    $pdo = db();
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $photo = save_upload('photo');
        $date = param('log_date') ?: date('Y-m-d');
        $pdo->prepare('INSERT INTO body_logs (user_id, log_date, weight_kg, waist_cm, chest_cm, arm_cm, thigh_cm, hip_cm, photo, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$uid, $date, num(param('weight_kg')), num(param('waist_cm')), num(param('chest_cm')),
                num(param('arm_cm')), num(param('thigh_cm')), num(param('hip_cm')), $photo,
                mb_substr((string) param('notes', ''), 0, 250) ?: null]);
    }
    $st = $pdo->prepare('SELECT * FROM body_logs WHERE user_id = ? ORDER BY log_date DESC, id DESC LIMIT 200');
    $st->execute([$uid]);
    out(['logs' => $st->fetchAll()]);
}

function handle_body_delete(int $uid): void
{
    $id = (int) param('id', 0);
    $st = db()->prepare('SELECT photo FROM body_logs WHERE id = ? AND user_id = ?');
    $st->execute([$id, $uid]);
    $row = $st->fetch();
    if (!$row) {
        fail('Registro não encontrado', 404);
    }
    if ($row['photo'] && preg_match('/^[a-f0-9]{24}\.(jpg|png|webp)$/', $row['photo'])) {
        @unlink(storage_dir() . '/' . $row['photo']);
    }
    db()->prepare('DELETE FROM body_logs WHERE id = ? AND user_id = ?')->execute([$id, $uid]);
    out(['ok' => true]);
}

function handle_photo(int $uid): void
{
    $f = (string) ($_GET['f'] ?? '');
    if (!preg_match('/^[a-f0-9]{24}\.(jpg|png|webp)$/', $f)) {
        fail('Arquivo inválido', 400);
    }
    $st = db()->prepare('SELECT 1 FROM body_logs WHERE user_id = ? AND photo = ?
        UNION SELECT 1 FROM workouts WHERE user_id = ? AND watch_image = ?');
    $st->execute([$uid, $f, $uid, $f]);
    $path = storage_dir() . '/' . $f;
    if (!$st->fetch() || !is_file($path)) {
        fail('Arquivo não encontrado', 404);
    }
    $mime = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'][pathinfo($f, PATHINFO_EXTENSION)];
    header('Content-Type: ' . $mime);
    header('Cache-Control: private, max-age=86400');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

// Diagnostico simples (so com login): de onde o app esta lendo configuracao e fotos
function handle_health(int $uid): void
{
    $priv = private_dir();
    $cfgPath = (string) config_file();
    $store = storage_dir();
    $dbOk = true;
    try {
        db()->query('SELECT 1');
    } catch (Throwable $e) {
        $dbOk = false;
    }
    out([
        'php' => PHP_VERSION,
        'config' => $priv && str_starts_with($cfgPath, $priv) ? 'privada' : 'na pasta api (legado)',
        'storage' => $priv && str_starts_with($store, $priv) ? 'privada' : 'na pasta publicada (legado)',
        'database' => $dbOk ? 'ok' : 'falhou',
        'ai_key' => !str_contains((string) cfg('anthropic_api_key', 'TROQUE'), 'TROQUE') && cfg('anthropic_api_key', '') !== '',
    ]);
}
