# Production Build Quick Reference

Quick reference for building and deploying MoLOS with the new build-time module resolution system.

## Quick Commands

### Local Development

```bash
# Start development server
bun run dev

# Prepare modules for build
bun run build:prepare

# Production build
bun run build:prod

# Run production build locally
NODE_ENV=production PORT=4173 node build/index.js
```

### Docker Build

```bash
# Build production image
docker build -t molos:latest .

# Build with no cache
docker build --no-cache -t molos:latest .

# Run container
docker run -d \
  -p 4173:4173 \
  -v $(pwd)/data:/data \
  -e DATABASE_URL=file:/data/molos.db \
  -e BETTER_AUTH_SECRET=your-secret \
  molos:latest
```

### Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f molos

# Stop all services
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```

### Kubernetes

```bash
# Deploy to Kubernetes
kubectl apply -f kubernetes/

# View deployment status
kubectl get pods -n molos

# View logs
kubectl logs -f deployment/molos-deployment -n molos

# Delete deployment
kubectl delete -f kubernetes/
```

## Module Configuration

### Add a Module

Edit `modules.config.ts`:

```typescript
export const modulesConfig: ModuleConfigEntry[] = [
	// ... existing modules
	{
		id: 'MoLOS-MyModule',
		git: 'https://github.com/user/MoLOS-MyModule.git',
		tag: 'v1.0.0', // Use tag for production
		required: false
	}
];
```

**Note:** Either `tag` or `branch` must be specified, but not both.

### Use Branch Instead of Tag

For development or testing:

```typescript
{
	id: 'MoLOS-MyModule',
	git: 'https://github.com/user/MoLOS-MyModule.git',
	branch: 'develop',        // Use branch for development
	required: false
}
```

Rebuild: `docker build -t molos:latest .`

### Remove a Module

Edit `modules.config.ts` and remove the module entry.

Rebuild: `docker build -t molos:latest .`

### Update Module Version

Edit `modules.config.ts` and change the `tag` or `branch`:

```typescript
// Using a tag (recommended for production)
{ id: 'MoLOS-Tasks', git: '...', tag: 'v2.0.0' }

// Or using a branch (for development/testing)
{ id: 'MoLOS-Tasks', git: '...', branch: 'main' }
```

Rebuild: `docker build -t molos:latest .`

### Fetch Specific Module

```bash
# Fetch single module for testing
bun run fetch:modules --single MoLOS-Tasks
```

### Fetch Behavior: Tag vs Branch

| Ref Type            | If Exists | Behavior                                |
| ------------------- | --------- | --------------------------------------- |
| `tag: 'v1.0.0'`     | Re-clones | Ensures exact version, no local changes |
| `branch: 'develop'` | Skips     | Preserves local changes for development |

**Recommendations:**

- Use `tag` for production builds (deterministic, reproducible)
- Use `branch` for development (allows local modifications)

**Note:** To force re-fetch a branch-based module, delete it first:

```bash
rm -rf modules/MoLOS-MyModule
bun run fetch:modules --single MoLOS-MyModule
```

**Note:** Branch-based modules are skipped if they already exist (preserves local changes). Tag-based modules are always re-cloned.

## Environment Variables

### Required

| Variable             | Description           | Example               |
| -------------------- | --------------------- | --------------------- |
| `DATABASE_URL`       | SQLite database path  | `file:/data/molos.db` |
| `BETTER_AUTH_SECRET` | Authentication secret | `your-secret-here`    |

### Optional

| Variable               | Description                       | Default                                       |
| ---------------------- | --------------------------------- | --------------------------------------------- |
| `NODE_ENV`             | Environment                       | `production`                                  |
| `PORT`                 | Port to run on                    | `4173`                                        |
| `BETTER_AUTH_URL`      | Base URL for auth                 | `http://127.0.0.1:4173`                       |
| `ORIGIN`               | Application origin                | `http://127.0.0.1:4173`                       |
| `CSRF_TRUSTED_ORIGINS` | Trusted origins (comma-separated) | `http://127.0.0.1:4173,http://localhost:4173` |

## Troubleshooting

### Build Issues

**Problem**: Module clone fails

```bash
Error: Failed to clone MoLOS-Tasks: fatal: repository not found
```

**Solution**: Check git URL in `modules.config.ts`, verify repository exists and is accessible

**Problem**: Build fails with missing module

```bash
Error: Module MoLOS-Tasks not found in modules.config.ts
```

**Solution**: Verify module ID in config matches folder name

**Problem**: Docker uses cached modules
**Solution**: `docker build --no-cache -t molos:latest .`

### Runtime Issues

**Problem**: Database migrations fail

```bash
Error: Database migrations failed
```

**Solution**:

- Check `/data` directory exists and is writable
- Verify database file permissions: `ls -l /data/molos.db`

**Problem**: Module routes return 404
```bash`
Error: 404 Not Found on /ui/MoLOS-Tasks/dashboard

````
**Solution**:
- Verify `src/routes/ui/(modules)/(external_modules)/{id}/` symlink exists
- Check module has `src/routes/ui/` directory
- Run `npm run build:prepare` and rebuild

**Problem**: Module not in sidebar
```bash
Error: Module not appearing in app
````

**Solution**:

- Verify `src/config.ts` has correct fields: `id`, `name`, `href`, `icon`, `description`
- Check module is in `modules.config.ts`
- Rebuild image

### Docker Issues

**Problem**: Container exits immediately

```bash
Error: Container exited with code 1
```

**Solution**:

- Check logs: `docker logs <container_id>`
- Verify `BETTER_AUTH_SECRET` is set
- Ensure database directory is mounted

**Problem**: Cannot access on localhost
```bash`
Error: Connection refused

````
**Solution**:
- Verify port mapping: `docker ps` shows `0.0.0.0:4173->4173/tcp`
- Check container is running: `docker ps`
- Wait for startup probe: `docker logs <container_id>`

## File Locations

### Configuration

| File | Purpose |
|-------|---------|
| `modules.config.ts` | Module configuration for production builds |
| `package.json` | Dependencies and scripts |
| `Dockerfile` | Docker image build definition |
| `docker-compose.yml` | Docker Compose configuration |
| `kubernetes/` | Kubernetes manifests |

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/fetch-modules.ts` | Clone modules from git |
| `scripts/build-modules.ts` | Prepare modules for build |
| `scripts/entrypoint.sh` | Container entrypoint |
| `scripts/sync-modules.ts` | Link module routes |
| `scripts/link-modules.ts` | Create module symlinks |

### Documentation

| File | Purpose |
|-------|---------|
| `documentation/production-build.md` | Comprehensive production build guide |
| `documentation/production-build-summary.md` | Implementation details |
| `documentation/module-improvements.md` | Module system internals |

## Common Workflows

### Test a New Module

```bash
# 1. Add module to config
# Edit modules.config.ts

# 2. Fetch single module
bun run fetch:modules --single MoLOS-MyModule

# 3. Prepare and build locally
bun run build:prepare && npm run build

# 4. Test locally
NODE_ENV=production PORT=4173 node build/index.js

# 5. If good, build Docker image
docker build -t molos:test .
````

### Update All Modules to Latest

```bash
# 1. Update tags in modules.config.ts
# Edit each module's tag field

# 2. Rebuild image
docker build -t molos:latest .

# 3. Test
docker run -p 4173:4173 molos:latest

# 4. Deploy
docker push molos:latest
```

### Debug Build Issues

```bash
# 1. Check module structure
ls -la modules/MoLOS-Tasks/src/

# 2. Validate config
cat modules/MoLOS-Tasks/src/config.ts

# 3. Check symlinks
ls -la src/routes/ui/(modules)/(external_modules)/

# 4. Test build prepare
bun run build:prepare

# 5. Check TypeScript
npm run check

# 6. Build with verbose output
npm run build -- --verbose
```

## Health Checks

### Check Application Health

```bash
# From container host
curl http://localhost:4173/api/health

# From inside container
docker exec <container_id> curl http://localhost:4173/api/health

# In Kubernetes
kubectl exec -n molos <pod_id> -- curl http://localhost:4173/api/health
```

### Check Container Status

```bash
# Docker
docker ps
docker logs <container_id>
docker inspect <container_id>

# Docker Compose
docker-compose ps
docker-compose logs molos

# Kubernetes
kubectl get pods -n molos
kubectl logs -f deployment/molos-deployment -n molos
kubectl describe pod <pod_id> -n molos
```

## Performance Tips

### Build Optimization

```bash
# Use BuildKit for faster builds
DOCKER_BUILDKIT=1 docker build -t molos:latest .

# Cache node modules
# (Automatic in Dockerfile)

# Parallel module fetching
# (Handled by fetch-modules.ts)
```

### Runtime Optimization

```bash
# Allocate resources in docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 4G
    reservations:
      cpus: '0.5'
      memory: 512M

# Set resource limits in Kubernetes
resources:
  limits:
    cpu: "2"
    memory: "4Gi"
  requests:
    cpu: "500m"
    memory: "512Mi"
```

## Security Checklist

- [ ] Run as non-root user (implemented in Dockerfile)
- [ ] Use read-only root filesystem (except `/data`)
- [ ] Set resource limits
- [ ] Use secrets for sensitive data
- [ ] Remove build tools from production image
- [ ] Scan image for vulnerabilities: `docker scan molos:latest`
- [ ] Keep base image updated
- [ ] Use specific tags instead of `latest` in production

## Support

- **Documentation**: `documentation/production-build.md`
- **Issues**: GitHub Issues
- **Architecture**: `documentation/architecture/`
- **Module System**: `documentation/module-improvements.md`
