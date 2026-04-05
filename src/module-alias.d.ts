/**
 * TypeScript declarations for the $module alias.
 *
 * This alias allows modules to import their own internal modules without
 * fragile relative paths.
 *
 * Usage:
 * - `$module/server/repositories/task-repository` → module's src/server/repositories/task-repository
 * - `$module/lib/models/index` → module's src/lib/models/index
 * - `$module/server/database/schema` → module's src/server/database/schema
 *
 * The path is resolved dynamically based on which module is importing.
 */

declare module '$module/server/*' {
	// This is a virtual module resolved by the moduleAliasPlugin in vite.config.ts
	// The actual exports depend on the file being imported
	const value: unknown;
	export default value;
}

declare module '$module/lib/*' {
	// This is a virtual module resolved by the moduleAliasPlugin in vite.config.ts
	// The actual exports depend on the file being imported
	const value: unknown;
	export default value;
}

declare module '$module/models/*' {
	// This is a virtual module resolved by the moduleAliasPlugin in vite.config.ts
	// The actual exports depend on the file being imported
	const value: unknown;
	export default value;
}

declare module '$module/*' {
	// Catch-all for any other $module imports
	// This is a virtual module resolved by the moduleAliasPlugin in vite.config.ts
	// The actual exports depend on the file being imported
	const value: unknown;
	export default value;
}
