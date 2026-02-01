ALTER TABLE `settings_external_modules` ADD `git_ref` text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings_external_modules` ADD `block_updates` integer DEFAULT false NOT NULL;