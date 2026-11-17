<?php
/**
 * DELETE api/orders/delete.php?id=XYZ -> delete one order.
 */
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_password();

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    header('Allow: DELETE');
    json_out(['error' => 'Use DELETE on this endpoint'], 405);
}

try {
    delete_order(db(), clean_str($_GET['id'] ?? '', 40));
    json_out(['ok' => true]);
} catch (InvalidArgumentException $e) {
    json_out(['error' => $e->getMessage()], 422);
} catch (PDOException $e) {
    db_error('orders/delete.php', $e);
}
