<?php
// Copie este arquivo para config.php e preencha os valores.
// O config.php fica so no servidor e nunca deve ser enviado para repositorios publicos.
return [
    // Banco de dados (hPanel > Bancos de dados MySQL)
    'db_host' => 'localhost',
    'db_name' => 'u000000000_treino',
    'db_user' => 'u000000000_treino',
    'db_pass' => 'TROQUE_AQUI',

    // Senha de acesso ao app. Pode ser texto puro ou um hash gerado com password_hash().
    'app_password' => 'TROQUE_ESTA_SENHA',
    'user_name'    => 'Matheus',

    // Leitura do print do relógio por IA (Anthropic). A chave fica so no servidor.
    'anthropic_api_key' => 'sk-ant-TROQUE_AQUI',
    'anthropic_model'   => 'claude-sonnet-5-5',

    // Dias que a sessao de login permanece valida
    'session_days' => 60,
];
