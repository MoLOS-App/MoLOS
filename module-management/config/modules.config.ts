/**
 * Module Navigation Configuration
 *
 * DEPRECATED: Use ./modules/index.ts for new code
 * This file is maintained for backward compatibility only.
 * Each module now has its own folder with standardized config.
 *
 * See:
 * - ./modules/dashboard/config.ts
 * - ./modules/tasks/config.ts
 */

// Re-export for backward compatibility
export {
	getAllModules as getAvailableModules,
	getModuleNavigation,
	getModuleByPath as getModuleConfig
} from './index';
