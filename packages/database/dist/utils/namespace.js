/**
 * Utility for namespacing module tables to avoid conflicts
 * when multiple modules might use similar table names.
 */
/**
 * Converts a module name to a table prefix
 * Example: "MoLOS-Product-Owner" -> "product_owner_"
 */
export function getTablePrefix(moduleName) {
    return moduleName
        .replace(/^MoLOS-/, '') // Remove MoLOS- prefix
        .replace(/-/g, '_') // Convert hyphens to underscores
        .toLowerCase() // Lowercase
        + '_'; // Add trailing underscore
}
/**
 * Creates a namespaced table name
 * Example: namespaceTableName("MoLOS-Product-Owner", "projects") -> "product_owner_projects"
 */
export function namespaceTableName(moduleName, tableName) {
    return getTablePrefix(moduleName) + tableName;
}
/**
 * Schema for module table creation with automatic namespacing
 */
export function createModuleTableSchema(_moduleName, tables) {
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
];
/**
 * Check if a table name should be namespaced
 */
export function shouldNamespace(tableName) {
    return !RESERVED_TABLE_NAMES.includes(tableName);
}
