# MCP Resource Handlers

This directory is for implementing actual resource handlers for the MCP server.

## TODO

The current resource implementation returns placeholder metadata. To implement actual resource handlers:

1. **Database Resources** (`database.ts`)
   - Query tables and return results as resources
   - Support filtering and pagination
   - Map table rows to resource content

2. **File Resources** (`files.ts`)
   - Read and return file contents
   - Support different MIME types
   - Handle file paths relative to a base directory

3. **API Resources** (`api.ts`)
   - Fetch from external APIs
   - Cache API responses
   - Handle API authentication

4. **Module Resources** (`modules.ts`)
   - Call module-specific resource handlers
   - Allow external modules to register resource handlers
   - Support dynamic resource discovery

## Resource Handler Interface

```typescript
export interface ResourceHandler {
	get(uri: string, context: MCPContext): Promise<ResourceContent>;
	list(context: MCPContext): Promise<MCPProtocolResource[]>;
}
```

## Example Implementation

```typescript
export class DatabaseResourceHandler implements ResourceHandler {
	async get(uri: string, context: MCPContext): Promise<ResourceContent> {
		// Parse URI: mcp://molos/database/users
		const [type, ...pathParts] = uri.replace('mcp://molos/', '').split('/');

		// Query database
		const db = getDatabase();
		const results = await db.select().from(pathParts[0]).limit(100);

		return {
			uri,
			mimeType: 'application/json',
			text: JSON.stringify(results, null, 2)
		};
	}
}
```

## Registration

Register handlers in the main resource handler:

```typescript
const resourceHandlers = new Map<string, ResourceHandler>();
resourceHandlers.set('database', new DatabaseResourceHandler());
resourceHandlers.set('file', new FileResourceHandler());
```
