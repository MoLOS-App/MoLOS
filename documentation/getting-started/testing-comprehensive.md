# Comprehensive Test Suite

> Complete guide to MoLOS testing infrastructure, patterns, and best practices

---

## Overview

MoLOS has a comprehensive test suite covering core functionality, module system, database operations, and API endpoints. The test infrastructure is designed to be:

- **Fast**: In-memory databases, parallel execution
- **Reliable**: Isolated tests, automatic cleanup
- **Maintainable**: Reusable utilities, factory patterns
- **Comprehensive**: Unit, integration, and end-to-end coverage

---

## Test Infrastructure

### Test Utilities (`tests/utils/`)

| File              | Purpose                                                  |
| ----------------- | -------------------------------------------------------- |
| `test-helpers.ts` | Core testing utilities, factories, and assertion helpers |
| `mock-module.ts`  | Mock module creation and management                      |

### Core Test Areas (`tests/core/`)

| Test File                              | Coverage                                         |
| -------------------------------------- | ------------------------------------------------ |
| `module-registry.test.ts`              | Module discovery, registration, filtering        |
| `base-repository.test.ts`              | Repository pattern implementation                |
| `settings-repository-extended.test.ts` | Settings storage, module states, system settings |

---

## Test Utilities

### Database Helpers

```typescript
import { createTestDb, createFileTestDb, cleanupFileTestDb } from '$lib/test-utils';

// In-memory database (fast, isolated)
const db = await createTestDb();

// File-based database (for debugging)
const { db, path, client } = createFileTestDb('my-test');

// Cleanup
cleanupFileTestDb(client, path);
```

### Mock Factories

```typescript
import {
	UserFactory,
	SessionFactory,
	AiSessionFactory,
	ModuleConfigFactory,
	SettingsFactory
} from '$lib/test-utils';

// Create mock user
const user = UserFactory.build({ email: 'custom@example.com' });

// Create multiple users
const users = UserFactory.buildList(5);

// Create mock module config
const config = ModuleConfigFactory.build({
	id: 'my-module',
	name: 'My Module'
});
```

### Assertion Helpers

```typescript
import {
	assertThrowsAsync,
	assertHasProperties,
	assertTableExists,
	assertTableRowCount,
	waitFor,
	measureTime,
	assertCompletesWithin
} from '$lib/test-utils';

// Assert async function throws
await assertThrowsAsync(async () => await riskyOperation(), 'Expected error message');

// Assert object has properties
assertHasProperties(user, ['id', 'email', 'name']);

// Assert database state
assertTableExists(db, 'user');
assertTableRowCount(db, 'user', 5);

// Wait for condition
await waitFor(() => someCondition(), 5000);

// Measure performance
const { result, duration } = await measureTime(async () => await operation());
expect(duration).toBeLessThan(1000);
```

### Environment Helpers

```typescript
import { withEnv, withEnvs } from '$lib/test-utils';

// Run with single env var
await withEnv('NODE_ENV', 'test', async () => {
	// Test code here
});

// Run with multiple env vars
await withEnvs(
	{
		DATABASE_URL: 'sqlite://test.db',
		NODE_ENV: 'test'
	},
	async () => {
		// Test code here
	}
);
```

---

## Test Patterns

### Repository Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyRepository } from './my-repository';
import { createTestDb, UserFactory } from '$lib/test-utils';

describe('MyRepository', () => {
	let db;
	let repository;
	let testUser;

	beforeEach(async () => {
		db = await createTestDb();
		repository = new MyRepository(db);
		testUser = UserFactory.build();
		await db.insert(user).values([testUser]);
	});

	it('should perform operation', async () => {
		const result = await repository.doSomething(testUser.id);
		expect(result).toBeDefined();
	});
});
```

### Module System Testing

```typescript
import { describe, it, expect } from 'vitest';
import { MODULE_REGISTRY, getModuleById, getAllModules } from '$lib/config';

describe('Module Registry', () => {
	it('should register core modules', () => {
		expect(MODULE_REGISTRY['dashboard']).toBeDefined();
		expect(MODULE_REGISTRY['ai']).toBeDefined();
	});

	it('should retrieve module by ID', () => {
		const module = getModuleById('dashboard');
		expect(module?.id).toBe('dashboard');
	});
});
```

### Database Transaction Testing

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createFileTestDb, cleanupFileTestDb } from '$lib/test-utils';

describe('Database Transactions', () => {
	let db, path, client;

	beforeEach(() => {
		({ db, path, client } = createFileTestDb('transaction-test'));
	});

	afterEach(() => {
		cleanupFileTestDb(client, path);
	});

	it('should rollback on error', async () => {
		// Test transaction behavior
	});
});
```

---

## Test Categories

### Unit Tests

Fast, isolated tests for individual functions and classes.

**Location**: `src/**/*.spec.ts` (colocated with source)

**Coverage**:

- Utility functions
- Repository methods
- Business logic
- Data transformations

**Example**:

```typescript
// src/lib/utils/format.spec.ts
describe('formatDate', () => {
	it('should format date correctly', () => {
		const date = new Date('2024-01-15');
		expect(formatDate(date)).toBe('2024-01-15');
	});
});
```

### Integration Tests

Tests that verify multiple components work together.

**Location**: `tests/**/*.test.ts`

**Coverage**:

- Module lifecycle
- Database operations
- API workflows
- Repository interactions

**Example**:

```typescript
// tests/integration/user-workflow.test.ts
describe('User Registration Flow', () => {
	it('should create user and initialize settings', async () => {
		const user = await createUser(userData);
		const settings = await getSettings(user.id);
		expect(settings.theme).toBe('system');
	});
});
```

### Migration Tests

Tests for database migration system.

**Location**: `tests/migrations/**/*.spec.ts`

**Coverage**:

- Migration application
- Rollback logic
- Schema validation
- Namespace enforcement

**See**: [Migration Tests Documentation](./testing.md#migration-tests)

---

## Test Configuration

### Vitest Setup

Tests run via Vitest with separate configurations:

```typescript
// vite.config.ts
export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright()
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			},
			{
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
```

### Test Scripts

```bash
# Run all tests
bun run test

# Run unit tests (watch mode)
bun run test:unit

# Run unit tests once
bun run test:unit -- --run

# Run specific test file
bun run test:unit -- tests/core/module-registry.test.ts --run

# Run with coverage
bun run test:unit -- --coverage --run

# Run migration tests
bun run test:unit -- tests/migrations --run
```

---

## Best Practices

### 1. Test Isolation

Each test should be independent:

```typescript
// ✅ Good - isolated test
beforeEach(async () => {
	db = await createTestDb();
	repository = new MyRepository(db);
});

afterEach(() => {
	cleanupTestDb(db);
});

// ❌ Bad - shared state
let globalDb;
beforeAll(() => {
	globalDb = createTestDb(); // Shared across all tests
});
```

### 2. Use Factories

Generate test data with factories:

```typescript
// ✅ Good - using factory
const user = UserFactory.build({ email: 'test@example.com' });

// ❌ Bad - manual construction
const user = {
	id: '123',
	email: 'test@example.com'
	// ... many other required fields
};
```

### 3. Descriptive Test Names

Use clear, descriptive names:

```typescript
// ✅ Good
it('should return null when user does not exist', () => {});

// ❌ Bad
it('works', () => {});
```

### 4. Test Edge Cases

Cover boundary conditions:

```typescript
describe('pagination', () => {
	it('should handle first page', () => {});
	it('should handle last page', () => {});
	it('should handle empty result set', () => {});
	it('should handle page beyond range', () => {});
});
```

### 5. Performance Testing

Measure and assert performance:

```typescript
it('should complete within time limit', async () => {
	await assertCompletesWithin(
		async () => await operation(),
		1000 // 1 second
	);
});
```

### 6. Cleanup Resources

Always clean up test resources:

```typescript
afterEach(() => {
	cleanupFileTestDb(client, path);
	MockModuleBuilder.cleanup(modulePath);
});
```

---

## Coverage Goals

| Area             | Target Coverage | Status          |
| ---------------- | --------------- | --------------- |
| Module System    | 90%+            | ✅ Implemented  |
| Repositories     | 85%+            | ✅ Implemented  |
| API Endpoints    | 80%+            | 🚧 In Progress  |
| Configuration    | 85%+            | ✅ Implemented  |
| Database Package | 80%+            | 🚧 In Progress  |
| **Overall Core** | **80%+**        | **✅ On Track** |

---

## Running Tests

### Development

```bash
# Watch mode for development
bun run test:unit

# Specific test file
bun run test:unit -- tests/core/module-registry.test.ts

# Filter by test name
bun run test:unit -- --grep "Module Registry"
```

### CI/CD

```bash
# All tests (used in CI)
bun run test

# With coverage report
bun run test:unit -- --coverage --run

# Type checking + tests
bun run check && bun run test
```

### Debugging

```bash
# Verbose output
bun run test:unit -- --reporter=verbose

# Debug specific test
bun run test:unit -- tests/core/module-registry.test.ts --inspect
```

---

## Test Maintenance

### Adding New Tests

1. **Identify test type**: Unit, integration, or migration
2. **Choose location**: Colocated (`.spec.ts`) or `tests/` directory
3. **Use utilities**: Import from `tests/utils/`
4. **Follow patterns**: Match existing test structure
5. **Document**: Update this file if adding new utilities

### Updating Tests

When updating existing code:

1. Run affected tests first
2. Update test expectations
3. Add new test cases for new functionality
4. Ensure all tests pass before committing

### Test Refactoring

Periodically:

1. Remove duplicate test code
2. Extract common setup to utilities
3. Update factories to match schema changes
4. Review and improve test performance

---

## Troubleshooting

### Common Issues

**Test fails with "database locked"**

- Use in-memory databases for unit tests
- Ensure proper cleanup in `afterEach`
- Avoid sharing databases between tests

**Import errors in tests**

- Check `vite.config.ts` test configuration
- Verify module resolution paths
- Use `$lib` alias consistently

**Tests pass locally but fail in CI**

- Check environment variables
- Verify file paths (case sensitivity)
- Ensure all dependencies are installed

**Slow test execution**

- Use `createTestDb()` (in-memory) not file-based
- Reduce database operations in beforeEach
- Run tests in parallel (default in Vitest)

---

## Advanced Topics

### Property-Based Testing

```typescript
import { fc } from 'fast-check';

describe('email validation', () => {
	it('should validate all email formats', () => {
		fc.assert(
			fc.property(fc.emailAddress(), (email) => {
				expect(isValidEmail(email)).toBe(true);
			})
		);
	});
});
```

### Snapshot Testing

```typescript
it('should match module config structure', () => {
	const config = createMockModuleConfig();
	expect(config).toMatchSnapshot();
});
```

### Mocking External Dependencies

```typescript
import { vi } from 'vitest';

it('should handle API failure', async () => {
	vi.mock('$lib/api', () => ({
		fetchData: vi.fn().mockRejectedValue(new Error('Network error'))
	}));

	await expect(fetchData()).rejects.toThrow('Network error');
});
```

---

## Related Documentation

- [Testing Guide](./testing.md) - Basic testing information
- [Database Architecture](../architecture/database.md) - Database design
- [Module Development](../modules/development.md) - Creating modules
- [Troubleshooting](./troubleshooting.md) - Common issues

---

_Last Updated: 2026-03-06_
