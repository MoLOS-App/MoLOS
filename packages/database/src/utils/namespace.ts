/**
 * Utility for namespacing module tables to avoid conflicts
 * when multiple modules might use similar table names.
 *
 * Table naming convention: MoLOS-{ModuleName}_{table_name}
 * Example: MoLOS-Finance_expenses, MoLOS-Tasks_tasks
 */

/**
 * Creates a namespaced table name following MoLOS convention
 * Example: namespaceTableName("MoLOS-Finance", "expenses") -> "MoLOS-Finance_expenses"
 * Example: namespaceTableName("MoLOS-Tasks", "tasks") -> "MoLOS-Tasks_tasks"
 */
export function namespaceTableName(moduleName: string, tableName: string): string {
	return `${moduleName}_${tableName}`;
}

/**
 * Schema for module table creation with automatic namespacing
 */
export function createModuleTableSchema<T extends Record<string, unknown>>(
	_moduleName: string,
	tables: T
): T {
	// The prefix is applied when defining individual tables
	// This function is kept for API compatibility
	return tables;
}

/**
 * List of reserved table names that shouldn't be namespaced
 */
export const RESERVED_TABLE_NAMES = [
	'user',
	'session',
	'account',
	'verification',
	'apikey',
	'ai_settings',
	'ai_sessions',
	'ai_messages',
	'ai_memories',
	'telegram_settings',
	'telegram_sessions',
	'telegram_messages',
	'ai_mcp_api_keys',
	'ai_mcp_logs',
	'ai_mcp_resources',
	'ai_mcp_prompts',
	'ai_mcp_oauth_clients',
	'ai_mcp_oauth_codes',
	'ai_mcp_oauth_tokens',
	'settings_user',
	'settings_modules',
	'settings_external_modules',
	'settings_server_logs',
	'settings_system',
	'migrations',
	'_journal'
] as const;

/**
 * Check if a table name should be namespaced
 */
export function shouldNamespace(tableName: string): boolean {
	return !RESERVED_TABLE_NAMES.includes(tableName as typeof RESERVED_TABLE_NAMES[number]);
}
