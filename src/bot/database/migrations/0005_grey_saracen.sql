ALTER TABLE `users` ADD `dm_on_code` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `dm_on_success` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `dm_on_failure` integer DEFAULT false NOT NULL;