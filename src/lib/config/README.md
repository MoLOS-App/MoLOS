# Configuration Directory

This directory contains all configuration files for the MoLOS application, organized by concern: layout configuration, module definitions, and their documentation.

## Structure

```
src/lib/config/
├── layout.config.ts                    # Global layout settings
├── modules.config.ts                   # Legacy exports (backward compat)
├── LAYOUT_GUIDE.md                     # Detailed layout configuration guide
└── modules/                            # Module configuration registry
    ├── types.ts                        # Shared TypeScript interfaces
    ├── index.ts                        # Module registry & helper functions
    ├── README.md                       # Guide for adding new modules
    ├── dashboard/
    │   └── config.ts                   # Dashboard module config
    ├── tasks/
    │   └── config.ts                   # Tasks module config
    └── [new-module]/                   # Add new modules here
        └── config.ts
```

## Quick Navigation

### 🎨 Layout Configuration

- **Detailed Guide**: See [LAYOUT_GUIDE.md](./LAYOUT_GUIDE.md)
- **Source Code**: [layout.config.ts](./layout.config.ts)
- **Purpose**: Configure tooltips, active states, sidebar styling, topbar behavior

### 📦 Module Configuration

- **Quick Start**: Read [modules/README.md](./modules/README.md)
- **Types**: [modules/types.ts](./modules/types.ts)
- **Registry**: [modules/index.ts](./modules/index.ts)
- **Add New Module**: Follow the guide in [modules/README.md](./modules/README.md)

## Key Concepts

### Layout Configuration

Controls the visual appearance and behavior of the application layout:

- **Tooltips**: Show/hide labels on hover, always, or never
- **Active States**: Choose visual style for active modules/items
- **Sidebar**: Customize width, icon sizes, separators
- **Topbar**: Control hover and animation behavior

**Presets Available**:

- `iconOnly` - Minimal, clean aesthetic
- `alwaysLabeled` - Accessibility-focused
- `subtle` - Minimal distraction
- `highlighted` - Prominent active states

### Module Configuration

Standardized structure for defining application modules:

- **Each module has its own folder** with `config.ts`
- **Consistent pattern** makes it easy to add new modules
- **Type-safe** with shared interfaces in `types.ts`
- **Centralized registry** for easy access to all module configs

**Standard Module Structure**:

```typescript
{
  id: string;                 // Unique identifier
  name: string;               // Display name
  href: string;               // Base route
  icon: Component;            // lucide-svelte icon
  description?: string;       // Optional description
  navigation: NavItem[];      // Sub-routes with icons
}
```

## Common Tasks

### Change Layout Style

Edit `layout.config.ts` to modify `DEFAULT_LAYOUT_CONFIG` or use a preset in your layout component.

### Add a New Module

1. Create folder: `modules/your-module/`
2. Create `config.ts` with module definition
3. Update `modules/index.ts` to register it
4. See [modules/README.md](./modules/README.md) for detailed steps

### Use Module Configuration

```typescript
import { getAllModules, getModuleById } from '$lib/config/modules';

const allModules = getAllModules();
const tasksModule = getModuleById('tasks');
```

### Use Layout Configuration

```typescript
import { DEFAULT_LAYOUT_CONFIG, LAYOUT_PRESETS } from '$lib/config/layout.config';

// Use default or a preset
const config = LAYOUT_PRESETS.alwaysLabeled;
```

## Documentation Files

| File                                                                   | Purpose                                                         |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| [LAYOUT_IMPLEMENTATION_SUMMARY.md](./LAYOUT_IMPLEMENTATION_SUMMARY.md) | Overview of layout system and quick start guide                 |
| [LAYOUT_GUIDE.md](./LAYOUT_GUIDE.md)                                   | Comprehensive layout configuration guide with examples          |
| [modules/README.md](./modules/README.md)                               | Guide for adding new modules and understanding module structure |

## Related Documentation

- **Root Level**: See [project README](../../README.md) for overall project structure
- **Database Schema**: See [src/lib/server/db/schema/README.md](../server/db/schema/README.md)
- **Module Guidelines**: See [MODULES_STRUCTURE.md](../../MODULES_STRUCTURE.md)
