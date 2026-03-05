-- Migration: Add submodule-level and tool-level permissions for MCP
-- Renames allowed_modules to allowed_scopes
-- Adds submodule and name fields to resources and prompts tables

-- Step 1: Rename allowed_modules to allowed_scopes in ai_mcp_api_keys
ALTER TABLE ai_mcp_api_keys RENAME COLUMN allowed_modules TO allowed_scopes;

--> statement-breakpoint

-- Step 2: Add submoduleId column to ai_mcp_resources
ALTER TABLE ai_mcp_resources ADD COLUMN submodule_id TEXT;

--> statement-breakpoint

-- Step 3: Add resourceName column to ai_mcp_resources
ALTER TABLE ai_mcp_resources ADD COLUMN resource_name TEXT;

--> statement-breakpoint

-- Step 4: Add submoduleId column to ai_mcp_prompts
ALTER TABLE ai_mcp_prompts ADD COLUMN submodule_id TEXT;

--> statement-breakpoint

-- Step 5: Add promptName column to ai_mcp_prompts
ALTER TABLE ai_mcp_prompts ADD COLUMN prompt_name TEXT;

--> statement-breakpoint

-- Note: This is a breaking change. Old API keys with module-level
-- permissions will need to be updated to use the new scope format.
-- New format: "module", "module:submodule", or "module:submodule:tool"
