PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_redeemed_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`discord_id` text NOT NULL,
	`redeemed_at` text DEFAULT CURRENT_TIMESTAMP,
	`status` text,
	`loot_detail` text,
	`is_public` integer DEFAULT 0,
	`expires_at` text,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
DELETE FROM `redeemed_codes` WHERE `discord_id` IS NULL;--> statement-breakpoint
INSERT INTO `__new_redeemed_codes`("id", "code", "discord_id", "redeemed_at", "status", "loot_detail", "is_public", "expires_at") SELECT "id", "code", "discord_id", "redeemed_at", "status", "loot_detail", "is_public", "expires_at" FROM `redeemed_codes`;--> statement-breakpoint
DROP TABLE `redeemed_codes`;--> statement-breakpoint
ALTER TABLE `__new_redeemed_codes` RENAME TO `redeemed_codes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `redeemed_codes_code_discord_id_unique` ON `redeemed_codes` (`code`,`discord_id`);