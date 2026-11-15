-- =======================================================
-- E-Bucket database schema (MySQL 8.0.16+)
-- Database: e_bucket
-- Safe to re-run: tables use IF NOT EXISTS, triggers are dropped and recreated.
-- No personal data lives in this file. Demo rows are in seed.sql.
-- Every statement ends with ';' on its own line end so init_db.py can split it.
-- =======================================================

CREATE DATABASE IF NOT EXISTS `e_bucket`;
USE `e_bucket`;

-- 1. USERR (customers). PASS holds a werkzeug scrypt hash (~170 chars).
CREATE TABLE IF NOT EXISTS `userr` (
    `USER_ID`  INT AUTO_INCREMENT PRIMARY KEY,
    `Name`     VARCHAR(100) NOT NULL,
    `PASS`     VARCHAR(255) NOT NULL,
    `DOB`      DATE,
    `EMAIL`    VARCHAR(100) NOT NULL,
    `PHONE_NO` BIGINT NOT NULL,
    `ADDRESS`  VARCHAR(255),
    UNIQUE KEY `uq_userr_email` (`EMAIL`)
);

-- 2. CATEGORY
CREATE TABLE IF NOT EXISTS `category` (
    `CATEGORY_ID` INT AUTO_INCREMENT PRIMARY KEY,
    `NAME`        VARCHAR(50) NOT NULL,
    UNIQUE KEY `uq_category_name` (`NAME`)
);

-- 3. PRODUCT. Stock can never go negative, even if two buyers race.
CREATE TABLE IF NOT EXISTS `product` (
    `PRODUCT_ID`  INT AUTO_INCREMENT PRIMARY KEY,
    `NAME`        VARCHAR(100) NOT NULL,
    `PRICE`       DECIMAL(10,2) NOT NULL,
    `STOCK`       INT NOT NULL DEFAULT 0,
    `DETAILS`     VARCHAR(200),
    `CATEGORY_ID` INT NOT NULL,
    `IMAGE_URL`   VARCHAR(255) NULL,
    CONSTRAINT `chk_product_price` CHECK (`PRICE` > 0),
    CONSTRAINT `chk_product_stock` CHECK (`STOCK` >= 0),
    FOREIGN KEY (`CATEGORY_ID`) REFERENCES `category`(`CATEGORY_ID`)
);

-- 4. ORDERS
CREATE TABLE IF NOT EXISTS `orders` (
    `ORDER_ID`   INT AUTO_INCREMENT PRIMARY KEY,
    `ORDER_DATE` DATE NOT NULL,
    `STATUS`     VARCHAR(20) NOT NULL DEFAULT 'Pending',
    `TOTAL`      DECIMAL(10,2) NOT NULL,
    `USER_ID`    INT NOT NULL,
    FOREIGN KEY (`USER_ID`) REFERENCES `userr`(`USER_ID`)
);

-- 5. ORDER_ITEM
CREATE TABLE IF NOT EXISTS `order_item` (
    `ORDER_ITEM_ID` INT AUTO_INCREMENT PRIMARY KEY,
    `QUANTITY`      INT NOT NULL,
    `SUBTOTAL`      DECIMAL(10,2) NOT NULL,
    `ORDER_ID`      INT NOT NULL,
    `PRODUCT_ID`    INT NOT NULL,
    CONSTRAINT `chk_order_item_qty` CHECK (`QUANTITY` > 0),
    FOREIGN KEY (`ORDER_ID`) REFERENCES `orders`(`ORDER_ID`),
    FOREIGN KEY (`PRODUCT_ID`) REFERENCES `product`(`PRODUCT_ID`)
);

-- 6. PAYMENT
CREATE TABLE IF NOT EXISTS `payment` (
    `RECEIPT_NO`   INT AUTO_INCREMENT PRIMARY KEY,
    `METHOD`       VARCHAR(50) NOT NULL,
    `STATUS`       VARCHAR(20) NOT NULL DEFAULT 'Pending',
    `PAYMENT_DATE` DATE NOT NULL,
    `ORDER_ID`     INT NOT NULL,
    UNIQUE KEY `uq_payment_order` (`ORDER_ID`),   -- ER diagram: Order 1 --- 1 Payment
    FOREIGN KEY (`ORDER_ID`) REFERENCES `orders`(`ORDER_ID`)
);

-- 7. DELIVERY
CREATE TABLE IF NOT EXISTS `delivery` (
    `SHIPMENT_ID`   INT AUTO_INCREMENT PRIMARY KEY,
    `DELIVERY_DATE` DATE,
    `SHIPMENT_NAME` VARCHAR(50) NOT NULL,
    `ORDER_ID`      INT NOT NULL,
    UNIQUE KEY `uq_delivery_order` (`ORDER_ID`),  -- ER diagram: Order 1 --- 1 Delivery
    FOREIGN KEY (`ORDER_ID`) REFERENCES `orders`(`ORDER_ID`)
);

-- =======================================================
-- TRIGGERS (single-statement bodies, so no DELIMITER is needed)
-- =======================================================

DROP TRIGGER IF EXISTS `reduce_stock_after_insert`;
CREATE TRIGGER `reduce_stock_after_insert` AFTER INSERT ON `order_item`
FOR EACH ROW UPDATE `product` SET `STOCK` = `STOCK` - NEW.`QUANTITY` WHERE `PRODUCT_ID` = NEW.`PRODUCT_ID`;

DROP TRIGGER IF EXISTS `restore_stock_after_delete`;
CREATE TRIGGER `restore_stock_after_delete` AFTER DELETE ON `order_item`
FOR EACH ROW UPDATE `product` SET `STOCK` = `STOCK` + OLD.`QUANTITY` WHERE `PRODUCT_ID` = OLD.`PRODUCT_ID`;

-- Payment turns Success -> a still-Pending order becomes Paid.
-- Restricted to Pending so a later Delivered/Shipped order is never knocked back to Paid.
DROP TRIGGER IF EXISTS `sync_order_status_after_update`;
CREATE TRIGGER `sync_order_status_after_update` AFTER UPDATE ON `payment`
FOR EACH ROW UPDATE `orders` SET `STATUS` = 'Paid'
WHERE `ORDER_ID` = NEW.`ORDER_ID` AND `STATUS` = 'Pending' AND NEW.`STATUS` = 'Success' AND OLD.`STATUS` <> 'Success';

-- Cancelling an order puts its items back on the shelf.
DROP TRIGGER IF EXISTS `restore_stock_on_cancel`;
CREATE TRIGGER `restore_stock_on_cancel` AFTER UPDATE ON `orders`
FOR EACH ROW UPDATE `product` p JOIN `order_item` oi ON oi.`PRODUCT_ID` = p.`PRODUCT_ID`
SET p.`STOCK` = p.`STOCK` + oi.`QUANTITY`
WHERE oi.`ORDER_ID` = NEW.`ORDER_ID` AND NEW.`STATUS` = 'Cancelled' AND OLD.`STATUS` <> 'Cancelled';
