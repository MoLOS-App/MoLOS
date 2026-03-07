-- Migration: 0018_rename_allowed_modules_to_scopes
-- Module: core
-- Created: 2026-03-07
-- Purpose: Rename allowed_modules column to allowed_scopes in ai_mcp_api_keys table

-- Rename column from allowed_modules to allowed_scopes
ALTER TABLE `ai_mcp_api_keys` RENAME COLUMN `allowed_modules` TO `allowed_scopes`;
