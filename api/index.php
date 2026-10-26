<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
require __DIR__ . '/plangen.php';
require __DIR__ . '/vision.php';
require __DIR__ . '/h_core.php';
require __DIR__ . '/h_plan.php';
require __DIR__ . '/h_workout.php';

set_exception_handler(function (Throwable $e) {
    error_log('[treino] ' . $e->getMessage());
    out(['error' => 'Erro no servidor: ' . $e->getMessage()], 500);
});

$route = $_GET['r'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Rotas publicas
if ($route === 'login' && $method === 'POST') {
    handle_login();
}
if ($route === 'me') {
    handle_me();
}
if ($route === 'logout') {
    handle_logout();
}

// Rotas protegidas
$uid = uid();

$routes = [
    'profile'          => 'handle_profile',
    'body'             => 'handle_body',
    'body_delete'      => 'handle_body_delete',
    'photo'            => 'handle_photo',
    'plan'             => 'handle_plan',
    'plan_generate'    => 'handle_plan_generate',
    'plan_save'        => 'handle_plan_save',
    'workout_start'    => 'handle_workout_start',
    'workout_get'      => 'handle_workout_get',
    'workout_swap'     => 'handle_workout_swap',
    'workout_rest'     => 'handle_workout_rest',
    'set_save'         => 'handle_set_save',
    'set_delete'       => 'handle_set_delete',
    'workout_watch'    => 'handle_workout_watch',
    'workout_finish'   => 'handle_workout_finish',
    'workout_cancel'   => 'handle_workout_cancel',
    'history'          => 'handle_history',
    'history_get'      => 'handle_history_get',
    'stats'            => 'handle_stats',
    'health'           => 'handle_health',
];

if (!isset($routes[$route])) {
    fail('Rota desconhecida', 404);
}
call_user_func($routes[$route], $uid);
