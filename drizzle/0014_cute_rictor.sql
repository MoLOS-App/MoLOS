PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings_external_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`repo_url` text NOT NULL,
	`status` text CHECK(status IN ('pending', 'active', 'error_manifest', 'error_migration', 'error_config', 'error_build', 'disabled', 'deleting')) DEFAULT 'pending' NOT NULL,
	`git_ref` text DEFAULT 'main' NOT NULL,
	`block_updates` integer DEFAULT false NOT NULL,
	`last_error` text,
	`error_details` text,
	`error_type` text,
	`recovery_steps` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`last_retry_at` integer,
	`installed_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_settings_external_modules`("id", "repo_url", "status", "git_ref", "block_updates", "last_error", "error_details", "error_type", "recovery_steps", "retry_count", "last_retry_at", "installed_at", "updated_at") SELECT "id", "repo_url", "status", "git_ref", "block_updates", "last_error", "error_details", "error_type", "recovery_steps", "retry_count", "last_retry_at", "installed_at", "updated_at" FROM `settings_external_modules`;--> statement-breakpoint
DROP TABLE `settings_external_modules`;--> statement-breakpoint
ALTER TABLE `__new_settings_external_modules` RENAME TO `settings_external_modules`;--> statement-breakpoint
PRAGMA foreign_keys=ON;