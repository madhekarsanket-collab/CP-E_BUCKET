USE e_bucket;

SHOW TABLES;
SELECT *
FROM orders
ORDER BY ORDER_ID DESC
LIMIT 5;

SELECT *
FROM order_item
ORDER BY ORDER_ITEM_ID DESC
LIMIT 10;

SELECT PRODUCT_ID, NAME, STOCK
FROM product
ORDER BY PRODUCT_ID;

SELECT 'userr' AS table_name, COUNT(*) AS total FROM userr
UNION ALL
SELECT 'category', COUNT(*) FROM category
UNION ALL
SELECT 'product', COUNT(*) FROM product
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'order_item', COUNT(*) FROM order_item
UNION ALL
SELECT 'payment', COUNT(*) FROM payment
UNION ALL
SELECT 'delivery', COUNT(*) FROM delivery;

select * from userr;

USE e_bucket;

SELECT
    o.ORDER_ID,
    u.NAME AS CUSTOMER,
    u.EMAIL,
    o.STATUS AS ORDER_STATUS,
    o.TOTAL,
    p.NAME AS PRODUCT,
    oi.QUANTITY,
    oi.SUBTOTAL,
    pr.STOCK AS CURRENT_STOCK,
    pay.METHOD AS PAYMENT_METHOD,
    pay.STATUS AS PAYMENT_STATUS,
    d.SHIPMENT_ID
FROM orders o
JOIN userr u ON o.USER_ID = u.USER_ID
JOIN order_item oi ON o.ORDER_ID = oi.ORDER_ID
JOIN product p ON oi.PRODUCT_ID = p.PRODUCT_ID
LEFT JOIN product pr ON pr.PRODUCT_ID = oi.PRODUCT_ID
LEFT JOIN payment pay ON pay.ORDER_ID = o.ORDER_ID
LEFT JOIN delivery d ON d.ORDER_ID = o.ORDER_ID
ORDER BY o.ORDER_ID DESC;