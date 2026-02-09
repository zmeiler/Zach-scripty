CREATE TABLE `cashDrawers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`openingBalance` decimal(10,2) DEFAULT 0,
	`closingBalance` decimal(10,2),
	`expectedTotal` decimal(10,2),
	`variance` decimal(10,2),
	`status` enum('open','reconciled','closed') NOT NULL DEFAULT 'open',
	`notes` text,
	`openedAt` datetime NOT NULL,
	`closedAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cashDrawers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comboItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`comboId` int NOT NULL,
	`menuItemId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`displayOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comboItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `combos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(150) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`imageUrl` text,
	`isAvailable` boolean NOT NULL DEFAULT true,
	`displayOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `combos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(20) NOT NULL,
	`firstName` varchar(100),
	`lastName` varchar(100),
	`email` varchar(320),
	`loyaltyPoints` decimal(15,2) NOT NULL DEFAULT 0,
	`totalSpent` decimal(15,2) NOT NULL DEFAULT 0,
	`visitCount` int NOT NULL DEFAULT 0,
	`lastVisit` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `dailySales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` datetime NOT NULL,
	`totalOrders` int DEFAULT 0,
	`totalRevenue` decimal(10,2) DEFAULT 0,
	`totalTax` decimal(10,2) DEFAULT 0,
	`totalDiscount` decimal(10,2) DEFAULT 0,
	`cashSales` decimal(10,2) DEFAULT 0,
	`cardSales` decimal(10,2) DEFAULT 0,
	`loyaltyPointsIssued` decimal(15,2) DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dailySales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`employeeId` varchar(50) NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`phone` varchar(20),
	`email` varchar(320),
	`position` enum('cashier','kitchen_staff','manager','owner') NOT NULL,
	`hourlyRate` decimal(10,2),
	`isActive` boolean NOT NULL DEFAULT true,
	`hireDate` datetime NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `employees_employeeId_unique` UNIQUE(`employeeId`)
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(150) NOT NULL,
	`sku` varchar(50) NOT NULL,
	`description` text,
	`unit` varchar(50) NOT NULL,
	`quantity` decimal(15,2) NOT NULL DEFAULT 0,
	`minimumLevel` decimal(15,2) DEFAULT 0,
	`maximumLevel` decimal(15,2),
	`unitCost` decimal(10,2),
	`reorderPoint` decimal(15,2),
	`reorderQuantity` decimal(15,2),
	`lastRestockDate` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `inventoryTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inventoryId` int NOT NULL,
	`type` enum('usage','adjustment','restock','return','damage') NOT NULL,
	`quantity` decimal(15,2) NOT NULL,
	`reason` text,
	`employeeId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `itemModifiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`menuItemId` int NOT NULL,
	`modifierId` int NOT NULL,
	`displayOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `itemModifiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `menuCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`displayOrder` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `menuCategories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `menuItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`name` varchar(150) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`cost` decimal(10,2),
	`imageUrl` text,
	`isAvailable` boolean NOT NULL DEFAULT true,
	`prepTime` int,
	`displayOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `menuItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `modifierOptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modifierId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`priceAdjustment` decimal(10,2) DEFAULT 0,
	`displayOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `modifierOptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `modifiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`isRequired` boolean DEFAULT false,
	`displayOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `modifiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`menuItemId` int,
	`comboId` int,
	`quantity` int NOT NULL DEFAULT 1,
	`price` decimal(10,2) NOT NULL,
	`modifiers` json,
	`notes` text,
	`status` enum('pending','preparing','ready','served','cancelled') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(50) NOT NULL,
	`customerId` int,
	`employeeId` int,
	`tableId` int,
	`orderType` enum('dine_in','takeout','delivery') NOT NULL,
	`status` enum('pending','confirmed','preparing','ready','completed','cancelled') NOT NULL DEFAULT 'pending',
	`subtotal` decimal(10,2) NOT NULL,
	`tax` decimal(10,2) DEFAULT 0,
	`discount` decimal(10,2) DEFAULT 0,
	`total` decimal(10,2) NOT NULL,
	`loyaltyPointsEarned` decimal(15,2) DEFAULT 0,
	`loyaltyPointsUsed` decimal(15,2) DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` datetime,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`method` enum('cash','card','digital_wallet','split') NOT NULL,
	`status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`stripePaymentIntentId` varchar(255),
	`stripeTransactionId` varchar(255),
	`reference` varchar(100),
	`employeeId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`receiptNumber` varchar(50) NOT NULL,
	`pdfUrl` text,
	`emailSent` boolean DEFAULT false,
	`emailSentAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `receipts_receiptNumber_unique` UNIQUE(`receiptNumber`)
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`startTime` datetime NOT NULL,
	`endTime` datetime,
	`breakMinutes` int DEFAULT 0,
	`totalHours` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shifts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `splitPayments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`paymentIndex` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`method` enum('cash','card','digital_wallet') NOT NULL,
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`stripePaymentIntentId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `splitPayments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tableNumber` varchar(50) NOT NULL,
	`capacity` int NOT NULL,
	`location` varchar(100),
	`status` enum('available','occupied','reserved','dirty') NOT NULL DEFAULT 'available',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tables_id` PRIMARY KEY(`id`),
	CONSTRAINT `tables_tableNumber_unique` UNIQUE(`tableNumber`)
);
--> statement-breakpoint
CREATE TABLE `topItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` datetime NOT NULL,
	`menuItemId` int,
	`comboId` int,
	`quantity` int DEFAULT 0,
	`revenue` decimal(10,2) DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `topItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','manager','cashier','kitchen') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);