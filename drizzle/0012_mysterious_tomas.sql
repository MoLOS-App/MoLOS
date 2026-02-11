PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ai_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text CHECK(provider IN ('openai', 'anthropic', 'ollama', 'openrouter', 'zai')) DEFAULT 'openai' NOT NULL,
	`api_key` text,
	`model_name` text DEFAULT 'gpt-4o' NOT NULL,
	`system_prompt` text,
	`base_url` text,
	`temperature` real,
	`top_p` real,
	`max_tokens` integer,
	`stream_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_ai_settings`("id", "user_id", "provider", "api_key", "model_name", "system_prompt", "base_url", "temperature", "top_p", "max_tokens", "stream_enabled", "created_at", "updated_at") SELECT "id", "user_id", "provider", "api_key", "model_name", "system_prompt", "base_url", "temperature", "top_p", "max_tokens", "stream_enabled", "created_at", "updated_at" FROM `ai_settings`;--> statement-breakpoint
DROP TABLE `ai_settings`;--> statement-breakpoint
ALTER TABLE `__new_ai_settings` RENAME TO `ai_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;