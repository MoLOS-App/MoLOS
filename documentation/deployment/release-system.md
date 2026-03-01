# Release System

> Automated versioning and release system for MoLOS using Changesets and GitHub Actions.

## Distribution Strategy

MoLOS follows a **verified modules** distribution model:

### Official Docker Image

The MoLOS team ships a **default Docker image** that includes:

- All **verified modules** at their **verified versions**
- Pre-configured and tested together
- Users **activate/deactivate** modules as needed via settings

```bash
# Pull the official image with all verified modules
docker pull ghcr.io/molos-app/molos:latest
```

### User-Built Images

Users can build **custom Docker images** with their own module selections:

- Choose which modules to include
- Add community or custom modules
- **At their own risk** - not officially supported

```bash
# Build custom image with selected modules
# Edit modules.config.ts to customize
docker build -t my-molos:custom .
```

### Summary

| Image Type   | Modules                                   | Support            | Use Case                        |
| ------------ | ----------------------------------------- | ------------------ | ------------------------------- |
| **Official** | All verified modules at verified versions | Full               | Production use                  |
| **Custom**   | User-selected modules                     | None (at own risk) | Experimentation, specific needs |

> **Key Decision:** Module activation is a runtime concern, not a build-time concern. The official image includes everything; users choose what to enable.

## Overview

MoLOS uses a Changesets-based release system with PR label triggers for automated versioning and releases. This provides:

- **Independent versioning** for each package and module
- **Review step** via Version Packages PR before final release
- **Auto-generated CHANGELOGs** from PR descriptions
- **Automatic updates** to `modules.config.ts` when module versions change
- **Docker image publishing** for the main application

## Quick Reference

| What                    | How                                                                  |
| ----------------------- | -------------------------------------------------------------------- |
| Trigger a release       | Add `release:patch`, `release:minor`, or `release:major` label to PR |
| Skip release            | Add `release:skip` label or no release label                         |
| Manual release          | `bun run release patch` (or minor/major)                             |
| View pending changesets | `bun run changeset:status`                                           |

## Release Labels

| Label           | Color     | Description                                |
| --------------- | --------- | ------------------------------------------ |
| `release:patch` | `#0e8a16` | Bug fixes, small changes (0.0.x)           |
| `release:minor` | `#fbca04` | New features, backwards compatible (0.x.0) |
| `release:major` | `#e11d21` | Breaking changes (x.0.0)                   |
| `release:skip`  | `#b0b0b0` | No release needed (docs, tests)            |

## Release Workflow

```
PR with label "release:minor" merged
         │
         ▼
┌─────────────────────────┐
│ GitHub Action generates │
│ changeset from PR info  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Run changeset version   │
│ → Creates "Version      │
│   Packages" PR          │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Maintainer reviews      │
│ version bumps & logs    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Merge Version PR        │
│ → Create Git tags       │
│ → Create GitHub Release │
│ → Update modules.config │
│ → Trigger Docker build  │
│   (if app changed)      │
└─────────────────────────┘
```

## Version Strategy

### Independent Versioning

Each package and module maintains its own version independently:

| Package Type                | Version Scope | Example Tag         |
| --------------------------- | ------------- | ------------------- |
| Main app (`molos`)          | Independent   | `v0.2.0`            |
| Packages (`@molos/*`)       | Independent   | N/A (not published) |
| Modules (`@molos/module-*`) | Independent   | `tasks-v1.1.0`      |

### Docker Tags

Docker images are only published for the main application:

- `ghcr.io/molos-app/molos:v0.2.0` - Version-specific
- `ghcr.io/molos-app/molos:latest` - Latest stable

### modules.config.ts Updates

When a module is released, `modules.config.ts` is automatically updated with the new version:

```typescript
// Before
{ repo: 'github.com/molos-org/MoLOS-Tasks', tag: 'v1.0.0' }

// After release (minor bump)
{ repo: 'github.com/molos-org/MoLOS-Tasks', tag: 'v1.1.0' }
```

## GitHub Actions Workflows

### release.yml

**Trigger:** `pull_request.closed` (when merged with release label)

**Responsibilities:**

1. Detect release label on merged PR
2. Generate changeset file from PR title and description
3. Run `changeset version` to bump versions
4. Create "Version Packages" PR for review

### version-packages.yml

**Trigger:** `push` to `main` on `Version Packages` PR merge

**Responsibilities:**

1. Detect Version Packages PR merge
2. Create Git tags for each bumped package
3. Create GitHub Releases with changelog
4. Update `modules.config.ts` with new module versions
5. Trigger Docker build (if main app changed)

### publish.yml

**Trigger:** `push` tags `v*` or `workflow_call`

**Responsibilities:**

1. Run tests
2. Build and push Docker image to GHCR
3. Tag with version and `latest`

## Manual Releases

For situations where you need to release manually (e.g., hotfixes, initial setup):

```bash
# Create a changeset
bun run changeset

# Version packages (creates version bump commits)
bun run changeset:version

# Review changes, then release
bun run release [patch|minor|major]
```

### Manual Release Script

The `scripts/release.sh` script provides a simplified manual release:

```bash
./scripts/release.sh patch   # Bug fixes
./scripts/release.sh minor   # New features
./scripts/release.sh major   # Breaking changes
```

This script:

1. Bumps the root `package.json` version
2. Updates `CHANGELOG.md`
3. Commits and tags the release
4. Pushes to GitHub (triggers Docker build)

## CHANGELOG Generation

CHANGELOGs are auto-generated from PR information:

- **PR title** becomes the changelog entry
- **PR description** provides additional context
- Each package/module gets its own `CHANGELOG.md`

Example generated entry:

```markdown
## 1.1.0

### Minor Changes

- abc123: Add new task filtering options ([#123](https://github.com/molos-org/MoLOS/pull/123))

### Patch Changes

- def456: Fix task completion state persistence ([#124](https://github.com/molos-org/MoLOS/pull/124))

- Updated dependencies: []
```

## Configuration Files

### .changeset/config.json

```json
{
	"$schema": "https://unpkg.com/@changesets/config@2.3.1/schema.json",
	"changelog": "@changesets/changelog-github",
	"commit": false,
	"access": "restricted",
	"baseBranch": "main",
	"updateInternalDependencies": "patch"
}
```

Key settings:

- `access: restricted` - No npm publishing (Docker only)
- `baseBranch: main` - Target branch for releases
- `updateInternalDependencies: patch` - Auto-bump internal deps

### Package Scripts

```json
{
	"scripts": {
		"changeset": "changeset",
		"changeset:version": "changeset version",
		"changeset:status": "changeset status",
		"release": "bun run scripts/release-cli.ts"
	}
}
```

## Creating GitHub Labels

Run this script to create the required labels in your repository:

```bash
# Using GitHub CLI
gh label create "release:patch" --color "0e8a16" --description "Bug fixes, small changes"
gh label create "release:minor" --color "fbca04" --description "New features, backwards compatible"
gh label create "release:major" --color "e11d21" --description "Breaking changes"
gh label create "release:skip" --color "b0b0b0" --description "No release needed"
```

## Troubleshooting

### Release not triggered

1. Check PR has a `release:*` label before merging
2. Verify GitHub Actions has write permissions
3. Check `baseBranch` in `.changeset/config.json` matches your branch

### Version Packages PR not created

1. Check if changeset files exist in `.changeset/*.md`
2. Run `bun run changeset:status` to see pending changesets
3. Ensure PR modified package files (not just docs)

### Docker image not published

1. Verify main app version was bumped
2. Check tag format: `v*` (e.g., `v0.2.0`)
3. Ensure GitHub token has package write permissions

### modules.config.ts not updated

1. Check `scripts/update-modules-config.ts` runs successfully
2. Verify module package.json has correct `@molos/module-*` name
3. Ensure module exists in `modules.config.ts`

## Related Documentation

- [Production Build System](./production-build.md) - Build-time module resolution
- [Docker Deployment](./docker.md) - Docker/Podman deployment guide
- [Architecture Overview](../architecture/overview.md) - System architecture

---

_Last Updated: 2026-02-27_
