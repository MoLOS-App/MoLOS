# Module Management System

This directory contains the complete module management system for MoLOS, consolidating all module-related functionality into a single, well-organized location.

## Overview

The MoLOS module system enables dynamic loading, management, and integration of external modules. This system handles:

- **Module Discovery**: Automatic detection of modules in the `external_modules/` directory
- **Module Initialization**: Safe loading and setup of modules with database migrations
- **Module Validation**: Comprehensive validation of module structure and configuration
- **Module Lifecycle**: Creation, updating, deletion, and cleanup of modules
- **Symlink Management**: Automatic creation and maintenance of symlinks for integration
- **Error Handling**: Robust error handling with recovery suggestions

## Directory Structure

```
module-management/
├── README.md                    # This file
├── scripts/                     # CLI tools and automation scripts
│   ├── backup-db.sh            # Database backup script
│   ├── entrypoint.sh           # Docker entrypoint script
│   ├── init-standalone.ts      # Standalone development initialization
│   ├── module-dev-cli.ts       # Legacy CLI (refactored into base-cli.ts)
│   ├── orchestrate-dev.ts      # Development orchestration
│   ├── release.sh              # Release automation
│   ├── supervisor.ts           # Application supervisor
│   ├── sync-modules.ts         # Module synchronization
│   ├── validate-module.ts      # Module validation (standalone)
│   ├── base-cli.ts             # Refactored CLI entry point
│   └── commands/               # CLI command implementations
│       ├── create-command.ts   # Module creation
│       ├── validate-command.ts # Module validation
│       └── test-command.ts     # Module testing
├── config/                     # Module configuration and types
│   ├── layout.config.ts        # Layout configuration
│   ├── module-types.ts         # TypeScript interfaces and validation
│   ├── modules.config.ts       # Legacy module exports
│   ├── symlink-config.ts       # Symlink configuration
│   ├── modules/                # Module registry
│   │   ├── index.ts            # Module registry and helpers
│   │   ├── types.ts            # Additional types
│   │   ├── README.md           # Module configuration guide
│   │   └── [module-name]/      # Individual module configs
│   ├── LAYOUT_GUIDE.md         # Layout configuration guide
│   └── README.md               # Configuration overview
├── server/                     # Server-side module management
│   ├── core-manager.ts         # Main module manager entry point
│   ├── initialization.ts       # Module initialization logic
│   ├── cleanup.ts              # Cleanup and deletion operations
│   ├── migration-runner.ts     # Database migration execution
│   ├── module-diagnostics.ts   # Health monitoring and diagnostics
│   ├── module-error-handler.ts # Error categorization and recovery
│   ├── paths.ts                # Centralized path configuration
│   └── utils.ts                # Utility functions
├── docs/                       # Documentation and guides
│   ├── INDEX.md                # Module development index
│   ├── 01-database-schema.md   # Database schema guide
│   ├── 02-typescript-models.md # TypeScript models guide
│   ├── 03-repository-layer.md  # Repository pattern guide
│   ├── 04-api-endpoints.md     # API development guide
│   ├── 05-ui-routes.md         # UI routing guide
│   ├── 06-ui-components.md     # Component development guide
│   ├── 07-module-configuration.md # Configuration guide
│   ├── 08-client-side-data.md  # Client-side data management
│   ├── 09-ai-tools.md          # AI tool integration
│   ├── 10-best-practices.md    # Development best practices
│   ├── 11-deployment-troubleshooting.md # Deployment and troubleshooting
│   ├── 12-testing.md           # Testing guide
│   ├── LAYOUT_GUIDE.md         # Layout configuration guide
│   ├── MODULE_DEVELOPMENT_GUIDE.md # Comprehensive development guide
│   └── config-README.md        # Configuration overview
└── utils/                      # Shared utilities (future use)
```

## Key Components

### Core Manager (`server/core-manager.ts`)

The main entry point for module management operations. Handles the complete module lifecycle:

```typescript
import { ModuleManager } from './module-management/server/core-manager';

// Initialize all modules during application startup
await ModuleManager.init();
```

### CLI Tools (`scripts/`)

Comprehensive command-line interface for module development:

```bash
# Create a new module
npm run module:create my-module --name "My Module"

# Validate module structure
npm run module:validate ./external_modules/my-module

# Run module tests
npm run module:test ./external_modules/my-module
```

### Configuration System (`config/`)

Centralized configuration management with type safety:

```typescript
import { getAllModules, getModuleById } from './module-management/config/modules';

// Get all available modules
const modules = getAllModules();

// Get specific module configuration
const taskModule = getModuleById('MoLOS-Tasks');
```

### Validation & Diagnostics (`server/`)

Robust validation and health monitoring:

```typescript
import { ModuleDiagnosticsService } from './module-management/server/module-diagnostics';

// Run comprehensive diagnostics on a module
const diagnostics = await diagnosticsService.diagnoseModule('my-module');
```

## Module Lifecycle

### 1. Discovery

- Automatic scanning of `external_modules/` directory
- Registration in database with metadata
- Validation of manifest files

### 2. Initialization

- Manifest validation
- Database migration execution
- Symlink creation for integration
- Import path standardization

### 3. Runtime Management

- Health monitoring
- Error state handling
- Automatic recovery attempts
- Symlink maintenance

### 4. Cleanup

- Safe module deletion
- Artifact cleanup
- Orphaned symlink removal
- Database record cleanup

## Development Workflow

### Creating a New Module

1. **Use the CLI**:

   ```bash
   npm run module:create my-feature --name "My Feature" --description "A new module"
   ```

2. **Develop the module** in `external_modules/my-feature/`:
   - Implement components, routes, and API endpoints
   - Define database schema in `drizzle/` directory
   - Configure navigation in `config.ts`

3. **Validate and test**:

   ```bash
   npm run module:validate ./external_modules/my-feature
   npm run module:test ./external_modules/my-feature
   ```

4. **Deploy**: The module will be automatically discovered and initialized on next application start.

### Module Structure

Each module follows a standardized structure:

```
external_modules/[module-id]/
├── manifest.yaml          # Module metadata and configuration
├── config.ts             # Runtime configuration and navigation
├── package.json          # Dependencies and scripts
├── drizzle/              # Database migrations
│   └── 0000_schema.sql
├── lib/                  # Shared libraries and utilities
│   ├── components/       # Svelte components
│   ├── models/          # TypeScript interfaces
│   ├── repositories/    # Data access layer
│   └── server/          # Server-side logic
└── routes/               # SvelteKit routes
    ├── ui/              # User interface routes
    └── api/             # API endpoints
```

## Configuration

### Environment Variables

- `MOLOS_AUTOLOAD_MODULES`: Enable/disable automatic module discovery (`true`/`false`)
- `MOLOS_EXTERNAL_MODULES_DIR`: Override external modules directory path
- `MOLOS_INTERNAL_CONFIG_DIR`: Override internal config directory path

### Module Manifest

Each module must have a `manifest.yaml`:

```yaml
id: 'my-module'
name: 'My Module'
version: '1.0.0'
description: 'A description of the module'
author: 'Developer Name'
icon: 'Zap'
minMolosVersion: '0.1.0'
enabled: true
dependencies:
  other-module: '^1.0.0'
```

## Error Handling

The system provides comprehensive error handling with categorized errors and recovery suggestions:

- **Manifest Validation**: YAML syntax, required fields, version format
- **Migration Failed**: SQL syntax, table naming conventions, database connectivity
- **Config Export**: Missing exports, invalid structure, type mismatches
- **Symlink Failed**: File system permissions, path conflicts

## Best Practices

### Module Development

- Follow the standardized directory structure
- Use TypeScript for all code
- Implement comprehensive tests
- Document API endpoints and components
- Follow semantic versioning

### Database Design

- Prefix all tables with module ID (e.g., `my_module_users`)
- Use foreign key constraints appropriately
- Include proper indexes for performance
- Document schema changes in migration comments

### Error Handling

- Provide meaningful error messages
- Include recovery steps in error responses
- Log errors with appropriate severity levels
- Handle edge cases gracefully

## Troubleshooting

### Common Issues

1. **Module not loading**: Check manifest.yaml syntax and required fields
2. **Database errors**: Verify migration SQL and table naming conventions
3. **Symlink issues**: Check file system permissions and existing conflicts
4. **Import errors**: Ensure proper path standardization during initialization

### Diagnostic Tools

```typescript
import { ModuleDiagnosticsService } from './module-management/server/module-diagnostics';

const diagnostics = await diagnosticsService.diagnoseModule('problematic-module');
console.log(diagnostics.recommendations);
```

## Contributing

When adding new features to the module management system:

1. Update this README with new functionality
2. Add comprehensive tests
3. Follow the established patterns and conventions
4. Update type definitions as needed
5. Provide clear documentation and examples

## Migration from Legacy System

If migrating from the old scattered module management files:

1. Update import paths to use `module-management/` prefix
2. Replace direct script calls with new CLI commands
3. Update configuration references to new locations
4. Test thoroughly before deployment

## Related Documentation

- [Module Development Guide](./docs/MODULE_DEVELOPMENT_GUIDE.md)
- [Layout Configuration Guide](./docs/LAYOUT_GUIDE.md)
- [Database Schema Guide](./docs/01-database-schema.md)
- [API Development Guide](./docs/04-api-endpoints.md)
