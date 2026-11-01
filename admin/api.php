<?php
declare(strict_types=1);

const MAX_REQUEST_BYTES = 6291456;
const MAX_UPLOAD_BYTES = 5242880;
const MAX_IMAGE_DIMENSION = 1440;
const MAX_GALLERIES = 50;
const MAX_IMAGES_PER_GALLERY = 100;
const MAX_IMAGES_TOTAL = 250;
const MAX_STAGED_UPLOADS = 250;
const MAX_TITLE_LENGTH = 80;
const MAX_ALT_LENGTH = 180;

final class GalleryApiException extends RuntimeException
{
    public $status;

    public function __construct(string $message, int $status)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

function respond(array $body, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private, max-age=0');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $status): void
{
    throw new GalleryApiException($message, $status);
}

function require_authenticated_user(): void
{
    if (!isset($_SERVER['REMOTE_USER']) || trim((string) $_SERVER['REMOTE_USER']) === '') {
        header('WWW-Authenticate: Basic realm="Painel administrativo", charset="UTF-8"');
        fail('Autenticação obrigatória.', 401);
    }
}

function require_same_origin_request(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $requestHost = $_SERVER['HTTP_HOST'] ?? '';
    $originParts = parse_url($origin);
    $hostParts = parse_url('http://' . $requestHost);
    $requestScheme = !empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off'
        ? 'https'
        : 'http';

    if (
        !is_array($originParts) ||
        !is_array($hostParts) ||
        !isset($originParts['scheme'], $originParts['host'], $hostParts['host']) ||
        strtolower($originParts['scheme']) !== $requestScheme ||
        strtolower($originParts['host']) !== strtolower($hostParts['host']) ||
        ($originParts['port'] ?? null) !== ($hostParts['port'] ?? null) ||
        isset($originParts['path']) ||
        isset($originParts['user']) ||
        isset($originParts['pass'])
    ) {
        fail('A solicitação deve ser iniciada pelo mesmo site.', 403);
    }
}

function is_list_array($value): bool
{
    if (!is_array($value)) {
        return false;
    }

    $expectedKey = 0;
    foreach ($value as $key => $_) {
        if ($key !== $expectedKey) {
            return false;
        }
        $expectedKey++;
    }
    return true;
}

function text_length(string $value): int
{
    $length = preg_match_all('/./us', $value);
    if ($length === false) {
        fail('O texto enviado não está codificado corretamente.', 400);
    }
    return $length;
}

function validate_asset_path(string $path, string $root): string
{
    if (!preg_match(
        '~\Aassets/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9][A-Za-z0-9._-]*\.(?:webp|jpe?g|png)\z~iD',
        $path
    )) {
        fail('A galeria contém um caminho de imagem inválido.', 422);
    }

    $assetsRoot = realpath($root . '/assets');
    $filePath = $root . '/' . $path;
    $realFilePath = realpath($filePath);
    if (
        $assetsRoot === false ||
        $realFilePath === false ||
        !is_file($realFilePath) ||
        is_link($filePath) ||
        strpos($realFilePath, $assetsRoot . DIRECTORY_SEPARATOR) !== 0
    ) {
        fail('Uma imagem referenciada não existe na pasta de assets.', 422);
    }

    return $path;
}

function validate_galleries($value, string $root, bool $allowUploads): array
{
    if (!is_list_array($value) || count($value) > MAX_GALLERIES) {
        fail('A lista de galerias é inválida ou excede o limite permitido.', 422);
    }

    $galleries = [];
    $galleryIds = [];
    $imageCount = 0;

    foreach ($value as $gallery) {
        if (!is_object($gallery)) {
            fail('Uma galeria está em formato inválido.', 422);
        }

        $id = isset($gallery->id) && is_string($gallery->id) ? $gallery->id : '';
        $title = isset($gallery->title) && is_string($gallery->title) ? trim($gallery->title) : '';
        $images = $gallery->images ?? null;

        if (!preg_match('/\A[A-Za-z0-9_-]{1,80}\z/', $id) || isset($galleryIds[$id])) {
            fail('A galeria possui um identificador inválido ou duplicado.', 422);
        }
        if (
            $title === '' ||
            text_length($title) > MAX_TITLE_LENGTH ||
            preg_match('/[\x00-\x1F\x7F]/', $title)
        ) {
            fail('O nome de uma galeria está vazio ou excede o limite de 80 caracteres.', 422);
        }
        if (!is_list_array($images) || count($images) > MAX_IMAGES_PER_GALLERY) {
            fail('Uma galeria excede o limite de imagens permitido.', 422);
        }

        $galleryIds[$id] = true;
        $normalizedImages = [];
        foreach ($images as $image) {
            if (!is_object($image)) {
                fail('Uma imagem da galeria está em formato inválido.', 422);
            }

            $alt = isset($image->alt) && is_string($image->alt) ? trim($image->alt) : null;
            if (
                $alt === null ||
                text_length($alt) > MAX_ALT_LENGTH ||
                preg_match('/[\x00-\x1F\x7F]/', $alt)
            ) {
                fail('O texto alternativo de uma imagem é inválido ou excede 180 caracteres.', 422);
            }

            if (isset($image->uploadId)) {
                $uploadId = is_string($image->uploadId) ? $image->uploadId : '';
                if (!$allowUploads || !preg_match('/\A[a-f0-9]{32}\z/', $uploadId)) {
                    fail('Uma imagem enviada possui um identificador inválido.', 422);
                }

                $normalizedImages[] = [
                    'alt' => $alt,
                    'uploadId' => $uploadId,
                ];
            } else {
                $src = isset($image->src) && is_string($image->src) ? $image->src : '';
                $normalized = [
                    'src' => validate_asset_path($src, $root),
                    'alt' => $alt,
                ];
                if (isset($image->fullSrc)) {
                    if (!is_string($image->fullSrc)) {
                        fail('O caminho da imagem ampliada é inválido.', 422);
                    }
                    $normalized['fullSrc'] = validate_asset_path($image->fullSrc, $root);
                }
                $normalizedImages[] = $normalized;
            }
            $imageCount++;
        }

        $galleries[] = [
            'id' => $id,
            'title' => $title,
            'images' => $normalizedImages,
        ];
    }

    if ($imageCount > MAX_IMAGES_TOTAL) {
        fail('O total de imagens excede o limite permitido.', 422);
    }

    return $galleries;
}

function read_published(string $path, string $root): array
{
    $contents = file_get_contents($path);
    if ($contents === false) {
        fail('Não foi possível ler as galerias publicadas.', 500);
    }

    try {
        $decoded = json_decode($contents, false, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        error_log('gallery api: galleries.json contains invalid JSON: ' . $error->getMessage());
        fail('O arquivo de galerias publicado está inválido; nenhuma alteração foi aplicada.', 500);
    }

    if (!is_array($decoded)) {
        fail('O formato do arquivo de galerias publicado é inválido.', 500);
    }

    return [
        'galleries' => validate_galleries($decoded, $root, false),
        'revision' => hash('sha256', $contents),
        'contents' => $contents,
    ];
}

function validate_webp_file(string $path): array
{
    if (!class_exists('finfo')) {
        fail('A extensão Fileinfo do PHP é necessária para validar imagens.', 500);
    }

    $size = filesize($path);
    if ($size === false || $size < 1 || $size > MAX_UPLOAD_BYTES) {
        fail('A imagem excede o limite de 5 MB ou está vazia.', 413);
    }

    $fileInfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $fileInfo->file($path);
    if ($mime !== 'image/webp') {
        fail('O arquivo enviado não é uma imagem WebP válida.', 415);
    }

    $imageInfo = getimagesize($path);
    if ($imageInfo === false || ($imageInfo['mime'] ?? '') !== 'image/webp') {
        fail('Não foi possível validar o conteúdo da imagem WebP.', 415);
    }
    if (
        $imageInfo[0] < 1 ||
        $imageInfo[1] < 1 ||
        $imageInfo[0] > MAX_IMAGE_DIMENSION ||
        $imageInfo[1] > MAX_IMAGE_DIMENSION
    ) {
        fail('A imagem excede as dimensões máximas de 1440 × 1440 pixels.', 413);
    }

    return $imageInfo;
}

function clean_expired_staging(string $stagingDirectory): void
{
    if (!is_dir($stagingDirectory) || !is_readable($stagingDirectory)) {
        return;
    }

    $entries = new DirectoryIterator($stagingDirectory);
    foreach ($entries as $entry) {
        if (
            $entry->isDot() ||
            !$entry->isFile() ||
            !preg_match('/\A[a-f0-9]{32}\.webp\z/', $entry->getFilename())
        ) {
            continue;
        }

        if ($entry->getMTime() < time() - 86400 && !@unlink($entry->getPathname())) {
            error_log('gallery api: failed to remove expired staged upload.');
        }
    }
}

function count_staged_uploads(string $stagingDirectory): int
{
    $count = 0;
    foreach (new DirectoryIterator($stagingDirectory) as $entry) {
        if (
            !$entry->isDot() &&
            $entry->isFile() &&
            preg_match('/\A[a-f0-9]{32}\.webp\z/', $entry->getFilename())
        ) {
            $count++;
        }
    }
    return $count;
}

function handle_upload(string $stagingDirectory): array
{
    if (
        count($_FILES) !== 1 ||
        count($_POST) !== 1 ||
        ($_POST['action'] ?? null) !== 'upload' ||
        !isset($_FILES['image']) ||
        !is_array($_FILES['image'])
    ) {
        fail('Selecione uma imagem WebP para enviar.', 400);
    }

    $file = $_FILES['image'];
    $uploadError = $file['error'] ?? UPLOAD_ERR_NO_FILE;
    if (!is_int($uploadError) || $uploadError !== UPLOAD_ERR_OK) {
        $status = in_array($uploadError, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
            ? 413
            : 400;
        fail('O envio da imagem falhou. Verifique o limite de upload do PHP e tente novamente.', $status);
    }
    if (
        !isset($file['tmp_name']) ||
        !is_string($file['tmp_name']) ||
        !is_uploaded_file($file['tmp_name'])
    ) {
        fail('O arquivo recebido não é um upload válido.', 400);
    }

    validate_webp_file($file['tmp_name']);
    if (!is_dir($stagingDirectory) || !is_writable($stagingDirectory)) {
        fail('A pasta privada de preparação não está gravável pelo PHP.', 500);
    }
    if (count_staged_uploads($stagingDirectory) >= MAX_STAGED_UPLOADS) {
        fail('O limite de imagens aguardando publicação foi atingido.', 429);
    }

    try {
        $uploadId = bin2hex(random_bytes(16));
    } catch (Throwable $error) {
        error_log('gallery api: secure random generator failed.');
        fail('Não foi possível gerar um identificador seguro para a imagem.', 500);
    }

    $destination = $stagingDirectory . '/' . $uploadId . '.webp';
    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        fail('Não foi possível guardar a imagem temporária.', 500);
    }
    if (!chmod($destination, 0600)) {
        if (!@unlink($destination)) {
            error_log('gallery api: could not remove staged upload after permission failure.');
        }
        fail('Não foi possível proteger a imagem temporária.', 500);
    }

    return ['uploadId' => $uploadId];
}

function collect_gallery_asset_paths(array $galleries): array
{
    $paths = [];
    foreach ($galleries as $gallery) {
        foreach ($gallery['images'] as $image) {
            foreach (['src', 'fullSrc'] as $key) {
                if (isset($image[$key])) {
                    $paths[$image[$key]] = true;
                }
            }
        }
    }
    return $paths;
}

function copy_staged_image(string $source, string $assetDirectory): string
{
    validate_webp_file($source);
    $sourceHandle = fopen($source, 'rb');
    if ($sourceHandle === false) {
        fail('Não foi possível ler uma imagem preparada para publicação.', 500);
    }

    for ($attempt = 0; $attempt < 5; $attempt++) {
        try {
            $fileName = 'gallery-' . bin2hex(random_bytes(16)) . '.webp';
        } catch (Throwable $error) {
            fclose($sourceHandle);
            fail('Não foi possível gerar um nome seguro para a imagem.', 500);
        }

        $destination = $assetDirectory . '/' . $fileName;
        $destinationHandle = @fopen($destination, 'x+b');
        if ($destinationHandle === false) {
            continue;
        }

        rewind($sourceHandle);
        $copied = stream_copy_to_stream($sourceHandle, $destinationHandle);
        $flushed = fflush($destinationHandle);
        fclose($destinationHandle);
        if ($copied === false || !$flushed || $copied !== filesize($source)) {
            fclose($sourceHandle);
            if (!@unlink($destination)) {
                error_log('gallery api: could not remove an incomplete published image.');
            }
            fail('Não foi possível copiar uma imagem para a pasta pública.', 500);
        }
        fclose($sourceHandle);
        if (!chmod($destination, 0644)) {
            if (!@unlink($destination)) {
                error_log('gallery api: could not remove an image after permission failure.');
            }
            fail('Não foi possível definir as permissões de uma imagem publicada.', 500);
        }

        return 'assets/gallery/' . $fileName;
    }

    fclose($sourceHandle);
    fail('Não foi possível reservar um nome exclusivo para a imagem.', 500);
}

function write_published_json(string $json, string $publishDirectory, string $destination): void
{
    if (!is_dir($publishDirectory) || !is_writable($publishDirectory)) {
        fail('A pasta privada de publicação não está gravável pelo PHP.', 500);
    }
    if (!is_writable(dirname($destination)) || !is_writable($destination)) {
        fail('A pasta data/ ou o arquivo de galerias não está gravável pelo PHP.', 500);
    }

    $temporaryPath = tempnam($publishDirectory, 'galleries-');
    if ($temporaryPath === false) {
        fail('Não foi possível criar o arquivo temporário de publicação.', 500);
    }

    try {
        $written = file_put_contents($temporaryPath, $json, LOCK_EX);
        if ($written !== strlen($json)) {
            fail('A gravação temporária do JSON foi incompleta.', 500);
        }
        if (!chmod($temporaryPath, 0644)) {
            fail('Não foi possível definir as permissões do JSON temporário.', 500);
        }
        if (!rename($temporaryPath, $destination)) {
            fail('Não foi possível substituir o JSON publicado; a versão anterior foi mantida.', 500);
        }
    } finally {
        if (is_file($temporaryPath) && !@unlink($temporaryPath)) {
            error_log('gallery api: could not remove a temporary galleries file.');
        }
    }
}

function publish_galleries(
    $payload,
    string $root,
    string $galleriesPath,
    string $stagingDirectory,
    string $assetDirectory,
    string $publishDirectory
): array {
    if (
        !is_object($payload) ||
        !isset($payload->revision) ||
        !is_string($payload->revision) ||
        !preg_match('/\A[a-f0-9]{64}\z/', $payload->revision) ||
        !isset($payload->galleries)
    ) {
        fail('Os dados de publicação estão incompletos ou inválidos.', 400);
    }

    $lockPath = $publishDirectory . '/publish.lock';
    $lock = @fopen($lockPath, 'c');
    if ($lock === false) {
        fail('Não foi possível abrir o bloqueio de publicação.', 500);
    }
    if (!chmod($lockPath, 0600)) {
        fclose($lock);
        fail('Não foi possível proteger o bloqueio de publicação.', 500);
    }
    if (!flock($lock, LOCK_EX)) {
        fclose($lock);
        fail('Não foi possível obter o bloqueio de publicação.', 500);
    }

    $createdAssets = [];
    $committed = false;
    try {
        $current = read_published($galleriesPath, $root);
        if (!hash_equals($current['revision'], $payload->revision)) {
            fail('As galerias publicadas mudaram desde que o painel foi carregado. Recarregue o painel antes de publicar.', 409);
        }

        $galleries = validate_galleries($payload->galleries, $root, true);
        if (!is_dir($assetDirectory) || !is_writable($assetDirectory)) {
            fail('A pasta assets/gallery/ não está gravável pelo PHP.', 500);
        }

        $stagedIds = [];
        foreach ($galleries as &$gallery) {
            foreach ($gallery['images'] as &$image) {
                if (!isset($image['uploadId'])) {
                    continue;
                }

                $uploadId = $image['uploadId'];
                if (isset($stagedIds[$uploadId])) {
                    fail('Uma imagem preparada foi referenciada mais de uma vez.', 422);
                }
                $stagedIds[$uploadId] = true;
                $stagedPath = $stagingDirectory . '/' . $uploadId . '.webp';
                if (!is_file($stagedPath) || is_link($stagedPath)) {
                    fail('Uma imagem preparada expirou ou não está disponível. Tente publicar novamente.', 422);
                }

                $publishedPath = copy_staged_image($stagedPath, $assetDirectory);
                $createdAssets[] = $root . '/' . $publishedPath;
                $image = [
                    'src' => $publishedPath,
                    'fullSrc' => $publishedPath,
                    'alt' => $image['alt'],
                ];
            }
            unset($image);
        }
        unset($gallery);

        $json = json_encode(
            $galleries,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
        ) . "\n";
        write_published_json($json, $publishDirectory, $galleriesPath);
        $committed = true;

        $warnings = [];
        $newAssetPaths = collect_gallery_asset_paths($galleries);
        $galleryFiles = glob($assetDirectory . '/gallery-*.webp');
        foreach ($galleryFiles === false ? [] : $galleryFiles as $galleryFile) {
            $fileName = basename($galleryFile);
            if (!preg_match('/\Agallery-[a-f0-9]{32}\.webp\z/', $fileName) || is_link($galleryFile)) {
                continue;
            }
            $relativePath = 'assets/gallery/' . $fileName;
            if (!isset($newAssetPaths[$relativePath]) && is_file($galleryFile) && !unlink($galleryFile)) {
                $warnings[] = 'A publicação foi concluída, mas uma imagem removida não pôde ser apagada.';
                error_log('gallery api: could not remove an obsolete gallery image.');
            }
        }

        foreach (array_keys($stagedIds) as $uploadId) {
            $stagedPath = $stagingDirectory . '/' . $uploadId . '.webp';
            if (is_file($stagedPath) && !unlink($stagedPath)) {
                $warnings[] = 'A publicação foi concluída, mas um arquivo temporário não pôde ser removido.';
                error_log('gallery api: could not remove a consumed staged upload.');
            }
        }

        return [
            'galleries' => $galleries,
            'revision' => hash('sha256', $json),
            'warnings' => $warnings,
        ];
    } catch (Throwable $error) {
        if (!$committed) {
            clearstatcache(true);
            foreach ($createdAssets as $assetPath) {
                if (is_file($assetPath) && !@unlink($assetPath)) {
                    error_log('gallery api: could not roll back a newly published image.');
                }
            }
        }
        throw $error;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function read_request_json(): object
{
    $contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
    if ($contentLength > MAX_REQUEST_BYTES) {
        fail('A solicitação excede o limite de tamanho permitido.', 413);
    }

    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') !== 0) {
        fail('O envio de publicação deve usar application/json.', 415);
    }

    $body = file_get_contents('php://input', false, null, 0, MAX_REQUEST_BYTES + 1);
    if ($body === false || strlen($body) > MAX_REQUEST_BYTES) {
        fail('Não foi possível ler a solicitação de publicação ou ela excede o limite permitido.', 413);
    }

    try {
        $payload = json_decode($body, false, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        fail('O JSON de publicação está malformado.', 400);
    }
    if (!is_object($payload)) {
        fail('O corpo da solicitação deve ser um objeto JSON.', 400);
    }

    return $payload;
}

$root = dirname(__DIR__);
$galleriesPath = $root . '/data/galleries.json';
$stagingDirectory = __DIR__ . '/.publish-staging';
$assetDirectory = $root . '/assets/gallery';
$publishDirectory = $root . '/data/.publish';

try {
    require_authenticated_user();
    $contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
    if ($contentLength > MAX_REQUEST_BYTES) {
        fail('A solicitação excede o limite de tamanho permitido.', 413);
    }
    clean_expired_staging($stagingDirectory);

    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if ($method === 'GET') {
        $published = read_published($galleriesPath, $root);
        respond([
            'galleries' => $published['galleries'],
            'revision' => $published['revision'],
        ]);
    }

    if ($method !== 'POST') {
        header('Allow: GET, POST');
        fail('Método não permitido.', 405);
    }
    require_same_origin_request();

    $action = $_POST['action'] ?? '';
    if ($action === 'upload') {
        respond(handle_upload($stagingDirectory), 201);
    }
    if ($action !== '') {
        fail('Ação de API desconhecida.', 400);
    }

    $payload = read_request_json();
    if (($payload->action ?? '') !== 'publish') {
        fail('Ação de API desconhecida.', 400);
    }

    $result = publish_galleries(
        $payload,
        $root,
        $galleriesPath,
        $stagingDirectory,
        $assetDirectory,
        $publishDirectory
    );
    respond($result);
} catch (GalleryApiException $error) {
    respond(['error' => $error->getMessage()], $error->status);
} catch (Throwable $error) {
    error_log('gallery api: unexpected failure: ' . $error->getMessage());
    respond(['error' => 'Falha inesperada na API. Nenhuma publicação foi confirmada.'], 500);
}
