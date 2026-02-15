# Task 010: CLI Tool for Module Scaffolding

**Priority**: P2 (Medium)
**Effort**: Medium
**Impact**: Medium

## Problem

Creating a new module requires:
- Manually creating folder structure
- Writing manifest.yaml from scratch
- Writing config.ts from scratch
- Setting up routes
- Easy to make mistakes

## Solution

Create a CLI tool for scaffolding new modules.

## CLI Commands

```bash
# Create new module
molos module create my-module

# Create with options
molos module create my-module --description "My cool module" --author "me@example.com"

# Validate existing module
molos module validate ./external_modules/my-module

# Link module (development)
molos module link ./external_modules/my-module

# Unlink module
molos module unlink my-module

# Show module status
molos module status my-module
```

## Implementation

### 1. CLI Entry Point

```typescript
// cli/index.ts
import { Command } from 'commander';
import { createModule } from './commands/create';
import { validateModule } from './commands/validate';
import { linkModule } from './commands/link';
import { unlinkModule } from './commands/unlink';
import { moduleStatus } from './commands/status';

const program = new Command();

program
  .name('molos')
  .description('MoLOS Module CLI')
  .version('1.0.0');

program
  .command('module:create <name>')
  .description('Create a new module')
  .option('-d, --description <desc>', 'Module description')
  .option('-a, --author <author>', 'Author name/email')
  .option('-i, --icon <icon>', 'Lucide icon name', 'package')
  .option('-t, --template <template>', 'Template to use', 'basic')
  .action(createModule);

program
  .command('module:validate <path>')
  .description('Validate a module')
  .action(validateModule);

program
  .command('module:link <path>')
  .description('Link a module for development')
  .action(linkModule);

program
  .command('module:unlink <name>')
  .description('Unlink a module')
  .action(unlinkModule);

program
  .command('module:status <name>')
  .description('Show module status')
  .action(moduleStatus);

program.parse();
```

### 2. Create Command

```typescript
// cli/commands/create.ts
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import yaml from 'yaml';

const TEMPLATES = {
  basic: 'Basic module with single page',
  crud: 'CRUD module with list/create/edit/delete',
  ai: 'AI-powered module with tool definitions',
  empty: 'Empty module (just structure)',
};

export async function createModule(
  name: string,
  options: { description?: string; author?: string; icon?: string; template?: string }
) {
  console.log(`Creating module: ${name}`);

  // Validate name
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    console.error('Error: Module name must contain only alphanumeric characters, hyphens, and underscores');
    process.exit(1);
  }

  // Prompt for missing options
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: options.description || `${name} module`,
      when: !options.description,
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author:',
      when: !options.author,
    },
    {
      type: 'list',
      name: 'template',
      message: 'Template:',
      choices: Object.entries(TEMPLATES).map(([value, name]) => ({ name, value })),
      when: !options.template,
    },
  ]);

  const config = { ...options, ...answers };
  const modulePath = path.join('external_modules', name);

  // Check if already exists
  if (fs.existsSync(modulePath)) {
    console.error(`Error: Module ${name} already exists at ${modulePath}`);
    process.exit(1);
  }

  // Create structure
  await createModuleStructure(modulePath, name, config);

  console.log(`\n✓ Module created at ${modulePath}`);
  console.log('\nNext steps:');
  console.log(`  1. cd ${modulePath}`);
  console.log(`  2. npm install  (if package.json exists)`);
  console.log(`  3. Update manifest.yaml and config.ts`);
  console.log(`  4. Run 'molos module:link ${modulePath}' to enable in dev`);
}

async function createModuleStructure(
  modulePath: string,
  name: string,
  config: any
): Promise<void> {
  // Create directories
  fs.ensureDirSync(modulePath);
  fs.ensureDirSync(path.join(modulePath, 'routes/ui', name));
  fs.ensureDirSync(path.join(modulePath, 'lib'));

  // Create manifest.yaml
  const manifest = {
    id: name,
    name: humanize(name),
    version: '0.1.0',
    description: config.description,
    author: config.author,
    icon: config.icon,
    minMolosVersion: '1.0.0',
  };
  fs.writeFileSync(path.join(modulePath, 'manifest.yaml'), yaml.stringify(manifest));

  // Create config.ts
  const configContent = generateConfig(name, config);
  fs.writeFileSync(path.join(modulePath, 'config.ts'), configContent);

  // Create route based on template
  await applyTemplate(modulePath, name, config.template);
}

function generateConfig(name: string, config: any): string {
  return `import { defineConfig } from '@molos/module-sdk';
import { ${toPascalCase(config.icon)} } from 'lucide-svelte';

export default defineConfig({
  id: '${name}',
  name: '${humanize(name)}',
  icon: ${toPascalCase(config.icon)},
  description: '${config.description || `${humanize(name)} module`}',
  navigation: [
    { name: 'Overview', icon: '${config.icon}' },
  ],
});
`;
}

async function applyTemplate(modulePath: string, name: string, template: string): Promise<void> {
  switch (template) {
    case 'basic':
      await applyBasicTemplate(modulePath, name);
      break;
    case 'crud':
      await applyCrudTemplate(modulePath, name);
      break;
    case 'ai':
      await applyAiTemplate(modulePath, name);
      break;
    case 'empty':
      // Just the basic structure
      break;
  }
}

async function applyBasicTemplate(modulePath: string, name: string): Promise<void> {
  // Main page
  const pageContent = `<script lang="ts">
  import { page } from '$app/stores';
  import { Card } from '$lib/components/ui/card';

  const moduleId = '${name}';
</script>

<div class="p-6">
  <h1 class="text-2xl font-bold mb-4">${humanize(name)}</h1>

  <Card class="p-4">
    <p>Welcome to ${humanize(name)} module!</p>
  </Card>
</div>
`;

  fs.writeFileSync(
    path.join(modulePath, 'routes/ui', name, '+page.svelte'),
    pageContent
  );

  // Page server
  const serverContent = `import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  return {
    user: locals.user,
  };
};
`;
  fs.writeFileSync(
    path.join(modulePath, 'routes/ui', name, '+page.server.ts'),
    serverContent
  );
}
```

### 3. Validate Command

```typescript
// cli/commands/validate.ts
import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';
import { validateModuleManifest } from '@molos/module-sdk';

export async function validateModule(modulePath: string) {
  console.log(`Validating module at: ${modulePath}`);

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check manifest exists
  const manifestPath = path.join(modulePath, 'manifest.yaml');
  if (!fs.existsSync(manifestPath)) {
    errors.push('Missing manifest.yaml');
  } else {
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = yaml.parse(manifestContent);

    const result = validateModuleManifest(manifest);
    if (!result.valid) {
      errors.push(...result.error.issues.map(i => `Manifest: ${i.message}`));
    }

    // Check manifest ID matches folder name
    const folderName = path.basename(modulePath);
    if (manifest.id !== folderName) {
      errors.push(`Manifest ID "${manifest.id}" doesn't match folder name "${folderName}"`);
    }
  }

  // Check config exists
  const configPath = path.join(modulePath, 'config.ts');
  if (!fs.existsSync(configPath)) {
    errors.push('Missing config.ts');
  }

  // Check for routes
  const routesPath = path.join(modulePath, 'routes/ui');
  if (!fs.existsSync(routesPath)) {
    warnings.push('No UI routes found');
  }

  // Check for drizzle migrations
  const drizzlePath = path.join(modulePath, 'drizzle');
  if (fs.existsSync(drizzlePath)) {
    // Check migration files have correct table prefixes
    const migrations = fs.readdirSync(drizzlePath).filter(f => f.endsWith('.sql'));
    for (const migration of migrations) {
      const content = fs.readFileSync(path.join(drizzlePath, migration), 'utf-8');
      if (content.includes('CREATE TABLE') && !content.includes('molos_')) {
        warnings.push(`Migration ${migration}: Tables should have 'molos_' prefix`);
      }
    }
  }

  // Print results
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✓ Module is valid\n');
  }

  if (warnings.length > 0) {
    console.log('Warnings:');
    warnings.forEach(w => console.log(`  ⚠ ${w}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach(e => console.log(`  ✗ ${e}`));
    process.exit(1);
  }
}
```

### 4. Link Command

```typescript
// cli/commands/link.ts
import { ModuleLinker } from '../../module-management/server/module-linker';

export async function linkModule(modulePath: string) {
  const moduleName = path.basename(modulePath);

  console.log(`Linking module: ${moduleName}`);

  const linker = new ModuleLinker();

  try {
    await linker.linkModule(moduleName, path.resolve(modulePath));
    console.log(`✓ Module ${moduleName} linked successfully`);
    console.log('\nRestart dev server to see changes.');
  } catch (error) {
    console.error(`✗ Failed to link module: ${error}`);
    process.exit(1);
  }
}
```

## Package.json Scripts

```json
{
  "bin": {
    "molos": "./dist/cli/index.js"
  },
  "scripts": {
    "build": "tsup cli/index.ts --format esm --dts",
    "dev": "tsup cli/index.ts --watch"
  }
}
```

## Usage Flow

```bash
# Install CLI globally
npm install -g @molos/cli

# Create new module
molos module:create MoLOS-Blog

# Answer prompts
? Description: A simple blog module
? Author: me@example.com
? Template: CRUD

# Module created!
✓ Module created at external_modules/MoLOS-Blog

# Link for development
molos module:link external_modules/MoLOS-Blog

# Validate before committing
molos module:validate external_modules/MoLOS-Blog
✓ Module is valid
```

## Benefits

| Before | After |
|--------|-------|
| Manual folder creation | One command scaffolding |
| Copy-paste config files | Templates for common patterns |
| Easy to make mistakes | Validation built-in |
| No documentation | CLI help and prompts |

## Files to Create

```
cli/
├── index.ts
├── commands/
│   ├── create.ts
│   ├── validate.ts
│   ├── link.ts
│   ├── unlink.ts
│   └── status.ts
└── templates/
    ├── basic/
    ├── crud/
    ├── ai/
    └── empty/
```
