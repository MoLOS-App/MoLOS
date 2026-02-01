export type SearchResult = {
	moduleId: string;
	moduleName?: string;
	entityType: string;
	entityId: string;
	title: string;
	snippet?: string;
	href: string;
	updatedAt?: number;
	score?: number;
};

export type SearchResponse = {
	query: string;
	results: SearchResult[];
	total: number;
};
