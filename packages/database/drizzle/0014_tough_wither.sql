ALTER TABLE `ai_mcp_api_keys` ADD `allowed_scopes` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_mcp_api_keys` DROP COLUMN `allowed_modules`;--> statement-breakpoint
ALTER TABLE `ai_mcp_prompts` ADD `submodule_id` text;--> statement-breakpoint
ALTER TABLE `ai_mcp_prompts` ADD `prompt_name` text;--> statement-breakpoint
ALTER TABLE `ai_mcp_resources` ADD `submodule_id` text;--> statement-breakpoint
ALTER TABLE `ai_mcp_resources` ADD `resource_name` text;