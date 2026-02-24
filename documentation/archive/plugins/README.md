# Archived Plugin System Documentation

This directory contains legacy plugin system documentation that has been archived.

## Background

MoLOS previously used a "plugin" system that was later replaced by the current "module" system. The plugin system had similar goals but different architecture.

## Migration

The plugin system was migrated to the module system in 2025-2026. Key differences:

| Aspect       | Plugin System (Old)    | Module System (Current)              |
| ------------ | ---------------------- | ------------------------------------ |
| Structure    | `plugins/molos-{name}` | `modules/{name}` or npm packages     |
| Discovery    | Manual registration    | Automatic via `import.meta.glob`     |
| Distribution | Local only             | npm, GitHub, or local development    |
| Integration  | Plugin hooks           | SvelteKit routes and packages        |
| Database     | Shared tables          | Namespaced tables (`MoLOS-{Name}_*`) |

## Contents

- **molos-ai-tools.md** - AI tools plugin documentation
- **molos-db.md** - Database plugin documentation
- **molos-module-management.md** - Module management plugin documentation

## Relevance

This documentation is kept for:

- Historical reference
- Understanding old code patterns
- Migration context for contributors

For current development, see the **[Module System](../../modules/)** documentation.

---

_Last Updated: 2026-02-24_
