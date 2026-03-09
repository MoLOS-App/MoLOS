# Module Card & Grid Components

Reusable UI components for displaying and selecting modules in the MoLOS welcome flow.

## Components

### ModuleCard

Individual module card with toggle functionality.

#### Props

```typescript
interface ModuleCardProps {
	module: ModuleConfig; // Module configuration object
	selected: boolean; // Is module selected?
	disabled?: boolean; // Is toggle disabled (for mandatory modules)?
	onToggle?: () => void; // Callback when toggle clicked
}
```

#### Features

- ✅ Displays module icon, name, and description
- ✅ Toggle switch for selection
- ✅ "Always Active" badge for disabled (mandatory) modules
- ✅ Hover effects and visual feedback
- ✅ Keyboard navigation support (Tab, Enter, Space)
- ✅ ARIA labels for accessibility
- ✅ Smooth scale animation on render
- ✅ Click anywhere on card to toggle

#### States

- **Normal**: Default appearance with muted background
- **Selected**: Primary border and subtle background tint
- **Disabled**: Lower opacity, non-interactive, "Always Active" badge

#### Example Usage

```svelte
<script lang="ts">
	import ModuleCard from '$lib/components/ui/module-card';
	import { MODULE_REGISTRY } from '$lib/config';

	const module = MODULE_REGISTRY['MoLOS-Tasks'];
	let selected = $state(false);
</script>

<ModuleCard {module} {selected} onToggle={() => (selected = !selected)} />
```

### ModuleGrid

Grid layout for displaying multiple module cards.

#### Props

```typescript
interface ModuleGridProps {
	modules: ModuleConfig[]; // All modules to display
	selectedIds: Set<string>; // IDs of selected modules
	disabledIds?: Set<string>; // IDs of disabled modules
	onToggle?: (moduleId: string) => void; // Callback when module toggled
}
```

#### Features

- ✅ Responsive grid layout (1/2/3 columns)
- ✅ Automatic sorting (mandatory modules first, then alphabetical)
- ✅ Staggered entry animations
- ✅ ARIA group role for accessibility

#### Responsive Breakpoints

- **Mobile**: 1 column
- **Tablet (md)**: 2 columns
- **Desktop (lg)**: 3 columns

#### Example Usage

```svelte
<script lang="ts">
	import ModuleGrid from '$lib/components/ui/module-grid';
	import { MODULE_REGISTRY } from '$lib/config';

	let selectedIds = $state(new Set(['dashboard', 'ai']));
	let disabledIds = $state(new Set(['dashboard', 'ai']));

	function handleToggle(moduleId: string) {
		if (selectedIds.has(moduleId)) {
			selectedIds.delete(moduleId);
		} else {
			selectedIds.add(moduleId);
		}
		selectedIds = new Set(selectedIds); // Trigger reactivity
	}
</script>

<ModuleGrid
	modules={Object.values(MODULE_REGISTRY)}
	{selectedIds}
	{disabledIds}
	onToggle={handleToggle}
/>
```

## Design System

### Visual Style

Components follow the MoLOS design system:

- **Rounded corners**: `rounded-2xl` for cards
- **Background**: `bg-muted` for cards, `bg-background` for icon containers
- **Border**: `border-primary` when selected
- **Shadows**: `shadow-lg` → `shadow-xl` on hover
- **Colors**: Uses Tailwind semantic colors (primary, muted, foreground, etc.)

### Animations

- **ModuleCard**: Scale animation on render (300ms)
- **ModuleGrid**: Staggered fly-in animations (300ms + 50ms delay per card)
- **Hover**: Smooth transitions (200ms duration)
- **Icon**: Scale transform on hover

### Accessibility

Both components are WCAG 2.2 compliant:

- ✅ Keyboard navigation (Tab, Enter, Space)
- ✅ ARIA labels and roles
- ✅ Focus indicators (2px ring offset)
- ✅ Screen reader friendly
- ✅ Disabled states properly marked

## Integration

### With Welcome Flow

```svelte
<script lang="ts">
	import ModuleGrid from '$lib/components/ui/module-grid';
	import { MODULE_REGISTRY } from '$lib/config';

	let step = $state(3); // Module selection step
	let selectedIds = $state(new Set(['dashboard', 'ai']));
	let disabledIds = $state(new Set(['dashboard', 'ai']));

	function handleToggle(moduleId: string) {
		// Update selection logic
	}

	async function handleContinue() {
		// Save module selections to settings
		// Navigate to next step
	}
</script>

{#if step === 3}
	<div>
		<h2>Select your modules</h2>
		<ModuleGrid
			modules={Object.values(MODULE_REGISTRY)}
			{selectedIds}
			{disabledIds}
			onToggle={handleToggle}
		/>
		<Button onclick={handleContinue}>Continue</Button>
	</div>
{/if}
```

## Testing

Components can be tested using the example usage file:

```bash
# Create a test route
src/routes/test-modules/+page.svelte
```

```svelte
<script lang="ts">
	import ModuleGrid from '$lib/components/ui/module-grid';
	import { MODULE_REGISTRY } from '$lib/config';

	let selectedIds = $state(new Set(['dashboard', 'ai']));
	let disabledIds = $state(new Set(['dashboard', 'ai']));

	function handleToggle(moduleId: string) {
		if (selectedIds.has(moduleId)) {
			selectedIds.delete(moduleId);
		} else {
			selectedIds.add(moduleId);
		}
		selectedIds = new Set(selectedIds);
	}
</script>

<ModuleGrid
	modules={Object.values(MODULE_REGISTRY)}
	{selectedIds}
	{disabledIds}
	onToggle={handleToggle}
/>
```

## Best Practices

1. **State Management**: Use Svelte 5 runes ($state, $derived)
2. **Reactivity**: Create new Set instances to trigger reactivity
3. **Disabled Modules**: Mark mandatory modules as disabled
4. **Sorting**: Let ModuleGrid handle sorting automatically
5. **Accessibility**: Don't override ARIA attributes

## Related Components

- [Switch](../switch) - Toggle switch component
- [Badge](../badge) - Badge component for "Always Active" indicator
- [Button](../button) - For continue/submit buttons
- [Card](../card) - Base card component (if needed)

## Troubleshooting

### Module not showing up

1. Check `MODULE_REGISTRY` includes the module
2. Verify module has valid `config.ts`
3. Run `npm run module:sync`

### Toggle not working

1. Ensure `onToggle` callback is provided
2. Create new Set instance when updating `selectedIds`
3. Check for JavaScript errors in console

### Animations not working

1. Verify `svelte/transition` is imported
2. Check for CSS conflicts
3. Ensure `in:` directive is used (not `transition:`)
