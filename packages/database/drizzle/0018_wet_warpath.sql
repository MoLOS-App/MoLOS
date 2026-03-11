CREATE TABLE `core_module_migrations` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`migration_name` text NOT NULL,
	`applied_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`checksum` text,
	`rolled_back_at` integer,
	`rollback_sql` text
);
--> statement-breakpoint
CREATE TABLE `molos_migrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`migration_name` text NOT NULL,
	`module` text NOT NULL,
	`version` integer NOT NULL,
	`checksum` text NOT NULL,
	`applied_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`execution_time_ms` integer NOT NULL,
	`success` integer NOT NULL,
	`rollback_available` integer NOT NULL,
	`sql_content` text,
	`error_message` text
);
--> statement-breakpoint
CREATE INDEX `idx_migrations_module_version` ON `molos_migrations` (`module`,`version`);--> statement-breakpoint
CREATE INDEX `idx_migrations_name` ON `molos_migrations` (`migration_name`);--> statement-breakpoint
CREATE INDEX `idx_migrations_module` ON `molos_migrations` (`module`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings_external_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`repo_url` text NOT NULL,
	`status` text CHECK(status IN ('pending', 'active', 'error_manifest', 'error_migration', 'error_config', 'disabled', 'deleting')) DEFAULT 'pending' NOT NULL,
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
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `ai_mcp_api_keys` ADD `allowed_scopes` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_mcp_api_keys` DROP COLUMN `allowed_modules`;--> statement-breakpoint
ALTER TABLE `ai_mcp_prompts` ADD `submodule_id` text;--> statement-breakpoint
ALTER TABLE `ai_mcp_prompts` ADD `prompt_name` text;--> statement-breakpoint
ALTER TABLE `ai_mcp_resources` ADD `submodule_id` text;--> statement-breakpoint
ALTER TABLE `ai_mcp_resources` ADD `resource_name` text;