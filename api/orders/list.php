<?php
/**
 * GET api/orders/list.php -> every order, with customer, measurements and materials.
 */
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_password();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    json_out(['error' => 'Use GET on this endpoint'], 405);
}

try {
    json_out(fetch_orders(db()));
} catch (PDOException $e) {
    db_error('orders/list.php', $e);
}
