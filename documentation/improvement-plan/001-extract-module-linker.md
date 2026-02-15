# Task 001: Extract Module Linker from vite.config.ts

**Priority**: P0 (Critical)
**Effort**: Medium
**Impact**: High

## Problem

`vite.config.ts` is 800+ lines and does too much:
- Module discovery and linking
- Symlink management
- Validation
- Error handling
- DB reads
- Build error recovery

This makes it hard to:
- Debug issues
- Test module linking independently
- Understand what's happening
- Maintain the code

## Solution

Extract module linking logic into a dedicated service/module:

```
module-management/
├── config/
│   └── module-types.ts
├── server/
│   ├── module-manager.ts
│   ├── module-linker.ts      # NEW
│   ├── module-validator.ts   # NEW (extracted from vite.config)
│   └── module-error-handler.ts
└── vite-plugin.ts            # NEW - thin wrapper for vite.config
```

## Implementation

### 1. Create `module-management/server/module-linker.ts`

```typescript
// Core linking logic extracted from vite.config.ts
export class ModuleLinker {
  constructor(private config: SymlinkConfig) {}

  linkModule(moduleId: string, modulePath: string): LinkResult {
    // Validation
    // Symlink creation
    // Error handling
  }

  unlinkModule(moduleId: string): void {
    // Cleanup symlinks
  }

  linkAllActive(modules: string[]): LinkResult[] {
    // Batch linking
  }
}
```

### 2. Create `module-management/vite-plugin.ts`

```typescript
// Thin Vite plugin that uses ModuleLinker
export function molosModulePlugin(): Plugin {
  return {
    name: 'molos-modules',
    configResolved() {
      const linker = new ModuleLinker(SYMLINK_CONFIG);
      linker.linkAllActive(getActiveModules());
    }
  }
}
```

### 3. Simplify `vite.config.ts`

```typescript
import { molosModulePlugin } from './module-management/vite-plugin';

export default defineConfig({
  plugins: [
    tailwindcss(),
    molosModulePlugin(),  // <-- Clean!
    sveltekit()
  ],
  // ... rest stays minimal
});
```

## Benefits

- Single responsibility per file
- Testable linking logic
- Clearer error messages
- Easier to debug

## Files to Change

- `vite.config.ts` - Major refactor (extract logic)
- `module-management/server/module-linker.ts` - New
- `module-management/server/module-validator.ts` - New (extract validation)
- `module-management/vite-plugin.ts` - New

## Testing

- Unit tests for ModuleLinker
- Unit tests for validation logic
- Integration test: link module → verify symlinks → unlink → verify cleanup
