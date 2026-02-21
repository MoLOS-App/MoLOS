# Troubleshooting (Codex)

Common issues

- Vite SSR runner closed during module clone:
  - Ensure Vite ignores external_modules/\*\*/svelte.config.js and tsconfig.json
  - Restart dev server after a clone finishes

- Missing module imports:
  - Use $lib/\*/external_modules/<MODULE_ID> paths
  - AI tools: $lib/server/ai/external_modules/<MODULE_ID>/ai-tools

- Module not loading:
  - Check manifest.yaml id matches folder name
  - Run npm run modules:sync and npm run module:validate
