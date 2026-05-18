CREATE TABLE `behavioral_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`event_id` int,
	`event_type` varchar(50) NOT NULL,
	`scan_time_ms` int,
	`error_type` varchar(100),
	`ip_address` varchar(45),
	`timezone` varchar(50),
	`language` varchar(10),
	`device_type` varchar(50),
	`user_agent` text,
	`metadata` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `behavioral_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`start_time` timestamp NOT NULL,
	`end_time` timestamp,
	`location` varchar(255),
	`capacity` int,
	`total_tickets` int NOT NULL DEFAULT 0,
	`scanned_tickets` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `offline_sync_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`event_id` int NOT NULL,
	`ticket_id` int NOT NULL,
	`action` varchar(50) NOT NULL,
	`payload` text NOT NULL,
	`status` enum('pending','synced','failed') NOT NULL DEFAULT 'pending',
	`sync_attempts` int NOT NULL DEFAULT 0,
	`last_sync_attempt` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `offline_sync_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scan_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_id` int NOT NULL,
	`scan_date` timestamp NOT NULL,
	`total_scans` int NOT NULL DEFAULT 0,
	`valid_scans` int NOT NULL DEFAULT 0,
	`duplicate_scans` int NOT NULL DEFAULT 0,
	`invalid_scans` int NOT NULL DEFAULT 0,
	`avg_scan_time_ms` int NOT NULL DEFAULT 0,
	`peak_scan_time` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scan_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scan_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticket_id` int NOT NULL,
	`event_id` int NOT NULL,
	`scanned_by` int NOT NULL,
	`scanned_at` timestamp NOT NULL DEFAULT (now()),
	`scan_location` varchar(255),
	`device_type` varchar(50),
	`ip_address` varchar(45),
	`offline_sync_status` enum('pending','synced','conflict') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scan_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_id` int NOT NULL,
	`ticket_number` varchar(100) NOT NULL,
	`qr_code_data` varchar(500) NOT NULL,
	`customer_name` varchar(255) NOT NULL,
	`customer_email` varchar(255),
	`status` enum('pending','confirmed','used','cancelled') NOT NULL DEFAULT 'pending',
	`is_used` int NOT NULL DEFAULT 0,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `tickets_ticket_number_unique` UNIQUE(`ticket_number`),
	CONSTRAINT `tickets_qr_code_data_unique` UNIQUE(`qr_code_data`)
);
