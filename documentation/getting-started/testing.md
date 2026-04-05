# Testing

MoLOS uses Vitest for unit testing with separate configurations for client and server tests.

## Quick Links

| I want to...                | Go to                                                      |
| --------------------------- | ---------------------------------------------------------- |
| See basic commands          | [Commands](#commands)                                      |
| Write repository tests      | [Repository Tests](#writing-tests)                         |
| Test migrations             | [Migration Tests](#migration-tests)                        |
| Use test utilities          | [Test Utilities](#test-utilities)                          |
| **See comprehensive guide** | **[Comprehensive Test Suite](./testing-comprehensive.md)** |

## Commands

| Command                                       | Description                  |
| --------------------------------------------- | ---------------------------- |
| `bun run test`                                | Run all tests (via turbo)    |
| `bun run test:unit`                           | Run unit tests in watch mode |
| `bun run test:unit -- --run`                  | Run unit tests once          |
| `bun run test:unit -- tests/migrations --run` | Run migration tests only     |
| `bun run test:e2e`                            | Run Playwright E2E tests     |
| `bun run test:e2e:ui`                         | Run E2E tests with UI        |
| `bun run playwright:mcp`                      | Start Playwright MCP server  |

## Test Structure

```
tests/
├── migrations/                    # Database migration tests
│   ├── utils.ts                   # Test utilities
│   ├── migrations.spec.ts         # Core & module migration tests
│   ├── rollback.spec.ts           # Rollback SQL generation tests
│   ├── logger-and-validator.spec.ts # Logger & validator tests
│   └── namespace.spec.ts          # Table namespacing tests

src/
├── **/*.test.ts                   # Inline test files
└── **/*.spec.ts                   # Inline spec files
```

## Test Configuration

Tests are configured in `vite.config.ts`:

```typescript
test: {
	projects: [
		{
			test: {
				name: 'client',
				browser: { enabled: true, provider: playwright() },
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
	];
}
```

---

## Migration Tests

The migration test suite validates the database migration system.

### Test Files

| File                                            | Tests | Description                                        |
| ----------------------------------------------- | ----- | -------------------------------------------------- |
| `tests/migrations/utils.ts`                     | -     | Test utilities (createTestDb, cleanupTestDb, etc.) |
| `tests/migrations/migrations.spec.ts`           | 7     | Core & module migrations, schema validation        |
| `tests/migrations/rollback.spec.ts`             | 8     | Rollback SQL generation                            |
| `tests/migrations/logger-and-validator.spec.ts` | 7     | Migration logger & schema validator                |
| `tests/migrations/namespace.spec.ts`            | 4     | Table namespacing utilities                        |

### Running Migration Tests

```bash
# Run all migration tests
bun run test:unit -- tests/migrations --run

# Run specific test file
bun run test:unit -- tests/migrations/rollback.spec.ts --run

# Run with coverage
bun run test:unit -- tests/migrations --coverage --run
```

### Test Utilities

```typescript
// tests/migrations/utils.ts
import { createTestDb, cleanupTestDb, getTableNames, tableExists } from './utils';

describe('My Test', () => {
	let testDb: ReturnType<typeof createTestDb>;

	beforeEach(() => {
		testDb = createTestDb('my-test');
	});

	afterEach(() => {
		cleanupTestDb(testDb.db, testDb.path);
	});

	it('should work', () => {
		expect(tableExists(testDb.db, 'users')).toBe(false);
	});
});
```

### Available Utilities

| Function                     | Description                    |
| ---------------------------- | ------------------------------ |
| `createTestDb(name)`         | Create isolated test database  |
| `cleanupTestDb(db, path)`    | Close and delete test database |
| `getTableNames(db)`          | Get all table names            |
| `tableExists(db, name)`      | Check if table exists          |
| `getAppliedMigrations(db)`   | Get list of applied migrations |
| `countAppliedMigrations(db)` | Count applied migrations       |

---

## Writing Tests

### Basic Test

```typescript
import { describe, it, expect } from 'vitest';

describe('My Feature', () => {
	it('should work correctly', () => {
		expect(1 + 1).toBe(2);
	});
});
```

### Database Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createTestDb, cleanupTestDb } from '../utils';

describe('Database', () => {
	let testDb: ReturnType<typeof createTestDb>;

	beforeAll(() => {
		testDb = createTestDb('my-test');
	});

	afterAll(() => {
		cleanupTestDb(testDb.db, testDb.path);
	});

	it('should apply migrations', async () => {
		const db = drizzle(testDb.db);
		await migrate(db, { migrationsFolder: './drizzle' });
		// assertions...
	});
});
```

---

## CI Integration

Tests run automatically in CI via GitHub Actions:

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run unit tests
        run: bun run test

  migration-validation:
    runs-on: ubuntu-latest
    steps:
      - name: Run migration tests
        run: bun run test:unit -- tests/migrations --run
```

---

## Module Validation

Validate external modules:

```bash
bun run module:validate ./modules/MoLOS-Tasks
```

---

## Playwright MCP for AI Agents

OpenCode agents can use the Playwright MCP server to test UI for errors.

### Starting the MCP Server

```bash
# Start the Playwright MCP server
bun run playwright:mcp
```

### Available Tools

| Tool                   | Description                              |
| ---------------------- | ---------------------------------------- |
| `navigate`             | Navigate to a URL in the browser         |
| `click`                | Click an element on the page             |
| `fill`                 | Fill an input field with text            |
| `get_text`             | Get text content from an element         |
| `get_attribute`        | Get an attribute value from an element   |
| `evaluate`             | Execute JavaScript in the page context   |
| `screenshot`           | Take a screenshot of the page            |
| `wait_for_selector`    | Wait for an element to appear            |
| `wait_for_timeout`     | Wait for a specified duration            |
| `check_errors`         | Check for console errors and page errors |
| `get_page_info`        | Get information about the current page   |
| `close_page`           | Close a specific page                    |
| `list_pages`           | List all open pages                      |
| `set_session`          | Set or create a browser session          |
| `close_session`        | Close a browser session                  |
| `ui_test_check_errors` | Test a UI page for errors (combo tool)   |

### Example Usage for AI Agents

```json
// Example: Test MCP dashboard for errors
{
	"tool": "ui_test_check_errors",
	"params": {
		"url": "http://localhost:5173/ui/ai/mcp",
		"waitForSelector": "text=Dashboard",
		"expectedErrors": 0
	}
}
```

```json
// Example: Navigate and click
{
	"tool": "navigate",
	"params": {
		"url": "http://localhost:5173/ui/ai/mcp?tab=keys"
	}
}
```

### Configuration

| Environment Variable  | Default                 | Description                  |
| --------------------- | ----------------------- | ---------------------------- |
| `PLAYWRIGHT_BASE_URL` | `http://localhost:5173` | Base URL for the app         |
| `PLAYWRIGHT_HEADLESS` | `true`                  | Run browser in headless mode |

### E2E Test Files

```
tests/e2e/
└── mcp-ui-errors.spec.ts    # UI error detection tests
```

---

## Notes

- Run `bun run module:sync` after module changes
- MoLOS-Tasks is the reference external module
- Always clean up test databases in `afterEach`/`afterAll`

---

## Related

- [Database Architecture](../architecture/database.md)
- [Troubleshooting](./troubleshooting.md)
- [Database Package](../packages/database.md)

_Last Updated: 2026-02-23_
