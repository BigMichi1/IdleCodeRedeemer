CREATE TABLE `users` (
	`discord_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_hash` text NOT NULL,
	`server` text,
	`instance_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discord_id` text,
	`action` text NOT NULL,
	`details` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `redeemed_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`discord_id` text,
	`redeemed_at` text DEFAULT CURRENT_TIMESTAMP,
	`status` text,
	`loot_detail` text,
	`is_public` integer DEFAULT 0,
	`expires_at` text,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `redeemed_codes_code_unique` ON `redeemed_codes` (`code`);--> statement-breakpoint
CREATE TABLE `backfill_operations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`initiated_by` text NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	`codes_found` integer DEFAULT 0 NOT NULL,
	`codes_redeemed` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pending_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`discord_id` text,
	`found_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action
);
