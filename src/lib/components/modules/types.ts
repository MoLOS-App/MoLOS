export interface ModuleState {
	enabled: boolean;
	menuOrder: number;
	submodules: Record<string, boolean>;
}

export interface ModuleData {
	id: string;
	name: string;
	description: string;
	href: string;
	isExternal: boolean;
	status: string;
	lastError?: string;
	gitRef?: string;
	blockUpdates?: boolean;
	menuOrder: number;
	navigation: { name: string; disabled?: boolean }[];
	repoUrl?: string; // For external modules to check if local
}

export type ModuleStatus = 'active' | 'pending' | 'deleting' | 'error_manifest' | 'error_migration' | 'error_config' | 'disabled';

export interface ExternalModuleActionHandlers {
	onDelete?: (moduleId: string) => void;
	onCancel?: (moduleId: string) => void;
	onToggleBlockUpdates?: (moduleId: string, currentState: boolean) => void;
	onForcePull?: (moduleId: string) => void;
	onToggleEnabled?: (moduleId: string) => void;
	onChangeGitRef?: (moduleId: string, moduleName: string, currentRef: string) => void;
}
