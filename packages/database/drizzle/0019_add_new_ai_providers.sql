-- Migration 0019: Add new AI providers (Groq, DeepSeek, Google, Mistral, Moonshot, xAI, MiniMax)
-- to the ai_settings table by recreating it with updated CHECK constraint

-- Step 1: Create new table with expanded provider CHECK constraint
CREATE TABLE IF NOT EXISTS `__new_ai_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text CHECK(provider IN ('openai', 'anthropic', 'ollama', 'openrouter', 'zai', 'groq', 'deepseek', 'google', 'mistral', 'moonshot', 'xai', 'minimax')) DEFAULT 'openai' NOT NULL,
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
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);

--> statement-breakpoint

-- Step 2: Copy data from old table to new table
INSERT INTO `__new_ai_settings`("id", "user_id", "provider", "api_key", "model_name", "system_prompt", "base_url", "temperature", "top_p", "max_tokens", "stream_enabled", "created_at", "updated_at") 
SELECT "id", "user_id", "provider", "api_key", "model_name", "system_prompt", "base_url", "temperature", "top_p", "max_tokens", "stream_enabled", "created_at", "updated_at" FROM `ai_settings`;

--> statement-breakpoint

-- Step 3: Drop old table
DROP TABLE IF EXISTS `ai_settings`;

--> statement-breakpoint

-- Step 4: Rename new table to original name
ALTER TABLE `__new_ai_settings` RENAME TO `ai_settings`;

--> statement-breakpoint

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS `idx_ai_settings_user_id` ON `ai_settings` (`user_id`);

--> statement-breakpoint

-- Rollback: Restore original table
-- CREATE TABLE IF NOT EXISTS `__old_ai_settings` (
-- 	`id` text PRIMARY KEY NOT NULL,
-- 	`user_id` text NOT NULL,
-- 	`provider` text CHECK(provider IN ('openai', 'anthropic', 'ollama', 'openrouter', 'zai')) DEFAULT 'openai' NOT NULL,
-- 	`api_key` text,
-- 	`model_name` text DEFAULT 'gpt-4o' NOT NULL,
-- 	`system_prompt` text,
-- 	`base_url` text,
-- 	`temperature` real,
-- 	`top_p` real,
-- 	`max_tokens` integer,
-- 	`stream_enabled` integer DEFAULT true NOT NULL,
-- 	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
-- 	`updated_at` integer NOT NULL,
-- 	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
-- );
-- INSERT INTO `__old_ai_settings` SELECT * FROM `ai_settings`;
-- DROP TABLE `ai_settings`;
-- ALTER TABLE `__old_ai_settings` RENAME TO `ai_settings`;