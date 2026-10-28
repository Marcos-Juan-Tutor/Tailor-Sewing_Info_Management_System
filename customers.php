<?php
/**
 * Customers. Repeat customers share one row, matched on name and phone.
 */
declare(strict_types=1);

/** Reuse a customer with the same name and phone, otherwise add one. */
function find_or_create_customer(PDO $pdo, string $name, string $phone, string $email, string $address): int
{
    if ($phone !== '' && $name !== '') {
        $stmt = $pdo->prepare('SELECT id FROM customers WHERE name = ? AND phone = ? LIMIT 1');
        $stmt->execute([$name, $phone]);
        $found = $stmt->fetchColumn();
        if ($found) {
            $pdo->prepare('UPDATE customers SET email = ?, address = ? WHERE id = ?')
                ->execute([$email, $address, $found]);
            return (int) $found;
        }
    }

    $pdo->prepare('INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)')
        ->execute([$name, $phone, $email, $address]);
    return (int) $pdo->lastInsertId();
}

/** The customer row of one order, or null. */
function customer_id_of(PDO $pdo, string $orderId): ?array
{
    $stmt = $pdo->prepare('SELECT customer_id, order_no FROM orders WHERE id = ?');
    $stmt->execute([$orderId]);
    $row = $stmt->fetch();
    return $row ?: null;
}
