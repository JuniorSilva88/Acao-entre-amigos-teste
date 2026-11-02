<?php
declare(strict_types=1);

$repository = dirname(__DIR__, 2);
$temporaryRoot = sys_get_temp_dir() . '/gallery-api-test-' . bin2hex(random_bytes(8));

function assert_test(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function make_directory(string $path): void
{
    if (!is_dir($path) && !mkdir($path, 0755, true) && !is_dir($path)) {
        throw new RuntimeException('Could not create test directory.');
    }
}

function remove_test_tree(string $path): void
{
    if (!is_dir($path)) {
        return;
    }
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($iterator as $entry) {
        if ($entry->isDir() && !$entry->isLink()) {
            rmdir($entry->getPathname());
        } else {
            unlink($entry->getPathname());
        }
    }
    rmdir($path);
}

function copy_file(string $source, string $destination): void
{
    make_directory(dirname($destination));
    if (!copy($source, $destination)) {
        throw new RuntimeException('Could not prepare an integration-test file.');
    }
}

function request_api(string $url, string $method, ?string $body = null, array $headers = []): array
{
    if ($method === 'POST' && !array_filter($headers, function (string $header): bool {
        return stripos($header, 'Origin:') === 0;
    })) {
        $parts = parse_url($url);
        $origin = $parts['scheme'] . '://' . $parts['host'];
        if (isset($parts['port'])) {
            $origin .= ':' . $parts['port'];
        }
        $headers[] = 'Origin: ' . $origin;
    }
    $headers[] = 'Connection: close';
    if ($body !== null) {
        $headers[] = 'Content-Length: ' . strlen($body);
    }
    $context = stream_context_create([
        'http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'content' => $body ?? '',
            'ignore_errors' => true,
            'timeout' => 5,
        ],
    ]);

    $responseBody = file_get_contents($url, false, $context);
    $statusLine = $http_response_header[0] ?? '';
    if (!preg_match('/\s(\d{3})\s/', $statusLine, $matches)) {
        throw new RuntimeException('The local API did not return an HTTP status.');
    }

    return [(int) $matches[1], $responseBody === false ? '' : $responseBody];
}

function make_multipart(string $boundary, string $fileContents, string $fileName): string
{
    return "--{$boundary}\r\n"
        . "Content-Disposition: form-data; name=\"action\"\r\n\r\nupload\r\n"
        . "--{$boundary}\r\n"
        . "Content-Disposition: form-data; name=\"image\"; filename=\"{$fileName}\"\r\n"
        . "Content-Type: image/webp\r\n\r\n"
        . $fileContents . "\r\n"
        . "--{$boundary}--\r\n";
}

function api_json(string $body): object
{
    $decoded = json_decode($body);
    if (!is_object($decoded)) {
        throw new RuntimeException('The API returned invalid JSON.');
    }
    return $decoded;
}

function publish_request(string $url, string $revision, array $galleries): array
{
    return request_api(
        $url,
        'POST',
        json_encode([
            'action' => 'publish',
            'revision' => $revision,
            'galleries' => $galleries,
        ], JSON_THROW_ON_ERROR),
        ['Content-Type: application/json', 'X-Test-User: test-user']
    );
}

function run_tests(string $repository, string $temporaryRoot): void
{
    $publishedPath = $temporaryRoot . '/data/galleries.json';
    $stagingDirectory = $temporaryRoot . '/admin/.publish-staging';
    $assetDirectory = $temporaryRoot . '/assets/gallery';
    $publishDirectory = $temporaryRoot . '/data/.publish';

    make_directory($temporaryRoot . '/admin');
    make_directory($temporaryRoot . '/assets');
    make_directory($temporaryRoot . '/data');
    make_directory($stagingDirectory);
    make_directory($assetDirectory);
    make_directory($publishDirectory);

    copy_file($repository . '/admin/api.php', $temporaryRoot . '/admin/api.php');
    copy_file($repository . '/admin/.publish-staging/.htaccess', $stagingDirectory . '/.htaccess');
    copy_file($repository . '/assets/gallery/.htaccess', $assetDirectory . '/.htaccess');
    copy_file($repository . '/data/.publish/.htaccess', $publishDirectory . '/.htaccess');
    copy_file($repository . '/data/galleries.json', $publishedPath);

    $initial = json_decode(file_get_contents($publishedPath));
    foreach ($initial as $gallery) {
        foreach ($gallery->images as $image) {
            foreach ([$image->src, $image->fullSrc ?? null] as $path) {
                if ($path !== null && !is_file($temporaryRoot . '/' . $path)) {
                    copy_file($repository . '/' . $path, $temporaryRoot . '/' . $path);
                }
            }
        }
    }

    $router = <<<'PHP'
    <?php
    if (parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) !== '/admin/api.php') {
    http_response_code(404);
    exit;
}
if (($_SERVER['HTTP_X_TEST_USER'] ?? '') === 'test-user') {
    $_SERVER['REMOTE_USER'] = 'test-user';
}
require __DIR__ . '/admin/api.php';
PHP;
    file_put_contents($temporaryRoot . '/router.php', $router);

    $socket = stream_socket_server('tcp://127.0.0.1:0', $errorCode, $errorMessage);
    if ($socket === false) {
        throw new RuntimeException('Could not reserve a local test port.');
    }
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $port = (int) substr($address, strrpos($address, ':') + 1);
    $command = [
        PHP_BINARY,
        '-S',
        '127.0.0.1:' . $port,
        '-t',
        $temporaryRoot,
        $temporaryRoot . '/router.php',
    ];
    $process = proc_open($command, [
        0 => ['file', '/dev/null', 'r'],
        1 => ['file', '/dev/null', 'a'],
        2 => ['file', '/dev/null', 'a'],
    ], $pipes);
    if (!is_resource($process)) {
        throw new RuntimeException('Could not start the local PHP test server.');
    }

    try {
        $url = 'http://127.0.0.1:' . $port . '/admin/api.php';
        $ready = false;
        for ($attempt = 0; $attempt < 50; $attempt++) {
            $connection = @stream_socket_client('tcp://127.0.0.1:' . $port, $code, $message, 0.1);
            if ($connection !== false) {
                fclose($connection);
                $ready = true;
                break;
            }
            usleep(100000);
        }
        assert_test($ready, 'The local PHP server did not start.');

        [$status] = request_api($url, 'GET');
        assert_test($status === 401, 'Unauthenticated API requests must be rejected.');

        [$status, $body] = request_api($url, 'GET', null, ['X-Test-User: test-user']);
        assert_test($status === 200, 'Authenticated API reads must succeed.');
        $published = api_json($body);
        assert_test(count($published->galleries) === count($initial), 'API read changed the current gallery count.');

        [$status] = request_api(
            $url,
            'POST',
            make_multipart('test-boundary', 'not-an-image', 'misleading.php'),
            ['Content-Type: multipart/form-data; boundary=test-boundary', 'X-Test-User: test-user']
        );
        assert_test($status === 415, 'Uploads with a non-WebP MIME must be rejected.');
        [$status] = request_api(
            $url,
            'POST',
            make_multipart('test-boundary', 'not-an-image', 'misleading.php'),
            [
                'Content-Type: multipart/form-data; boundary=test-boundary',
                'Origin: https://attacker.example',
                'X-Test-User: test-user',
            ]
        );
        assert_test($status === 403, 'Cross-origin API requests must be rejected.');

        $initialContents = file_get_contents($publishedPath);
        [$status] = publish_request($url, str_repeat('0', 64), $published->galleries);
        assert_test($status === 409, 'Stale publication revisions must be rejected.');
        assert_test(file_get_contents($publishedPath) === $initialContents, 'A stale publish changed the JSON.');

        $invalidGalleries = json_decode(json_encode($published->galleries), false);
        $invalidGalleries[0]->images[0]->src = 'assets/../../README.md';
        [$status] = publish_request($url, $published->revision, $invalidGalleries);
        assert_test($status === 422, 'Path traversal in gallery image paths must be rejected.');
        assert_test(file_get_contents($publishedPath) === $initialContents, 'An invalid publish changed the JSON.');

        $tooManyImages = json_decode(json_encode($published->galleries), false);
        while (count($tooManyImages[0]->images) <= 100) {
            $tooManyImages[0]->images[] = clone $tooManyImages[0]->images[0];
        }
        [$status] = publish_request($url, $published->revision, $tooManyImages);
        assert_test($status === 422, 'Image-count limits must be enforced.');
        assert_test(file_get_contents($publishedPath) === $initialContents, 'An over-limit publish changed the JSON.');

        $sampleWebp = file_get_contents($repository . '/assets/img1-800.webp');
        assert_test($sampleWebp !== false, 'The WebP test fixture is missing.');
        $boundary = 'upload-' . bin2hex(random_bytes(8));
        [$status, $body] = request_api(
            $url,
            'POST',
            make_multipart($boundary, $sampleWebp, '../../untrusted.php'),
            ['Content-Type: multipart/form-data; boundary=' . $boundary, 'X-Test-User: test-user']
        );
        assert_test($status === 201, 'A valid WebP upload must be staged.');
        $upload = api_json($body);
        assert_test(preg_match('/\A[a-f0-9]{32}\z/', $upload->uploadId) === 1, 'The upload ID must be server-generated.');
        assert_test(is_file($stagingDirectory . '/' . $upload->uploadId . '.webp'), 'The staged WebP is missing.');

        $publishGalleries = json_decode(json_encode($published->galleries), false);
        $publishGalleries[0]->images[] = (object) [
            'uploadId' => $upload->uploadId,
            'alt' => 'Imagem de teste',
        ];
        $assetsBeforeFailedPublish = glob($assetDirectory . '/gallery-*.webp') ?: [];
        chmod($publishDirectory, 0555);
        [$status, $failedPublishBody] = publish_request($url, $published->revision, $publishGalleries);
        chmod($publishDirectory, 0755);
        assert_test($status === 500, 'A storage failure must abort publication: ' . $failedPublishBody);
        clearstatcache(true, $publishedPath);
        assert_test(file_get_contents($publishedPath) === $initialContents, 'A failed storage write changed the previous JSON.');
        $remainingAssets = glob($assetDirectory . '/gallery-*.webp') ?: [];
        assert_test(
            $remainingAssets === $assetsBeforeFailedPublish,
            'A failed publication did not restore the generated gallery images.'
        );
        assert_test(is_file($stagingDirectory . '/' . $upload->uploadId . '.webp'), 'A failed publication discarded its retryable staged image.');

        [$status, $body] = publish_request($url, $published->revision, $publishGalleries);
        assert_test($status === 200, 'A valid gallery publication must succeed.');
        $result = api_json($body);
        assert_test(count($result->galleries[0]->images) === count($published->galleries[0]->images) + 1, 'The new image was not published.');
        $newImage = $result->galleries[0]->images[count($result->galleries[0]->images) - 1];
        assert_test(
            preg_match('~\Aassets/gallery/gallery-[a-f0-9]{32}\.webp\z~', $newImage->src) === 1,
            'The public image path must use a server-generated name.'
        );
        assert_test(is_file($temporaryRoot . '/' . $newImage->src), 'The published WebP file is missing.');
        assert_test(!is_file($stagingDirectory . '/' . $upload->uploadId . '.webp'), 'The staged file was not removed after publication.');
        assert_test(hash('sha256', file_get_contents($publishedPath)) === $result->revision, 'The returned revision does not match the saved JSON.');

        $removedImagePath = $temporaryRoot . '/' . $newImage->src;
        array_pop($result->galleries[0]->images);
        [$status, $body] = publish_request($url, $result->revision, $result->galleries);
        assert_test($status === 200, 'Removing a published image must succeed: ' . $body);
        clearstatcache(true, $removedImagePath);
        assert_test(
            !is_file($removedImagePath),
            'An unreferenced generated gallery image was not removed: ' . $body
        );

        echo "Gallery API integration tests passed: authentication, same-origin checks, MIME/quantity limits, path safety, revision conflict, rollback, publish, and image removal.\n";
    } finally {
        proc_terminate($process);
        proc_close($process);
    }
}

if (strpos($temporaryRoot, sys_get_temp_dir() . '/gallery-api-test-') !== 0) {
    throw new RuntimeException('Refusing to use an unexpected temporary test path.');
}

try {
    run_tests($repository, $temporaryRoot);
} finally {
    remove_test_tree($temporaryRoot);
}
