-- =======================================================
-- E-Bucket Database Schema Definition (College Project)
-- Database Name: e_bucket
-- Safe Reference File for Git (NO Real Personal Data or Passwords)
-- =======================================================

CREATE DATABASE IF NOT EXISTS `e_bucket`;
USE `e_bucket`;

-- 1. USERR Table (Customers)
CREATE TABLE IF NOT EXISTS `userr` (
    `USER_ID` INT PRIMARY KEY,
    `Name` VARCHAR(50),
    `PASS` VARCHAR(50),
    `DOB` DATE,
    `EMAIL` VARCHAR(50),
    `PHONE_NO` BIGINT NOT NULL,
    `ADDRESS` VARCHAR(50)
);

-- 2. CATEGORY Table
CREATE TABLE IF NOT EXISTS `category` (
    `CATEGORY_ID` INT PRIMARY KEY,
    `NAME` VARCHAR(50)
);

-- 3. PRODUCT Table
CREATE TABLE IF NOT EXISTS `product` (
    `PRODUCT_ID` INT PRIMARY KEY,
    `NAME` VARCHAR(50),
    `PRICE` DECIMAL(10,2), 
    `STOCK` INT,
    `DETAILS` VARCHAR(200),  
    `CATEGORY_ID` INT,       
    FOREIGN KEY (`CATEGORY_ID`) REFERENCES `category`(`CATEGORY_ID`)
);

-- 4. ORDERS Table
CREATE TABLE IF NOT EXISTS `orders` (
    `ORDER_ID` INT PRIMARY KEY,
    `ORDER_DATE` DATE,
    `STATUS` VARCHAR(20),
    `TOTAL` DECIMAL(10, 2),
    `USER_ID` INT,
    FOREIGN KEY (`USER_ID`) REFERENCES `userr`(`USER_ID`)
);

-- 5. ORDER_ITEM Table
CREATE TABLE IF NOT EXISTS `order_item` (
    `ORDER_ITEM_ID` INT PRIMARY KEY,
    `QUANTITY` INT,
    `SUBTOTAL` DECIMAL(10,2),
    `ORDER_ID` INT,
    `PRODUCT_ID` INT,
    FOREIGN KEY (`ORDER_ID`) REFERENCES `orders`(`ORDER_ID`),
    FOREIGN KEY (`PRODUCT_ID`) REFERENCES `product`(`PRODUCT_ID`)
);

-- 6. PAYMENT Table
CREATE TABLE IF NOT EXISTS `payment` (
    `RECEIPT_NO` INT PRIMARY KEY,
    `METHOD` VARCHAR(50),
    `STATUS` VARCHAR(20),
    `PAYMENT_DATE` DATE,     
    `ORDER_ID` INT,          
    FOREIGN KEY (`ORDER_ID`) REFERENCES `orders`(`ORDER_ID`)
); 

-- 7. DELIVERY Table
CREATE TABLE IF NOT EXISTS `delivery` (
    `SHIPMENT_ID` INT PRIMARY KEY,
    `DELIVERY_DATE` DATE,
    `SHIPMENT_NAME` VARCHAR(50) NOT NULL,	
    `ORDER_ID` INT,          
    FOREIGN KEY (`ORDER_ID`) REFERENCES `orders`(`ORDER_ID`)
);

-- =======================================================
-- TRIGGERS
-- =======================================================

DELIMITER //

-- Trigger 1: Reduce stock when order_item is inserted
CREATE TRIGGER IF NOT EXISTS `reduce_stock_after_insert` 
AFTER INSERT ON `order_item` 
FOR EACH ROW 
BEGIN
    UPDATE `product` 
    SET `STOCK` = `STOCK` - NEW.`QUANTITY` 
    WHERE `PRODUCT_ID` = NEW.`PRODUCT_ID`;
END //

-- Trigger 2: Restore stock if order_item is deleted
CREATE TRIGGER IF NOT EXISTS `restore_stock_after_delete` 
AFTER DELETE ON `order_item` 
FOR EACH ROW 
BEGIN
    UPDATE `product` 
    SET `STOCK` = `STOCK` + OLD.`QUANTITY` 
    WHERE `PRODUCT_ID` = OLD.`PRODUCT_ID`;
END //

-- Trigger 3: Sync order status when payment is successful
CREATE TRIGGER IF NOT EXISTS `sync_order_status_after_update` 
AFTER UPDATE ON `payment` 
FOR EACH ROW 
BEGIN
    IF NEW.`STATUS` = 'Success' AND OLD.`STATUS` != 'Success' THEN
        UPDATE `orders` 
        SET `STATUS` = 'Paid' 
        WHERE `ORDER_ID` = NEW.`ORDER_ID`;
    END IF;
END //

DELIMITER ;

