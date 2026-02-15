# Task 012: Module Dependency Resolution

**Priority**: P2 (Medium)
**Effort**: Medium
**Impact**: Medium

## Problem

Modules can declare dependencies in their manifest:

```yaml
dependencies:
  MoLOS-Tasks: "^1.0.0"
  MoLOS-Auth: ">=2.0.0"
```

But:
- Dependencies aren't validated at install time
- No dependency resolution algorithm
- Circular dependencies not detected
- No load order based on dependencies

## Solution

Implement proper dependency resolution with:
- Version constraint checking
- Circular dependency detection
- Topological sort for load order

## Implementation

### 1. Dependency Types

```typescript
// module-management/config/dependency-types.ts
export interface ModuleDependency {
  moduleId: string;
  versionConstraint: string;
  optional?: boolean;
}

export interface ResolvedDependency {
  moduleId: string;
  requiredVersion: string;
  installedVersion: string;
  satisfied: boolean;
}

export interface DependencyGraph {
  nodes: Map<string, ModuleNode>;
  edges: Map<string, string[]>; // moduleId -> dependencies
}

export interface ModuleNode {
  id: string;
  version: string;
  dependencies: ModuleDependency[];
  status: ModuleStatus;
}

export type DependencyError =
  | { type: 'missing'; moduleId: string; requiredBy: string }
  | { type: 'version_mismatch'; moduleId: string; required: string; installed: string }
  | { type: 'circular'; cycle: string[] }
  | { type: 'disabled'; moduleId: string; requiredBy: string };
```

### 2. Version Constraint Checker

```typescript
// module-management/server/version-constraint.ts
import semver from 'semver';

/**
 * Check if a version satisfies a constraint
 */
export function satisfiesConstraint(
  version: string,
  constraint: string
): boolean {
  // Clean version (remove 'v' prefix if present)
  const cleanVersion = semver.clean(version);
  if (!cleanVersion) return false;

  return semver.satisfies(cleanVersion, constraint);
}

/**
 * Parse version constraint
 */
export function parseConstraint(constraint: string): {
  operator: string;
  version: string;
} {
  const match = constraint.match(/^([\^~>=<]+)?(.+)$/);
  if (!match) {
    return { operator: '=', version: constraint };
  }

  return {
    operator: match[1] || '=',
    version: match[2].trim(),
  };
}

/**
 * Get minimum version from constraint
 */
export function getMinVersion(constraint: string): string | null {
  const range = new semver.Range(constraint);
  return range ? semver.minVersion(range)?.version ?? null : null;
}
```

### 3. Dependency Resolver

```typescript
// module-management/server/dependency-resolver.ts
import { satisfiesConstraint } from './version-constraint';
import type {
  ModuleDependency,
  ResolvedDependency,
  DependencyGraph,
  DependencyError,
  ModuleNode,
} from '../config/dependency-types';

export class DependencyResolver {
  private modules: Map<string, ModuleNode>;

  constructor(modules: ModuleNode[]) {
    this.modules = new Map(modules.map(m => [m.id, m]));
  }

  /**
   * Resolve all dependencies for a module
   */
  resolve(moduleId: string): {
    dependencies: ResolvedDependency[];
    loadOrder: string[];
    errors: DependencyError[];
  } {
    const errors: DependencyError[] = [];
    const dependencies: ResolvedDependency[] = [];
    const visited = new Set<string>();
    const loadOrder: string[] = [];

    // Check for circular dependencies first
    const cycle = this.detectCircularDependency(moduleId);
    if (cycle) {
      errors.push({ type: 'circular', cycle });
      return { dependencies: [], loadOrder: [], errors };
    }

    // Resolve dependencies recursively
    this.resolveRecursive(moduleId, visited, dependencies, errors, loadOrder);

    // Remove the module itself from load order (it loads last)
    const moduleIndex = loadOrder.indexOf(moduleId);
    if (moduleIndex > -1) {
      loadOrder.splice(moduleIndex, 1);
    }

    return { dependencies, loadOrder, errors };
  }

  private resolveRecursive(
    moduleId: string,
    visited: Set<string>,
    dependencies: ResolvedDependency[],
    errors: DependencyError[],
    loadOrder: string[]
  ): void {
    if (visited.has(moduleId)) return;
    visited.add(moduleId);

    const module = this.modules.get(moduleId);
    if (!module) {
      // Module not installed
      return;
    }

    // Process dependencies first
    for (const dep of module.dependencies) {
      const depModule = this.modules.get(dep.moduleId);

      if (!depModule) {
        if (!dep.optional) {
          errors.push({
            type: 'missing',
            moduleId: dep.moduleId,
            requiredBy: moduleId,
          });
        }
        continue;
      }

      if (depModule.status === 'disabled') {
        if (!dep.optional) {
          errors.push({
            type: 'disabled',
            moduleId: dep.moduleId,
            requiredBy: moduleId,
          });
        }
        continue;
      }

      // Check version constraint
      const satisfied = satisfiesConstraint(depModule.version, dep.versionConstraint);

      dependencies.push({
        moduleId: dep.moduleId,
        requiredVersion: dep.versionConstraint,
        installedVersion: depModule.version,
        satisfied,
      });

      if (!satisfied && !dep.optional) {
        errors.push({
          type: 'version_mismatch',
          moduleId: dep.moduleId,
          required: dep.versionConstraint,
          installed: depModule.version,
        });
      }

      // Recurse
      this.resolveRecursive(dep.moduleId, visited, dependencies, errors, loadOrder);
    }

    // Add to load order after dependencies
    loadOrder.push(moduleId);
  }

  /**
   * Detect circular dependencies using DFS
   */
  detectCircularDependency(moduleId: string): string[] | null {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const cycle = this.dfsForCycle(moduleId, visited, recursionStack, path);
    return cycle;
  }

  private dfsForCycle(
    moduleId: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[]
  ): string[] | null {
    visited.add(moduleId);
    recursionStack.add(moduleId);
    path.push(moduleId);

    const module = this.modules.get(moduleId);
    if (module) {
      for (const dep of module.dependencies) {
        if (dep.optional) continue;

        if (!visited.has(dep.moduleId)) {
          const cycle = this.dfsForCycle(dep.moduleId, visited, recursionStack, path);
          if (cycle) return cycle;
        } else if (recursionStack.has(dep.moduleId)) {
          // Found cycle - return the cycle path
          const cycleStart = path.indexOf(dep.moduleId);
          return [...path.slice(cycleStart), dep.moduleId];
        }
      }
    }

    path.pop();
    recursionStack.delete(moduleId);
    return null;
  }

  /**
   * Get load order for all modules (topological sort)
   */
  getLoadOrder(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];

    for (const moduleId of this.modules.keys()) {
      this.topologicalSort(moduleId, visited, order);
    }

    return order;
  }

  private topologicalSort(
    moduleId: string,
    visited: Set<string>,
    order: string[]
  ): void {
    if (visited.has(moduleId)) return;
    visited.add(moduleId);

    const module = this.modules.get(moduleId);
    if (module) {
      for (const dep of module.dependencies) {
        if (!dep.optional && this.modules.has(dep.moduleId)) {
          this.topologicalSort(dep.moduleId, visited, order);
        }
      }
    }

    order.push(moduleId);
  }

  /**
   * Get modules that depend on a given module
   */
  getDependents(moduleId: string): string[] {
    const dependents: string[] = [];

    for (const [id, module] of this.modules) {
      if (module.dependencies.some(d => d.moduleId === moduleId)) {
        dependents.push(id);
      }
    }

    return dependents;
  }
}
```

### 4. Integrate with ModuleManager

```typescript
// module-management/server/module-manager.ts
import { DependencyResolver } from './dependency-resolver';

export class ModuleManager {
  /**
   * Check dependencies before enabling a module
   */
  static async enableModule(moduleId: string): Promise<EnableResult> {
    const allModules = await this.getAllModules();
    const resolver = new DependencyResolver(allModules);
    const { dependencies, errors, loadOrder } = resolver.resolve(moduleId);

    if (errors.length > 0) {
      return {
        success: false,
        errors,
        message: 'Dependency check failed',
      };
    }

    // Enable in dependency order
    for (const depId of loadOrder) {
      await this.setStatus(depId, 'active');
    }

    await this.setStatus(moduleId, 'active');

    return {
      success: true,
      loadOrder: [...loadOrder, moduleId],
      message: 'Module enabled',
    };
  }

  /**
   * Check what will be affected by disabling a module
   */
  static async getDisableImpact(moduleId: string): Promise<string[]> {
    const allModules = await this.getAllModules();
    const resolver = new DependencyResolver(allModules);
    return resolver.getDependents(moduleId);
  }

  /**
   * Disable module and warn about dependents
   */
  static async disableModule(moduleId: string): Promise<DisableResult> {
    const dependents = await this.getDisableImpact(moduleId);

    if (dependents.length > 0) {
      moduleLogger.warn(
        { moduleId, dependents },
        'Disabling module that others depend on'
      );

      // Optionally disable dependents too
      for (const depId of dependents) {
        await this.setStatus(depId, 'disabled');
      }
    }

    await this.setStatus(moduleId, 'disabled');

    return {
      success: true,
      disabledDependents: dependents,
    };
  }

  /**
   * Get recommended load order for all active modules
   */
  static async getInitializationOrder(): Promise<string[]> {
    const activeModules = await this.getActiveModules();
    const resolver = new DependencyResolver(activeModules);
    return resolver.getLoadOrder();
  }
}
```

### 5. Add API Endpoints

```typescript
// src/routes/api/admin/modules/[id]/dependencies/+server.ts
import { json } from '@sveltejs/kit';
import { ModuleManager } from '$lib/server/modules';

export const GET: RequestHandler = async ({ params }) => {
  const moduleId = params.id;

  const allModules = await ModuleManager.getAllModules();
  const resolver = new DependencyResolver(allModules);
  const { dependencies, errors, loadOrder } = resolver.resolve(moduleId);

  const dependents = resolver.getDependents(moduleId);

  return json({
    moduleId,
    dependencies,
    dependents,
    loadOrder,
    errors,
    hasErrors: errors.length > 0,
  });
};
```

### 6. UI Integration

```svelte
<!-- Module settings page shows dependencies -->
{#if module.manifest.dependencies}
  <div class="dependencies">
    <h3>Dependencies</h3>
    {#each Object.entries(module.manifest.dependencies) as [depId, constraint]}
      {@const dep = modules.find(m => m.id === depId)}
      <div class="dependency" class:missing={!dep} class:error={!dep?.satisfied}>
        <span>{depId}</span>
        <span class="constraint">{constraint}</span>
        {#if dep}
          <span class="version">{dep.version}</span>
          {#if satisfiesConstraint(dep.version, constraint)}
            <IconCheck class="text-green" />
          {:else}
            <IconX class="text-red" />
          {/if}
        {:else}
          <span class="text-red">Not installed</span>
        {/if}
      </div>
    {/each}
  </div>
{/if}
```

## Error Messages

```typescript
// Human-readable error messages
const ERROR_MESSAGES = {
  missing: (moduleId, requiredBy) =>
    `Module "${moduleId}" is required by "${requiredBy}" but is not installed.`,

  version_mismatch: (moduleId, required, installed) =>
    `Module "${moduleId}" version ${installed} does not satisfy required ${required}.`,

  circular: (cycle) =>
    `Circular dependency detected: ${cycle.join(' → ')}`,

  disabled: (moduleId, requiredBy) =>
    `Module "${moduleId}" is required by "${requiredBy}" but is disabled.`,
};
```

## Benefits

| Before | After |
|--------|-------|
| No dependency checking | Validated at install/enable |
| Unknown load order | Topological sort |
| Circular deps crash | Detected and reported |
| Disabling breaks modules | Shows impact warning |

## Files to Create

- `module-management/config/dependency-types.ts`
- `module-management/server/version-constraint.ts`
- `module-management/server/dependency-resolver.ts`

## Files to Change

- `module-management/server/module-manager.ts`
- `src/routes/api/admin/modules/[id]/dependencies/+server.ts` (new)
