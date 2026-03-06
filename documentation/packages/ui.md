# @molos/ui Package

## Overview

`@molos/ui` contains shared UI components used across MoLOS modules and the main application. Built with Svelte 5 and Tailwind CSS.

## Location

```
packages/ui/
├── src/
│   ├── components/
│   │   ├── ui/          # Base UI components (buttons, inputs, etc.)
│   │   └── shared/      # Shared composite components
│   └── index.ts         # Main exports
├── package.json
└── tsconfig.json
```

## Installation

```bash
npm install @molos/ui
```

## Usage

```svelte
<script lang="ts">
	import { Button, Card, Badge } from '@molos/ui';
</script>

<Card>
	<h2>Card Title</h2>
	<Badge>Active</Badge>
	<Button>Click me</Button>
</Card>
```

## Available Components

### Layout Components

| Component | Description                       |
| --------- | --------------------------------- |
| `Card`    | Container with border and padding |
| `Modal`   | Overlay dialog                    |
| `Tabs`    | Tab navigation container          |
| `Sidebar` | Side navigation panel             |

### Form Components

| Component  | Description                    |
| ---------- | ------------------------------ |
| `Button`   | Clickable button with variants |
| `Input`    | Text input field               |
| `Select`   | Dropdown selection             |
| `Checkbox` | Checkbox input                 |
| `Switch`   | Toggle switch                  |

### Feedback Components

| Component | Description            |
| --------- | ---------------------- |
| `Badge`   | Status indicator       |
| `Alert`   | Notification message   |
| `Toast`   | Temporary notification |
| `Spinner` | Loading indicator      |

### Data Display

| Component | Description         |
| --------- | ------------------- |
| `Table`   | Data table          |
| `List`    | Vertical list       |
| `Avatar`  | User avatar         |
| `Icon`    | Lucide icon wrapper |

## Component Variants

### Button

```svelte
<Button variant="default">Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
```

### Badge

```svelte
<Badge variant="default">Default</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="destructive">Error</Badge>
```

## Styling

Components use Tailwind CSS classes. Ensure Tailwind is configured in your project:

```javascript
// tailwind.config.js
export default {
	content: ['./src/**/*.{html,js,svelte,ts}', './node_modules/@molos/ui/**/*.{html,js,svelte,ts}']
};
```

## Peer Dependencies

- `svelte` ^5.0.0
- `@sveltejs/kit` ^2.0.0
- `tailwindcss` ^4.0.0
- `lucide-svelte` - Icons

## Related

- [Module Development](../modules/development.md)
- [Getting Started](../getting-started/quick-start.md)

---

_See also: [Architecture Overview](../architecture/overview.md)_
