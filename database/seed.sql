-- =======================================================
-- E-Bucket DEMO data. Load into an empty database only:  python backend/init_db.py --seed
-- Do NOT load this in production: it creates known demo accounts.
-- Demo customer login:  demo@ebucket.in  /  Demo@1234   (all five customers share that password)
-- All emails use the reserved example.com domain and all phone numbers are fictional.
-- =======================================================

USE `e_bucket`;

INSERT INTO `userr` (`USER_ID`, `Name`, `PASS`, `DOB`, `EMAIL`, `PHONE_NO`, `ADDRESS`) VALUES
(1, 'Aarav Mehta',     'scrypt:32768:8:1$p125njyysbXutwho$b5a73b97a924ad6efa2c31345a21874be8aa4de48e70d0b37f8676e9f23c44d49782ab4be2416f804b2d1afa2d02862d47b69fc0449f77f73c1d423aed5ad59f', '1996-03-14', 'aarav@example.com',  9876500001, '12 Linking Road, Bandra West, Mumbai 400050'),
(2, 'Priya Nair',      'scrypt:32768:8:1$p125njyysbXutwho$b5a73b97a924ad6efa2c31345a21874be8aa4de48e70d0b37f8676e9f23c44d49782ab4be2416f804b2d1afa2d02862d47b69fc0449f77f73c1d423aed5ad59f', '1999-11-02', 'priya@example.com',  9876500002, '48 MG Road, Indiranagar, Bengaluru 560038'),
(3, 'Rohan Deshmukh',  'scrypt:32768:8:1$p125njyysbXutwho$b5a73b97a924ad6efa2c31345a21874be8aa4de48e70d0b37f8676e9f23c44d49782ab4be2416f804b2d1afa2d02862d47b69fc0449f77f73c1d423aed5ad59f', '1994-07-21', 'rohan@example.com',  9876500003, '7 FC Road, Shivajinagar, Pune 411005'),
(4, 'Sneha Kulkarni',  'scrypt:32768:8:1$p125njyysbXutwho$b5a73b97a924ad6efa2c31345a21874be8aa4de48e70d0b37f8676e9f23c44d49782ab4be2416f804b2d1afa2d02862d47b69fc0449f77f73c1d423aed5ad59f', '2001-01-30', 'sneha@example.com',  9876500004, '33 Sadashiv Peth, Pune 411030'),
(5, 'Demo Customer',   'scrypt:32768:8:1$p125njyysbXutwho$b5a73b97a924ad6efa2c31345a21874be8aa4de48e70d0b37f8676e9f23c44d49782ab4be2416f804b2d1afa2d02862d47b69fc0449f77f73c1d423aed5ad59f', '2000-01-01', 'demo@ebucket.in',    9876500005, '101 Demo Heights, Koregaon Park, Pune 411001');

INSERT INTO `category` (`CATEGORY_ID`, `NAME`) VALUES
(1, 'Electronics'),
(2, 'Musical Instruments'),
(3, 'Fitness'),
(4, 'Gaming'),
(5, 'Wearables'),
(6, 'Home & Kitchen'),
(7, 'Books & Stationery'),
(8, 'Fashion');

INSERT INTO `product` (`PRODUCT_ID`, `NAME`, `PRICE`, `STOCK`, `DETAILS`, `CATEGORY_ID`, `IMAGE_URL`) VALUES
(1,  'Wireless Noise-Cancelling Headphones', 7999.00, 40, 'Over-ear Bluetooth 5.3 headphones with active noise cancellation and 40 hours of battery life.', 1, '/products/1.jpg'),
(2,  'Portable Bluetooth Speaker',            2499.00, 65, 'Water-resistant 20W speaker with deep bass, 12 hour playtime and a built-in microphone.', 1, '/products/2.jpg'),
(3,  '10000 mAh Power Bank',                  1299.00, 120, 'Slim 22.5W fast-charging power bank with two USB-A ports and one USB-C port.', 1, '/products/3.jpg'),
(4,  '4K Action Camera',                      6499.00, 9,  'Waterproof 4K action camera with image stabilisation, wrist remote and mounting kit.', 1, '/products/4.jpg'),
(5,  'Mechanical Keyboard (Tenkeyless)',      3499.00, 28, 'Hot-swappable tenkeyless keyboard with tactile switches and warm white backlighting.', 1, '/products/5.jpg'),
(6,  'Acoustic Guitar (Dreadnought)',         8999.00, 14, 'Spruce-top dreadnought guitar with a rosewood fretboard, gig bag and spare strings included.', 2, '/products/6.jpg'),
(7,  '61-Key Portable Keyboard',              7499.00, 11, 'Touch-sensitive 61-key keyboard with 300 tones, USB MIDI and a sustain pedal.', 2, '/products/7.jpg'),
(8,  'Bamboo Flute in C Natural',              699.00, 70, 'Hand-tuned six-hole bamboo flute, ideal for beginners, with a cleaning rod.', 2, '/products/8.jpg'),
(9,  'Tabla Set with Cushions',               5499.00, 6,  'Sheesham wood dayan and brass bayan with leather straps, hammer and carry bag.', 2, '/products/9.jpg'),
(10, 'Ukulele Soprano',                       2799.00, 33, 'Mahogany soprano ukulele with nylon strings, tuner and padded bag.', 2, '/products/10.jpg'),
(11, 'Anti-Slip Yoga Mat 6mm',                 899.00, 150, 'Dense 6mm TPE yoga mat with alignment lines and a carry strap.', 3, '/products/11.jpg'),
(12, 'Adjustable Dumbbell Set (20 kg)',       3999.00, 22, 'Rubber-coated adjustable dumbbells with a quick-lock collar, set of two.', 3, '/products/12.jpg'),
(13, 'Resistance Bands (Set of 5)',            599.00, 200, 'Latex loop bands in five resistance levels with a mesh carry pouch.', 3, '/products/13.jpg'),
(14, 'Smart Skipping Rope',                    999.00, 3,  'Counts jumps and calories, with a memory-foam grip and a tangle-free steel cable.', 3, NULL),
(15, 'Foam Roller 45 cm',                      749.00, 0,  'High-density foam roller for muscle recovery and mobility work.', 3, '/products/15.jpg'),
(16, 'Wireless Gaming Mouse',                 2199.00, 55, '16000 DPI wireless mouse with six programmable buttons and 70 hours of battery.', 4, '/products/16.jpg'),
(17, 'Gaming Controller (Bluetooth)',         2999.00, 18, 'Dual-vibration Bluetooth controller compatible with PC, Android and iOS.', 4, '/products/17.jpg'),
(18, 'RGB Mouse Pad XL',                       799.00, 90, 'Extended 80 x 30 cm RGB mouse pad with a stitched edge and non-slip rubber base.', 4, '/products/18.jpg'),
(19, 'Gaming Headset with Mic',               3299.00, 7,  '7.1 surround headset with a detachable noise-cancelling microphone and memory-foam cushions.', 4, '/products/19.jpg'),
(20, 'Fitness Smartwatch',                    4999.00, 36, 'AMOLED smartwatch with heart-rate and SpO2 tracking, GPS and a 10 day battery.', 5, '/products/20.jpg'),
(21, 'Fitness Band',                          1999.00, 80, 'Slim band with sleep tracking, 14 sport modes and a 5 ATM water rating.', 5, '/products/21.jpg'),
(22, 'Wireless Earbuds',                      2999.00, 4,  'True wireless earbuds with a 30 hour charging case, low-latency mode and IPX5 rating.', 5, '/products/22.jpg'),
(23, 'Stainless Steel Water Bottle 1L',        799.00, 110, 'Double-wall vacuum insulated bottle that keeps drinks cold for 24 hours or hot for 12.', 6, '/products/23.jpg'),
(24, 'Non-Stick Cookware Set (3 pc)',         2599.00, 25, 'Induction-friendly tawa, kadhai and frying pan with cool-touch handles.', 6, '/products/24.jpg'),
(25, 'Electric Kettle 1.5L',                  1199.00, 48, 'Stainless steel kettle with auto shut-off and boil-dry protection.', 6, '/products/25.jpg'),
(26, 'Aroma Diffuser with LED Light',         1499.00, 2,  'Ultrasonic diffuser with seven colour LED modes and an auto-off timer.', 6, '/products/26.jpg'),
(27, 'Hardcover Notebook (A5, Dotted)',        349.00, 180, '192 pages of 100 gsm paper with a ribbon marker and an elastic closure.', 7, '/products/27.jpg'),
(28, 'Fountain Pen with Ink Set',              999.00, 45, 'Brushed metal fountain pen with a medium nib and six ink cartridges.', 7, '/products/28.jpg'),
(29, 'Desk Organiser (Bamboo)',               1099.00, 30, 'Five-compartment bamboo organiser for pens, phone and sticky notes.', 7, '/products/29.jpg'),
(30, 'Classic Denim Jacket',                  2799.00, 17, 'Mid-weight cotton denim jacket with a regular fit and brass buttons.', 8, '/products/30.jpg'),
(31, 'Canvas Backpack 25L',                   1899.00, 42, 'Water-resistant canvas backpack with a padded laptop sleeve and leather accents.', 8, '/products/31.jpg'),
(32, 'Polarised Sunglasses',                  1299.00, 60, 'UV400 polarised lenses in a lightweight acetate frame, with a hard case.', 8, '/products/32.jpg');

-- Order history (dates are relative so the demo always looks recent).
-- Inserting order_item rows fires reduce_stock_after_insert, so stock above is the pre-order level.
INSERT INTO `orders` (`ORDER_ID`, `ORDER_DATE`, `STATUS`, `TOTAL`, `USER_ID`) VALUES
(1, CURDATE() - INTERVAL 21 DAY, 'Delivered',  10498.00, 1),
(2, CURDATE() - INTERVAL 14 DAY, 'Delivered',   4647.00, 2),
(3, CURDATE() - INTERVAL 9  DAY, 'Shipped',     8999.00, 3),
(4, CURDATE() - INTERVAL 6  DAY, 'Processing',  4999.00, 4),
(5, CURDATE() - INTERVAL 3  DAY, 'Paid',        6499.00, 5),
(6, CURDATE() - INTERVAL 2  DAY, 'Pending',     1998.00, 5),
(7, CURDATE() - INTERVAL 1  DAY, 'Paid',        5398.00, 2),
(8, CURDATE() - INTERVAL 11 DAY, 'Paid',        1299.00, 1);

INSERT INTO `order_item` (`ORDER_ITEM_ID`, `QUANTITY`, `SUBTOTAL`, `ORDER_ID`, `PRODUCT_ID`) VALUES
(1,  1, 7999.00, 1, 1),
(2,  1, 2499.00, 1, 2),
(3,  1, 3499.00, 2, 5),
(4,  1,  799.00, 2, 18),
(5,  1,  349.00, 2, 27),
(6,  1, 8999.00, 3, 6),
(7,  1, 4999.00, 4, 20),
(8,  1, 6499.00, 5, 4),
(9,  2, 1998.00, 6, 28),
(10, 1, 2599.00, 7, 24),
(11, 1, 2799.00, 7, 30),
(12, 1, 1299.00, 8, 3);

INSERT INTO `payment` (`RECEIPT_NO`, `METHOD`, `STATUS`, `PAYMENT_DATE`, `ORDER_ID`) VALUES
(1, 'UPI',               'Success', CURDATE() - INTERVAL 21 DAY, 1),
(2, 'Credit/Debit Card', 'Success', CURDATE() - INTERVAL 14 DAY, 2),
(3, 'Net Banking',       'Success', CURDATE() - INTERVAL 9  DAY, 3),
(4, 'UPI',               'Success', CURDATE() - INTERVAL 6  DAY, 4),
(5, 'Credit/Debit Card', 'Success', CURDATE() - INTERVAL 3  DAY, 5),
(6, 'Cash on Delivery',  'Pending', CURDATE() - INTERVAL 2  DAY, 6),
(7, 'UPI',               'Success', CURDATE() - INTERVAL 1  DAY, 7),
(8, 'UPI',               'Success', CURDATE() - INTERVAL 11 DAY, 8);

INSERT INTO `delivery` (`SHIPMENT_ID`, `DELIVERY_DATE`, `SHIPMENT_NAME`, `ORDER_ID`) VALUES
(1, CURDATE() - INTERVAL 17 DAY, 'BlueDart Express',  1),
(2, CURDATE() - INTERVAL 10 DAY, 'Delhivery Surface', 2),
(3, CURDATE() + INTERVAL 1  DAY, 'DTDC Priority',     3),
(4, CURDATE() - INTERVAL 2  DAY, 'BlueDart Express',  4),
(5, CURDATE() + INTERVAL 1  DAY, 'India Post EMS',    5),
(6, CURDATE() + INTERVAL 2  DAY, 'Delhivery Surface', 6),
(7, CURDATE() + INTERVAL 3  DAY, 'BlueDart Express',  7),
(8, CURDATE() - INTERVAL 7  DAY, 'DTDC Priority',     8);

-- Order 8 was placed, then cancelled by the customer: the UPDATE fires restore_stock_on_cancel.
UPDATE `orders` SET `STATUS` = 'Cancelled' WHERE `ORDER_ID` = 8;
