# Deployment Guide

This document covers deployment strategies for MoLOS in production, including Docker/Podman deployment, production configuration, module bundling, and update workflows.

## Deployment Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Deployment Architecture                       │
│                                                                  │
│   Development          CI/CD              Production             │
│   ┌─────────┐         ┌─────────┐        ┌─────────────┐        │
│   │  Local  │────────▶│  Build  │───────▶│  Container  │        │
│   │   Dev   │   push  │ Pipeline│  push  │  Registry   │        │
│   └─────────┘         └─────────┘        └─────────────┘        │
│                             │                   │               │
│                             ▼                   ▼               │
│                       ┌─────────┐        ┌─────────────┐        │
│                       │  Test   │        │   Deploy    │        │
│                       │ Suite   │        │  (K8s/VPS)  │        │
│                       └─────────┘        └─────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Build Strategies

### Single Build (Recommended)

Build all modules into a single container:

```dockerfile
# Dockerfile

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json package-lock.json ./
COPY turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/*/package.json ./packages/*/
COPY modules/*/package.json ./modules/*/

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build all packages
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Copy built files
COPY --from=builder /app/apps/web/.svelte-kit ./apps/web/.svelte-kit
COPY --from=builder /app/apps/web/package.json ./apps/web/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "apps/web/.svelte-kit/output/server/index.js"]
```

### Per-Module Builds (Advanced)

For large deployments with many modules:

```dockerfile
# Dockerfile.modules

# Build core first
FROM node:20-alpine AS core-builder
# ... build core packages

# Build each module in parallel stages
FROM core-builder AS module-product-owner
# ... build product-owner module

FROM core-builder AS module-tasks
# ... build tasks module

# Combine in final stage
FROM node:20-alpine AS production
# Copy built modules
COPY --from=module-product-owner /app/modules/product-owner ./modules/product-owner
COPY --from=module-tasks /app/modules/tasks ./modules/tasks
# ...
```

## Docker/Podman Deployment

### Using Docker Compose

```yaml
# docker-compose.yml

version: '3.8'

services:
  app:
    image: ghcr.io/molos-app/molos:latest
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/data/molos.db
      - ORIGIN=https://molos.example.com
      - MOLOS_ENCRYPTION_KEY=${MOLOS_ENCRYPTION_KEY}
    volumes:
      - molos-data:/data
      - molos-uploads:/app/uploads
    healthcheck:
      test: ['CMD', 'wget', '-q', '--spider', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  backup:
    image: ghcr.io/molos-app/molos-backup:latest
    environment:
      - DATABASE_URL=file:/data/molos.db
      - BACKUP_SCHEDULE=0 2 * * * # 2 AM daily
      - BACKUP_RETENTION_DAYS=30
      - S3_BUCKET=${BACKUP_S3_BUCKET}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
    volumes:
      - molos-data:/data:ro
      - molos-backups:/backups

volumes:
  molos-data:
  molos-uploads:
  molos-backups:
```

### Using Podman

```bash
# Build the image
podman build -t molos:latest .

# Run with Podman
podman run -d \
  --name molos \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=file:/data/molos.db \
  -v molos-data:/data \
  molos:latest

# Generate systemd service
podman generate systemd --name molos > /etc/systemd/system/molos.service
systemctl enable molos
systemctl start molos
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: molos
  labels:
    app: molos
spec:
  replicas: 3
  selector:
    matchLabels:
      app: molos
  template:
    metadata:
      labels:
        app: molos
    spec:
      containers:
        - name: molos
          image: ghcr.io/molos-app/molos:v1.0.0
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: production
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: molos-secrets
                  key: database-url
            - name: MOLOS_ENCRYPTION_KEY
              valueFrom:
                secretKeyRef:
                  name: molos-secrets
                  key: encryption-key
          resources:
            requests:
              memory: '512Mi'
              cpu: '250m'
            limits:
              memory: '1Gi'
              cpu: '500m'
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
          volumeMounts:
            - name: data
              mountPath: /data
            - name: uploads
              mountPath: /app/uploads
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: molos-data-pvc
        - name: uploads
          persistentVolumeClaim:
            claimName: molos-uploads-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: molos
spec:
  selector:
    app: molos
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: molos-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - molos.example.com
      secretName: molos-tls
  rules:
    - host: molos.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: molos
                port:
                  number: 80
```

## Production Configuration

### Environment Variables

```bash
# .env.production

# Core settings
NODE_ENV=production
PORT=3000
ORIGIN=https://molos.example.com

# Database
DATABASE_URL=file:/data/molos.db

# Security
MOLOS_ENCRYPTION_KEY=your-32-character-encryption-key
MOLOS_SESSION_SECRET=your-session-secret

# Authentication
AUTH_SECRET=your-auth-secret
AUTH_GITHUB_CLIENT_ID=github-client-id
AUTH_GITHUB_CLIENT_SECRET=github-client-secret

# AI Integration
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key

# Module settings
MOLOS_MODULES_MODE=explicit
MOLOS_ENABLE_ANALYTICS=true

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Feature flags
MOLOS_FEATURE_FLAGS=ai-assistant,real-time-sync
```

### Module Activation in Production

```typescript
// modules.config.production.ts

export const modulesConfig: ModulesConfig = {
	mode: 'explicit',

	modules: {
		// Core modules - always active
		core: { enabled: true, required: true },
		'product-owner': { enabled: true },
		tasks: { enabled: true },

		// Optional modules
		analytics: {
			enabled: process.env.MOLOS_ENABLE_ANALYTICS === 'true',
			config: {
				trackingId: process.env.ANALYTICS_TRACKING_ID
			}
		},

		// Debug tools - disabled in production
		'debug-tools': { enabled: false }
	}
};
```

### Logging Configuration

```typescript
// apps/web/src/lib/server/logging.ts

import pino from 'pino';

export const logger = pino({
	level: process.env.LOG_LEVEL || 'info',
	transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
	formatters: {
		level: (label) => ({ level: label })
	},
	serializers: {
		req: pino.stdSerializers.req,
		res: pino.stdSerializers.res,
		err: pino.stdSerializers.err
	}
});
```

### Health Check Endpoints

```typescript
// apps/web/src/routes/health/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	// Check database connection
	let dbHealthy = false;
	try {
		await locals.db.execute('SELECT 1');
		dbHealthy = true;
	} catch {
		dbHealthy = false;
	}

	const healthy = dbHealthy;

	return json(
		{
			status: healthy ? 'healthy' : 'unhealthy',
			timestamp: new Date().toISOString(),
			checks: {
				database: dbHealthy ? 'ok' : 'error'
			}
		},
		{
			status: healthy ? 200 : 503
		}
	);
};

// apps/web/src/routes/health/ready/+server.ts

export const GET: RequestHandler = async () => {
	// Readiness check - is the app ready to receive traffic?
	return json({ ready: true });
};
```

## Module Bundling Strategies

### Static Bundle (All Modules Included)

```dockerfile
# All modules are built into the container
# Module activation is controlled via database/config

FROM node:20-alpine AS builder
# ... copy and build everything

FROM node:20-alpine
COPY --from=builder /app /app
# All modules are available, enable/disable at runtime
```

**Pros:**

- Simple deployment
- Fast module activation
- No additional downloads

**Cons:**

- Larger image size
- Unused code in container

### Dynamic Loading (Modules on Demand)

```dockerfile
# Base image without modules
FROM node:20-alpine AS base
# ... install core only

# Module layers
FROM base AS with-product-owner
COPY modules/product-owner /app/modules/product-owner

FROM base AS with-tasks
COPY modules/tasks /app/modules/tasks
```

**Pros:**

- Smaller base image
- Mix and match modules
- A/B testing capability

**Cons:**

- More complex deployment
- Module download on first use

### Recommended Approach

For most deployments, use **static bundle with runtime activation**:

1. Build all active modules into the container
2. Control activation via database
3. Keep unused modules for quick enablement

## Version Management

### Semantic Versioning

```
MoLOS v1.2.3
       │ │ │
       │ │ └── Patch: Bug fixes
       │ └──── Minor: New features, module additions
       └────── Major: Breaking changes, architecture changes
```

### Module Version Compatibility

```yaml
# manifest.yaml
id: 'product-owner'
version: '2.1.0'

# Declare core version requirement
requiresCore: '>=1.0.0 <2.0.0'

# Module dependencies
dependencies:
  - id: 'tasks'
    version: '>=1.5.0'
    optional: true
```

### Version Check

```typescript
// apps/web/src/lib/server/modules/version-check.ts

import semver from 'semver';

export function checkModuleCompatibility(
	module: ModuleManifest,
	coreVersion: string
): { compatible: boolean; errors: string[] } {
	const errors: string[] = [];

	// Check core version requirement
	if (module.requiresCore) {
		if (!semver.satisfies(coreVersion, module.requiresCore)) {
			errors.push(`Module requires core ${module.requiresCore}, but ${coreVersion} is installed`);
		}
	}

	// Check module dependencies
	for (const dep of module.dependencies ?? []) {
		const installed = getInstalledModuleVersion(dep.id);
		if (!installed && !dep.optional) {
			errors.push(`Missing required dependency: ${dep.id}`);
		} else if (installed && !semver.satisfies(installed, dep.version)) {
			errors.push(`Dependency ${dep.id} version ${dep.version} required, ${installed} installed`);
		}
	}

	return {
		compatible: errors.length === 0,
		errors
	};
}
```

## Update Workflows

### Rolling Updates (Kubernetes)

```yaml
# k8s/deployment.yaml (excerpt)
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

### Blue-Green Deployment

```bash
# Deploy new version alongside old
kubectl apply -f k8s/deployment-blue.yaml

# Wait for health checks
kubectl wait --for=condition=ready pod -l app=molos,version=blue

# Switch traffic
kubectl patch service molos -p '{"spec":{"selector":{"version":"blue"}}}'

# Remove old version
kubectl delete -f k8s/deployment-green.yaml
```

### Database Migrations

```typescript
// apps/web/src/hooks.server.ts

import { runMigrations } from '@molos/database/migrations';

export async function handle({ event, resolve }) {
	// Run migrations on startup (once)
	if (!migrationsRun) {
		await runMigrations();
		migrationsRun = true;
	}

	return resolve(event);
}
```

### Migration Strategy

```typescript
// packages/database/src/migrations/runner.ts

export async function runMigrations(): Promise<void> {
	const pending = await getPendingMigrations();

	for (const migration of pending) {
		console.log(`Running migration: ${migration.name}`);

		try {
			await db.transaction(async (tx) => {
				await migration.up(tx);
				await markMigrationComplete(migration.name);
			});

			console.log(`Migration complete: ${migration.name}`);
		} catch (error) {
			console.error(`Migration failed: ${migration.name}`, error);
			throw error;
		}
	}
}
```

## Monitoring and Observability

### Metrics Collection

```typescript
// apps/web/src/lib/server/metrics.ts

import prometheus from 'prom-client';

export const metrics = {
	httpRequestDuration: new prometheus.Histogram({
		name: 'molos_http_request_duration_seconds',
		help: 'HTTP request duration',
		labelNames: ['method', 'route', 'status']
	}),

	moduleActivationCount: new prometheus.Gauge({
		name: 'molos_module_activation_count',
		help: 'Number of active modules',
		labelNames: ['module_id']
	}),

	dbQueryDuration: new prometheus.Histogram({
		name: 'molos_db_query_duration_seconds',
		help: 'Database query duration',
		labelNames: ['query_type']
	})
};

// Metrics endpoint
// apps/web/src/routes/metrics/+server.ts
export const GET: RequestHandler = async () => {
	const metrics = await prometheus.register.metrics();
	return new Response(metrics, {
		headers: { 'Content-Type': prometheus.register.contentType }
	});
};
```

### Logging

```typescript
// Structured logging for production
logger.info({
	event: 'http_request',
	method: event.request.method,
	path: event.url.pathname,
	status: response.status,
	duration: Date.now() - startTime,
	userId: event.locals.user?.id
});
```

### Alerting

```yaml
# prometheus/alerts.yml

groups:
  - name: molos
    rules:
      - alert: MoLOSHealthCheckFailing
        expr: up{job="molos"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'MoLOS health check failing'

      - alert: MoLOSHighErrorRate
        expr: rate(molos_http_request_duration_seconds_count{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High error rate detected'

      - alert: MoLOSModuleError
        expr: molos_module_status{status="error"} > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: 'Module in error state'
```

## Backup and Recovery

### Automated Backups

```bash
#!/bin/bash
# scripts/backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/$DATE"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
sqlite3 /data/molos.db ".backup '$BACKUP_DIR/molos.db'"

# Backup uploads
cp -r /app/uploads "$BACKUP_DIR/uploads"

# Compress
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

# Upload to S3
aws s3 cp "$BACKUP_DIR.tar.gz" "s3://$S3_BUCKET/backups/"

# Clean old backups
find /backups -name "*.tar.gz" -mtime +30 -delete
```

### Recovery Procedure

```bash
#!/bin/bash
# scripts/restore.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore.sh <backup-file>"
  exit 1
fi

# Stop the application
systemctl stop molos

# Extract backup
tar -xzf "$BACKUP_FILE" -C /tmp

# Restore database
cp /tmp/molos.db /data/molos.db

# Restore uploads
cp -r /tmp/uploads /app/uploads

# Start the application
systemctl start molos

echo "Restore complete"
```

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check logs
docker logs molos

# Common causes:
# - Missing environment variables
# - Database file not accessible
# - Permission issues on volumes
```

#### Module Not Loading

```bash
# Check module status in database
sqlite3 /data/molos.db "SELECT * FROM settings_external_modules"

# Check for errors
sqlite3 /data/molos.db "SELECT id, last_error FROM settings_external_modules WHERE status='error'"
```

#### Database Locked

```bash
# SQLite locks can occur with concurrent access
# Solutions:
# 1. Use WAL mode
sqlite3 /data/molos.db "PRAGMA journal_mode=WAL"

# 2. Increase timeout
sqlite3 /data/molos.db "PRAGMA busy_timeout=5000"
```

---

_Last Updated: 2025-02-15_
_Version: 1.0_
