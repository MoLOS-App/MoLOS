# ADR-002: Verified Modules Distribution Strategy

| Status    | Accepted         |
| --------- | ---------------- |
| Date      | 2026-02-27       |
| Deciders  | Development Team |
| Review By | 2026-06-27       |

## Context

MoLOS is a modular productivity suite with many optional modules (Tasks, Goals, Finance, Health, etc.). We needed to decide how to distribute the application and its modules to users.

### Options Considered

1. **Minimal core + user-installed modules** - Ship minimal core, users install modules from registry
2. **Verified bundle + runtime activation** - Ship all verified modules, users activate at runtime
3. **User-built images** - Users build their own images with selected modules

### Problem Statement

- Module compatibility testing is complex
- Version conflicts between modules can occur
- User experience for module installation should be simple
- Self-hosted users expect reliability over flexibility

## Decision

**Ship official Docker images with all verified modules at verified versions. Users activate/deactivate modules at runtime via settings.**

Custom images with user-selected modules are supported but at the user's own risk.

### Rationale

1. **Simplified user experience** - No module installation step, just activation
2. **Guaranteed compatibility** - All bundled modules are tested together
3. **Reliable updates** - Single version to update, no dependency conflicts
4. **Self-hosted friendly** - Works offline, no external registry needed

### Trade-offs

| Aspect             | Verified Bundle | Minimal + Install |
| ------------------ | --------------- | ----------------- |
| Image size         | Larger          | Smaller           |
| User simplicity    | ✅ High         | Low               |
| Compatibility      | ✅ Guaranteed   | User-managed      |
| Flexibility        | Limited         | ✅ High           |
| Update complexity  | ✅ Simple       | Complex           |
| Offline capability | ✅ Full         | Partial           |

## Consequences

### Positive

- Users get a "just works" experience
- No module version conflicts
- Simpler update process (one image to update)
- Better testing coverage (known configuration)
- Offline-friendly for self-hosted deployments

### Negative

- Larger Docker image size
- Less flexibility for advanced users
- All modules must be maintained together

### Neutral

- Custom images are possible but unsupported
- Module activation is a runtime concern, not build-time

## Implementation

### Official Image

```bash
# Pull official image (includes all verified modules)
docker pull ghcr.io/molos-app/molos:latest

# Modules are deactivated by default
# Users activate what they need via settings
```

### Custom Image

```bash
# Edit modules.config.ts to select modules
# Build custom image (at own risk)
docker build -t my-molos:custom .
```

### modules.config.ts

The `modules.config.ts` file defines which modules are included in production builds:

```typescript
export const modulesConfig: ModuleConfigEntry[] = [
	{ id: 'MoLOS-Tasks', git: 'https://github.com/molos-org/MoLOS-Tasks.git', tag: 'v1.0.0' },
	{ id: 'MoLOS-Goals', git: 'https://github.com/molos-org/MoLOS-Goals.git', tag: 'v1.0.0' }
	// ... more verified modules
];
```

## Related

- [Release System](../deployment/release-system.md) - How versions are managed
- [Production Build](../deployment/production-build.md) - Build-time module resolution
- [Docker Deployment](../deployment/docker.md) - Deployment guide
- [Module Activation](../modules/activation.md) - Runtime module management

---

_Last Updated: 2026-02-27_
