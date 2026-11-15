-- =======================================================
-- One-time upgrade for a database created from the ORIGINAL schema.sql.
-- Run with:  python backend/init_db.py --migrate
-- (that also re-runs schema.sql afterwards, which recreates the triggers.)
-- Run it once. It keeps every existing row. It fails loudly, without losing data, if
-- existing rows break a new rule (duplicate emails, non-positive prices, negative stock).
-- =======================================================

USE `e_bucket`;

-- MySQL refuses to alter a key column that other tables reference unless checks are off.
-- The column types do not change, so the relationships stay valid.
SET FOREIGN_KEY_CHECKS = 0;

-- Auto-increment keys replace the racy "SELECT MAX(id)+1" in the API.
ALTER TABLE `userr`      MODIFY `USER_ID`       INT NOT NULL AUTO_INCREMENT;
ALTER TABLE `category`   MODIFY `CATEGORY_ID`   INT NOT NULL AUTO_INCREMENT;
ALTER TABLE `product`    MODIFY `PRODUCT_ID`    INT NOT NULL AUTO_INCREMENT;
ALTER TABLE `orders`     MODIFY `ORDER_ID`      INT NOT NULL AUTO_INCREMENT;
ALTER TABLE `order_item` MODIFY `ORDER_ITEM_ID` INT NOT NULL AUTO_INCREMENT;
ALTER TABLE `payment`    MODIFY `RECEIPT_NO`    INT NOT NULL AUTO_INCREMENT;
ALTER TABLE `delivery`   MODIFY `SHIPMENT_ID`   INT NOT NULL AUTO_INCREMENT;

-- Room for a real password hash (the old 50-char column forced a weak truncated hash).
ALTER TABLE `userr` MODIFY `PASS`    VARCHAR(255) NOT NULL;
ALTER TABLE `userr` MODIFY `Name`    VARCHAR(100) NOT NULL;
ALTER TABLE `userr` MODIFY `EMAIL`   VARCHAR(100) NOT NULL;
ALTER TABLE `userr` MODIFY `ADDRESS` VARCHAR(255);
ALTER TABLE `userr` ADD UNIQUE KEY `uq_userr_email` (`EMAIL`);

ALTER TABLE `category` MODIFY `NAME` VARCHAR(50) NOT NULL;
ALTER TABLE `category` ADD UNIQUE KEY `uq_category_name` (`NAME`);

ALTER TABLE `product` MODIFY `NAME`        VARCHAR(100) NOT NULL;
ALTER TABLE `product` MODIFY `PRICE`       DECIMAL(10,2) NOT NULL;
ALTER TABLE `product` MODIFY `STOCK`       INT NOT NULL DEFAULT 0;
ALTER TABLE `product` MODIFY `CATEGORY_ID` INT NOT NULL;
ALTER TABLE `product` ADD COLUMN `IMAGE_URL` VARCHAR(255) NULL;
ALTER TABLE `product` ADD CONSTRAINT `chk_product_price` CHECK (`PRICE` > 0);
ALTER TABLE `product` ADD CONSTRAINT `chk_product_stock` CHECK (`STOCK` >= 0);

ALTER TABLE `orders`     MODIFY `ORDER_DATE` DATE NOT NULL;
ALTER TABLE `orders`     MODIFY `STATUS`     VARCHAR(20) NOT NULL DEFAULT 'Pending';
ALTER TABLE `orders`     MODIFY `TOTAL`      DECIMAL(10,2) NOT NULL;
ALTER TABLE `orders`     MODIFY `USER_ID`    INT NOT NULL;
ALTER TABLE `order_item` MODIFY `QUANTITY`   INT NOT NULL;
ALTER TABLE `order_item` ADD CONSTRAINT `chk_order_item_qty` CHECK (`QUANTITY` > 0);
ALTER TABLE `payment`    MODIFY `STATUS`     VARCHAR(20) NOT NULL DEFAULT 'Pending';
ALTER TABLE `payment`    ADD UNIQUE KEY `uq_payment_order` (`ORDER_ID`);
ALTER TABLE `delivery`   ADD UNIQUE KEY `uq_delivery_order` (`ORDER_ID`);

SET FOREIGN_KEY_CHECKS = 1;
