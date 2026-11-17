<?php
/**
 * Reading and writing orders: the JSON shape the page uses, mapped onto the
 * orders / customers / order_measurements / order_materials tables.
 */
declare(strict_types=1);

const ORDER_STATUSES = ['New', 'Measured', 'Sewing', 'Fitting', 'Ready', 'Picked up'];

/** Load orders (all, or one when $id is given) in the shape the page uses. */
function fetch_orders(PDO $pdo, ?string $id = null): array
{
    $where = $id !== null ? 'WHERE o.id = :id' : '';
    $params = $id !== null ? [':id' => $id] : [];

    $stmt = $pdo->prepare(
        "SELECT o.*, c.name AS c_name, c.phone AS c_phone, c.email AS c_email, c.address AS c_address
           FROM orders o
           JOIN customers c ON c.id = o.customer_id
           $where
          ORDER BY o.received_date DESC, o.id DESC"
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $measures  = group_children($pdo, 'order_measurements', 'label, value', $id);
    $materials = group_children($pdo, 'order_materials', 'name, qty, cost', $id);

    $orders = [];
    foreach ($rows as $r) {
        $orders[] = [
            'id'          => $r['id'],
            'no'          => $r['order_no'],
            'createdAt'   => $r['received_date'],
            'updatedAt'   => (int) (strtotime($r['updated_at']) * 1000),
            'status'      => $r['status'],
            'cancelled'   => (bool) $r['is_cancelled'],
            'cancelledAt' => $r['cancelled_at'] ?? '',
            'customer'    => [
                'name'    => $r['c_name'],
                'phone'   => $r['c_phone'],
                'email'   => $r['c_email'],
                'address' => $r['c_address'],
            ],
            'type'        => $r['type'],
            'item'        => $r['item'],
            'due'         => $r['due_date'] ?? '',
            'unit'        => $r['unit'],
            'measures'    => $measures[$r['id']] ?? [],
            'adjustments' => $r['adjustments'] ?? '',
            'materials'   => array_map(
                fn($m) => ['name' => $m['name'], 'qty' => $m['qty'], 'cost' => (float) $m['cost']],
                $materials[$r['id']] ?? []
            ),
            'fee'         => (float) $r['fee'],
            'deposit'     => (float) $r['deposit'],
            'sample'      => (bool) $r['is_sample'],
        ];
    }
    return $orders;
}

/** Child rows (measurements or materials) grouped by order id, in sort order. */
function group_children(PDO $pdo, string $table, string $columns, ?string $id): array
{
    $sql = "SELECT order_id, $columns FROM $table"
        . ($id !== null ? ' WHERE order_id = :id' : '')
        . ' ORDER BY order_id, sort_order';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($id !== null ? [':id' => $id] : []);

    $grouped = [];
    foreach ($stmt->fetchAll() as $row) {
        $key = $row['order_id'];
        unset($row['order_id']);
        $grouped[$key][] = $row;
    }
    return $grouped;
}

/** Validate the posted order, write it in one transaction and return the saved copy. */
function save_order(PDO $pdo, array $in): array
{
    $id = clean_str($in['id'] ?? '', 40);
    if (!preg_match('/^[A-Za-z0-9_-]{1,40}$/', $id)) {
        throw new InvalidArgumentException('Missing or invalid order id');
    }

    $status = $in['status'] ?? 'New';
    if (!in_array($status, ORDER_STATUSES, true)) {
        throw new InvalidArgumentException('Unknown status');
    }

    $unit      = ($in['unit'] ?? 'cm') === 'in' ? 'in' : 'cm';
    $cust      = is_array($in['customer'] ?? null) ? $in['customer'] : [];
    $cancelled = !empty($in['cancelled']);

    $pdo->beginTransaction();
    try {
        $current = customer_id_of($pdo, $id);

        $name    = clean_str($cust['name'] ?? '', 120);
        $phone   = clean_str($cust['phone'] ?? '', 40);
        $email   = clean_str($cust['email'] ?? '', 120);
        $address = clean_str($cust['address'] ?? '', 300);

        if ($current) {
            $customerId = (int) $current['customer_id'];
            $pdo->prepare('UPDATE customers SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?')
                ->execute([$name, $phone, $email, $address, $customerId]);
        } else {
            $customerId = find_or_create_customer($pdo, $name, $phone, $email, $address);
        }

        $orderNo = clean_str($in['no'] ?? '', 20);
        if ($current) {
            $orderNo = $current['order_no'];
        } elseif ($orderNo === '' || order_no_taken($pdo, $orderNo)) {
            $orderNo = next_order_no($pdo);
        }

        $fields = [
            'order_no'      => $orderNo,
            'customer_id'   => $customerId,
            'type'          => clean_str($in['type'] ?? 'Other', 40),
            'item'          => clean_str($in['item'] ?? '', 200),
            'received_date' => clean_date($in['createdAt'] ?? '') ?? date('Y-m-d'),
            'due_date'      => clean_date($in['due'] ?? ''),
            'status'        => $status,
            'is_cancelled'  => $cancelled ? 1 : 0,
            'cancelled_at'  => $cancelled ? (clean_date($in['cancelledAt'] ?? '') ?? date('Y-m-d')) : null,
            'unit'          => $unit,
            'adjustments'   => clean_str($in['adjustments'] ?? '', 5000),
            'fee'           => clean_money($in['fee'] ?? 0),
            'deposit'       => clean_money($in['deposit'] ?? 0),
            'is_sample'     => !empty($in['sample']) ? 1 : 0,
        ];

        if ($current) {
            $set  = implode(', ', array_map(fn($k) => "$k = :$k", array_keys($fields)));
            $stmt = $pdo->prepare("UPDATE orders SET $set WHERE id = :id");
        } else {
            $cols = implode(', ', array_keys($fields));
            $vals = implode(', ', array_map(fn($k) => ":$k", array_keys($fields)));
            $stmt = $pdo->prepare("INSERT INTO orders (id, $cols) VALUES (:id, $vals)");
        }
        $stmt->execute($fields + ['id' => $id]);

        replace_children($pdo, $id, $in);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    return fetch_orders($pdo, $id)[0];
}

/** Rewrite the measurement and material rows of one order. */
function replace_children(PDO $pdo, string $orderId, array $in): void
{
    $pdo->prepare('DELETE FROM order_measurements WHERE order_id = ?')->execute([$orderId]);
    $pdo->prepare('DELETE FROM order_materials WHERE order_id = ?')->execute([$orderId]);

    $insM = $pdo->prepare('INSERT INTO order_measurements (order_id, sort_order, label, value) VALUES (?, ?, ?, ?)');
    foreach (array_slice(array_values($in['measures'] ?? []), 0, 60) as $i => $m) {
        if (!is_array($m)) {
            continue;
        }
        $label = clean_str($m['label'] ?? '', 60);
        $value = clean_str($m['value'] ?? '', 20);
        if ($label === '' && $value === '') {
            continue;
        }
        $insM->execute([$orderId, $i, $label, $value]);
    }

    $insT = $pdo->prepare('INSERT INTO order_materials (order_id, sort_order, name, qty, cost) VALUES (?, ?, ?, ?, ?)');
    foreach (array_slice(array_values($in['materials'] ?? []), 0, 60) as $i => $m) {
        if (!is_array($m)) {
            continue;
        }
        $name = clean_str($m['name'] ?? '', 120);
        $qty  = clean_str($m['qty'] ?? '', 30);
        $cost = clean_money($m['cost'] ?? 0);
        if ($name === '' && $qty === '' && $cost == 0.0) {
            continue;
        }
        $insT->execute([$orderId, $i, $name, $qty, $cost]);
    }
}

/** Delete an order. Its measurements and materials go with it (ON DELETE CASCADE). */
function delete_order(PDO $pdo, string $id): void
{
    if ($id === '') {
        throw new InvalidArgumentException('Missing order id');
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM orders WHERE id = ?')->execute([$id]);
        // Drop customers that no longer have any order.
        $pdo->exec('DELETE FROM customers WHERE NOT EXISTS (SELECT 1 FROM orders WHERE orders.customer_id = customers.id)');
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}
