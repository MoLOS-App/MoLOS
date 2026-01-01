import type { PageServerLoad } from './$types';
import { getAllModules } from '$lib/config/modules';
import { SettingsRepository } from '$lib/repositories/settings/settings-repository';

export const load: PageServerLoad = async ({ fetch, locals }) => {
	const userId = locals.user?.id;
	const settingsRepo = new SettingsRepository();
	const moduleStates = userId ? await settingsRepo.getModuleStates(userId) : [];

	const modules = getAllModules()
		.filter((m) => m.id !== 'dashboard')
		.filter((m) => {
			const state = moduleStates.find((s) => s.moduleId === m.id && s.submoduleId === 'main');
			return state ? state.enabled : true; // Default to enabled if no state found
		});
	const [tasksRes, healthRes, financeRes, goalsRes, mealsRes] = await Promise.allSettled([
		fetch('/api/tasks'),
		fetch('/api/health/weight'),
		fetch('/api/finance/expenses'),
		fetch('/api/goals'),
		fetch('/api/meals')
	]);

	// Helper to safely parse JSON from settled promises
	const getJson = async (res: PromiseSettledResult<Response>) => {
		if (res.status === 'fulfilled' && res.value.ok) {
			try {
				return await res.value.json();
			} catch (e) {
				return null;
			}
		}
		return null;
	};

	const tasks = (await getJson(tasksRes)) || [];
	const health = (await getJson(healthRes)) || [];
	const finance = (await getJson(financeRes)) || [];
	const goals = (await getJson(goalsRes)) || [];
	const meals = (await getJson(mealsRes)) || [];

	// Process Tasks
	const totalTasks = tasks.length;
	const activeTasks = tasks.filter((t: any) => !t.completed).length;
	const completedTasks = totalTasks - activeTasks;

	// Process Health (Latest weight)
	const latestWeight =
		health.length > 0 ? health.sort((a: any, b: any) => b.timestamp - a.timestamp)[0] : null;

	// Process Finance (Current month expenses)
	const now = new Date();
	const currentMonth = now.getMonth();
	const currentYear = now.getFullYear();
	const monthlyExpenses = finance.filter((e: any) => {
		const d = new Date(e.date);
		return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
	});
	const monthlySpend = monthlyExpenses.reduce((acc: number, e: any) => acc + Number(e.amount), 0);

	// Process Goals
	const activeGoals = goals.filter((g: any) => g.status === 'in_progress');
	const avgGoalProgress =
		activeGoals.length > 0
			? activeGoals.reduce(
					(acc: number, g: any) => acc + (g.currentValue / g.targetValue) * 100,
					0
				) / activeGoals.length
			: 0;

	// Process Meals (Today's meals)
	const todayStr = now.toISOString().split('T')[0];
	const todayMeals = meals.filter((m: any) => m.plannedDate === todayStr);

	return {
		user: locals.user,
		modules: modules.map((m) => ({
			id: m.id,
			name: m.name,
			href: m.href,
			description: m.description
		})),
		stats: {
			tasks: {
				total: totalTasks,
				active: activeTasks,
				completed: completedTasks,
				recent: tasks.filter((t: any) => !t.completed).slice(0, 3)
			},
			health: {
				latest: latestWeight,
				count: health.length
			},
			finance: {
				monthlySpend,
				currency: monthlyExpenses[0]?.currency || 'USD',
				count: monthlyExpenses.length
			},
			goals: {
				activeCount: activeGoals.length,
				avgProgress: Math.round(avgGoalProgress)
			},
			meals: {
				today: todayMeals
			}
		}
	};
};
