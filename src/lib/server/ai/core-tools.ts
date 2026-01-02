// import { ActivityLogRepository } from '$lib/repositories/health/activity-log-repository';
import { getAllModules } from '$lib/config';
// import { TaskRepository } from '$lib/repositories/tasks/task-repository';
// import { DailyLogRepository } from '$lib/repositories/tasks/daily-log-repository';
// import { ExpenseRepository } from '$lib/repositories/finance/expense-repository';
import type { ToolDefinition } from '$lib/models/ai';

/**
 * This file defines the global/system-level AI tools for MoLOS.
 * Module-specific tools are now defined in their respective module configurations.
 */

export function getCoreAiTools(userId: string): ToolDefinition[] {
	// const taskRepo = new TaskRepository();
	// const dailyLogRepo = new DailyLogRepository();
	// const expenseRepo = new ExpenseRepository();
	// const activityRepo = new ActivityLogRepository();

	return [
		{
			name: 'get_active_modules',
			description: 'Lists all currently active modules in the system.',
			parameters: {
				type: 'object',
				properties: {}
			},
			execute: async () => {
				const allModules = getAllModules();
				return allModules.map((m) => ({ id: m.id, name: m.name, description: m.description }));
			}
		},
		{
			name: 'get_user_profile',
			description:
				"Retrieves the current user's profile information, including their ID and any relevant settings.",
			parameters: {
				type: 'object',
				properties: {}
			},
			execute: async () => {
				return { userId };
			}
		},
		{
			name: 'get_current_time',
			description:
				'Returns the current date and time in ISO format. Use this to calculate relative dates or timestamps.',
			parameters: {
				type: 'object',
				properties: {}
			},
			execute: async () => {
				return { iso: new Date().toISOString(), timestamp: Math.floor(Date.now() / 1000) };
			}
		},
		{
			name: 'search_codebase',
			description:
				'Searches the codebase for specific patterns or keywords. Use this to understand how modules are implemented or to find specific logic.',
			parameters: {
				type: 'object',
				properties: {
					query: { type: 'string', description: 'The search query or regex pattern.' },
					path: { type: 'string', description: 'Optional subdirectory to limit the search.' }
				},
				required: ['query']
			},
			execute: async () => {
				return { message: 'Codebase search is handled by the system.' };
			}
		},
		{
			name: 'list_files',
			description: 'Lists files in a directory to understand the project structure.',
			parameters: {
				type: 'object',
				properties: {
					path: { type: 'string', description: 'The directory path.' },
					recursive: { type: 'boolean', description: 'Whether to list files recursively.' }
				},
				required: ['path']
			},
			execute: async () => {
				return { message: 'File listing is handled by the system.' };
			}
		},
		{
			name: 'save_memory',
			description:
				'Saves important information about the user, their preferences, or key context for future reference. Use this when the user shares something they want you to remember.',
			parameters: {
				type: 'object',
				properties: {
					content: { type: 'string', description: 'The information to remember.' },
					importance: {
						type: 'number',
						description: 'Importance level from 1 to 5 (5 being most important).',
						minimum: 1,
						maximum: 5
					}
				},
				required: ['content']
			},
			execute: async () => {
				// The actual implementation is handled in AiAgent.executeAction to avoid circular dependencies
				return { success: true, message: 'Memory saved.' };
			}
		},
		{
			name: 'get_daily_summary',
			description:
				'Retrieves a comprehensive summary of the user\'s day, including pending tasks, completed routines, financial expenses, and health activities. Use this to provide a "daily briefing" or to understand the user\'s current state.',
			parameters: {
				type: 'object',
				properties: {
					date: {
						type: 'string',
						description:
							'The target date in ISO format (YYYY-MM-DD). Defaults to the current date if not provided.'
					}
				}
			},
			execute: async (params) => {
				const targetDate = params.date ? new Date(params.date) : new Date();
				const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0)).getTime() / 1000;
				const endOfDay = startOfDay + 86400;

				// TODO: Implement repositories for tasks, daily logs, expenses, and activities
				// For now, return empty data structure
				const tasks: unknown[] = [];
				const dailyLog = null;
				const expenses: unknown[] = [];
				const activities: unknown[] = [];

				const todaysTasks = (tasks as any[]).filter(
					(t) =>
						(t.dueDate && t.dueDate >= startOfDay && t.dueDate < endOfDay) ||
						(t.doDate && t.doDate >= startOfDay && t.doDate < endOfDay)
				);

				const todaysExpenses = expenses.filter((e) => {
					const eDate = new Date(e.date).getTime() / 1000;
					return eDate >= startOfDay && eDate < endOfDay;
				});

				const todaysActivities = activities.filter((a) => {
					const aDate = new Date(a.timestamp).getTime() / 1000;
					return aDate >= startOfDay && aDate < endOfDay;
				});

				return {
					date: targetDate.toISOString().split('T')[0],
					tasks: {
						total: todaysTasks.length,
						completed: todaysTasks.filter((t) => t.isCompleted).length,
						pending: todaysTasks.filter((t) => !t.isCompleted).length,
						items: todaysTasks.map((t) => ({ title: t.title, status: t.status }))
					},
					routines: dailyLog
						? {
								morning: dailyLog.morningRoutine,
								evening: dailyLog.eveningRoutine,
								mood: dailyLog.mood,
								notes: dailyLog.notes
							}
						: 'No daily log found for today.',
					finance: {
						expensesCount: todaysExpenses.length,
						totalAmount: todaysExpenses.reduce((sum, e) => sum + e.amount, 0)
					},
					health: {
						activitiesCount: todaysActivities.length
					}
				};
			}
		}
	];
}
