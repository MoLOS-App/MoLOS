# Changelog - Module Discovery Fix (2026-02-16)

## Problem
The sidebar menu was not showing modules because:
1. `.env` had `VITE_MOLOS_AUTOLOAD_MODULES=finance` - filtering to only finance module
2. Finance module doesn't exist in the registry
3. No modules passed the filter, resulting in empty MODULE_REGISTRY
4. The autoload filter logic didn't have "mandatory" modules that always load
5. Module symlinks used folder names instead of module IDs from config

## Solution
1. Added mandatory module concept that bypasses the environment filter for essential modules
2. Updated link script to read module ID from config file
3. Fixed tasks module to use correct external module ID `MoLOS-Tasks`

## Changes Made

### 1. Added Mandatory Modules Logic
**File:** `src/lib/config/index.ts`

```typescript
// Modules that must always be loaded (cannot be filtered out by env variable)
const MANDATORY_MODULES = ['dashboard', 'ai'] as const;

// In buildModuleRegistry():
// Skip filter for mandatory modules (always load regardless of env filter)
const isMandatory = MANDATORY_MODULES.includes(config.id as (typeof MANDATORY_MODULES)[number]);

// Apply autoload filter if set (but not for mandatory modules)
if (!isMandatory && autoloadFilter && !autoloadFilter.includes(config.id)) {
    return acc;
}
```

### 2. Fixed Environment Variable
**File:** `.env`

```bash
# Before (broken - finance module doesn't exist)
VITE_MOLOS_AUTOLOAD_MODULES=finance

# After (empty = load all modules)
VITE_MOLOS_AUTOLOAD_MODULES=
```

### 3. Updated Link Script to Use Module ID from Config
**File:** `scripts/link-modules.ts`

Added `extractModuleIdFromConfig()` function to read the module ID from the config file instead of using the folder name. This ensures symlinks are named correctly (e.g., `MoLOS-Tasks` instead of `tasks`).

### 4. Fixed Tasks Module Configuration
**File:** `modules/tasks/src/config.ts`

```typescript
// Module ID follows external module convention
id: "MoLOS-Tasks",
href: "/ui/MoLOS-Tasks",
navigation: [
  { href: "/ui/MoLOS-Tasks/dashboard" },
  // ... other navigation items
]
```

### 5. Updated Documentation
**Files:**
- `documentation/modules/README.md` - Added autoload filtering and mandatory modules section
- `documentation/modules/quick-reference.md` - Updated environment variables section

## Module Classification

### Internal Modules (always in this repo)
- `dashboard` - Core dashboard functionality
- `ai` - AI assistant interface

### External Modules (separate repositories)
- `MoLOS-Tasks` - Task management (symlinked from modules/ for development)

## Result
- **Dashboard** and **AI** modules always load (mandatory, cannot be filtered)
- **MoLOS-Tasks** loads by default (env variable now empty)
- Symlinks correctly use module IDs from config

## Known Issues
- MoLOS-Tasks database tables don't exist yet - migrations need to be created and run

## Verification
1. Run `bun run module:link && bun run module:sync` to link and sync modules
2. Start dev server: `bun run dev`
3. Check sidebar shows: Dashboard, AI, Tasks
4. Verify symlinks: `ls -la src/routes/ui/\(modules\)/\(external_modules\)/`
