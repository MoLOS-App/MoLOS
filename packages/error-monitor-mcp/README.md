# Error Monitor MCP Server

A Model Context Protocol (MCP) server that provides automated error detection, aggregation, and pattern memory for OpenCode agents.

## Features

- **Error Aggregation**: Collects errors from multiple sources (server logs, console, UI, API)
- **Pattern Memory**: Learns from successful fixes and remembers solutions across sessions
- **Auto-fix Tracking**: Tracks fix attempts per error, up to 5 retries
- **Persistent Storage**: Error patterns stored in JSON file, survives restarts

## Error Types

| Type      | Source            | Description                |
| --------- | ----------------- | -------------------------- |
| `server`  | Dev server logs   | Backend/runtime errors     |
| `console` | Browser console   | JavaScript errors in UI    |
| `ui`      | Playwright checks | Rendering/display errors   |
| `api`     | API responses     | HTTP errors from endpoints |
| `unknown` | Manual reports    | Uncategorized errors       |

## Available Tools

| Tool                 | Description                             |
| -------------------- | --------------------------------------- |
| `get_errors`         | Get all unresolved errors               |
| `get_all_errors`     | Get all errors including resolved       |
| `clear_errors`       | Clear error buffer                      |
| `resolve_error`      | Mark error as resolved (learns pattern) |
| `resolve_errors`     | Mark multiple errors as resolved        |
| `add_error`          | Manually add an error                   |
| `get_suggestions`    | Get fix hints from learned patterns     |
| `can_fix`            | Check if error still has retries left   |
| `record_fix_attempt` | Track a fix attempt                     |
| `reset_fix_attempts` | Reset attempts for an error             |
| `get_patterns`       | Get all learned patterns                |
| `add_pattern`        | Add a known pattern manually            |
| `remove_pattern`     | Remove a learned pattern                |
| `clear_patterns`     | Clear all patterns                      |
| `add_server_log`     | Add server log line (checks for errors) |
| `get_server_logs`    | Get accumulated server logs             |
| `verify_no_errors`   | Comprehensive error check               |

## Usage

### Starting the MCP Server

```bash
# Development
bun run error-monitor:mcp

# Or directly
cd packages/error-monitor-mcp && bun run dev
```

### Environment Variables

| Variable              | Default                    | Description                    |
| --------------------- | -------------------------- | ------------------------------ |
| `ERROR_PATTERNS_PATH` | `data/error-patterns.json` | Path to store learned patterns |

### OpenCode Agent Configuration

Add to your `opencode.json`:

```json
{
	"mcp": {
		"error-monitor": {
			"type": "local",
			"command": ["bun", "run", "error-monitor:mcp"],
			"cwd": "/path/to/MoLOS"
		}
	}
}
```

## How It Works

### Error Detection Flow

```
1. OpenCode makes code change
2. Calls error_monitor_verify_no_errors()
3. If errors found:
   - Gets error details via get_errors()
   - Checks suggestions via get_suggestions()
   - Attempts fix
   - Records attempt via record_fix_attempt()
   - Resolves via resolve_error() when fixed
   - Repeats up to 5 times
4. If no errors: reports success
```

### Pattern Learning

When an error is resolved with `learnPattern=true`:

1. Extracts a regex pattern from the error message
2. Stores pattern + solution in `data/error-patterns.json`
3. Future similar errors will get automatic suggestions

### Retry Logic

```
MAX_FIX_ATTEMPTS = 5 per unique error message

- can_fix() returns { canFix: true, remainingAttempts: N }
- record_fix_attempt() increments counter
- After 5 failed attempts, error is flagged for human review
```

## Example OpenCode Agent Usage

```json
// After implementing a feature:
{
  "tool": "error_monitor_verify_no_errors",
  "params": {}
}
// Response: { isErrorFree: false, errorCount: 2, errors: [...] }

// Fix the errors:
{
  "tool": "error_monitor_get_errors",
  "params": {}
}

// For each error:
{
  "tool": "error_monitor_get_suggestions",
  "params": { "errorMessage": "Cannot read property 'x' of undefined" }
}

// Attempt fix, then:
{
  "tool": "error_monitor_record_fix_attempt",
  "params": { "errorMessage": "Cannot read property 'x' of undefined" }
}

// When fixed:
{
  "tool": "error_monitor_resolve_error",
  "params": { "id": "err_123...", "learnPattern": true }
}
```

## Architecture

- Uses `@modelcontextprotocol/sdk` for MCP protocol
- Persistent JSON file storage for patterns
- In-memory error buffer (cleared on resolution or explicit clear)
- Communication via stdio (JSON-RPC)
- Auto-save patterns with debouncing

## Files

- `src/index.ts` - Main MCP server implementation
- `package.json` - Package configuration
- `tsconfig.json` - TypeScript configuration
