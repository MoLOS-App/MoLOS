/**
 * Utility for namespacing module tables to avoid conflicts
 * when multiple modules might use similar table names.
 */
/**
 * Converts a module name to a table prefix
 * Example: "MoLOS-Product-Owner" -> "product_owner_"
 */
export declare function getTablePrefix(moduleName: string): string;
/**
 * Creates a namespaced table name
 * Example: namespaceTableName("MoLOS-Product-Owner", "projects") -> "product_owner_projects"
 */
export declare function namespaceTableName(moduleName: string, tableName: string): string;
/**
 * Schema for module table creation with automatic namespacing
 */
export declare function createModuleTableSchema<T extends Record<string, unknown>>(_moduleName: string, tables: T): T;
/**
 * List of reserved table names that shouldn't be namespaced
 */
export declare const RESERVED_TABLE_NAMES: readonly ["user", "session", "account", "verification", "apikey", "ai_settings", "ai_sessions", "ai_messages", "ai_memories", "telegram_settings", "telegram_sessions", "telegram_messages", "ai_mcp_api_keys", "ai_mcp_logs", "ai_mcp_resources", "ai_mcp_prompts", "ai_mcp_oauth_clients", "ai_mcp_oauth_codes", "ai_mcp_oauth_tokens", "settings_user", "settings_modules", "settings_external_modules", "settings_server_logs", "settings_system", "migrations", "_journal"];
/**
 * Check if a table name should be namespaced
 */
export declare function shouldNamespace(tableName: string): boolean;
//# sourceMappingURL=namespace.d.ts.map