# Module System (Codex)

Module layout
- external modules live in external_modules/<MODULE_ID>
- symlinks are created into core app under src/:
  - lib/components/external_modules/<MODULE_ID>
  - lib/config/external_modules/<MODULE_ID>.ts
  - lib/models/external_modules/<MODULE_ID>
  - lib/repositories/external_modules/<MODULE_ID>
  - lib/stores/external_modules/<MODULE_ID>
  - lib/server/ai/external_modules/<MODULE_ID>
  - lib/server/db/schema/external_modules/<MODULE_ID>
  - routes/ui/(modules)/(external_modules)/<MODULE_ID>
  - routes/api/(external_modules)/<MODULE_ID>

Module initialization
- ModuleManager runs in module-management/server/core-manager.ts
- Sync script: scripts/sync-modules.ts
- Local modules may be symlinked via local:// paths in DB

Key constraints
- Do not use src/lib/modules or src/lib/config/modules (legacy)
- Import module code via $lib/*/external_modules/<MODULE_ID>
- External AI tools live at src/lib/server/ai/external_modules/<MODULE_ID>/ai-tools.ts
