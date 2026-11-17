<?php
/**
 * Shop-facing order numbers: T-0001, T-0002, ...
 */
declare(strict_types=1);

function order_no_taken(PDO $pdo, string $no): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM orders WHERE order_no = ?');
    $stmt->execute([$no]);
    return (bool) $stmt->fetchColumn();
}

/** The highest number in use, plus one. */
function next_order_no(PDO $pdo): string
{
    $max = (int) $pdo->query(
        'SELECT COALESCE(MAX(CAST(SUBSTRING(order_no, 3) AS UNSIGNED)), 0) FROM orders'
    )->fetchColumn();
    return 'T-' . str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
}
