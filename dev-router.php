<?php

if (($_SERVER['REMOTE_ADDR'] ?? '') === '127.0.0.1') {
    $_SERVER['REMOTE_USER'] = 'desenvolvimento';
}

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = __DIR__ . $path;

if (is_dir($file) || is_file($file)) {
    return false;
}

http_response_code(404);
echo 'Arquivo não encontrado.';
