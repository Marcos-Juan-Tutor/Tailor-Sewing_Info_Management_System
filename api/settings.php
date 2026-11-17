<?php
/**
 * The shop's saved settings (currently the currency symbol).
 *
 *   GET  api/settings.php -> {"currency": "$"}
 *   POST api/settings.php -> body {"currency": "₱"}
 */
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_password();

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET' && $method !== 'POST') {
    header('Allow: GET, POST');
    json_out(['error' => 'Use GET or POST on this endpoint'], 405);
}

try {
    $pdo = db();

    if ($method === 'POST') {
        $currency = clean_str(json_in()['currency'] ?? '$', 4);
        if ($currency === '') {
            $currency = '$';
        }
        $pdo->prepare(
            'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
        )->execute(['currency', $currency]);
    }

    $stmt = $pdo->prepare('SELECT setting_value FROM settings WHERE setting_key = ?');
    $stmt->execute(['currency']);
    json_out(['currency' => $stmt->fetchColumn() ?: '$']);
} catch (PDOException $e) {
    db_error('settings.php', $e);
}
