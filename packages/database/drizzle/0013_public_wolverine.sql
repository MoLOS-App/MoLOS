CREATE TABLE `core_module_migrations` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`migration_name` text NOT NULL,
	`applied_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`checksum` text,
	`rolled_back_at` integer,
	`rollback_sql` text
);
