CREATE TABLE `ai_mcp_oauth_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`client_secret` text,
	`redirect_uris` text NOT NULL,
	`scopes` text,
	`grant_types` text NOT NULL,
	`token_endpoint_auth_method` text DEFAULT 'none' NOT NULL,
	`status` text CHECK(status IN ('active', 'disabled', 'revoked')) DEFAULT 'active' NOT NULL,
	`client_secret_expires_at` integer,
	`client_uri` text,
	`logo_uri` text,
	`contacts` text,
	`tos_uri` text,
	`policy_uri` text,
	`software_id` text,
	`software_version` text,
	`issued_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_mcp_oauth_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`scopes` text NOT NULL,
	`code_challenge` text NOT NULL,
	`code_challenge_method` text DEFAULT 'S256' NOT NULL,
	`state` text,
	`resource` text,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `ai_mcp_oauth_clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_mcp_oauth_codes_code_unique` ON `ai_mcp_oauth_codes` (`code`);--> statement-breakpoint
CREATE TABLE `ai_mcp_oauth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text NOT NULL,
	`token_type` text CHECK(token_type IN ('access', 'refresh')) DEFAULT 'access' NOT NULL,
	`token` text NOT NULL,
	`scopes` text NOT NULL,
	`expires_at` integer,
	`refresh_token_id` text,
	`revoked_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `ai_mcp_oauth_clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`refresh_token_id`) REFERENCES `ai_mcp_oauth_tokens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_mcp_oauth_tokens_token_unique` ON `ai_mcp_oauth_tokens` (`token`);