# MoLOS Module Release Script

> Guide for releasing individual MoLOS modules with the `module:release` script.

---

## Overview

The `module:release` script automates the release process for individual modules in the MoLOS monorepo. It handles version bumping, git workflows, and tag creation according to semantic versioning rules.

**Usage:**

```bash
bun run module:release --type [major|minor|patch] --module [MoLOS-Tasks...]
```

---

## Quick Reference

| Command                                                                 | Description            |
| ----------------------------------------------------------------------- | ---------------------- |
| `bun run module:release --type patch --module MoLOS-Tasks`              | Release patch version  |
| `bun run module:release --type minor --module MoLOS-Goals --dry-run`    | Preview release        |
| `bun run module:release --type major --module MoLOS-Health --skip-push` | Prepare but don't push |

---

## Arguments

### Required Arguments

| Argument          | Alias | Description                                     |
| ----------------- | ----- | ----------------------------------------------- |
| `--type <type>`   | `-t`  | Version bump type: `major`, `minor`, or `patch` |
| `--module <name>` | `-m`  | Module name (folder name in `modules/`)         |

### Options

| Option        | Alias | Description                                   |
| ------------- | ----- | --------------------------------------------- |
| `--dry-run`   | `-n`  | Show what would happen without making changes |
| `--skip-push` | -     | Prepare release but don't push to remote      |
| `--help`      | `-h`  | Show help message                             |

---

## Workflow

The script follows different workflows based on the current branch:

### On `develop` Branch

```
1. Pull latest from develop
2. Fetch main branch
3. Merge develop → main
4. Bump version
5. Create tag
6. Push to remote
7. Switch back to develop
```

### On `main` Branch

```
1. Bump version
2. Create tag
3. Push to remote
```

---

## Tag Naming Convention

Tags are created with the format: `<module>-v<version>`

| Module       | Tag Example           |
| ------------ | --------------------- |
| MoLOS-Tasks  | `molos-tasks-v1.2.0`  |
| MoLOS-Goals  | `molos-goals-v0.1.0`  |
| MoLOS-Health | `molos-health-v2.0.0` |

---

## Validation Checks

Before performing any actions, the script validates:

- [ ] Module folder exists under `modules/`
- [ ] Module is a git repository
- [ ] Remote is configured
- [ ] Current branch is `develop` or `main`
- [ ] Working directory is clean (no uncommitted changes)
- [ ] Tag does not already exist

If any validation fails, the script exits with an error message.

---

## Examples

### Patch Release (Bug Fixes)

```bash
# Release patch for MoLOS-Tasks
bun run module:release --type patch --module MoLOS-Tasks

# Dry run first to preview
bun run module:release --type patch --module MoLOS-Tasks --dry-run
```

### Minor Release (New Features)

```bash
# Release minor version for MoLOS-Goals
bun run module:release --type minor --module MoLOS-Goals
```

### Major Release (Breaking Changes)

```bash
# Release major version for MoLOS-Health
bun run module:release --type major --module MoLOS-Health
```

### Skip Push (Manual Push Later)

```bash
# Prepare release but don't push
bun run module:release --type patch --module MoLOS-Tasks --skip-push

# Then push manually:
# git push origin main
# git push origin molos-tasks-v1.2.0
```

---

## Error Handling

### "Module not found"

The specified module doesn't exist in the `modules/` directory.

```bash
# List available modules
ls modules/
```

### "Not a git repository"

The module folder is not a git repo. Each module must be its own git repo.

### "Invalid branch"

Current branch is neither `develop` nor `main`. Releases must be done from these branches.

### "Working directory has uncommitted changes"

Commit or stash changes before releasing.

```bash
git stash
# ... perform release ...
git stash pop
```

### "Tag already exists"

The calculated tag already exists. This usually means:

- The version was already released
- Use a higher version bump type (e.g., `minor` instead of `patch`)

---

## Script Location

The script is located at:

```
scripts/module-release.ts
```

It's registered in `package.json` as:

```json
"module:release": "bun scripts/module-release.ts"
```

---

## Version Bumping Rules

| Type      | When to Use                        | Example           |
| --------- | ---------------------------------- | ----------------- |
| **patch** | Bug fixes, small changes           | `1.2.0` → `1.2.1` |
| **minor** | New features, backwards compatible | `1.2.0` → `1.3.0` |
| **major** | Breaking changes                   | `1.2.0` → `2.0.0` |

---

## Safety Features

1. **Dry-run mode** - Preview all actions without making changes
2. **Validation-first** - All checks run before any modifications
3. **Clean working directory required** - Prevents accidental releases with uncommitted changes
4. **Tag existence check** - Prevents duplicate tags
5. **Skip push option** - Manual control over when to push

---

## See Also

- [Release Manager Agent](../../.opencode/agents/release-manager.md) - Agent documentation for release orchestration
- [Release System](../deployment/release-system.md) - Complete release system documentation
- [Module Development Guide](../modules/development.md) - Creating and managing modules
- [Semantic Versioning](https://semver.org/) - Version numbering specification

---

_Last Updated: 2026-04-02_
