<?php
/**
 * Settings API (currently only the currency symbol).
 *
 *   GET  api/settings.php  -> {"currency": "$"}
 *   POST api/settings.php  -> body {"currency": "₱"}
 */
declare(strict_types=1);

require __DIR__ . '/db.php';

try {
    $pdo = db();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
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
    error_log('settings.php: ' . $e->getMessage());
    json_out(['error' => 'Database error'], 500);
}
