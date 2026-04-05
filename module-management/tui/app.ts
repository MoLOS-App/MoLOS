import blessed from 'blessed';
import { spawn } from 'child_process';
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import { parse, stringify } from 'yaml';
import type { SettingsRepository } from '../../src/lib/repositories/settings/settings-repository';
import { EXTERNAL_MODULES_DIR } from './constants';
import {
	findUserByIdentifier as findUserByIdentifierInDb,
	listTablesWithCounts,
	listUsers as listUsersFromDb,
	removeUser as removeUserFromDb,
	resetUserPassword as resetUserPasswordInDb,
	runSqlQuery,
	updateUserRole as updateUserRoleInDb
} from './db';
import { listModulesFromFilesystem } from './fs';
import { mergeModuleData, moduleStructureSummary } from './merge';
import type { ModuleRecord } from './types';
import type { UserRecord } from './db';

type ActionItem = {
	label: string;
	run?: () => Promise<void>;
	enabled?: boolean;
	shortcut?: string;
};

type Layout = {
	header: blessed.Widgets.BoxElement;
	footer: blessed.Widgets.BoxElement;
	modules: blessed.Widgets.ListElement;
	actions: blessed.Widgets.ListElement;
	moduleActions: blessed.Widgets.ListElement;
	logs: blessed.Widgets.Log;
	db: blessed.Widgets.ListElement;
	prompt: blessed.Widgets.PromptElement;
};

export class ModuleTUI {
	private screen: blessed.Widgets.Screen;
	private layout: Layout;
	private modules: ModuleRecord[] = [];
	private actions: ActionItem[] = [];
	private moduleActions: ActionItem[] = [];
	private selectedModuleId: string | null = null;
	private activeProcess: ReturnType<typeof spawn> | null = null;
	private activeProcessLabel: string | null = null;
	private logsFullscreen = false;

	constructor(private settingsRepo: SettingsRepository) {
		this.screen = blessed.screen({
			smartCSR: true,
			title: 'MoLOS-CLI'
		});
		this.layout = this.createLayout();
	}

	async run() {
		this.bindKeys();
		await this.refreshModules();
		await this.refreshDbTables();
		this.actionsFocus();
		this.screen.render();
	}

	private createLayout(): Layout {
		const header = blessed.box({
			parent: this.screen,
			top: 0,
			left: 0,
			height: 2,
			width: '100%',
			content: ' MoLOS-CLI — Module Management ',
			style: { fg: 'black', bg: 'white' }
		});

		const footer = blessed.box({
			parent: this.screen,
			bottom: 0,
			left: 0,
			height: 1,
			width: '100%',
			content:
				' Tab: switch | Enter: select | n: new | c: clone | d: dev | v: validate | t: test | y: sync | o: open | m: root | k: stop | f: logs | q: quit ',
			style: { fg: 'white', bg: 'gray' }
		});

		const modules = blessed.list({
			parent: this.screen,
			label: ' Submodules ',
			tags: true,
			border: 'line',
			keys: true,
			mouse: true,
			scrollbar: {
				ch: ' ',
				inverse: true
			},
			style: {
				fg: 'white',
				bg: 'black',
				border: { fg: 'gray' },
				item: { fg: 'white', bg: 'black' },
				selected: { bg: 'blue', fg: 'white' }
			}
		});

		const actions = blessed.list({
			parent: this.screen,
			label: ' General Scripts ',
			tags: true,
			border: 'line',
			keys: true,
			mouse: true,
			scrollbar: {
				ch: ' ',
				inverse: true
			},
			style: {
				fg: 'white',
				bg: 'black',
				border: { fg: 'gray' },
				selected: { bg: 'blue', fg: 'white' }
			}
		});

		const moduleActions = blessed.list({
			parent: this.screen,
			label: ' Module Actions ',
			tags: true,
			border: 'line',
			keys: true,
			mouse: true,
			scrollbar: {
				ch: ' ',
				inverse: true
			},
			style: {
				fg: 'white',
				bg: 'black',
				border: { fg: 'gray' },
				selected: { bg: 'blue', fg: 'white' }
			}
		});

		const logs = blessed.log({
			parent: this.screen,
			label: ' Logs / Output ',
			tags: true,
			border: 'line',
			scrollable: true,
			keys: true,
			mouse: true,
			alwaysScroll: true,
			style: {
				fg: 'white',
				bg: 'black',
				border: { fg: 'gray' }
			},
			scrollbar: {
				ch: ' ',
				inverse: true
			}
		});

		const db = blessed.list({
			parent: this.screen,
			label: ' DB Explorer ',
			tags: true,
			border: 'line',
			keys: true,
			mouse: true,
			style: {
				fg: 'white',
				bg: 'black',
				border: { fg: 'gray' },
				selected: { bg: 'blue', fg: 'white' }
			}
		});

		const prompt = blessed.prompt({
			parent: this.screen,
			border: 'line',
			height: 8,
			width: '60%',
			top: 'center',
			left: 'center',
			label: ' Input ',
			tags: true,
			hidden: true,
			style: {
				fg: 'white',
				bg: 'black',
				border: { fg: 'gray' }
			}
		});

		this.applyLayout(header, footer, modules, actions, moduleActions, logs, db);
		this.screen.on('resize', () =>
			this.applyLayout(header, footer, modules, actions, moduleActions, logs, db)
		);

		return { header, footer, modules, actions, moduleActions, logs, db, prompt };
	}

	private applyLayout(
		header: blessed.Widgets.BoxElement,
		footer: blessed.Widgets.BoxElement,
		modules: blessed.Widgets.ListElement,
		actions: blessed.Widgets.ListElement,
		moduleActions: blessed.Widgets.ListElement,
		logs: blessed.Widgets.Log,
		db: blessed.Widgets.ListElement
	) {
		const headerHeight = 2;
		const footerHeight = 1;
		const mainTop = headerHeight;
		const mainHeight = Math.max(10, this.screen.height - headerHeight - footerHeight);
		const leftWidth = Math.floor(this.screen.width * 0.46);
		const rightWidth = this.screen.width - leftWidth;

		const actionsHeight = Math.max(8, Math.floor(mainHeight * 0.68));
		const moduleAreaHeight = mainHeight - actionsHeight;
		const modulesHeight = moduleAreaHeight;
		const moduleActionsHeight = moduleAreaHeight;
		const logsHeight = Math.max(6, Math.floor(mainHeight * 0.65));
		const dbHeight = mainHeight - logsHeight;
		const modulesWidth = Math.max(20, Math.floor(leftWidth * 0.55));
		const moduleActionsWidth = leftWidth - modulesWidth;

		header.top = 0;
		header.left = 0;
		header.width = this.screen.width;
		header.height = headerHeight;

		footer.bottom = 0;
		footer.left = 0;
		footer.width = this.screen.width;
		footer.height = footerHeight;

		actions.top = mainTop;
		modules.left = 0;
		modules.width = leftWidth;
		modules.height = modulesHeight;

		modules.top = mainTop + actionsHeight;
		modules.left = 0;
		modules.width = modulesWidth;
		modules.height = modulesHeight;

		actions.left = 0;
		actions.width = leftWidth;
		actions.height = actionsHeight;

		moduleActions.top = mainTop + actionsHeight;
		moduleActions.left = modulesWidth;
		moduleActions.width = moduleActionsWidth;
		moduleActions.height = moduleActionsHeight;

		logs.top = mainTop;
		logs.left = leftWidth;
		logs.width = rightWidth;
		logs.height = logsHeight;

		db.top = mainTop + logsHeight;
		db.left = leftWidth;
		db.width = rightWidth;
		db.height = dbHeight;
	}

	private bindKeys() {
		this.screen.key(['q', 'C-c'], () => {
			if (this.activeProcess) {
				this.activeProcess.kill('SIGTERM');
				this.activeProcess = null;
			}
			this.screen.destroy();
			process.exit(0);
		});

		this.screen.key(['tab'], () => this.cycleFocus(1));
		this.screen.key(['S-tab'], () => this.cycleFocus(-1));
		this.screen.key(['f'], () => this.toggleLogsFullscreen());

		this.layout.modules.key(['enter'], () => void this.selectModule());
		this.layout.modules.key(['x'], () => void this.deleteSelectedModule());
		this.layout.modules.key(['t'], () => void this.toggleSelectedModule());

		this.layout.actions.key(['enter', 'r'], () => void this.runSelectedAction());
		this.layout.moduleActions.key(['enter', 'r'], () => void this.runSelectedModuleAction());

		this.layout.db.key(['s'], () => void this.openSqlPrompt());
		this.layout.db.key(['r'], () => void this.refreshDbTables());

		this.screen.key(['n'], () => void this.createModuleWizard());
		this.screen.key(['c'], () => void this.cloneModuleRepo());
		this.screen.key(['y'], () => void this.syncModules());
		this.screen.key(['k'], () => void this.stopActiveProcess());
		this.screen.key(['d'], () => void this.runDevServer());
		this.screen.key(['v'], () => void this.runValidateSelected());
		this.screen.key(['t'], () => void this.runTestSelected());
		this.screen.key(['o'], () => void this.openSelectedModuleInEditor());
		this.screen.key(['m'], () => void this.openInEditor(process.cwd()));
		this.screen.key(['?'], () => this.renderWorkflowHelp());

		[
			this.layout.actions,
			this.layout.modules,
			this.layout.moduleActions,
			this.layout.logs,
			this.layout.db
		].forEach((panel) => {
			panel.on('focus', () => this.updateFocusBorders(panel));
		});
	}

	private cycleFocus(direction: number) {
		const order = [
			this.layout.actions,
			this.layout.modules,
			this.layout.moduleActions,
			this.layout.logs,
			this.layout.db
		];
		const index = order.findIndex((item) => item === this.screen.focused);
		const next = index === -1 ? 0 : (index + direction + order.length) % order.length;
		order[next].focus();
		this.screen.render();
	}

	private modulesFocus() {
		this.layout.modules.focus();
	}

	private actionsFocus() {
		this.layout.actions.focus();
	}

	private updateFocusBorders(active: blessed.Widgets.BoxElement) {
		const panels = [
			this.layout.actions,
			this.layout.modules,
			this.layout.moduleActions,
			this.layout.logs,
			this.layout.db
		];
		panels.forEach((panel) => {
			panel.style.border = panel.style.border || {};
			panel.style.border.fg = panel === active ? 'blue' : 'gray';
		});
		this.screen.render();
	}

	private async refreshModules() {
		try {
			const [dbModules, fsModules] = await Promise.all([
				this.settingsRepo.getExternalModules(),
				Promise.resolve(listModulesFromFilesystem())
			]);
			this.modules = mergeModuleData(dbModules, fsModules);
			this.layout.modules.setItems(this.modules.map((module) => this.formatModuleLabel(module)));
			this.updateHeader();
			if (this.modules.length === 0) {
				this.selectedModuleId = null;
				await this.refreshActions();
			} else if (!this.selectedModuleId) {
				this.selectedModuleId = this.modules[0].id;
				this.layout.modules.select(0);
				await this.refreshActions();
			} else if (this.selectedModuleId) {
				const index = this.modules.findIndex((module) => module.id === this.selectedModuleId);
				if (index >= 0) {
					this.layout.modules.select(index);
				} else {
					this.selectedModuleId = null;
				}
				await this.refreshActions();
			}
		} catch (error) {
			this.logError(`Failed to load modules: ${this.stringifyError(error)}`);
		}
		this.screen.render();
	}

	private formatModuleLabel(module: ModuleRecord) {
		const status = module.status ? this.formatStatusTag(module.status) : '{gray-fg}n/a{/}';
		const source = module.source.toUpperCase();
		return `${status} ${module.id} {gray-fg}[${source}]{/}`;
	}

	private formatStatusTag(status: NonNullable<ModuleRecord['status']>) {
		switch (status) {
			case 'active':
				return `{green-fg}${status}{/}`;
			case 'disabled':
				return `{gray-fg}${status}{/}`;
			case 'pending':
			case 'deleting':
				return `{yellow-fg}${status}{/}`;
			case 'error_manifest':
			case 'error_migration':
			case 'error_config':
				return `{red-fg}${status}{/}`;
			default:
				return status;
		}
	}

	private async refreshActions() {
		const actions: ActionItem[] = [];
		const addHeading = (label: string) =>
			actions.push({ label: `{gray-fg}${label}{/}`, enabled: false, shortcut: undefined });
		const addAction = (label: string, run: () => Promise<void>, shortcut?: string) =>
			actions.push({
				label: shortcut ? `{cyan-fg}[${shortcut}]{/} ${label}` : `{cyan-fg}${label}{/}`,
				run,
				enabled: true,
				shortcut
			});

		addHeading('General');
		addAction('New module wizard (from sample)', async () => this.createModuleWizard(), 'n');
		addAction('Clone module repo into external_modules', async () => this.cloneModuleRepo(), 'c');
		addAction('Sync external modules', async () => this.syncModules(), 'y');
		addAction('Run dev server', async () => this.runDevServer(), 'd');
		addAction('Open MoLOS root in editor', async () => this.openInEditor(process.cwd()), 'm');
		addAction('Stop running process', async () => this.stopActiveProcess(), 'k');
		addAction('Show workflow checklist', async () => this.renderWorkflowHelp(), '?');

		addHeading('User Admin');
		addAction('List users', async () => this.listUsers());
		addAction('Reset user password', async () => this.resetUserPassword());
		addAction('Change user role', async () => this.changeUserRole());
		addAction('Remove user', async () => this.removeUser());

		const scripts = this.readPackageScripts();
		const scriptEntries = Object.keys(scripts).sort();
		if (scriptEntries.length) {
			addHeading('Scripts');
			scriptEntries.forEach((script) => {
				actions.push({
					label: `{green-fg}script{/} ${script}`,
					run: async () => this.runProcess(`npm run ${script}`, process.cwd(), script),
					enabled: true
				});
			});
		}

		this.actions = actions;
		this.layout.actions.setItems(actions.map((action) => action.label));
		this.refreshModuleActions();
		this.screen.render();
	}

	private refreshModuleActions() {
		const selected = this.getSelectedModule();
		const modulePath = selected?.path;
		const actions: ActionItem[] = [];
		const addHeading = (label: string) =>
			actions.push({ label: `{gray-fg}${label}{/}`, enabled: false, shortcut: undefined });
		const addAction = (label: string, run: () => Promise<void>, shortcut?: string) =>
			actions.push({
				label: shortcut ? `{cyan-fg}[${shortcut}]{/} ${label}` : `{cyan-fg}${label}{/}`,
				run,
				enabled: true,
				shortcut
			});

		addHeading('Selected Module');
		if (!selected || !modulePath) {
			actions.push({
				label: '{gray-fg}Select a module to see actions{/}',
				enabled: false
			});
		} else {
			addAction('Open module in editor', async () => this.openSelectedModuleInEditor(), 'o');
			addAction('Show module summary', async () => this.logModuleSummary(selected));
			addAction('Toggle module (enable/disable)', async () => this.toggleSelectedModule());
			addAction('Delete module (mark for deletion)', async () => this.deleteSelectedModule());
			addAction(
				'Validate module',
				async () => this.runModuleCommand('module:validate', modulePath),
				'v'
			);
			addAction('Test module', async () => this.runModuleCommand('module:test', modulePath), 't');
		}

		this.moduleActions = actions;
		this.layout.moduleActions.setItems(actions.map((action) => action.label));
	}

	private readPackageScripts(targetPath = process.cwd()) {
		const pkgPath = path.join(targetPath, 'package.json');
		if (!existsSync(pkgPath)) return {};
		try {
			const content = readFileSync(pkgPath, 'utf-8');
			const json = JSON.parse(content) as { scripts?: Record<string, string> };
			return json.scripts || {};
		} catch {
			return {};
		}
	}

	private async selectModule() {
		const index = this.layout.modules.selected ?? 0;
		const module = this.modules[index];
		if (!module) return;
		this.selectedModuleId = module.id;
		await this.refreshActions();
		this.updateHeader();
		this.logModuleSummary(module);
		this.logInfo(`Selected module: ${module.id}`);
	}

	private getSelectedModule() {
		if (!this.selectedModuleId) return null;
		return this.modules.find((module) => module.id === this.selectedModuleId) || null;
	}

	private async toggleSelectedModule() {
		const module = this.getSelectedModule();
		if (!module) {
			this.logInfo('No module selected.');
			return;
		}
		try {
			if (!module.status && module.source === 'fs' && module.path) {
				await this.settingsRepo.registerExternalModule(module.id, `local://${module.path}`);
			}
			const nextStatus = module.status === 'active' ? 'disabled' : 'active';
			await this.settingsRepo.updateExternalModuleStatus(module.id, nextStatus);
			this.logInfo(`Set ${module.id} to ${nextStatus}. Syncing modules...`);
			await this.syncModules();
			await this.refreshModules();
		} catch (error) {
			this.logError(`Failed to toggle module: ${this.stringifyError(error)}`);
		}
	}

	private async deleteSelectedModule() {
		const module = this.getSelectedModule();
		if (!module) {
			this.logInfo('No module selected.');
			return;
		}
		if (!module.status) {
			this.logInfo('Module is not registered in the database.');
			return;
		}
		try {
			await this.settingsRepo.updateExternalModuleStatus(module.id, 'deleting');
			this.logInfo(`Marked ${module.id} for deletion. Syncing modules...`);
			await this.syncModules();
			await this.refreshModules();
		} catch (error) {
			this.logError(`Failed to delete module: ${this.stringifyError(error)}`);
		}
	}

	private async syncModules() {
		await this.runProcess('npm run module:sync', process.cwd(), 'module:sync', { replace: true });
		await this.refreshModules();
	}

	private async createModuleWizard() {
		const name = await this.promptInput('Module id (alphanumeric, hyphen, underscore)', (input) =>
			/^[a-zA-Z0-9_-]+$/.test(input)
		);
		if (!name) return;
		const displayName = await this.promptInput('Display name', () => true, name);
		if (!displayName) return;
		const author = await this.promptInput('Author', () => true, 'Module Developer');
		if (!author) return;
		const description = await this.promptInput('Description', () => true, 'A new MoLOS module');
		if (!description) return;
		const version = await this.promptInput('Version', () => true, '1.0.0');
		if (!version) return;
		const syncAfter = await this.promptConfirm('Run sync after creation?', true);

		const targetPath = path.join(EXTERNAL_MODULES_DIR, name);
		if (existsSync(targetPath)) {
			this.logError(`Target path already exists: ${targetPath}`);
			return;
		}

		const usedLocalTemplate = this.copyLocalTemplateModule(targetPath);
		if (!usedLocalTemplate) {
			await this.cloneTemplateModule(targetPath);
		}
		this.removeGitFolders(targetPath);
		this.replaceModuleName(targetPath, name);
		this.normalizeModuleUiRoutes(targetPath, name);
		this.updateModuleMetadata(targetPath, {
			id: name,
			name: displayName,
			author,
			description,
			version
		});
		await this.settingsRepo.registerExternalModule(name, this.toLocalRepoUrl(name));

		if (syncAfter) {
			await this.syncModules();
		}
		await this.refreshModules();
	}

	private toLocalRepoUrl(moduleName: string) {
		const workspaceName = path.basename(process.cwd());
		const relative = path.posix.join(workspaceName, 'external_modules', moduleName);
		return `local://${relative}`;
	}

	private async cloneTemplateModule(targetPath: string) {
		const repo = 'https://github.com/MoLOS-App/MoLOS-Sample-Module.git';
		await this.runProcess(`git clone ${repo} "${targetPath}"`, process.cwd());
	}

	private copyLocalTemplateModule(targetPath: string) {
		const candidates = [path.resolve(process.cwd(), 'external_modules', 'MoLOS-Sample-Module')];
		const source = candidates.find((candidate) => existsSync(candidate));
		if (!source) return false;
		try {
			cpSync(source, targetPath, { recursive: true, dereference: true });
			this.logInfo(`Copied template from ${source}`);
			return true;
		} catch (error) {
			this.logError(`Failed to copy template: ${this.stringifyError(error)}`);
			return false;
		}
	}

	private removeGitFolders(root: string) {
		const entries = readdirSync(root, { withFileTypes: true });
		for (const entry of entries) {
			const entryPath = path.join(root, entry.name);
			if (entry.name === '.git') {
				rmSync(entryPath, { recursive: true, force: true });
				continue;
			}
			if (entry.isDirectory()) {
				this.removeGitFolders(entryPath);
			}
		}
	}

	private replaceModuleName(root: string, moduleName: string) {
		const originalName = 'MoLOS-Sample-Module';
		const ignore = new Set(['node_modules', '.git']);
		const files = this.collectFiles(root, ignore);

		files.forEach((filePath) => {
			let content: string;
			try {
				content = readFileSync(filePath, 'utf-8');
			} catch {
				return;
			}
			if (!content.includes(originalName)) return;
			const updated = content.split(originalName).join(moduleName);
			writeFileSync(filePath, updated, 'utf-8');
		});
	}

	private normalizeModuleUiRoutes(root: string, moduleName: string) {
		const target = `/ui/${moduleName}`;
		const ignore = new Set(['node_modules', '.git']);
		const files = this.collectFiles(root, ignore);

		files.forEach((filePath) => {
			let content: string;
			try {
				content = readFileSync(filePath, 'utf-8');
			} catch {
				return;
			}

			const fixed = content
				.split(`'${target}"`)
				.join(`'${target}'`)
				.split(`"${target}'`)
				.join(`"${target}"`);

			if (fixed !== content) {
				writeFileSync(filePath, fixed, 'utf-8');
			}
		});
	}

	private updateModuleMetadata(
		root: string,
		metadata: {
			id: string;
			name: string;
			author: string;
			description: string;
			version: string;
		}
	) {
		const manifestPath = path.join(root, 'manifest.yaml');
		if (existsSync(manifestPath)) {
			try {
				const manifest = parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
				manifest.id = metadata.id;
				manifest.name = metadata.name;
				manifest.author = metadata.author;
				manifest.description = metadata.description;
				manifest.version = metadata.version;
				writeFileSync(manifestPath, stringify(manifest), 'utf-8');
			} catch {
				this.logError('Failed to update manifest.yaml metadata.');
			}
		}

		const packagePath = path.join(root, 'package.json');
		if (existsSync(packagePath)) {
			try {
				const pkg = JSON.parse(readFileSync(packagePath, 'utf-8')) as Record<string, unknown>;
				pkg.name = metadata.id;
				pkg.version = metadata.version;
				pkg.description = metadata.description;
				pkg.author = metadata.author;
				writeFileSync(packagePath, JSON.stringify(pkg, null, '\t') + '\n', 'utf-8');
			} catch {
				this.logError('Failed to update package.json metadata.');
			}
		}
	}

	private collectFiles(root: string, ignore: Set<string>) {
		const files: string[] = [];
		const entries = readdirSync(root, { withFileTypes: true });
		for (const entry of entries) {
			if (ignore.has(entry.name)) continue;
			const entryPath = path.join(root, entry.name);
			if (entry.isDirectory()) {
				files.push(...this.collectFiles(entryPath, ignore));
				continue;
			}
			if (entry.isFile()) {
				files.push(entryPath);
			}
		}
		return files;
	}

	private async runSelectedAction() {
		const index = this.layout.actions.selected ?? 0;
		const action = this.actions[index];
		if (!action) return;
		if (action.enabled === false || !action.run) {
			this.logInfo('Select a runnable action.');
			return;
		}
		await action.run();
	}

	private async runSelectedModuleAction() {
		const index = this.layout.moduleActions.selected ?? 0;
		const action = this.moduleActions[index];
		if (!action) return;
		if (action.enabled === false || !action.run) {
			this.logInfo('Select a runnable module action.');
			return;
		}
		await action.run();
	}

	private async runModuleCommand(command: string, modulePath?: string) {
		if (!modulePath) {
			this.logInfo('No module path available.');
			return;
		}
		await this.runProcess(`npm run ${command} "${modulePath}"`, process.cwd(), command, {
			replace: true
		});
	}

	private async runDevServer() {
		await this.runProcess('npm run dev', process.cwd(), 'dev', { replace: true });
	}

	private async runValidateSelected() {
		const module = this.getSelectedModule();
		if (!module?.path) {
			this.logInfo('Select a module to validate.');
			return;
		}
		await this.runModuleCommand('module:validate', module.path);
	}

	private async runTestSelected() {
		const module = this.getSelectedModule();
		if (!module?.path) {
			this.logInfo('Select a module to test.');
			return;
		}
		await this.runModuleCommand('module:test', module.path);
	}

	private async runProcess(
		command: string,
		cwd: string,
		scriptName?: string,
		options?: { replace?: boolean }
	) {
		if (this.activeProcess) {
			if (!options?.replace) {
				this.logInfo('A process is already running. Wait for it to finish.');
				return;
			}
			const label = this.activeProcessLabel || 'running';
			const confirmed = await this.promptConfirm(
				`Stop current process (${label}) and run new command?`,
				false
			);
			if (!confirmed) return;
			this.activeProcess.kill('SIGTERM');
			this.activeProcess = null;
			this.activeProcessLabel = null;
		}

		return new Promise<void>((resolve) => {
			this.logInfo(`$ ${command}`);
			const child = spawn(command, {
				shell: true,
				cwd,
				env: process.env
			});
			this.activeProcess = child;
			this.activeProcessLabel = scriptName || command;

			const escape = (value: string) => value.replace(/[{}]/g, (char) => `\\${char}`);
			child.stdout.on('data', (data) => {
				this.layout.logs.log(escape(data.toString()));
			});

			child.stderr.on('data', (data) => {
				this.layout.logs.log(`{red-fg}${escape(data.toString())}{/}`);
			});

			child.on('close', (code) => {
				const status = code === 0 ? 'PASS' : 'FAIL';
				const indicator =
					scriptName && /test|vitest|playwright/i.test(scriptName) ? `{bold}${status}{/}` : 'done';
				this.logInfo(`Process exited (${code ?? 'unknown'}) ${indicator}.`);
				this.activeProcess = null;
				this.activeProcessLabel = null;
				this.screen.render();
				resolve();
			});
		});
	}

	private async stopActiveProcess() {
		if (!this.activeProcess) {
			this.logInfo('No running process.');
			return;
		}
		const label = this.activeProcessLabel || 'running';
		const confirmed = await this.promptConfirm(`Stop current process (${label})?`, false);
		if (!confirmed) return;
		this.activeProcess.kill('SIGTERM');
		this.activeProcess = null;
		this.activeProcessLabel = null;
		this.logInfo('Process stopped.');
	}

	private async cloneModuleRepo() {
		const repoUrl = await this.promptInput('Git repo URL', (input) => input.length > 0);
		if (!repoUrl) return;
		const suggestedId = this.deriveModuleIdFromRepo(repoUrl);
		const moduleId = await this.promptInput(
			'Module id (folder name)',
			(input) => /^[a-zA-Z0-9_-]+$/.test(input),
			suggestedId || ''
		);
		if (!moduleId) return;

		const targetPath = path.join(EXTERNAL_MODULES_DIR, moduleId);
		if (existsSync(targetPath)) {
			this.logError(`Target path already exists: ${targetPath}`);
			return;
		}
		await this.runProcess(`git clone ${repoUrl} "${targetPath}"`, process.cwd());
		await this.settingsRepo.registerExternalModule(moduleId, repoUrl);
		await this.refreshModules();
	}

	private deriveModuleIdFromRepo(repoUrl: string) {
		const trimmed = repoUrl.replace(/\/$/, '');
		const lastPart = trimmed.split('/').pop();
		if (!lastPart) return null;
		return lastPart.endsWith('.git') ? lastPart.slice(0, -4) : lastPart;
	}

	private async openSelectedModuleInEditor() {
		const module = this.getSelectedModule();
		if (!module?.path) {
			this.logInfo('Select a module to open.');
			return;
		}
		await this.openInEditor(module.path);
	}

	private async openInEditor(targetPath: string) {
		const editor = process.env.VISUAL || process.env.EDITOR;
		if (!editor) {
			const input = await this.promptInput(
				'Editor command (e.g. code, subl, vim)',
				(value) => value.length > 0
			);
			if (!input) return;
			await this.runProcess(`${input} "${targetPath}"`, process.cwd());
			return;
		}
		await this.runProcess(`${editor} "${targetPath}"`, process.cwd());
	}

	private async refreshDbTables() {
		try {
			const tables = listTablesWithCounts();
			const items = tables.map((table) => {
				const source = table.source === 'schema' ? '{green-fg}schema{/}' : '{yellow-fg}db{/}';
				const count =
					typeof table.count === 'number' ? `{cyan-fg}${table.count}{/}` : '{gray-fg}?{/}';
				return `${table.name} ${source} ${count}`;
			});
			this.layout.db.setItems(items);
		} catch (error) {
			this.logError(`DB explorer failed: ${this.stringifyError(error)}`);
		}
		this.screen.render();
	}

	private async openSqlPrompt() {
		const query = await this.promptInput('SQL query', (input) => input.trim().length > 0);
		if (!query) return;
		try {
			const result = runSqlQuery(query);
			if (result.rows.length === 0 && !result.changes) {
				this.logInfo('Query returned no rows.');
				return;
			}
			if (result.rows.length > 0) {
				this.logInfo(`Columns: ${result.columns.join(', ')}`);
				result.rows.slice(0, 20).forEach((row) => {
					this.layout.logs.log(JSON.stringify(row));
				});
				if (result.rows.length > 20) {
					this.layout.logs.log('{gray-fg}... more rows truncated{/}');
				}
			}
			if (typeof result.changes === 'number') {
				this.logInfo(`Changes: ${result.changes}`);
			}
		} catch (error) {
			this.logError(`SQL error: ${this.stringifyError(error)}`);
		}
	}

	private logUserSummary(user: UserRecord) {
		const role = user.role ?? 'none';
		this.layout.logs.log(`{gray-fg}user{/} ${user.name} <${user.email}> (${user.id}) role=${role}`);
	}

	private async listUsers() {
		try {
			const users = listUsersFromDb(50);
			if (users.length === 0) {
				this.logInfo('No users found.');
				return;
			}
			this.logInfo(`Users (${users.length}):`);
			users.forEach((user) => this.logUserSummary(user));
		} catch (error) {
			this.logError(`Failed to list users: ${this.stringifyError(error)}`);
		}
	}

	private async promptForUser(): Promise<UserRecord | null> {
		const identifier = await this.promptInput('User email or id', (input) => input.length > 0);
		if (!identifier) return null;
		const user = findUserByIdentifierInDb(identifier);
		if (!user) {
			this.logError('User not found.');
			return null;
		}
		this.logUserSummary(user);
		return user;
	}

	private async resetUserPassword() {
		const user = await this.promptForUser();
		if (!user) return;
		const newPassword = await this.promptInput('New password', (input) => input.length > 0);
		if (!newPassword) return;
		const confirmed = await this.promptConfirm(`Reset password for ${user.email}?`, false);
		if (!confirmed) return;
		const revokeSessions = await this.promptConfirm('Revoke active sessions?', true);
		try {
			await resetUserPasswordInDb(user.id, newPassword, { revokeSessions });
			this.logInfo(`Password reset for ${user.email}.`);
		} catch (error) {
			this.logError(`Failed to reset password: ${this.stringifyError(error)}`);
		}
	}

	private async changeUserRole() {
		const user = await this.promptForUser();
		if (!user) return;
		const role = await this.promptInput(
			'New role (blank clears role)',
			() => true,
			user.role ?? ''
		);
		if (role === null) return;
		const confirmed = await this.promptConfirm(
			`Set role for ${user.email} to "${role || 'none'}"?`,
			false
		);
		if (!confirmed) return;
		try {
			const updated = updateUserRoleInDb(user.id, role);
			this.logInfo(`Role updated for ${updated.email}.`);
			this.logUserSummary(updated);
		} catch (error) {
			this.logError(`Failed to update role: ${this.stringifyError(error)}`);
		}
	}

	private async removeUser() {
		const user = await this.promptForUser();
		if (!user) return;
		const confirmed = await this.promptConfirm(`Remove user ${user.email}?`, false);
		if (!confirmed) return;
		try {
			const removed = removeUserFromDb(user.id);
			this.logInfo(`Removed user ${removed.email}.`);
		} catch (error) {
			this.logError(`Failed to remove user: ${this.stringifyError(error)}`);
		}
	}

	private async promptInput(
		message: string,
		validate: (value: string) => boolean,
		initial?: string
	) {
		return new Promise<string | null>((resolve) => {
			this.layout.prompt.input(message, initial || '', (err, value) => {
				if (err) {
					resolve(null);
					return;
				}
				const input = String(value ?? '').trim();
				if (!validate(input)) {
					this.logError('Invalid input.');
					resolve(null);
					return;
				}
				resolve(input);
			});
			this.screen.render();
		});
	}

	private async promptConfirm(message: string, initial = false) {
		return new Promise<boolean>((resolve) => {
			const suffix = initial ? ' (Y/n)' : ' (y/N)';
			this.layout.prompt.input(`${message}${suffix}`, '', (err, value) => {
				if (err) {
					resolve(false);
					return;
				}
				const input = String(value ?? '')
					.trim()
					.toLowerCase();
				if (input === '') {
					resolve(initial);
					return;
				}
				resolve(input === 'y' || input === 'yes');
			});
			this.screen.render();
		});
	}

	private toggleLogsFullscreen() {
		this.logsFullscreen = !this.logsFullscreen;
		if (this.logsFullscreen) {
			this.layout.modules.hide();
			this.layout.actions.hide();
			this.layout.moduleActions.hide();
			this.layout.db.hide();
			this.layout.logs.top = 3;
			this.layout.logs.left = 0;
			this.layout.logs.width = this.screen.width;
			this.layout.logs.height = this.screen.height - 4;
		} else {
			this.layout.modules.show();
			this.layout.actions.show();
			this.layout.moduleActions.show();
			this.layout.db.show();
			this.applyLayout(
				this.layout.header,
				this.layout.footer,
				this.layout.modules,
				this.layout.actions,
				this.layout.moduleActions,
				this.layout.logs,
				this.layout.db
			);
		}
		this.layout.logs.focus();
		this.screen.render();
	}

	private updateHeader() {
		const selected = this.getSelectedModule();
		const suffix = selected ? ` | Selected: ${selected.id}` : '';
		this.layout.header.setContent(` MoLOS-CLI — Module Management${suffix} `);
	}

	private logModuleSummary(module: ModuleRecord) {
		const status = module.status ? module.status : 'n/a';
		const structure = moduleStructureSummary(module);
		const manifestName = module.manifest?.name || 'n/a';
		const version = module.manifest?.version || module.packageJson?.version || 'n/a';
		this.logInfo(`Module ${module.id} | status: ${status}`);
		this.layout.logs.log(`{gray-fg}name{/} ${manifestName}`);
		this.layout.logs.log(`{gray-fg}version{/} ${version}`);
		this.layout.logs.log(`{gray-fg}structure{/} ${structure}`);
	}

	private renderWorkflowHelp() {
		this.logInfo(
			'Module workflow (new): create repo -> clone MoLOS -> clone module into external_modules -> open editor -> scaffold -> npm run dev -> build.'
		);
		this.logInfo(
			'Module workflow (extend): clone MoLOS -> ensure module in external_modules -> npm run dev -> edit module.'
		);
		this.logInfo('Shortcuts: n new, c clone, d dev, v validate, t test, y sync');
	}

	private logInfo(message: string) {
		this.layout.logs.log(`{cyan-fg}${message}{/}`);
	}

	private logError(message: string) {
		this.layout.logs.log(`{red-fg}${message}{/}`);
	}

	private stringifyError(error: unknown) {
		return error instanceof Error ? error.message : String(error);
	}
}
