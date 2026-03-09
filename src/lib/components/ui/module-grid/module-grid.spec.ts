/**
 * Tests for ModuleGrid Component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ModuleGrid from './module-grid.svelte';
import { ModuleConfigFactory } from '../../../../../tests/utils/test-helpers';

describe('ModuleGrid Component', () => {
	const mockModules = [
		ModuleConfigFactory.build({ id: 'module-a', name: 'Alpha Module' }),
		ModuleConfigFactory.build({ id: 'module-b', name: 'Beta Module' }),
		ModuleConfigFactory.build({ id: 'module-c', name: 'Gamma Module' }),
		ModuleConfigFactory.build({ id: 'module-d', name: 'Delta Module' })
	];

	describe('Rendering', () => {
		it('should render all modules in grid', () => {
			const selectedIds = new Set(['module-a', 'module-b']);
			const { getByText } = render(ModuleGrid, {
				props: {
					modules: mockModules,
					selectedIds,
					disabledIds: new Set()
				}
			});

			expect(getByText('Alpha Module')).toBeInTheDocument();
			expect(getByText('Beta Module')).toBeInTheDocument();
			expect(getByText('Gamma Module')).toBeInTheDocument();
			expect(getByText('Delta Module')).toBeInTheDocument();
		});

		it('should render empty grid when no modules', () => {
			const { container } = render(ModuleGrid, {
				props: {
					modules: [],
					selectedIds: new Set(),
					disabledIds: new Set()
				}
			});

			const grid = container.querySelector('[role="group"]');
			expect(grid).toBeInTheDocument();
		});
	});

	describe('Selected State', () => {
		it('should mark selected modules correctly', () => {
			const selectedIds = new Set(['module-a', 'module-c']);
			const { container } = render(ModuleGrid, {
				props: {
					modules: mockModules,
					selectedIds,
					disabledIds: new Set()
				}
			});

			// Check that selected modules have the correct aria-pressed
			const cards = container.querySelectorAll('[role="button"]');
			expect(cards[0]).toHaveAttribute('aria-pressed', 'true'); // module-a
			expect(cards[1]).toHaveAttribute('aria-pressed', 'false'); // module-b
			expect(cards[2]).toHaveAttribute('aria-pressed', 'true'); // module-c
			expect(cards[3]).toHaveAttribute('aria-pressed', 'false'); // module-d
		});

		it('should update when selectedIds changes', async () => {
			const selectedIds = new Set(['module-a']);
			const { container, rerender } = render(ModuleGrid, {
				props: {
					modules: mockModules,
					selectedIds,
					disabledIds: new Set()
				}
			});

			// Initial state
			let cards = container.querySelectorAll('[role="button"]');
			expect(cards[0]).toHaveAttribute('aria-pressed', 'true');
			expect(cards[1]).toHaveAttribute('aria-pressed', 'false');

			// Update selectedIds
			const newSelectedIds = new Set(['module-a', 'module-b']);
			await rerender({ selectedIds: newSelectedIds });

			cards = container.querySelectorAll('[role="button"]');
			expect(cards[0]).toHaveAttribute('aria-pressed', 'true');
			expect(cards[1]).toHaveAttribute('aria-pressed', 'true');
		});
	});

	describe('Disabled State', () => {
		it('should mark disabled modules correctly', () => {
			const disabledIds = new Set(['module-b', 'module-d']);
			const { container } = render(ModuleGrid, {
				props: {
					modules: mockModules,
					selectedIds: new Set(),
					disabledIds
				}
			});

			const cards = container.querySelectorAll('[role="button"]');
			expect(cards[1]).toHaveAttribute('aria-disabled', 'true'); // module-b
			expect(cards[3]).toHaveAttribute('aria-disabled', 'true'); // module-d
		});

		it('should prevent toggling disabled modules', async () => {
			const onToggle = vi.fn();
			const disabledIds = new Set(['module-a']);
			const { container } = render(ModuleGrid, {
				props: {
					modules: mockModules,
					selectedIds: new Set(['module-a']),
					disabledIds,
					onToggle
				}
			});

			const firstCard = container.querySelector('[role="button"]');
			await fireEvent.click(firstCard!);

			expect(onToggle).not.toHaveBeenCalled();
		});
	});

	describe('Toggle Callback', () => {
		it('should call onToggle when module clicked', async () => {
			const onToggle = vi.fn();
			const { container } = render(ModuleGrid, {
				props: {
					modules: mockModules,
					selectedIds: new Set(),
					disabledIds: new Set(),
					onToggle
				}
			});

			const firstCard = container.querySelector('[role="button"]');
			await fireEvent.click(firstCard!);

			expect(onToggle).toHaveBeenCalledWith('module-a');
		});

		it('should call onToggle with correct module ID', async () => {
			const onToggle = vi.fn();
			const { container } = render(ModuleGrid, {
				props: {
					modules: mockModules,
					selectedIds: new Set(),
					disabledIds: new Set(),
					onToggle
				}
			});

			const cards = container.querySelectorAll('[role="button"]');
			await fireEvent.click(cards[2]); // module-c

			expect(onToggle).toHaveBeenCalledWith('module-c');
		});
	});

	describe('Sorting', () => {
		it('should sort modules with disabled (mandatory) first', () => {
			const modules = [
				ModuleConfigFactory.build({ id: 'module-z', name: 'Zeta Module' }),
				ModuleConfigFactory.build({ id: 'module-a', name: 'Alpha Module' }),
				ModuleConfigFactory.build({ id: 'mandatory', name: 'Mandatory Module' }),
				ModuleConfigFactory.build({ id: 'module-b', name: 'Beta Module' })
			];

			const disabledIds = new Set(['mandatory']);
			const { container } = render(ModuleGrid, {
				props: {
					modules,
					selectedIds: new Set(['mandatory']),
					disabledIds
				}
			});

			// First module should be the mandatory one
			const cards = container.querySelectorAll('[role="button"]');
			expect(cards[0]).toHaveAttribute('aria-label', 'Toggle Mandatory Module module');
		});

		it('should sort non-disabled modules alphabetically', () => {
			const modules = [
				ModuleConfigFactory.build({ id: 'module-z', name: 'Zeta Module' }),
				ModuleConfigFactory.build({ id: 'module-a', name: 'Alpha Module' }),
				ModuleConfigFactory.build({ id: 'module-b', name: 'Beta Module' })
			];

			const { container } = render(ModuleGrid, {
				props: {
					modules,
					selectedIds: new Set(),
					disabledIds: new Set()
				}
			});

			const cards = container.querySelectorAll('[role="button"]');
			// Should be sorted alphabetically: Alpha, Beta, Zeta
			expect(cards[0]).toHaveAttribute('aria-label', 'Toggle Alpha Module module');
			expect(cards[1]).toHaveAttribute('aria-label', 'Toggle Beta Module module');
			expect(cards[2]).toHaveAttribute('aria-label', 'Toggle Zeta Module module');
		});

		it('should sort disabled modules before non-disabled', () => {
			const modules = [
				ModuleConfigFactory.build({ id: 'module-z', name: 'Zeta Module' }),
				ModuleConfigFactory.build({ id: 'mandatory-b', name: 'Mandatory B' }),
				ModuleConfigFactory.build({ id: 'module-a', name: 'Alpha Module' }),
				ModuleConfigFactory.build({ id: 'mandatory-a', name: 'Mandatory A' })
			];

			const disabledIds = new Set(['mandatory-a', 'mandatory-b']);
			const { container } = render(ModuleGrid, {
				props: {
					modules,
					selectedIds: new Set(['mandatory-a', 'mandatory-b']),
					disabledIds
				}
			});

			const cards = container.querySelectorAll('[role="button"]');
			// First two should be disabled (sorted alphabetically)
			expect(cards[0]).toHaveAttribute('aria-label', 'Toggle Mandatory A module');
			expect(cards[1]).toHaveAttribute('aria-label', 'Toggle Mandatory B module');
			// Then non-disabled (sorted alphabetically)
			expect(cards[2]).toHaveAttribute('aria-label', 'Toggle Alpha Module module');
			expect(cards[3]).toHaveAttribute('aria-label', 'Toggle Zeta Module module');
		});
	});

	describe('Accessibility', () => {
		it('should have role="group"', () => {
			const { container } = render(ModuleGrid, {
				props: {
					modules: mockModules,
					selectedIds: new Set(),
					disabledIds: new Set()
				}
			});

			const grid = container.querySelector('[role="group"]');
			expect(grid).toBeInTheDocument();
		});

		it('should have aria-label for module selection', () => {
			const { container } = render(ModuleGrid, {
				props: {
					modules: mockModules,
					selectedIds: new Set(),
					disabledIds: new Set()
				}
			});

			const grid = container.querySelector('[role="group"]');
			expect(grid).toHaveAttribute('aria-label', 'Module selection');
		});

		it('should have accessible child elements', () => {
			const { container } = render(ModuleGrid, {
				props: {
					modules: mockModules,
					selectedIds: new Set(),
					disabledIds: new Set()
				}
			});

			const cards = container.querySelectorAll('[role="button"]');
			expect(cards.length).toBe(mockModules.length);
		});
	});

	describe('Grid Layout', () => {
		it('should apply responsive grid classes', () => {
			const { container } = render(ModuleGrid, {
				props: {
					modules: mockModules,
					selectedIds: new Set(),
					disabledIds: new Set()
				}
			});

			const grid = container.querySelector('.grid');
			expect(grid).toBeInTheDocument();
			expect(grid?.className).toContain('sm:grid-cols-1');
			expect(grid?.className).toContain('md:grid-cols-2');
			expect(grid?.className).toContain('lg:grid-cols-3');
		});

		it('should have gap between grid items', () => {
			const { container } = render(ModuleGrid, {
				props: {
					modules: mockModules,
					selectedIds: new Set(),
					disabledIds: new Set()
				}
			});

			const grid = container.querySelector('.grid');
			expect(grid?.className).toContain('gap-4');
		});
	});

	describe('Edge Cases', () => {
		it('should handle single module', () => {
			const singleModule = [mockModules[0]];
			const { getByText } = render(ModuleGrid, {
				props: {
					modules: singleModule,
					selectedIds: new Set(),
					disabledIds: new Set()
				}
			});

			expect(getByText('Alpha Module')).toBeInTheDocument();
		});

		it('should handle all modules selected', () => {
			const allSelected = new Set(mockModules.map((m) => m.id));
			const { container } = render(ModuleGrid, {
				props: {
					modules: mockModules,
					selectedIds: allSelected,
					disabledIds: new Set()
				}
			});

			const cards = container.querySelectorAll('[role="button"]');
			cards.forEach((card) => {
				expect(card).toHaveAttribute('aria-pressed', 'true');
			});
		});

		it('should handle all modules disabled', () => {
			const allDisabled = new Set(mockModules.map((m) => m.id));
			const { container } = render(ModuleGrid, {
				props: {
					modules: mockModules,
					selectedIds: allDisabled,
					disabledIds: allDisabled
				}
			});

			const cards = container.querySelectorAll('[role="button"]');
			cards.forEach((card) => {
				expect(card).toHaveAttribute('aria-disabled', 'true');
			});
		});

		it('should handle modules with same name', () => {
			const duplicateNames = [
				ModuleConfigFactory.build({ id: 'module-1', name: 'Same Name' }),
				ModuleConfigFactory.build({ id: 'module-2', name: 'Same Name' })
			];

			const { getAllByText } = render(ModuleGrid, {
				props: {
					modules: duplicateNames,
					selectedIds: new Set(),
					disabledIds: new Set()
				}
			});

			const modules = getAllByText('Same Name');
			expect(modules).toHaveLength(2);
		});
	});
});
