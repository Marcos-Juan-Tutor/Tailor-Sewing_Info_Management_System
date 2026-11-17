<?php
/**
 * Database connection, the shop password, and small helpers for reading and
 * writing JSON safely.
 */
declare(strict_types=1);

/** One PDO connection per request. All queries use prepared statements. */
function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

/**
 * Ask the browser for the shared shop password (HTTP Basic auth).
 * A no-op when APP_PASSWORD is empty.
 */
function require_password(): void
{
    if (APP_PASSWORD === '') {
        return;
    }

    $pass = $_SERVER['PHP_AUTH_PW'] ?? '';

    // Some PHP setups only forward the raw Authorization header.
    $header = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if ($pass === '' && stripos($header, 'Basic ') === 0) {
        $decoded = base64_decode(substr($header, 6), true);
        if (is_string($decoded) && strpos($decoded, ':') !== false) {
            [, $pass] = explode(':', $decoded, 2);
        }
    }

    if (is_string($pass) && $pass !== '' && hash_equals(APP_PASSWORD, $pass)) {
        return;
    }

    header('WWW-Authenticate: Basic realm="Tailor Order Book", charset="UTF-8"');
    json_out(['error' => 'Password required. Reload the page and enter the shop password.'], 401);
}

/** Send a JSON response and stop. */
function json_out($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Read the request body as a JSON object, or answer 400. */
function json_in(): array
{
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($data)) {
        json_out(['error' => 'Request body must be a JSON object'], 400);
    }
    return $data;
}

/** Trim a value to a string of at most $max characters. */
function clean_str($value, int $max): string
{
    $s = trim((string) ($value ?? ''));
    if (function_exists('mb_substr')) {
        return mb_substr($s, 0, $max);
    }
    return substr($s, 0, $max);
}

/** A non-negative money amount with two decimals. */
function clean_money($value): float
{
    $n = is_numeric($value) ? (float) $value : 0.0;
    return round(max(0.0, min($n, 99999999.99)), 2);
}

/** A Y-m-d date string, or null when empty or invalid. */
function clean_date($value): ?string
{
    $s = trim((string) ($value ?? ''));
    $d = DateTime::createFromFormat('Y-m-d', $s);
    return ($d && $d->format('Y-m-d') === $s) ? $s : null;
}

/** Turn a database failure into a JSON error the page can show. */
function db_error(string $where, PDOException $e): void
{
    error_log($where . ': ' . $e->getMessage());
    json_out([
        'error' => 'Database error. Check api/config.php, and that sql/schema.sql has been imported.',
    ], 500);
}
