<?php
declare(strict_types=1);

/**
 * Le o print do relatório de treino do relógio (Zepp / Amazfit) com IA de visao.
 * Retorna um array com os campos encontrados; o que não aparecer na imagem volta como null.
 */
function read_watch_report(string $path, string $mime): array
{
    $key = (string) cfg('anthropic_api_key', '');
    if ($key === '' || str_contains($key, 'TROQUE')) {
        return ['ok' => false, 'error' => 'Chave da API não configurada no servidor.'];
    }
    $bytes = @file_get_contents($path);
    if ($bytes === false) {
        return ['ok' => false, 'error' => 'Não foi possível ler a imagem.'];
    }

    $prompt = "Esta imagem e um print do relatório de um treino gerado por um relógio Amazfit (app Zepp). "
        . "Extraia os numeros visiveis e responda SOMENTE com um objeto JSON, sem texto extra e sem markdown, "
        . "neste formato: {\"duration_min\": numero ou null, \"calories\": numero ou null, \"avg_hr\": numero ou null, "
        . "\"max_hr\": numero ou null, \"distance_km\": numero ou null, \"activity\": texto ou null, \"notes\": texto ou null}. "
        . "Regras: duration_min e a duracao total em minutos (converta de horas:minutos:segundos e arredonde); "
        . "calories em kcal; avg_hr e max_hr em bpm; distance_km em quilometros; "
        . "se um valor não aparecer na imagem use null; nunca invente numeros. "
        . "Em notes, escreva no maximo uma frase curta com algo relevante que aparece no relatório (por exemplo zonas de frequencia cardiaca ou efeito do treino).";

    $payload = [
        'model' => cfg('anthropic_model', 'claude-sonnet-5-5'),
        'max_tokens' => 400,
        'messages' => [[
            'role' => 'user',
            'content' => [
                ['type' => 'image', 'source' => [
                    'type' => 'base64',
                    'media_type' => $mime,
                    'data' => base64_encode($bytes),
                ]],
                ['type' => 'text', 'text' => $prompt],
            ],
        ]],
    ];

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_HTTPHEADER => [
            'content-type: application/json',
            'x-api-key: ' . $key,
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
    ]);
    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($resp === false) {
        return ['ok' => false, 'error' => 'Falha de rede ao chamar a IA: ' . $err];
    }
    $json = json_decode($resp, true);
    if ($code !== 200 || !is_array($json)) {
        $msg = $json['error']['message'] ?? ('HTTP ' . $code);
        return ['ok' => false, 'error' => 'A IA recusou a leitura: ' . $msg];
    }

    $text = '';
    foreach ($json['content'] ?? [] as $block) {
        if (($block['type'] ?? '') === 'text') {
            $text .= $block['text'];
        }
    }
    if (preg_match('/\{.*\}/s', $text, $m)) {
        $data = json_decode($m[0], true);
    } else {
        $data = null;
    }
    if (!is_array($data)) {
        return ['ok' => false, 'error' => 'Não consegui interpretar a resposta da IA.'];
    }

    return [
        'ok' => true,
        'duration_min' => intval_or_null($data['duration_min'] ?? null),
        'calories' => intval_or_null($data['calories'] ?? null),
        'avg_hr' => intval_or_null($data['avg_hr'] ?? null),
        'max_hr' => intval_or_null($data['max_hr'] ?? null),
        'distance_km' => num($data['distance_km'] ?? null, 2),
        'activity' => isset($data['activity']) ? mb_substr((string) $data['activity'], 0, 60) : null,
        'notes' => isset($data['notes']) ? mb_substr((string) $data['notes'], 0, 200) : null,
    ];
}
