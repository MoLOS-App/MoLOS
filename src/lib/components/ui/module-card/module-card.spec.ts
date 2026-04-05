/**
 * Tests for ModuleCard Component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ModuleCard from './module-card.svelte';
import { ModuleConfigFactory } from '../../../../../tests/utils/test-helpers';
import { Dashboard } from 'lucide-svelte';

// Mock lucide-svelte icons
vi.mock('lucide-svelte', () => ({
	Dashboard: class MockIcon {}
}));

describe('ModuleCard Component', () => {
	const mockModule = ModuleConfigFactory.build({
		id: 'test-module',
		name: 'Test Module',
		description: 'A test module for testing',
		icon: Dashboard
	});

	describe('Rendering', () => {
		it('should render module information correctly', () => {
			const { getByText } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: false,
					disabled: false
				}
			});

			expect(getByText('Test Module')).toBeInTheDocument();
			expect(getByText('A test module for testing')).toBeInTheDocument();
		});

		it('should render module without description', () => {
			const moduleWithoutDesc = { ...mockModule, description: undefined };
			const { queryByText } = render(ModuleCard, {
				props: {
					module: moduleWithoutDesc,
					selected: false,
					disabled: false
				}
			});

			// Should not throw error and should still render
			expect(queryByText('Test Module')).toBeInTheDocument();
		});

		it('should display "Always Active" badge for disabled modules', () => {
			const { getByText } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: true,
					disabled: true
				}
			});

			expect(getByText('Always Active')).toBeInTheDocument();
		});

		it('should not display "Always Active" badge for enabled modules', () => {
			const { queryByText } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: true,
					disabled: false
				}
			});

			expect(queryByText('Always Active')).not.toBeInTheDocument();
		});
	});

	describe('Toggle State', () => {
		it('should show selected state when selected is true', () => {
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: true,
					disabled: false
				}
			});

			// Check for selected styling
			const card = container.querySelector('[role="button"]');
			expect(card).toHaveAttribute('aria-pressed', 'true');
		});

		it('should show unselected state when selected is false', () => {
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: false,
					disabled: false
				}
			});

			const card = container.querySelector('[role="button"]');
			expect(card).toHaveAttribute('aria-pressed', 'false');
		});

		it('should call onToggle when clicked and not disabled', async () => {
			const onToggle = vi.fn();
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: false,
					disabled: false,
					onToggle
				}
			});

			const card = container.querySelector('[role="button"]');
			await fireEvent.click(card!);

			expect(onToggle).toHaveBeenCalledTimes(1);
		});

		it('should not call onToggle when clicked and disabled', async () => {
			const onToggle = vi.fn();
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: true,
					disabled: true,
					onToggle
				}
			});

			const card = container.querySelector('[role="button"]');
			await fireEvent.click(card!);

			expect(onToggle).not.toHaveBeenCalled();
		});
	});

	describe('Disabled State', () => {
		it('should prevent toggling when disabled', async () => {
			const onToggle = vi.fn();
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: true,
					disabled: true,
					onToggle
				}
			});

			const card = container.querySelector('[role="button"]');
			await fireEvent.click(card!);

			expect(onToggle).not.toHaveBeenCalled();
		});

		it('should have correct aria-disabled attribute when disabled', () => {
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: true,
					disabled: true
				}
			});

			const card = container.querySelector('[role="button"]');
			expect(card).toHaveAttribute('aria-disabled', 'true');
		});

		it('should have correct aria-disabled attribute when enabled', () => {
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: false,
					disabled: false
				}
			});

			const card = container.querySelector('[role="button"]');
			expect(card).toHaveAttribute('aria-disabled', 'false');
		});

		it('should not be focusable when disabled', () => {
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: true,
					disabled: true
				}
			});

			const card = container.querySelector('[role="button"]');
			expect(card).toHaveAttribute('tabindex', '-1');
		});

		it('should be focusable when enabled', () => {
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: false,
					disabled: false
				}
			});

			const card = container.querySelector('[role="button"]');
			expect(card).toHaveAttribute('tabindex', '0');
		});
	});

	describe('Keyboard Navigation', () => {
		it('should toggle on Enter key press when not disabled', async () => {
			const onToggle = vi.fn();
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: false,
					disabled: false,
					onToggle
				}
			});

			const card = container.querySelector('[role="button"]');
			await fireEvent.keyDown(card!, { key: 'Enter' });

			expect(onToggle).toHaveBeenCalledTimes(1);
		});

		it('should toggle on Space key press when not disabled', async () => {
			const onToggle = vi.fn();
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: false,
					disabled: false,
					onToggle
				}
			});

			const card = container.querySelector('[role="button"]');
			await fireEvent.keyDown(card!, { key: ' ' });

			expect(onToggle).toHaveBeenCalledTimes(1);
		});

		it('should not toggle on other key presses', async () => {
			const onToggle = vi.fn();
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: false,
					disabled: false,
					onToggle
				}
			});

			const card = container.querySelector('[role="button"]');
			await fireEvent.keyDown(card!, { key: 'Tab' });

			expect(onToggle).not.toHaveBeenCalled();
		});

		it('should not toggle on keyboard when disabled', async () => {
			const onToggle = vi.fn();
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: true,
					disabled: true,
					onToggle
				}
			});

			const card = container.querySelector('[role="button"]');
			await fireEvent.keyDown(card!, { key: 'Enter' });

			expect(onToggle).not.toHaveBeenCalled();
		});

		it('should prevent default behavior on Enter/Space', async () => {
			const onToggle = vi.fn();
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: false,
					disabled: false,
					onToggle
				}
			});

			const card = container.querySelector('[role="button"]');
			const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
			const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

			card!.dispatchEvent(event);

			expect(preventDefaultSpy).toHaveBeenCalled();
		});
	});

	describe('Accessibility', () => {
		it('should have role="button"', () => {
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: false,
					disabled: false
				}
			});

			const card = container.querySelector('[role="button"]');
			expect(card).toBeInTheDocument();
		});

		it('should have aria-label for module name', () => {
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: false,
					disabled: false
				}
			});

			const card = container.querySelector('[role="button"]');
			expect(card).toHaveAttribute('aria-label', 'Toggle Test Module module');
		});

		it('should have aria-pressed attribute', () => {
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: false,
					disabled: false
				}
			});

			const card = container.querySelector('[role="button"]');
			expect(card).toHaveAttribute('aria-pressed');
		});

		it('should have aria-disabled attribute', () => {
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: false,
					disabled: false
				}
			});

			const card = container.querySelector('[role="button"]');
			expect(card).toHaveAttribute('aria-disabled');
		});
	});

	describe('Styling', () => {
		it('should apply selected styling when selected', () => {
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: true,
					disabled: false
				}
			});

			const card = container.querySelector('[role="button"]');
			expect(card?.className).toContain('border-primary');
		});

		it('should apply disabled styling when disabled', () => {
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: true,
					disabled: true
				}
			});

			const card = container.querySelector('[role="button"]');
			expect(card?.className).toContain('cursor-not-allowed');
		});

		it('should apply hover effects when not disabled', () => {
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: false,
					disabled: false
				}
			});

			const card = container.querySelector('[role="button"]');
			expect(card?.className).toContain('hover:bg-muted/80');
		});

		it('should not apply hover effects when disabled', () => {
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: true,
					disabled: true
				}
			});

			const card = container.querySelector('[role="button"]');
			expect(card?.className).not.toContain('hover:bg-muted/80');
		});
	});

	describe('Switch Component', () => {
		it('should render switch with checked state', () => {
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: true,
					disabled: false
				}
			});

			// Switch should reflect the selected state
			const switchElement = container.querySelector('button[role="switch"]');
			expect(switchElement).toHaveAttribute('aria-checked', 'true');
		});

		it('should render switch with unchecked state', () => {
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: false,
					disabled: false
				}
			});

			const switchElement = container.querySelector('button[role="switch"]');
			expect(switchElement).toHaveAttribute('aria-checked', 'false');
		});

		it('should toggle when switch is clicked', async () => {
			const onToggle = vi.fn();
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: false,
					disabled: false,
					onToggle
				}
			});

			const switchElement = container.querySelector('button[role="switch"]');
			await fireEvent.click(switchElement!);

			expect(onToggle).toHaveBeenCalledTimes(1);
		});

		it('should not toggle when disabled switch is clicked', async () => {
			const onToggle = vi.fn();
			const { container } = render(ModuleCard, {
				props: {
					module: mockModule,
					selected: true,
					disabled: true,
					onToggle
				}
			});

			const switchElement = container.querySelector('button[role="switch"]');
			await fireEvent.click(switchElement!);

			expect(onToggle).not.toHaveBeenCalled();
		});
	});
});
