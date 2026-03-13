import { relations } from 'drizzle-orm/relations';
import {
	user,
	account,
	apikey,
	session,
	settingsModules,
	settingsUser,
	aiMemories,
	aiSessions,
	aiMessages,
	telegramSessions,
	telegramMessages,
	telegramSettings,
	aiMcpApiKeys,
	aiMcpLogs,
	aiMcpPrompts,
	aiMcpResources,
	aiMcpOauthClients,
	aiMcpOauthCodes,
	aiMcpOauthTokens,
	aiSettings,
	moLosAiKnowledgeLlmFiles,
	moLosAiKnowledgeLlmFileVersions,
	moLosAiKnowledgePrompts,
	moLosAiKnowledgePromptDeployments,
	moLosAiKnowledgePromptVersions,
	moLosGoogleAccounts,
	moLosGoogleAccountPermissions,
	moLosGoogleAccountTokens,
	moLosGoogleCalendars,
	moLosGoogleCalendarEvents,
	moLosGoogleDriveItems,
	moLosGoogleGmailDrafts,
	moLosGoogleGmailLabels,
	moLosGoogleGmailThreads,
	moLosGoogleGmailMessages,
	moLosGoogleKeepLabels,
	moLosGoogleKeepNotes,
	moLosGoogleServiceSyncs,
	moLosTasksCustomFields,
	moLosTasksCustomFieldValues,
	moLosTasksTasks,
	moLosTasksDependencies
} from './schema';

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	})
}));

export const userRelations = relations(user, ({ many }) => ({
	accounts: many(account),
	apikeys: many(apikey),
	sessions: many(session),
	settingsModules: many(settingsModules),
	settingsUsers: many(settingsUser),
	aiMemories: many(aiMemories),
	aiMessages: many(aiMessages),
	aiSessions: many(aiSessions),
	telegramMessages: many(telegramMessages),
	telegramSessions: many(telegramSessions),
	telegramSettings: many(telegramSettings),
	aiMcpApiKeys: many(aiMcpApiKeys),
	aiMcpLogs: many(aiMcpLogs),
	aiMcpPrompts: many(aiMcpPrompts),
	aiMcpResources: many(aiMcpResources),
	aiMcpOauthClients: many(aiMcpOauthClients),
	aiMcpOauthCodes: many(aiMcpOauthCodes),
	aiMcpOauthTokens: many(aiMcpOauthTokens),
	aiSettings: many(aiSettings)
}));

export const apikeyRelations = relations(apikey, ({ one }) => ({
	user: one(user, {
		fields: [apikey.userId],
		references: [user.id]
	})
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	})
}));

export const settingsModulesRelations = relations(settingsModules, ({ one }) => ({
	user: one(user, {
		fields: [settingsModules.userId],
		references: [user.id]
	})
}));

export const settingsUserRelations = relations(settingsUser, ({ one }) => ({
	user: one(user, {
		fields: [settingsUser.userId],
		references: [user.id]
	})
}));

export const aiMemoriesRelations = relations(aiMemories, ({ one }) => ({
	user: one(user, {
		fields: [aiMemories.userId],
		references: [user.id]
	})
}));

export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
	aiSession: one(aiSessions, {
		fields: [aiMessages.sessionId],
		references: [aiSessions.id]
	}),
	user: one(user, {
		fields: [aiMessages.userId],
		references: [user.id]
	})
}));

export const aiSessionsRelations = relations(aiSessions, ({ one, many }) => ({
	aiMessages: many(aiMessages),
	user: one(user, {
		fields: [aiSessions.userId],
		references: [user.id]
	}),
	telegramSessions: many(telegramSessions)
}));

export const telegramMessagesRelations = relations(telegramMessages, ({ one }) => ({
	telegramSession: one(telegramSessions, {
		fields: [telegramMessages.sessionId],
		references: [telegramSessions.id]
	}),
	user: one(user, {
		fields: [telegramMessages.userId],
		references: [user.id]
	})
}));

export const telegramSessionsRelations = relations(telegramSessions, ({ one, many }) => ({
	telegramMessages: many(telegramMessages),
	user: one(user, {
		fields: [telegramSessions.userId],
		references: [user.id]
	}),
	aiSession: one(aiSessions, {
		fields: [telegramSessions.aiSessionId],
		references: [aiSessions.id]
	})
}));

export const telegramSettingsRelations = relations(telegramSettings, ({ one }) => ({
	user: one(user, {
		fields: [telegramSettings.userId],
		references: [user.id]
	})
}));

export const aiMcpApiKeysRelations = relations(aiMcpApiKeys, ({ one, many }) => ({
	user: one(user, {
		fields: [aiMcpApiKeys.userId],
		references: [user.id]
	}),
	aiMcpLogs: many(aiMcpLogs)
}));

export const aiMcpLogsRelations = relations(aiMcpLogs, ({ one }) => ({
	aiMcpApiKey: one(aiMcpApiKeys, {
		fields: [aiMcpLogs.apiKeyId],
		references: [aiMcpApiKeys.id]
	}),
	user: one(user, {
		fields: [aiMcpLogs.userId],
		references: [user.id]
	})
}));

export const aiMcpPromptsRelations = relations(aiMcpPrompts, ({ one }) => ({
	user: one(user, {
		fields: [aiMcpPrompts.userId],
		references: [user.id]
	})
}));

export const aiMcpResourcesRelations = relations(aiMcpResources, ({ one }) => ({
	user: one(user, {
		fields: [aiMcpResources.userId],
		references: [user.id]
	})
}));

export const aiMcpOauthClientsRelations = relations(aiMcpOauthClients, ({ one, many }) => ({
	user: one(user, {
		fields: [aiMcpOauthClients.userId],
		references: [user.id]
	}),
	aiMcpOauthCodes: many(aiMcpOauthCodes),
	aiMcpOauthTokens: many(aiMcpOauthTokens)
}));

export const aiMcpOauthCodesRelations = relations(aiMcpOauthCodes, ({ one }) => ({
	user: one(user, {
		fields: [aiMcpOauthCodes.userId],
		references: [user.id]
	}),
	aiMcpOauthClient: one(aiMcpOauthClients, {
		fields: [aiMcpOauthCodes.clientId],
		references: [aiMcpOauthClients.id]
	})
}));

export const aiMcpOauthTokensRelations = relations(aiMcpOauthTokens, ({ one, many }) => ({
	aiMcpOauthToken: one(aiMcpOauthTokens, {
		fields: [aiMcpOauthTokens.refreshTokenId],
		references: [aiMcpOauthTokens.id],
		relationName: 'aiMcpOauthTokens_refreshTokenId_aiMcpOauthTokens_id'
	}),
	aiMcpOauthTokens: many(aiMcpOauthTokens, {
		relationName: 'aiMcpOauthTokens_refreshTokenId_aiMcpOauthTokens_id'
	}),
	user: one(user, {
		fields: [aiMcpOauthTokens.userId],
		references: [user.id]
	}),
	aiMcpOauthClient: one(aiMcpOauthClients, {
		fields: [aiMcpOauthTokens.clientId],
		references: [aiMcpOauthClients.id]
	})
}));

export const aiSettingsRelations = relations(aiSettings, ({ one }) => ({
	user: one(user, {
		fields: [aiSettings.userId],
		references: [user.id]
	})
}));

export const moLosAiKnowledgeLlmFileVersionsRelations = relations(
	moLosAiKnowledgeLlmFileVersions,
	({ one }) => ({
		moLosAiKnowledgeLlmFile: one(moLosAiKnowledgeLlmFiles, {
			fields: [moLosAiKnowledgeLlmFileVersions.llmFileId],
			references: [moLosAiKnowledgeLlmFiles.id]
		})
	})
);

export const moLosAiKnowledgeLlmFilesRelations = relations(
	moLosAiKnowledgeLlmFiles,
	({ many }) => ({
		moLosAiKnowledgeLlmFileVersions: many(moLosAiKnowledgeLlmFileVersions)
	})
);

export const moLosAiKnowledgePromptDeploymentsRelations = relations(
	moLosAiKnowledgePromptDeployments,
	({ one }) => ({
		moLosAiKnowledgePrompt: one(moLosAiKnowledgePrompts, {
			fields: [moLosAiKnowledgePromptDeployments.promptId],
			references: [moLosAiKnowledgePrompts.id]
		})
	})
);

export const moLosAiKnowledgePromptsRelations = relations(moLosAiKnowledgePrompts, ({ many }) => ({
	moLosAiKnowledgePromptDeployments: many(moLosAiKnowledgePromptDeployments),
	moLosAiKnowledgePromptVersions: many(moLosAiKnowledgePromptVersions)
}));

export const moLosAiKnowledgePromptVersionsRelations = relations(
	moLosAiKnowledgePromptVersions,
	({ one }) => ({
		moLosAiKnowledgePrompt: one(moLosAiKnowledgePrompts, {
			fields: [moLosAiKnowledgePromptVersions.promptId],
			references: [moLosAiKnowledgePrompts.id]
		})
	})
);

export const moLosGoogleAccountPermissionsRelations = relations(
	moLosGoogleAccountPermissions,
	({ one }) => ({
		moLosGoogleAccount: one(moLosGoogleAccounts, {
			fields: [moLosGoogleAccountPermissions.accountId],
			references: [moLosGoogleAccounts.id]
		})
	})
);

export const moLosGoogleAccountsRelations = relations(moLosGoogleAccounts, ({ many }) => ({
	moLosGoogleAccountPermissions: many(moLosGoogleAccountPermissions),
	moLosGoogleAccountTokens: many(moLosGoogleAccountTokens),
	moLosGoogleCalendarEvents: many(moLosGoogleCalendarEvents),
	moLosGoogleCalendars: many(moLosGoogleCalendars),
	moLosGoogleDriveItems: many(moLosGoogleDriveItems),
	moLosGoogleGmailDrafts: many(moLosGoogleGmailDrafts),
	moLosGoogleGmailLabels: many(moLosGoogleGmailLabels),
	moLosGoogleGmailMessages: many(moLosGoogleGmailMessages),
	moLosGoogleGmailThreads: many(moLosGoogleGmailThreads),
	moLosGoogleKeepLabels: many(moLosGoogleKeepLabels),
	moLosGoogleKeepNotes: many(moLosGoogleKeepNotes),
	moLosGoogleServiceSyncs: many(moLosGoogleServiceSyncs)
}));

export const moLosGoogleAccountTokensRelations = relations(moLosGoogleAccountTokens, ({ one }) => ({
	moLosGoogleAccount: one(moLosGoogleAccounts, {
		fields: [moLosGoogleAccountTokens.accountId],
		references: [moLosGoogleAccounts.id]
	})
}));

export const moLosGoogleCalendarEventsRelations = relations(
	moLosGoogleCalendarEvents,
	({ one }) => ({
		moLosGoogleCalendar: one(moLosGoogleCalendars, {
			fields: [moLosGoogleCalendarEvents.calendarId],
			references: [moLosGoogleCalendars.id]
		}),
		moLosGoogleAccount: one(moLosGoogleAccounts, {
			fields: [moLosGoogleCalendarEvents.accountId],
			references: [moLosGoogleAccounts.id]
		})
	})
);

export const moLosGoogleCalendarsRelations = relations(moLosGoogleCalendars, ({ one, many }) => ({
	moLosGoogleCalendarEvents: many(moLosGoogleCalendarEvents),
	moLosGoogleAccount: one(moLosGoogleAccounts, {
		fields: [moLosGoogleCalendars.accountId],
		references: [moLosGoogleAccounts.id]
	})
}));

export const moLosGoogleDriveItemsRelations = relations(moLosGoogleDriveItems, ({ one }) => ({
	moLosGoogleAccount: one(moLosGoogleAccounts, {
		fields: [moLosGoogleDriveItems.accountId],
		references: [moLosGoogleAccounts.id]
	})
}));

export const moLosGoogleGmailDraftsRelations = relations(moLosGoogleGmailDrafts, ({ one }) => ({
	moLosGoogleAccount: one(moLosGoogleAccounts, {
		fields: [moLosGoogleGmailDrafts.accountId],
		references: [moLosGoogleAccounts.id]
	})
}));

export const moLosGoogleGmailLabelsRelations = relations(moLosGoogleGmailLabels, ({ one }) => ({
	moLosGoogleAccount: one(moLosGoogleAccounts, {
		fields: [moLosGoogleGmailLabels.accountId],
		references: [moLosGoogleAccounts.id]
	})
}));

export const moLosGoogleGmailMessagesRelations = relations(moLosGoogleGmailMessages, ({ one }) => ({
	moLosGoogleGmailThread: one(moLosGoogleGmailThreads, {
		fields: [moLosGoogleGmailMessages.threadId],
		references: [moLosGoogleGmailThreads.id]
	}),
	moLosGoogleAccount: one(moLosGoogleAccounts, {
		fields: [moLosGoogleGmailMessages.accountId],
		references: [moLosGoogleAccounts.id]
	})
}));

export const moLosGoogleGmailThreadsRelations = relations(
	moLosGoogleGmailThreads,
	({ one, many }) => ({
		moLosGoogleGmailMessages: many(moLosGoogleGmailMessages),
		moLosGoogleAccount: one(moLosGoogleAccounts, {
			fields: [moLosGoogleGmailThreads.accountId],
			references: [moLosGoogleAccounts.id]
		})
	})
);

export const moLosGoogleKeepLabelsRelations = relations(moLosGoogleKeepLabels, ({ one }) => ({
	moLosGoogleAccount: one(moLosGoogleAccounts, {
		fields: [moLosGoogleKeepLabels.accountId],
		references: [moLosGoogleAccounts.id]
	})
}));

export const moLosGoogleKeepNotesRelations = relations(moLosGoogleKeepNotes, ({ one }) => ({
	moLosGoogleAccount: one(moLosGoogleAccounts, {
		fields: [moLosGoogleKeepNotes.accountId],
		references: [moLosGoogleAccounts.id]
	})
}));

export const moLosGoogleServiceSyncsRelations = relations(moLosGoogleServiceSyncs, ({ one }) => ({
	moLosGoogleAccount: one(moLosGoogleAccounts, {
		fields: [moLosGoogleServiceSyncs.accountId],
		references: [moLosGoogleAccounts.id]
	})
}));

export const moLosTasksCustomFieldValuesRelations = relations(
	moLosTasksCustomFieldValues,
	({ one }) => ({
		moLosTasksCustomField: one(moLosTasksCustomFields, {
			fields: [moLosTasksCustomFieldValues.fieldId],
			references: [moLosTasksCustomFields.id]
		}),
		moLosTasksTask: one(moLosTasksTasks, {
			fields: [moLosTasksCustomFieldValues.taskId],
			references: [moLosTasksTasks.id]
		})
	})
);

export const moLosTasksCustomFieldsRelations = relations(moLosTasksCustomFields, ({ many }) => ({
	moLosTasksCustomFieldValues: many(moLosTasksCustomFieldValues)
}));

export const moLosTasksTasksRelations = relations(moLosTasksTasks, ({ many }) => ({
	moLosTasksCustomFieldValues: many(moLosTasksCustomFieldValues),
	moLosTasksDependencies_dependsOnTaskId: many(moLosTasksDependencies, {
		relationName: 'moLosTasksDependencies_dependsOnTaskId_moLosTasksTasks_id'
	}),
	moLosTasksDependencies_taskId: many(moLosTasksDependencies, {
		relationName: 'moLosTasksDependencies_taskId_moLosTasksTasks_id'
	})
}));

export const moLosTasksDependenciesRelations = relations(moLosTasksDependencies, ({ one }) => ({
	moLosTasksTask_dependsOnTaskId: one(moLosTasksTasks, {
		fields: [moLosTasksDependencies.dependsOnTaskId],
		references: [moLosTasksTasks.id],
		relationName: 'moLosTasksDependencies_dependsOnTaskId_moLosTasksTasks_id'
	}),
	moLosTasksTask_taskId: one(moLosTasksTasks, {
		fields: [moLosTasksDependencies.taskId],
		references: [moLosTasksTasks.id],
		relationName: 'moLosTasksDependencies_taskId_moLosTasksTasks_id'
	})
}));
