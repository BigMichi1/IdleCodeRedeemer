CREATE TABLE `loot_totals` (
	`loot_key` text NOT NULL,
	`loot_type` text NOT NULL,
	`scope` text NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`loot_key`, `scope`)
);
