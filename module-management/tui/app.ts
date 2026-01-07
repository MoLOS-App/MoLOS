import blessed from 'blessed';
import { spawn } from 'child_process';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import { parse, stringify } from 'yaml';
import type { SettingsRepository } from '../../src/lib/repositories/settings/settings-repository';
import { EXTERNAL_MODULES_DIR } from './constants';
import { listTablesWithCounts, runSqlQuery } from './db';
import { listModulesFromFilesystem } from './fs';
import { mergeModuleData } from './merge';
import type { ModuleRecord } from './types';

type ActionItem = {
	label: string;
	run: () => Promise<void>;
};

type Layout = {
	header: blessed.Widgets.BoxElement;
	footer: blessed.Widgets.BoxElement;
	modules: blessed.Widgets.ListElement;
	actions: blessed.Widgets.ListElement;
	logs: blessed.Widgets.Log;
	db: blessed.Widgets.ListElement;
	prompt: blessed.Widgets.PromptElement;
};

export class ModuleTUI {
	private screen: blessed.Widgets.Screen;
	private layout: Layout;
	private modules: ModuleRecord[] = [];
	private actions: ActionItem[] = [];
	private selectedModuleId: string | null = null;
	private activeProcess: ReturnType<typeof spawn> | null = null;
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
		this.modulesFocus();
		this.screen.render();
	}

	private createLayout(): Layout {
		const header = blessed.box({
			parent: this.screen,
			top: 0,
			left: 0,
			height: 3,
			width: '100%',
			content: ' MoLOS-CLI | Module Management Suite ',
			style: { fg: 'white', bg: 'blue' }
		});

		const footer = blessed.box({
			parent: this.screen,
			bottom: 0,
			left: 0,
			height: 1,
			width: '100%',
			content: ' Tab: switch | Enter: select | x: delete | t: toggle | r: run | s: SQL | f: logs | q: quit ',
			style: { fg: 'black', bg: 'white' }
		});

		const modules = blessed.list({
			parent: this.screen,
			label: ' Modules ',
			tags: true,
			border: 'line',
			keys: true,
			mouse: true,
			style: {
				selected: { bg: 'blue', fg: 'white' }
			}
		});

		const actions = blessed.list({
			parent: this.screen,
			label: ' Actions ',
			tags: true,
			border: 'line',
			keys: true,
			mouse: true,
			style: {
				selected: { bg: 'green', fg: 'black' }
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
			alwaysScroll: true
		});

		const db = blessed.list({
			parent: this.screen,
			label: ' DB Explorer ',
			tags: true,
			border: 'line',
			keys: true,
			mouse: true,
			style: {
				selected: { bg: 'magenta', fg: 'white' }
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
			hidden: true
		});

		this.applyLayout(header, footer, modules, actions, logs, db);
		this.screen.on('resize', () => this.applyLayout(header, footer, modules, actions, logs, db));

		return { header, footer, modules, actions, logs, db, prompt };
	}

	private applyLayout(
		header: blessed.Widgets.BoxElement,
		footer: blessed.Widgets.BoxElement,
		modules: blessed.Widgets.ListElement,
		actions: blessed.Widgets.ListElement,
		logs: blessed.Widgets.Log,
		db: blessed.Widgets.ListElement
	) {
		const headerHeight = 3;
		const footerHeight = 1;
		const mainTop = headerHeight;
		const mainHeight = Math.max(8, this.screen.height - headerHeight - footerHeight);
		const leftWidth = Math.floor(this.screen.width * 0.48);
		const rightWidth = this.screen.width - leftWidth;

		const modulesHeight = Math.floor(mainHeight * 0.6);
		const actionsHeight = mainHeight - modulesHeight;
		const logsHeight = Math.floor(mainHeight * 0.7);
		const dbHeight = mainHeight - logsHeight;

		header.top = 0;
		header.left = 0;
		header.width = this.screen.width;
		header.height = headerHeight;

		footer.bottom = 0;
		footer.left = 0;
		footer.width = this.screen.width;
		footer.height = footerHeight;

		modules.top = mainTop;
		modules.left = 0;
		modules.width = leftWidth;
		modules.height = modulesHeight;

		actions.top = mainTop + modulesHeight;
		actions.left = 0;
		actions.width = leftWidth;
		actions.height = actionsHeight;

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

		this.layout.db.key(['s'], () => void this.openSqlPrompt());
		this.layout.db.key(['r'], () => void this.refreshDbTables());
	}

	private cycleFocus(direction: number) {
		const order = [this.layout.modules, this.layout.actions, this.layout.logs, this.layout.db];
		const index = order.findIndex((item) => item === this.screen.focused);
		const next = index === -1 ? 0 : (index + direction + order.length) % order.length;
		order[next].focus();
		this.screen.render();
	}

	private modulesFocus() {
		this.layout.modules.focus();
	}

	private async refreshModules() {
		try {
			const [dbModules, fsModules] = await Promise.all([
				this.settingsRepo.getExternalModules(),
				Promise.resolve(listModulesFromFilesystem())
			]);
			this.modules = mergeModuleData(dbModules, fsModules);
			this.layout.modules.setItems(
				this.modules.map((module) => this.formatModuleLabel(module))
			);
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
		const selected = this.getSelectedModule();
		const modulePath = selected?.path;
		const actions: ActionItem[] = [
			{
				label: '{cyan-fg}Refresh modules{/}',
				run: async () => this.refreshModules()
			},
			{
				label: '{cyan-fg}Sync external modules{/}',
				run: async () => this.syncModules()
			},
			{
				label: '{cyan-fg}New module wizard{/}',
				run: async () => this.createModuleWizard()
			}
		];

		if (selected) {
			actions.push(
				{
					label: '{cyan-fg}Toggle module (enable/disable){/}',
					run: async () => this.toggleSelectedModule()
				},
				{
					label: '{cyan-fg}Delete module (mark for deletion){/}',
					run: async () => this.deleteSelectedModule()
				},
				{
					label: '{cyan-fg}Validate module{/}',
					run: async () => this.runModuleCommand('module:validate', modulePath)
				},
				{
					label: '{cyan-fg}Test module{/}',
					run: async () => this.runModuleCommand('module:test', modulePath)
				}
			);
		}

		const scripts = modulePath ? this.readPackageScripts(modulePath) : this.readPackageScripts();
		const scriptEntries = Object.keys(scripts).sort();
		scriptEntries.forEach((script) => {
			actions.push({
				label: `{green-fg}script{/} ${script}`,
				run: async () =>
					this.runProcess(`npm run ${script}`, modulePath || process.cwd(), script)
			});
		});

		this.actions = actions;
		this.layout.actions.setItems(actions.map((action) => action.label));
		this.screen.render();
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
		await this.runProcess('npm run module:sync', process.cwd());
	}

	private async createModuleWizard() {
		const name = await this.promptInput(
			'Module id (alphanumeric, hyphen, underscore)',
			(input) => /^[a-zA-Z0-9_-]+$/.test(input)
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

		await this.cloneTemplateModule(targetPath);
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
		await action.run();
	}

	private async runModuleCommand(command: string, modulePath?: string) {
		if (!modulePath) {
			this.logInfo('No module path available.');
			return;
		}
		await this.runProcess(`npm run ${command} "${modulePath}"`, process.cwd());
	}

	private async runProcess(command: string, cwd: string, scriptName?: string) {
		if (this.activeProcess) {
			this.logInfo('A process is already running. Wait for it to finish.');
			return;
		}

		return new Promise<void>((resolve) => {
			this.logInfo(`$ ${command}`);
			const child = spawn(command, {
				shell: true,
				cwd,
				env: process.env
			});
			this.activeProcess = child;

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
					scriptName && /test|vitest|playwright/i.test(scriptName)
						? `{bold}${status}{/}`
						: 'done';
				this.logInfo(`Process exited (${code ?? 'unknown'}) ${indicator}.`);
				this.activeProcess = null;
				this.screen.render();
				resolve();
			});
		});
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
				const input = String(value ?? '').trim().toLowerCase();
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
			this.layout.db.hide();
			this.layout.logs.top = 3;
			this.layout.logs.left = 0;
			this.layout.logs.width = this.screen.width;
			this.layout.logs.height = this.screen.height - 4;
		} else {
			this.layout.modules.show();
			this.layout.actions.show();
			this.layout.db.show();
			this.applyLayout(
				this.layout.header,
				this.layout.footer,
				this.layout.modules,
				this.layout.actions,
				this.layout.logs,
				this.layout.db
			);
		}
		this.layout.logs.focus();
		this.screen.render();
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
