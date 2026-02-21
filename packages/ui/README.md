# @molos/ui

UI component library for the MoLOS monorepo.

## Overview

This package contains all reusable UI components extracted from the MoLOS SvelteKit application. It follows the shadcn-svelte "bits" pattern and provides a comprehensive set of components for building modern web interfaces.

## Installation

This is a private package within the MoLOS monorepo. It should be installed via workspace protocol:

```bash
pnpm add @molos/ui
```

## Usage

### Importing Components

```svelte
<script>
	import { Button, Card, Input } from '@molos/ui';
	import { cn } from '@molos/ui';
</script>

<Card>
	<Button variant="default">Click me</Button>
	<Input placeholder="Enter text..." />
</Card>
```

### Importing Styles

Import the main stylesheet in your app's layout or root file:

```typescript
import '@molos/ui/styles';
```

Or import specific theme CSS:

```typescript
import '@molos/ui/styles/themes/base.css';
import '@molos/ui/styles/themes/blue.css';
```

## Components

### Base UI Components (57)

- accordion, alert, alert-dialog, aspect-ratio, avatar
- badge, breadcrumb, button, button-group
- calendar, card, carousel, chart, checkbox, collapsible
- command, context-menu
- data-table, dialog, drawer, dropdown-menu
- empty, field, form
- hover-card
- input, input-group, input-otp, item
- kbd
- label
- menubar
- native-select, navigation-menu
- pagination, popover, progress
- radio-group, range-calendar, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, spinner, switch
- table, tabs, textarea, toggle, toggle-group, tooltip

### Shared Components

#### Modules (6 components)

- `ModuleManagerHeader` - Header for module management interface
- `ModuleManagerFooter` - Footer for module management interface
- `ExternalModuleCard` - Card component for external modules
- `BuiltinModuleCard` - Card component for built-in modules
- `InstallModuleForm` - Form for installing new modules
- `GitRefDialog` - Dialog for selecting git references

#### Navigation (3 components)

- `AppNavDrawer` - Main navigation drawer component
- `SubmenuRail` - Submenu rail component
- `SubmenuSection` - Submenu section component

#### AI Components (37 components)

**Chat & Messaging:**

- `AiChatWorkspace` - Main AI chat workspace
- `TelegramChatWorkspace` - Telegram-style chat workspace
- `ChatSidepanel` - Chat sidepanel component
- `ChatHeader` - Chat header component
- `ChatInput` - Chat input component
- `ChatMessage` - Chat message component
- `ChatSidebar` - Chat sidebar component
- `SessionList` - List of chat sessions

**Code & Execution:**

- `CodeBlock` - Code block display component
- `ExecutionLog` - Execution log display
- `ExecutionLogActions` - Actions for execution logs
- `ProgressDisplay` - Progress display component
- `PlanVisualization` - Plan visualization component
- `ReviewChangesOverlay` - Review changes overlay

**MCP Components (24 components):**

- `McpApiKeyTable` - API key management table
- `McpConnectionInfo` - Connection information display
- `McpCreateKeyDialog` - Create API key dialog
- `McpEditKeyDialog` - Edit API key dialog
- `McpKeySecretDialog` - Show API key secret dialog
- `McpOAuthAppsTable` - OAuth apps table
- `McpCreateOAuthAppDialog` - Create OAuth app dialog
- `McpEditOAuthAppDialog` - Edit OAuth app dialog
- `McpPromptsTable` - Prompts management table
- `McpCreatePromptDialog` - Create prompt dialog
- `McpEditPromptDialog` - Edit prompt dialog
- `McpResourcesTable` - Resources management table
- `McpCreateResourceDialog` - Create resource dialog
- `McpEditResourceDialog` - Edit resource dialog
- `McpLogsTable` - Logs table
- `McpLogDetailDialog` - Log detail dialog
- `McpModulesGrid` - Modules grid display
- `McpStatsCard` - Statistics card
- `McpTabs` - MCP tab navigation
- `McpHeader` - MCP header component
- `McpQuickStart` - Quick start guide
- `McpRecentActivity` - Recent activity display
- `McpHelpDialog` - Help dialog

## Themes

The package includes 10 theme CSS files:

- `base.css` - Base theme with CSS variables
- `blue.css`, `green.css`, `lavender.css`, `mint.css`
- `neutral.css`, `orange.css`, `peach.css`, `rose.css`, `sky.css`

## Utilities

### `cn()` function

Utility function for combining Tailwind CSS classes:

```typescript
import { cn } from '@molos/ui';

const className = cn('base-class', 'additional-class', {
	'conditional-class': isActive
});
```

### Type Utilities

- `WithoutChild<T>` - Removes `child` prop from type
- `WithoutChildren<T>` - Removes `children` prop from type
- `WithoutChildrenOrChild<T>` - Removes both `child` and `children` props
- `WithElementRef<T, U>` - Adds element ref to type

## Development

### Build

```bash
pnpm run build
```

### Watch mode

```bash
pnpm run dev
```

### Clean

```bash
pnpm run clean
```

## Dependencies

The package has the following key dependencies:

- **bits-ui** - Radix UI component primitives
- **formsnap** - Form handling utilities
- **mode-watcher** - Dark/light mode management
- **tailwind-merge** - Tailwind class merging
- **class-variance-authority** - Component variant management
- **embla-carousel-svelte** - Carousel components
- **layerchart** - Chart components
- **paneforge** - Panel/resizable components
- **svelte-sonner** - Toast notifications
- **vaul-svelte** - Drawer/sheet components

## License

Private package for MoLOS project use only.
