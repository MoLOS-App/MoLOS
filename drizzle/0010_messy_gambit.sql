PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ai_mcp_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`uri` text NOT NULL,
	`module_id` text,
	`description` text NOT NULL,
	`resource_type` text CHECK(resource_type IN ('static', 'url')) DEFAULT 'static' NOT NULL,
	`url` text,
	`mime_type` text DEFAULT 'application/json',
	`metadata` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_ai_mcp_resources`("id", "user_id", "name", "uri", "module_id", "description", "resource_type", "url", "mime_type", "metadata", "enabled", "created_at", "updated_at") SELECT "id", "user_id", "name", "uri", "module_id", "description", 'static', NULL, "mime_type", "metadata", "enabled", "created_at", "updated_at" FROM `ai_mcp_resources`;--> statement-breakpoint
DROP TABLE `ai_mcp_resources`;--> statement-breakpoint
ALTER TABLE `__new_ai_mcp_resources` RENAME TO `ai_mcp_resources`;--> statement-breakpoint
PRAGMA foreign_keys=ON;