ALTER TABLE `settings_external_modules` ADD `retry_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings_external_modules` ADD `last_retry_at` integer;