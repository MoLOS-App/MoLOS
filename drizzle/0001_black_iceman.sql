PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ai_memories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`importance` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_ai_memories`("id", "user_id", "content", "importance", "created_at", "updated_at") SELECT "id", "user_id", "content", "importance", "created_at", "updated_at" FROM `ai_memories`;--> statement-breakpoint
DROP TABLE `ai_memories`;--> statement-breakpoint
ALTER TABLE `__new_ai_memories` RENAME TO `ai_memories`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_ai_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_ai_sessions`("id", "user_id", "title", "created_at", "updated_at") SELECT "id", "user_id", "title", "created_at", "updated_at" FROM `ai_sessions`;--> statement-breakpoint
DROP TABLE `ai_sessions`;--> statement-breakpoint
ALTER TABLE `__new_ai_sessions` RENAME TO `ai_sessions`;--> statement-breakpoint
CREATE TABLE `__new_ai_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text CHECK(provider IN ('openai', 'anthropic', 'ollama', 'openrouter')) DEFAULT 'openai' NOT NULL,
	`api_key` text,
	`model_name` text DEFAULT 'gpt-4o' NOT NULL,
	`system_prompt` text,
	`base_url` text,
	`temperature` real,
	`top_p` real,
	`max_tokens` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_ai_settings`("id", "user_id", "provider", "api_key", "model_name", "system_prompt", "base_url", "temperature", "top_p", "max_tokens", "created_at", "updated_at") SELECT "id", "user_id", "provider", "api_key", "model_name", "system_prompt", "base_url", "temperature", "top_p", "max_tokens", "created_at", "updated_at" FROM `ai_settings`;--> statement-breakpoint
DROP TABLE `ai_settings`;--> statement-breakpoint
ALTER TABLE `__new_ai_settings` RENAME TO `ai_settings`;--> statement-breakpoint
CREATE TABLE `__new_ai_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`role` text CHECK(role IN ('user', 'assistant', 'system', 'tool')) NOT NULL,
	`content` text NOT NULL,
	`context_metadata` text,
	`tool_call_id` text,
	`tool_calls` text,
	`attachments` text,
	`parts` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `ai_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_ai_messages`("id", "user_id", "session_id", "role", "content", "context_metadata", "tool_call_id", "tool_calls", "attachments", "parts", "created_at") SELECT "id", "user_id", "session_id", "role", "content", "context_metadata", "tool_call_id", "tool_calls", "attachments", "parts", "created_at" FROM `ai_messages`;--> statement-breakpoint
DROP TABLE `ai_messages`;--> statement-breakpoint
ALTER TABLE `__new_ai_messages` RENAME TO `ai_messages`;