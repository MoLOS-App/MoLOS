# @molos/core Package

## Overview

`@molos/core` is the foundational package for MoLOS, providing shared utilities, types, and core functionality used across all modules and the main application.

## Location

```
packages/core/
├── src/
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript type definitions
│   └── index.ts         # Main exports
├── package.json
└── tsconfig.json
```

## Installation

```bash
npm install @molos/core
```

## Usage

```typescript
// Import utilities
import { formatDate, slugify } from '@molos/core/utils';

// Import types
import type { ModuleConfig, UserId } from '@molos/core/types';

// Import everything
import { utils, types } from '@molos/core';
```

## Key Exports

### Utilities

| Function | Description |
|----------|-------------|
| `formatDate()` | Format dates consistently across the app |
| `slugify()` | Convert strings to URL-safe slugs |
| `generateId()` | Generate unique identifiers |
| `validateUuid()` | UUID validation helper |

### Types

| Type | Description |
|------|-------------|
| `ModuleConfig` | Module configuration interface |
| `UserId` | User identifier type |
| `Timestamp` | Unix timestamp type |
| `JsonValue` | JSON-compatible value type |

## Dependencies

This package has minimal dependencies to keep it lightweight:

- `typescript` - Type definitions
- No runtime dependencies

## Related Packages

- `@molos/database` - Database schema and utilities
- `@molos/ui` - Shared UI components

---

*See also: [Architecture Overview](../architecture/overview.md)*
