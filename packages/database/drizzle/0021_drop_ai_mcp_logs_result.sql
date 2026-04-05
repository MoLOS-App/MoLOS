-- Migration 0021: Drop ai_mcp_logs.result column
-- Module: core
-- Created: 2026-03-27
-- Reason: The result column stores full JSON responses (~412 MB) and is not needed for debugging
-- Effect: Reduces ai_mcp_logs table from ~412 MB to ~2 MB

-- Step 1: Create new table without the result column
CREATE TABLE IF NOT EXISTS `__new_ai_mcp_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`api_key_id` text,
	`session_id` text NOT NULL,
	`request_id` text NOT NULL,
	`method` text NOT NULL,
	`tool_name` text,
	`resource_name` text,
	`prompt_name` text,
	`params` text,
	`error_message` text,
	`status` text CHECK(status IN ('success', 'error')) NOT NULL,
	`duration_ms` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	FOREIGN KEY (`api_key_id`) REFERENCES `ai_mcp_api_keys`(`id`) ON DELETE SET NULL
);

--> statement-breakpoint

-- Step 2: Copy data from old table to new table (excluding result column)
INSERT INTO `__new_ai_mcp_logs`(
	"id", "user_id", "api_key_id", "session_id", "request_id", 
	"method", "tool_name", "resource_name", "prompt_name", 
	"params", "error_message", "status", "duration_ms", "created_at"
) 
SELECT 
	"id", "user_id", "api_key_id", "session_id", "request_id", 
	"method", "tool_name", "resource_name", "prompt_name", 
	"params", "error_message", "status", "duration_ms", "created_at" 
FROM `ai_mcp_logs`;

--> statement-breakpoint

-- Step 3: Drop old table
DROP TABLE IF EXISTS `ai_mcp_logs`;

--> statement-breakpoint

-- Step 4: Rename new table to original name
ALTER TABLE `__new_ai_mcp_logs` RENAME TO `ai_mcp_logs`;

--> statement-breakpoint

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS `idx_ai_mcp_logs_user_id` ON `ai_mcp_logs` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_ai_mcp_logs_created_at` ON `ai_mcp_logs` (`created_at`);

--> statement-breakpoint

-- Rollback: Restore the result column
-- Note: This rollback will NOT recover the lost data - result column data is permanently deleted
-- CREATE TABLE IF NOT EXISTS `__old_ai_mcp_logs` (
-- 	`id` text PRIMARY KEY NOT NULL,
-- 	`user_id` text NOT NULL,
-- 	`api_key_id` text,
-- 	`session_id` text NOT NULL,
-- 	`request_id` text NOT NULL,
-- 	`method` text NOT NULL,
-- 	`tool_name` text,
-- 	`resource_name` text,
-- 	`prompt_name` text,
-- 	`params` text,
-- 	`result` text,
-- 	`error_message` text,
-- 	`status` text CHECK(status IN ('success', 'error', 'pending')) NOT NULL,
-- 	`duration_ms` integer,
-- 	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
-- 	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
-- 	FOREIGN KEY (`api_key_id`) REFERENCES `ai_mcp_api_keys`(`id`) ON DELETE SET NULL
-- );
-- INSERT INTO `__old_ai_mcp_logs` SELECT * FROM `ai_mcp_logs`;
-- DROP TABLE `ai_mcp_logs`;
-- ALTER TABLE `__old_ai_mcp_logs` RENAME TO `ai_mcp_logs`;
-- CREATE INDEX IF NOT EXISTS `idx_ai_mcp_logs_user_id` ON `ai_mcp_logs` (`user_id`);
