-- Add error_build status to settings_external_modules
-- This status is used when a module fails to build during Vite compilation
-- No schema changes needed - the status field already uses TEXT type
-- This migration exists to track the addition of ERROR_BUILD status support

-- The status field in settings_external_modules already supports arbitrary text values
-- The ERROR_BUILD status is used by vite.config.ts moduleBuildErrorHandler plugin
-- to mark modules that caused build failures

SELECT 1;
