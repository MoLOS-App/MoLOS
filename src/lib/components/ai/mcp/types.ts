export interface DataTableColumn<T> {
	key: keyof T | string;
	label: string;
	render?: (row: T) => string;
	class?: string;
}

export interface DataTableAction<T> {
	icon: any;
	label: string;
	variant?: 'ghost' | 'outline' | 'destructive';
	onClick: (row: T) => void;
	disabled?: (row: T) => boolean;
	hide?: (row: T) => boolean;
}

export interface DataTableFilter {
	key: string;
	label: string;
	options: { value: string; label: string }[];
}

export interface Tool {
	name: string;
	fullName: string;
	description: string;
	submodule: string;
}

export interface SubmoduleData {
	tools: Tool[];
	submoduleCount: number;
}

export interface ModuleData {
	id: string;
	name: string;
	description: string;
	isExternal: boolean;
	submodules: Map<string, SubmoduleData>;
}

export interface ApiKeyInfo {
	id: string;
	name: string;
	keyPrefix: string;
	status: 'active' | 'disabled' | 'revoked';
	createdAt: string | Date;
	lastUsedAt: string | Date | null;
	expiresAt: string | Date | null;
}
