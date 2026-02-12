/**
 * Multi-Agent module exports
 */

export {
	createDelegationTool,
	createModuleDelegationTools,
	createLocalModuleTool,
	generateModuleDescriptions,
} from './delegation-tools';

export {
	ModuleRegistry,
	getModuleRegistry,
	resetModuleRegistry,
} from './module-registry';

export type {
	ModuleHealthResponse,
	DelegationRequest,
	DelegationResponse,
	ModuleCapabilitiesResponse,
} from './module-spec';
