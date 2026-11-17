<?php
/**
 * POST api/orders/save.php -> create or update one order.
 * The body is the same JSON shape the list endpoint returns, so the page can
 * send back exactly what it received.
 */
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_password();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    json_out(['error' => 'Use POST on this endpoint'], 405);
}

try {
    json_out(save_order(db(), json_in()));
} catch (InvalidArgumentException $e) {
    json_out(['error' => $e->getMessage()], 422);
} catch (PDOException $e) {
    db_error('orders/save.php', $e);
}
