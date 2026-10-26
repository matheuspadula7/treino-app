<?php
declare(strict_types=1);

date_default_timezone_set('America/Sao_Paulo');

/**
 * Pasta privada fora da pasta publicada (treino-private), onde ficam config.php e storage.
 * Assim o deploy automatico por Git nunca mexe nas senhas nem nas fotos.
 * Procura ao lado da pasta publicada e, se o app estiver numa subpasta, um nivel acima.
 */
function private_dir(): ?string
{
    static $dir = false;
    if ($dir === false) {
        $dir = null;
        $env = getenv('TREINO_PRIVATE');
        $cands = array_filter([$env ?: null, dirname(__DIR__, 2) . '/treino-private', dirname(__DIR__, 3) . '/treino-private']);
        foreach ($cands as $c) {
            if (is_dir($c)) {
                $dir = $c;
                break;
            }
        }
    }
    return $dir;
}

function config_file(): ?string
{
    $priv = private_dir();
    if ($priv && is_file($priv . '/config.php')) {
        return $priv . '/config.php';
    }
    return is_file(__DIR__ . '/config.php') ? __DIR__ . '/config.php' : null;
}

$cfgFile = config_file();
if ($cfgFile === null) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'config.php ausente. Crie treino-private/config.php (ou api/config.php) a partir do config.sample.php.']);
    exit;
}
$CONFIG = require $cfgFile;

function cfg(string $key, $default = null)
{
    global $CONFIG;
    return $CONFIG[$key] ?? $default;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . cfg('db_host', 'localhost') . ';dbname=' . cfg('db_name') . ';charset=utf8mb4';
        $pdo = new PDO($dsn, cfg('db_user'), cfg('db_pass'), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

function now(): string
{
    return date('Y-m-d H:i:s');
}

function out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    exit;
}

function fail(string $msg, int $code = 400): void
{
    out(['error' => $msg], $code);
}

function input(): array
{
    static $data = null;
    if ($data === null) {
        $raw = file_get_contents('php://input');
        $data = $raw ? (json_decode($raw, true) ?: []) : [];
    }
    return $data;
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $days = (int) cfg('session_days', 60);
    $life = $days * 86400;
    ini_set('session.gc_maxlifetime', (string) $life);
    session_name('treino_sid');
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params([
        'lifetime' => $life,
        'path' => '/',
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function uid(): int
{
    start_session();
    if (empty($_SESSION['uid'])) {
        fail('Não autenticado', 401);
    }
    return (int) $_SESSION['uid'];
}

function check_password(string $given): bool
{
    $stored = (string) cfg('app_password', '');
    if ($stored === '') {
        return false;
    }
    if (str_starts_with($stored, '$2y$') || str_starts_with($stored, '$argon')) {
        return password_verify($given, $stored);
    }
    return hash_equals($stored, $given);
}

function ensure_user(): int
{
    $row = db()->query('SELECT id FROM users ORDER BY id LIMIT 1')->fetch();
    if ($row) {
        return (int) $row['id'];
    }
    $st = db()->prepare('INSERT INTO users (name, created_at) VALUES (?, ?)');
    $st->execute([cfg('user_name', 'Atleta'), now()]);
    return (int) db()->lastInsertId();
}

function storage_dir(): string
{
    $priv = private_dir();
    $dir = ($priv && is_dir($priv . '/storage')) ? $priv . '/storage' : dirname(__DIR__) . '/storage';
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    return $dir;
}

function num($v, int $dec = 1)
{
    if ($v === null || $v === '') {
        return null;
    }
    $v = str_replace(',', '.', (string) $v);
    return is_numeric($v) ? round((float) $v, $dec) : null;
}

function intval_or_null($v)
{
    if ($v === null || $v === '') {
        return null;
    }
    return is_numeric($v) ? (int) round((float) $v) : null;
}
