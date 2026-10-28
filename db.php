<?php
/**
 * Shared helpers: database connection and JSON in/out.
 * Included by orders.php and settings.php.
 */
declare(strict_types=1);

require __DIR__ . '/config.php';

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
    return mb_substr(trim((string) ($value ?? '')), 0, $max);
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
