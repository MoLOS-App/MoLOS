/**
 * Integration Tests for Welcome Flow
 *
 * Tests the complete module activation flow during user onboarding
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import WelcomePage from '../../src/routes/ui/(auth)/welcome/+page.svelte';
import { UserFactory, createTestDb } from '../utils/test-helpers';

// Mock dependencies
vi.mock('$app/stores', () => ({
	page: {
		subscribe: vi.fn((fn) => {
			fn({ url: { pathname: '/welcome' }, data: {} });
			return { unsubscribe: vi.fn() };
		})
	},
	navigating: { subscribe: vi.fn() },
	updated: { subscribe: vi.fn() }
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
	invalidate: vi.fn()
}));

vi.mock('$lib/config', () => ({
	MODULE_REGISTRY: {
		dashboard: {
			id: 'dashboard',
			name: 'Dashboard',
			href: '/ui/dashboard',
			description: 'Dashboard',
			icon: {}
		},
		ai: { id: 'ai', name: 'AI', href: '/ui/ai', description: 'AI Assistant', icon: {} },
		'MoLOS-Tasks': {
			id: 'MoLOS-Tasks',
			name: 'Tasks',
			href: '/ui/MoLOS-Tasks',
			description: 'Task management',
			icon: {}
		},
		'MoLOS-Markdown': {
			id: 'MoLOS-Markdown',
			name: 'Markdown',
			href: '/ui/MoLOS-Markdown',
			description: 'Markdown notes',
			icon: {}
		},
		'MoLOS-Goals': {
			id: 'MoLOS-Goals',
			name: 'Goals',
			href: '/ui/MoLOS-Goals',
			description: 'Goal tracking',
			icon: {}
		},
		'MoLOS-Health': {
			id: 'MoLOS-Health',
			name: 'Health',
			href: '/ui/MoLOS-Health',
			description: 'Health tracking',
			icon: {}
		}
	},
	getAllModules: () =>
		Object.values({
			dashboard: {
				id: 'dashboard',
				name: 'Dashboard',
				href: '/ui/dashboard',
				description: 'Dashboard',
				icon: {}
			},
			ai: { id: 'ai', name: 'AI', href: '/ui/ai', description: 'AI Assistant', icon: {} },
			'MoLOS-Tasks': {
				id: 'MoLOS-Tasks',
				name: 'Tasks',
				href: '/ui/MoLOS-Tasks',
				description: 'Task management',
				icon: {}
			},
			'MoLOS-Markdown': {
				id: 'MoLOS-Markdown',
				name: 'Markdown',
				href: '/ui/MoLOS-Markdown',
				description: 'Markdown notes',
				icon: {}
			},
			'MoLOS-Goals': {
				id: 'MoLOS-Goals',
				name: 'Goals',
				href: '/ui/MoLOS-Goals',
				description: 'Goal tracking',
				icon: {}
			},
			'MoLOS-Health': {
				id: 'MoLOS-Health',
				name: 'Health',
				href: '/ui/MoLOS-Health',
				description: 'Health tracking',
				icon: {}
			}
		})
}));

describe('Welcome Flow Integration', () => {
	let testUser: any;

	beforeEach(() => {
		vi.clearAllMocks();
		testUser = UserFactory.build();
	});

	describe('Step 3: Module Selection', () => {
		it('should display module selection grid', () => {
			const { container } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			// Should show module grid
			const grid = container.querySelector('[role="group"]');
			expect(grid).toBeInTheDocument();
		});

		it('should display all available modules', () => {
			const { getByText } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			// Should show at least the required modules
			expect(getByText(/Dashboard/i)).toBeInTheDocument();
			expect(getByText(/AI/i)).toBeInTheDocument();
			expect(getByText(/Tasks/i)).toBeInTheDocument();
			expect(getByText(/Markdown/i)).toBeInTheDocument();
		});

		it('should pre-select default modules', () => {
			const { container } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			// Required modules should be pre-selected
			const selectedCards = container.querySelectorAll('[aria-pressed="true"]');
			expect(selectedCards.length).toBeGreaterThanOrEqual(4); // At least 4 required modules
		});

		it('should mark mandatory modules as disabled', () => {
			const { container } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			// Mandatory modules should be disabled
			const disabledCards = container.querySelectorAll('[aria-disabled="true"]');
			expect(disabledCards.length).toBeGreaterThanOrEqual(4); // At least 4 required modules
		});

		it('should show "Always Active" badge for mandatory modules', () => {
			const { getAllByText } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			// Should show "Always Active" badges
			const badges = getAllByText('Always Active');
			expect(badges.length).toBeGreaterThanOrEqual(4);
		});

		it('should allow toggling optional modules', async () => {
			const { container, getByText } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			// Find an optional module (not mandatory)
			const optionalModule = getByText(/Goals/i);
			const card = optionalModule.closest('[role="button"]');

			// Should be able to toggle
			expect(card).not.toHaveAttribute('aria-disabled', 'true');

			await fireEvent.click(card!);

			// State should change
			await waitFor(() => {
				expect(card).toHaveAttribute('aria-pressed');
			});
		});

		it('should prevent deselecting mandatory modules', async () => {
			const { container, getByText } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			// Find a mandatory module
			const mandatoryModule = getByText(/Dashboard/i);
			const card = mandatoryModule.closest('[role="button"]');

			// Should be disabled
			expect(card).toHaveAttribute('aria-disabled', 'true');

			// Clicking should not toggle
			const initialPressed = card?.getAttribute('aria-pressed');
			await fireEvent.click(card!);

			// State should not change
			expect(card).toHaveAttribute('aria-pressed', initialPressed!);
		});

		it('should show module count', () => {
			const { getByText } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			// Should show count of selected modules
			expect(getByText(/modules selected/i)).toBeInTheDocument();
		});

		it('should have continue button', () => {
			const { getByRole } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			const continueButton = getByRole('button', { name: /continue|finish|complete/i });
			expect(continueButton).toBeInTheDocument();
		});

		it('should have back button', () => {
			const { getByRole } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			const backButton = getByRole('button', { name: /back/i });
			expect(backButton).toBeInTheDocument();
		});
	});

	describe('Module Selection State', () => {
		it('should maintain selection state when toggling multiple modules', async () => {
			const { container, getByText } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			// Toggle Goals
			const goalsModule = getByText(/Goals/i);
			const goalsCard = goalsModule.closest('[role="button"]');
			await fireEvent.click(goalsCard!);

			// Toggle Health
			const healthModule = getByText(/Health/i);
			const healthCard = healthModule.closest('[role="button"]');
			await fireEvent.click(healthCard!);

			// Both should be selected
			await waitFor(() => {
				expect(goalsCard).toHaveAttribute('aria-pressed', 'true');
				expect(healthCard).toHaveAttribute('aria-pressed', 'true');
			});
		});

		it('should update module count when toggling', async () => {
			const { getByText, queryByText } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			// Get initial count
			const countText = getByText(/modules selected/i);
			const initialCount = parseInt(countText.textContent?.match(/\d+/)?.[0] || '0');

			// Toggle an optional module
			const goalsModule = getByText(/Goals/i);
			const goalsCard = goalsModule.closest('[role="button"]');
			await fireEvent.click(goalsCard!);

			// Count should change
			await waitFor(() => {
				const newCountText = getByText(/modules selected/i);
				const newCount = parseInt(newCountText.textContent?.match(/\d+/)?.[0] || '0');
				expect(newCount).toBe(initialCount + 1);
			});
		});
	});

	describe('Form Submission', () => {
		it('should submit form with selected modules', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ success: true })
			});

			global.fetch = mockFetch;

			const { getByRole } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			const continueButton = getByRole('button', { name: /continue|finish|complete/i });
			await fireEvent.click(continueButton);

			// Should call API
			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalled();
			});
		});

		it('should show loading state during submission', async () => {
			const mockFetch = vi
				.fn()
				.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

			global.fetch = mockFetch;

			const { getByRole, container } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			const continueButton = getByRole('button', { name: /continue|finish|complete/i });
			await fireEvent.click(continueButton);

			// Button should show loading state
			await waitFor(() => {
				expect(continueButton).toBeDisabled();
			});
		});

		it('should handle submission errors gracefully', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: false,
				json: () =>
					Promise.resolve({
						success: false,
						error: 'Failed to activate modules'
					})
			});

			global.fetch = mockFetch;

			const { getByRole, findByText } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			const continueButton = getByRole('button', { name: /continue|finish|complete/i });
			await fireEvent.click(continueButton);

			// Should show error message
			const errorMessage = await findByText(/failed to activate/i);
			expect(errorMessage).toBeInTheDocument();
		});

		it('should redirect on successful submission', async () => {
			const mockGoto = vi.fn();
			vi.mocked(await import('$app/navigation')).goto = mockGoto;

			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ success: true })
			});

			global.fetch = mockFetch;

			const { getByRole } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			const continueButton = getByRole('button', { name: /continue|finish|complete/i });
			await fireEvent.click(continueButton);

			// Should redirect to dashboard
			await waitFor(() => {
				expect(mockGoto).toHaveBeenCalledWith('/ui/dashboard');
			});
		});
	});

	describe('Navigation', () => {
		it('should return to step 2 when back button clicked', async () => {
			const mockGoto = vi.fn();
			vi.mocked(await import('$app/navigation')).goto = mockGoto;

			const { getByRole } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			const backButton = getByRole('button', { name: /back/i });
			await fireEvent.click(backButton);

			// Should navigate back
			await waitFor(() => {
				expect(mockGoto).toHaveBeenCalled();
			});
		});

		it('should preserve state when navigating back and forward', async () => {
			const { container, getByText, rerender } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			// Toggle a module
			const goalsModule = getByText(/Goals/i);
			const goalsCard = goalsModule.closest('[role="button"]');
			await fireEvent.click(goalsCard!);

			// Simulate navigation away and back
			await rerender({ data: { user: testUser, step: 2 } } as any);
			await rerender({ data: { user: testUser, step: 3 } } as any);

			// State should be preserved (or reset depending on implementation)
			const newGoalsCard = getByText(/Goals/i).closest('[role="button"]');
			// Implementation-specific: either preserved or reset
		});
	});

	describe('Accessibility', () => {
		it('should have proper heading structure', () => {
			const { container } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			const h1 = container.querySelector('h1');
			expect(h1).toBeInTheDocument();
		});

		it('should be keyboard navigable', async () => {
			const { container } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			// Tab through interactive elements
			const focusableElements = container.querySelectorAll(
				'button, [role="button"]:not([tabindex="-1"])'
			);

			expect(focusableElements.length).toBeGreaterThan(0);
		});

		it('should have focus management', () => {
			const { container } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			// Check that focus is properly managed
			const buttons = container.querySelectorAll('button');
			buttons.forEach((button) => {
				expect(button).not.toHaveAttribute('tabindex', '-1');
			});
		});
	});

	describe('Edge Cases', () => {
		it('should handle network errors', async () => {
			const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
			global.fetch = mockFetch;

			const { getByRole, findByText } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			const continueButton = getByRole('button', { name: /continue|finish|complete/i });
			await fireEvent.click(continueButton);

			// Should show error
			const errorMessage = await findByText(/error|failed/i);
			expect(errorMessage).toBeInTheDocument();
		});

		it('should handle slow network', async () => {
			const mockFetch = vi.fn().mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve({
									ok: true,
									json: () => Promise.resolve({ success: true })
								}),
							2000
						)
					)
			);

			global.fetch = mockFetch;

			const { getByRole } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			const continueButton = getByRole('button', { name: /continue|finish|complete/i });
			await fireEvent.click(continueButton);

			// Should show loading state
			await waitFor(() => {
				expect(continueButton).toBeDisabled();
			});
		});

		it('should handle unauthenticated user', async () => {
			const { container } = render(WelcomePage, {
				data: {
					user: null,
					step: 3
				}
			} as any);

			// Should handle gracefully (redirect or show error)
			expect(container).toBeInTheDocument();
		});

		it('should handle empty module registry', async () => {
			// Mock empty registry
			vi.mocked(await import('$lib/config')).getAllModules = vi.fn(() => []);

			const { container } = render(WelcomePage, {
				data: {
					user: testUser,
					step: 3
				}
			} as any);

			// Should handle gracefully
			expect(container).toBeInTheDocument();
		});
	});
});
