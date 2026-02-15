# Task 009: Module SDK with Typed Contracts

**Priority**: P2 (Medium)
**Effort**: Medium
**Impact**: Medium

## Problem

External modules have no clear API contract:
- Must reverse-engineer existing modules to understand patterns
- No type safety for module-to-core communication
- Easy to make mistakes in module structure
- No documentation for module developers

## Solution

Create a formal Module SDK with typed contracts, utilities, and documentation.

## SDK Structure

```
@molos/module-sdk/
├── src/
│   ├── index.ts              # Main exports
│   ├── types.ts              # All type definitions
│   ├── define-config.ts      # Config builder helper
│   ├── define-manifest.ts    # Manifest builder helper
│   ├── define-routes.ts      # Route definition helper
│   ├── hooks.ts              # Lifecycle hooks
│   ├── utils/
│   │   ├── db.ts             # Database utilities
│   │   ├── api.ts            # API helpers
│   │   └── ai.ts             # AI integration helpers
│   └── testing/
│       └── mock-module.ts    # Testing utilities
├── package.json
└── README.md
```

## Implementation

### 1. Type Definitions

```typescript
// @molos/module-sdk/src/types.ts

import type { ComponentType } from 'svelte';
import type { LucideIcon } from 'lucide-svelte';

/**
 * Module manifest - defines module metadata
 */
export interface ModuleManifest {
  /** Unique module ID (alphanumeric, hyphens, underscores) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version (e.g., "1.0.0") */
  version: string;
  /** Brief description */
  description?: string;
  /** Author name/email */
  author?: string;
  /** Lucide icon name */
  icon?: string;
  /** Minimum MoLOS version required */
  minMolosVersion?: string;
  /** Other modules this module depends on */
  dependencies?: Record<string, string>;
  /** Enable by default */
  enabled?: boolean;
}

/**
 * Navigation item for module sidebar
 */
export interface NavItem {
  /** Display name */
  name: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Route path (e.g., "/ui/my-module/subpage") */
  href?: string;
  /** Badge count to display */
  badge?: number;
  /** Disable this item */
  disabled?: boolean;
}

/**
 * Module configuration
 */
export interface ModuleConfig {
  /** Module ID (must match manifest) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Base route path (must start with /ui/) */
  href: string;
  /** Icon component */
  icon: LucideIcon;
  /** Description */
  description?: string;
  /** Mark as external module */
  isExternal?: boolean;
  /** Sidebar navigation items */
  navigation: NavItem[];
  /** AI tool definitions */
  toolDefinitions?: ToolDefinition[];
}

/**
 * AI Tool Definition
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (params: any, context: ToolContext) => Promise<any>;
}

export interface ToolContext {
  userId: string;
  sessionId: string;
  module: ModuleInfo;
}

/**
 * Module lifecycle hooks
 */
export interface ModuleHooks {
  /** Called when module is installed */
  onInstall?: (context: HookContext) => Promise<void>;
  /** Called when module is enabled */
  onEnable?: (context: HookContext) => Promise<void>;
  /** Called when module is disabled */
  onDisable?: (context: HookContext) => Promise<void>;
  /** Called when module is uninstalled */
  onUninstall?: (context: HookContext) => Promise<void>;
  /** Called before database migration */
  onMigrate?: (context: MigrationContext) => Promise<void>;
}

export interface HookContext {
  moduleId: string;
  db: DatabaseConnection;
  logger: ModuleLogger;
}

export interface MigrationContext extends HookContext {
  direction: 'up' | 'down';
  version: string;
}

/**
 * Module info exposed to routes
 */
export interface ModuleInfo {
  id: string;
  name: string;
  version: string;
  status: ModuleStatus;
}

export type ModuleStatus =
  | 'active'
  | 'pending'
  | 'disabled'
  | 'error_manifest'
  | 'error_migration'
  | 'error_config'
  | 'error_build';
```

### 2. Config Builder Helper

```typescript
// @molos/module-sdk/src/define-config.ts
import type { ModuleConfig, NavItem } from './types';

interface DefineConfigOptions {
  id: string;
  name: string;
  icon: LucideIcon;
  description?: string;
  navigation?: Omit<NavItem, 'icon'> & { icon: string }[];
  tools?: ToolDefinition[];
}

/**
 * Type-safe module config builder
 */
export function defineConfig(options: DefineConfigOptions): ModuleConfig {
  const { id, name, icon, description, navigation = [], tools = [] } = options;

  return {
    id,
    name,
    href: `/ui/${id}`,
    icon,
    description,
    isExternal: true,
    navigation: navigation.map(item => ({
      ...item,
      icon: getIconComponent(item.icon),
      href: item.href || `/ui/${id}/${slugify(item.name)}`,
    })),
    toolDefinitions: tools,
  };
}

// Usage in module config.ts:
export default defineConfig({
  id: 'my-module',
  name: 'My Module',
  icon: Package,
  description: 'A sample module',
  navigation: [
    { name: 'Overview', icon: 'home' },
    { name: 'Settings', icon: 'settings', href: '/ui/my-module/settings' },
  ],
  tools: [
    {
      name: 'get_data',
      description: 'Fetch data from module',
      parameters: { type: 'object', properties: { id: { type: 'string' } } },
      execute: async (params, context) => {
        return { data: '...' };
      },
    },
  ],
});
```

### 3. Manifest Builder Helper

```typescript
// @molos/module-sdk/src/define-manifest.ts
import type { ModuleManifest } from './types';
import yaml from 'yaml';
import { writeFileSync } from 'fs';

interface DefineManifestOptions {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  minMolosVersion?: string;
  dependencies?: Record<string, string>;
}

/**
 * Type-safe manifest builder
 * Call with write: true to generate manifest.yaml
 */
export function defineManifest(
  options: DefineManifestOptions,
  write = false
): ModuleManifest {
  const manifest: ModuleManifest = {
    id: options.id,
    name: options.name,
    version: options.version,
    description: options.description,
    author: options.author,
    icon: options.icon,
    minMolosVersion: options.minMolosVersion,
    dependencies: options.dependencies,
    enabled: true,
  };

  if (write) {
    writeFileSync('manifest.yaml', yaml.stringify(manifest));
  }

  return manifest;
}
```

### 4. Lifecycle Hooks

```typescript
// @molos/module-sdk/src/hooks.ts
import type { ModuleHooks, HookContext, MigrationContext } from './types';

/**
 * Define module lifecycle hooks
 */
export function defineHooks(hooks: ModuleHooks): ModuleHooks {
  return hooks;
}

// Usage:
export const hooks = defineHooks({
  onInstall: async (context) => {
    context.logger.info('Module installed');
    // Run setup
  },
  onEnable: async (context) => {
    // Start services
  },
  onDisable: async (context) => {
    // Stop services
  },
  onMigrate: async (context) => {
    if (context.direction === 'up') {
      // Apply migration
    } else {
      // Rollback migration
    }
  },
});
```

### 5. Database Utilities

```typescript
// @molos/module-sdk/src/utils/db.ts
import { db } from '@molos/core/db';

/**
 * Create a module-scoped table name
 * All module tables must have a prefix
 */
export function moduleTable(name: string, moduleId: string): string {
  return `molos_${moduleId.toLowerCase()}_${name}`;
}

/**
 * Get module-specific database client
 */
export function getModuleDb(moduleId: string) {
  return {
    query: <T>(sql: string, params: any[] = []): Promise<T[]> => {
      return db.all(sql, params);
    },
    execute: (sql: string, params: any[] = []): Promise<void> => {
      return db.run(sql, params);
    },
    transaction: <T>(fn: () => Promise<T>): Promise<T> => {
      return db.transaction(fn);
    },
  };
}
```

### 6. Testing Utilities

```typescript
// @molos/module-sdk/src/testing/mock-module.ts
import type { ModuleConfig, ModuleManifest } from '../types';

/**
 * Create a mock module for testing
 */
export function createMockModule(overrides: Partial<ModuleConfig & ModuleManifest> = {}) {
  return {
    manifest: {
      id: 'test-module',
      name: 'Test Module',
      version: '1.0.0',
      ...overrides,
    },
    config: {
      id: 'test-module',
      name: 'Test Module',
      href: '/ui/test-module',
      icon: () => {},
      navigation: [],
      ...overrides,
    },
  };
}

/**
 * Mock tool execution context
 */
export function createMockToolContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    userId: 'test-user',
    sessionId: 'test-session',
    module: {
      id: 'test-module',
      name: 'Test Module',
      version: '1.0.0',
      status: 'active',
    },
    ...overrides,
  };
}
```

### 7. Package Exports

```typescript
// @molos/module-sdk/src/index.ts
// Types
export type {
  ModuleManifest,
  ModuleConfig,
  NavItem,
  ToolDefinition,
  ToolContext,
  ModuleHooks,
  HookContext,
  MigrationContext,
  ModuleInfo,
  ModuleStatus,
} from './types';

// Builders
export { defineConfig } from './define-config';
export { defineManifest } from './define-manifest';
export { defineHooks } from './define-hooks';

// Utilities
export { moduleTable, getModuleDb } from './utils/db';
export { apiRequest, apiResponse } from './utils/api';
export { registerTool, executeTool } from './utils/ai';

// Testing
export { createMockModule, createMockToolContext } from './testing/mock-module';

// Icons helper
export { getIconComponent, listAvailableIcons } from './icons';
```

## Usage Example

```typescript
// external_modules/MyModule/config.ts
import { defineConfig, defineHooks, moduleTable } from '@molos/module-sdk';
import { Package, Settings, Home } from 'lucide-svelte';

export default defineConfig({
  id: 'my-module',
  name: 'My Module',
  icon: Package,
  description: 'A sample module built with the SDK',
  navigation: [
    { name: 'Home', icon: 'home' },
    { name: 'Settings', icon: 'settings' },
  ],
  tools: [
    {
      name: 'get_items',
      description: 'Get all items from module',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max items to return' },
        },
      },
      execute: async (params, context) => {
        const db = getModuleDb(context.module.id);
        return db.query(`SELECT * FROM ${moduleTable('items', context.module.id)} LIMIT ?`, [params.limit || 10]);
      },
    },
  ],
});

export const hooks = defineHooks({
  onInstall: async (context) => {
    context.logger.info('Installing my-module...');
  },
});
```

## Benefits

| Before | After |
|--------|-------|
| Reverse-engineer existing modules | Clear API documentation |
| No type safety | Full TypeScript support |
| Easy to make mistakes | Compile-time validation |
| Inconsistent patterns | Standardized structure |
| No testing support | Testing utilities included |

## Files to Create

- `packages/module-sdk/` - New package
- Publish to npm as `@molos/module-sdk`
