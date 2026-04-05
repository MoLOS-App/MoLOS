# Playwright MCP Server

A Model Context Protocol (MCP) server that provides UI testing capabilities via Playwright. OpenCode agents can use this to test the MoLOS UI for errors.

## Tools Available

| Tool                   | Description                                                      |
| ---------------------- | ---------------------------------------------------------------- |
| `navigate`             | Navigate to a URL in the browser                                 |
| `click`                | Click an element on the page                                     |
| `fill`                 | Fill an input field with text                                    |
| `get_text`             | Get text content from an element                                 |
| `get_attribute`        | Get an attribute value from an element                           |
| `evaluate`             | Execute JavaScript in the page context                           |
| `screenshot`           | Take a screenshot of the page                                    |
| `wait_for_selector`    | Wait for an element to appear on the page                        |
| `wait_for_timeout`     | Wait for a specified duration                                    |
| `check_errors`         | Check for console errors and page errors                         |
| `get_page_info`        | Get information about the current page                           |
| `close_page`           | Close a specific page or the current page                        |
| `list_pages`           | List all open pages in the current session                       |
| `set_session`          | Set or create a browser session                                  |
| `close_session`        | Close a browser session and all its pages                        |
| `ui_test_check_errors` | Test a UI page for errors (combines navigation + error checking) |

## Usage

### Running the MCP Server

```bash
# Development
bun run playwright:mcp

# Or directly
cd packages/playwright-mcp && bun run dev
```

### Environment Variables

| Variable              | Default                 | Description                  |
| --------------------- | ----------------------- | ---------------------------- |
| `PLAYWRIGHT_BASE_URL` | `http://localhost:5173` | Base URL for the app         |
| `PLAYWRIGHT_HEADLESS` | `true`                  | Run browser in headless mode |

### Example OpenCode Agent Usage

OpenCode agents can call these tools via the MCP protocol:

```json
// Example: Navigate to MCP dashboard and check for errors
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
// Example: Click a button and check for errors
{
	"tool": "navigate",
	"params": {
		"url": "http://localhost:5173/ui/ai/mcp?tab=keys"
	}
}
```

```json
// Example: Check for console errors on a page
{
	"tool": "check_errors",
	"params": {}
}
```

## For OpenCode Integration

To use this MCP server with OpenCode, configure it in your OpenCode settings:

```json
{
	"mcpServers": {
		"playwright": {
			"command": "bun",
			"args": ["run", "playwright:mcp"],
			"cwd": "/path/to/MoLOS"
		}
	}
}
```

Or run it standalone:

```bash
cd /path/to/MoLOS
bun run playwright:mcp
```

## Architecture

- Uses `@modelcontextprotocol/sdk` for MCP protocol implementation
- Uses `playwright` for browser automation
- Communication via stdio (JSON-RPC)
- Supports multiple browser sessions
- Error tracking for console errors and page errors

## Integration with Error Monitor

Playwright MCP works together with `error-monitor-mcp` for comprehensive error handling:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Error Detection Flow                           │
│                                                                  │
│  1. Playwright checks UI → Returns errors                        │
│              ↓                                                   │
│  2. OpenCode calls error_monitor_add_error for each error       │
│              ↓                                                   │
│  3. OpenCode attempts fixes (up to 5 times per error)            │
│              ↓                                                   │
│  4. OpenCode verifies with Playwright again                      │
│              ↓                                                   │
│  5. OpenCode calls error_monitor_resolve_error when fixed      │
└─────────────────────────────────────────────────────────────────┘
```

### Example Combined Workflow

```json
// Step 1: Check UI with Playwright
{
  "tool": "ui_test_check_errors",
  "params": {
    "url": "http://localhost:5173/ui/ai/mcp",
    "expectedErrors": 0
  }
}

// Step 2: If errors found, add them to error monitor
{
  "tool": "error_monitor_add_error",
  "params": {
    "type": "ui",
    "source": "MCP Dashboard",
    "message": "Cannot read property 'x' of undefined"
  }
}

// Step 3: Get suggestions based on learned patterns
{
  "tool": "error_monitor_get_suggestions",
  "params": {
    "errorMessage": "Cannot read property 'x' of undefined"
  }
}

// Step 4: Fix, record attempt, verify again
// (repeat up to 5 times)

// Step 5: When fixed, resolve the error
{
  "tool": "error_monitor_resolve_error",
  "params": {
    "id": "err_123...",
    "learnPattern": true
  }
}
```

### OpenCode Configuration

Configure both MCPs in your `opencode.json`:

```json
{
	"mcp": {
		"playwright": {
			"type": "local",
			"command": ["bun", "run", "playwright:mcp"],
			"cwd": "/path/to/MoLOS"
		},
		"error-monitor": {
			"type": "local",
			"command": ["bun", "run", "error-monitor:mcp"],
			"cwd": "/path/to/MoLOS"
		}
	}
}
```
