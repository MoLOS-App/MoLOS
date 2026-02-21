# Plugin: molos-module-management

Purpose

- Wrap module lifecycle commands and path conventions.

Capabilities

- modules:sync -> npm run modules:sync
- module:create -> npm run module:create <name>
- module:validate -> npm run module:validate <path>
- module:test -> npm run module:test <path>
- check symlink layout per README

Notes

- External module imports must use $lib/\*/external_modules/<MODULE_ID>
- AI tools live at src/lib/server/ai/external_modules/<MODULE_ID>/ai-tools.ts
