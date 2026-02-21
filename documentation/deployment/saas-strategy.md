# SaaS Strategy

This document outlines the strategic considerations for offering MoLOS as both a self-hosted solution and a SaaS (Software as a Service) platform, including module marketplace concepts, premium modules, cloud sync architecture, and pricing recommendations.

## Executive Summary

MoLOS is designed to support multiple deployment models:

| Model            | Target Audience                       | Revenue Model                          |
| ---------------- | ------------------------------------- | -------------------------------------- |
| **Self-Hosted**  | Technical users, privacy-focused orgs | Support contracts, enterprise licenses |
| **SaaS (Cloud)** | Non-technical users, small teams      | Subscription tiers                     |
| **Enterprise**   | Large organizations                   | Custom pricing, SLAs                   |

## Self-Hosted vs SaaS Offerings

### Feature Comparison

| Feature            | Self-Hosted | SaaS (Free) | SaaS (Pro) | SaaS (Enterprise) |
| ------------------ | ----------- | ----------- | ---------- | ----------------- |
| Core functionality | ✅          | ✅          | ✅         | ✅                |
| All modules        | ✅          | Limited     | ✅         | ✅                |
| Cloud sync         | ❌          | ❌          | ✅         | ✅                |
| Team collaboration | Manual      | 1 user      | 5 users    | Unlimited         |
| Priority support   | Community   | Community   | Email      | Dedicated         |
| Custom modules     | ✅          | ❌          | ❌         | ✅                |
| SLA                | -           | -           | 99.5%      | 99.9%             |
| Data residency     | Customer    | Shared      | Regional   | Custom            |
| SSO/SAML           | Self-config | ❌          | ❌         | ✅                |

### Self-Hosted Advantages

```
┌─────────────────────────────────────────────────────────────────┐
│                  Self-Hosted Benefits                           │
│                                                                  │
│  ✅ Full Data Control        - Data stays on your servers       │
│  ✅ Privacy Compliance       - GDPR, HIPAA, SOC2 compliance     │
│  ✅ Custom Modifications     - Fork and modify as needed        │
│  ✅ No Recurring Costs       - One-time setup, optional support │
│  ✅ Air-Gapped Deployments   - Works offline, secure networks   │
│  ✅ Integration Freedom      - Connect to internal systems      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### SaaS Advantages

```
┌─────────────────────────────────────────────────────────────────┐
│                     SaaS Benefits                               │
│                                                                  │
│  ✅ Zero Maintenance         - No server management required    │
│  ✅ Automatic Updates        - Always on latest version         │
│  ✅ Cloud Sync              - Access from anywhere              │
│  ✅ Team Collaboration       - Easy sharing and permissions     │
│  ✅ Instant Setup           - Start using in minutes            │
│  ✅ Professional Support     - Expert help when needed          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Module Marketplace Concept

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Module Marketplace                             │
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   Module    │     │   Module    │     │   Module    │       │
│  │  Registry   │     │   Store     │     │  Publisher  │       │
│  │             │     │             │     │             │       │
│  │ - Metadata  │     │ - Listings  │     │ - Upload    │       │
│  │ - Versions  │     │ - Reviews   │     │ - Validate  │       │
│  │ - Deps      │     │ - Install   │     │ - Publish   │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│         │                   │                   │               │
│         └───────────────────┴───────────────────┘               │
│                             │                                   │
│                             ▼                                   │
│                    ┌─────────────────┐                          │
│                    │   Marketplace   │                          │
│                    │      API        │                          │
│                    │                 │                          │
│                    │ - Search        │                          │
│                    │ - Install       │                          │
│                    │ - Purchase      │                          │
│                    │ - License       │                          │
│                    └─────────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Module Listing Schema

```typescript
// Marketplace module listing

interface ModuleListing {
	// Basic info
	id: string;
	name: string;
	description: string;
	version: string;
	author: AuthorInfo;

	// Classification
	category: 'productivity' | 'integration' | 'analytics' | 'ai' | 'custom';
	tags: string[];

	// Pricing
	pricing: {
		type: 'free' | 'freemium' | 'paid' | 'enterprise';
		price?: number;
		currency?: string;
		billingPeriod?: 'monthly' | 'yearly' | 'one-time';
	};

	// Availability
	availability: {
		selfHosted: boolean;
		saas: {
			free: boolean;
			pro: boolean;
			enterprise: boolean;
		};
	};

	// Statistics
	stats: {
		downloads: number;
		activeInstalls: number;
		rating: number;
		reviewCount: number;
	};

	// Links
	links: {
		documentation: string;
		repository?: string;
		support: string;
	};
}
```

### Marketplace API

```typescript
// GET /api/marketplace/modules
interface MarketplaceSearchResponse {
	modules: ModuleListing[];
	total: number;
	page: number;
	pageSize: number;
}

// POST /api/marketplace/modules/{id}/install
interface InstallRequest {
	targetInstance: string; // Instance ID
	version?: string; // Optional version
}

interface InstallResponse {
	status: 'installed' | 'pending' | 'error';
	message: string;
	moduleId: string;
}

// GET /api/marketplace/modules/{id}/versions
interface ModuleVersionsResponse {
	versions: {
		version: string;
		releasedAt: string;
		changelog: string;
		minCoreVersion: string;
	}[];
}
```

### Marketplace UI

```svelte
<!-- Module Marketplace Page -->
<script lang="ts">
	import { Card, Button, Badge, Rating, SearchInput } from '@molos/ui';

	let searchQuery = $state('');
	let category = $state('all');
	let modules = $state([]);

	async function searchModules() {
		const response = await fetch(`/api/marketplace/modules?q=${searchQuery}&category=${category}`);
		modules = await response.json().then((r) => r.modules);
	}

	async function installModule(moduleId: string) {
		await fetch(`/api/marketplace/modules/${moduleId}/install`, {
			method: 'POST',
			body: JSON.stringify({ targetInstance: currentInstanceId })
		});
	}
</script>

<div class="marketplace">
	<div class="filters">
		<SearchInput bind:value={searchQuery} onsearch={searchModules} />
		<select bind:value={category} onchange={searchModules}>
			<option value="all">All Categories</option>
			<option value="productivity">Productivity</option>
			<option value="integration">Integrations</option>
			<option value="analytics">Analytics</option>
			<option value="ai">AI & Automation</option>
		</select>
	</div>

	<div class="module-grid">
		{#each modules as module (module.id)}
			<Card class="module-card">
				<div class="module-header">
					<h3>{module.name}</h3>
					<Badge variant={module.pricing.type === 'free' ? 'success' : 'default'}>
						{module.pricing.type === 'free' ? 'Free' : `$${module.pricing.price}/mo`}
					</Badge>
				</div>

				<p class="description">{module.description}</p>

				<div class="stats">
					<Rating value={module.stats.rating} />
					<span>{module.stats.reviewCount} reviews</span>
				</div>

				<div class="actions">
					<Button onclick={() => installModule(module.id)}>Install</Button>
					<Button variant="outline" href={`/marketplace/${module.id}`}>Learn More</Button>
				</div>
			</Card>
		{/each}
	</div>
</div>
```

## Premium Modules

### Module Pricing Tiers

| Tier           | Price Range | Target Audience  | Examples                              |
| -------------- | ----------- | ---------------- | ------------------------------------- |
| **Free**       | $0          | All users        | Core modules, community contributions |
| **Lite**       | $5-15/mo    | Individual users | Basic integrations, simple automation |
| **Pro**        | $20-50/mo   | Small teams      | Advanced integrations, AI features    |
| **Enterprise** | Custom      | Large orgs       | Custom modules, dedicated support     |

### Premium Module Examples

#### 1. Advanced AI Assistant (Pro - $29/mo)

```yaml
id: 'advanced-ai'
name: 'Advanced AI Assistant'
pricing:
  type: 'freemium'
  tiers:
    - name: 'Basic'
      price: 0
      features:
        - '100 AI queries/month'
        - 'Basic context understanding'
    - name: 'Pro'
      price: 29
      features:
        - 'Unlimited AI queries'
        - 'Advanced context (100k tokens)'
        - 'Custom AI training'
        - 'Priority processing'
```

#### 2. Enterprise SSO Module (Enterprise - Custom)

```yaml
id: 'enterprise-sso'
name: 'Enterprise SSO & Security'
pricing:
  type: 'enterprise'
  features:
    - 'SAML 2.0 integration'
    - 'OAuth 2.0 / OIDC'
    - 'Active Directory / LDAP'
    - 'Audit logging'
    - 'Compliance reports'
  availability:
    selfHosted: true
    saas:
      free: false
      pro: false
      enterprise: true
```

#### 3. Advanced Analytics (Pro - $19/mo)

```yaml
id: 'advanced-analytics'
name: 'Advanced Analytics Dashboard'
pricing:
  type: 'paid'
  price: 19
  features:
    - 'Custom dashboards'
    - 'Trend analysis'
    - 'Export to PDF/Excel'
    - 'Scheduled reports'
    - 'Team metrics'
```

### License Verification

```typescript
// packages/core/src/licensing/verifier.ts

interface License {
	id: string;
	customerId: string;
	moduleId: string;
	type: 'free' | 'paid' | 'trial' | 'enterprise';
	expiresAt: number;
	features: string[];
	signature: string;
}

export class LicenseVerifier {
	private publicKey: CryptoKey;

	async verify(license: License): Promise<boolean> {
		// Verify signature
		const data = JSON.stringify({
			id: license.id,
			customerId: license.customerId,
			moduleId: license.moduleId,
			type: license.type,
			expiresAt: license.expiresAt,
			features: license.features
		});

		const signature = base64ToBytes(license.signature);

		const isValid = await crypto.subtle.verify(
			{ name: 'RSASSA-PKCS1-v1_5' },
			this.publicKey,
			signature,
			new TextEncoder().encode(data)
		);

		if (!isValid) return false;

		// Check expiration
		if (license.expiresAt < Date.now()) return false;

		return true;
	}

	async checkFeature(license: License, feature: string): Promise<boolean> {
		if (!(await this.verify(license))) return false;
		return license.features.includes(feature);
	}
}
```

## Cloud Sync Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cloud Sync Architecture                      │
│                                                                  │
│   Client (Browser/App)           Cloud Sync Service             │
│   ┌─────────────────┐            ┌─────────────────┐           │
│   │   Local Storage │            │   Sync Server   │           │
│   │                 │            │                 │           │
│   │ - Offline data  │◄──────────▶│ - Versioning    │           │
│   │ - Changes queue │    Sync    │ - Conflict res. │           │
│   │ - Merge logic   │            │ - Encryption    │           │
│   └─────────────────┘            └─────────────────┘           │
│                                          │                      │
│                                          ▼                      │
│                                 ┌─────────────────┐            │
│                                 │  Cloud Storage  │            │
│                                 │                 │            │
│                                 │ - User data     │            │
│                                 │ - Module data   │            │
│                                 │ - Settings      │            │
│                                 └─────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sync Protocol

```typescript
// packages/core/src/sync/protocol.ts

interface SyncRequest {
	clientId: string;
	lastSyncTimestamp: number;
	changes: ChangeRecord[];
}

interface SyncResponse {
	serverTimestamp: number;
	changes: ChangeRecord[];
	conflicts: ConflictRecord[];
	deletions: string[];
}

interface ChangeRecord {
	id: string;
	table: string;
	operation: 'insert' | 'update' | 'delete';
	data: Record<string, unknown>;
	timestamp: number;
	clientId: string;
}

interface ConflictRecord {
	id: string;
	table: string;
	localVersion: Record<string, unknown>;
	serverVersion: Record<string, unknown>;
	resolution: 'local' | 'server' | 'manual';
}
```

### Conflict Resolution Strategies

```typescript
// packages/core/src/sync/conflict.ts

export enum ConflictStrategy {
	// Server always wins
	SERVER_WINS = 'server_wins',

	// Client always wins
	CLIENT_WINS = 'client_wins',

	// Most recent wins
	LAST_WRITE_WINS = 'last_write_wins',

	// Custom merge function
	CUSTOM = 'custom',

	// Manual resolution required
	MANUAL = 'manual'
}

export class ConflictResolver {
	resolve(conflict: ConflictRecord, strategy: ConflictStrategy): Record<string, unknown> {
		switch (strategy) {
			case ConflictStrategy.SERVER_WINS:
				return conflict.serverVersion;

			case ConflictStrategy.CLIENT_WINS:
				return conflict.localVersion;

			case ConflictStrategy.LAST_WRITE_WINS:
				// Compare timestamps
				const localTime = conflict.localVersion.updatedAt;
				const serverTime = conflict.serverVersion.updatedAt;
				return localTime > serverTime ? conflict.localVersion : conflict.serverVersion;

			case ConflictStrategy.CUSTOM:
				// Use module-specific merge logic
				return this.customMerge(conflict);

			case ConflictStrategy.MANUAL:
				// Mark for manual resolution
				throw new ManualResolutionRequired(conflict);
		}
	}

	private customMerge(conflict: ConflictRecord): Record<string, unknown> {
		// Module can register custom merge handlers
		const handler = this.mergeHandlers.get(conflict.table);
		if (handler) {
			return handler(conflict.localVersion, conflict.serverVersion);
		}
		// Default to server wins
		return conflict.serverVersion;
	}
}
```

### Offline Support

```typescript
// packages/core/src/sync/offline.ts

export class OfflineManager {
	private pendingChanges: ChangeRecord[] = [];
	private isOnline: boolean = true;

	constructor() {
		// Listen for online/offline events
		window.addEventListener('online', () => this.onOnline());
		window.addEventListener('offline', () => this.onOffline());
	}

	async queueChange(change: ChangeRecord): Promise<void> {
		if (this.isOnline) {
			// Try to sync immediately
			try {
				await this.syncChange(change);
			} catch {
				// If sync fails, queue for later
				this.pendingChanges.push(change);
			}
		} else {
			// Queue for when back online
			this.pendingChanges.push(change);
		}
	}

	private async onOnline(): Promise<void> {
		this.isOnline = true;

		// Process pending changes
		while (this.pendingChanges.length > 0) {
			const change = this.pendingChanges.shift()!;
			try {
				await this.syncChange(change);
			} catch (error) {
				// Re-queue failed changes
				this.pendingChanges.unshift(change);
				break;
			}
		}
	}

	private onOffline(): void {
		this.isOnline = false;
	}
}
```

## Team and Enterprise Features

### Team Management

```typescript
// Team structure
interface Team {
	id: string;
	name: string;
	slug: string;
	plan: 'free' | 'pro' | 'enterprise';
	members: TeamMember[];
	settings: TeamSettings;
}

interface TeamMember {
	userId: string;
	role: 'owner' | 'admin' | 'member' | 'viewer';
	joinedAt: number;
}

interface TeamSettings {
	// Module permissions
	modulePermissions: Record<string, ('view' | 'edit' | 'admin')[]>;

	// Feature flags
	features: Record<string, boolean>;

	// Security settings
	security: {
		twoFactorRequired: boolean;
		ipWhitelist: string[];
		sessionTimeout: number;
	};
}
```

### Role-Based Access Control

```typescript
// packages/core/src/auth/rbac.ts

export const ROLES = {
	owner: {
		permissions: ['*'] // All permissions
	},
	admin: {
		permissions: ['team.manage', 'members.manage', 'modules.*', 'settings.*', 'billing.view']
	},
	member: {
		permissions: ['modules.view', 'modules.use', 'settings.view']
	},
	viewer: {
		permissions: ['modules.view']
	}
};

export function hasPermission(role: string, permission: string): boolean {
	const rolePerms = ROLES[role]?.permissions ?? [];

	// Check for wildcard
	if (rolePerms.includes('*')) return true;

	// Check exact match
	if (rolePerms.includes(permission)) return true;

	// Check wildcard prefix (e.g., 'modules.*' matches 'modules.view')
	const prefix = permission.split('.').slice(0, -1).join('.') + '.*';
	if (rolePerms.includes(prefix)) return true;

	return false;
}
```

### Enterprise Features

| Feature               | Description                | Implementation          |
| --------------------- | -------------------------- | ----------------------- |
| **SSO/SAML**          | Single sign-on integration | `enterprise-sso` module |
| **Audit Logs**        | Detailed activity logging  | Built into core         |
| **Data Export**       | GDPR compliance, backups   | `data-export` module    |
| **Custom Branding**   | White-label support        | Theme configuration     |
| **Dedicated Support** | Priority support channel   | SLA in contract         |
| **Custom SLA**        | Uptime guarantees          | Infrastructure config   |
| **On-Premise Option** | Self-hosted with support   | Enterprise license      |

## Pricing Model Recommendations

### Recommended Pricing Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    MoLOS Pricing Tiers                          │
│                                                                  │
│  FREE                PRO                  ENTERPRISE            │
│  $0/user/mo          $19/user/mo          Custom                │
│  ────────────        ────────────        ────────────           │
│  • 1 user            • Up to 50 users    • Unlimited users      │
│  • Core modules      • All modules       • Custom modules       │
│  • Community support • Email support     • Dedicated support    │
│  • 1GB storage       • 100GB storage     • Unlimited storage    │
│  • No SLA            • 99.5% SLA         • 99.9% SLA            │
│                      • Cloud sync        • On-premise option    │
│                                          • SSO/SAML            │
│                                          • Custom contracts     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Pricing Rationale

| Factor                 | Consideration                                                |
| ---------------------- | ------------------------------------------------------------ |
| **Market Research**    | Compare with Notion ($8-15), Linear ($8-14), Asana ($10.99+) |
| **Value-Based**        | Price based on value delivered, not cost                     |
| **Freemium Funnel**    | Free tier drives adoption, Pro tier captures value           |
| **Enterprise Premium** | 3-5x Pro pricing for enterprise features                     |
| **Annual Discount**    | 20% discount for annual billing                              |

### Revenue Projections (Example)

```
Scenario: 1,000 users after 12 months

Free Users (80%):        800 users × $0      = $0
Pro Users (18%):         180 users × $19     = $3,420/mo
Enterprise (2%):          20 users × ~$100   = $2,000/mo

Total MRR:                                    ~$5,420/mo
Annual:                                       ~$65,000/year

Plus:
- Marketplace module commissions (30%):       ~$10,000/year
- Enterprise support contracts:               ~$50,000/year
- Self-hosted enterprise licenses:           ~$30,000/year

Total ARR:                                    ~$155,000/year
```

### Billing Implementation

```typescript
// Stripe integration
interface Subscription {
	id: string;
	customerId: string;
	status: 'active' | 'past_due' | 'canceled' | 'trialing';
	plan: 'free' | 'pro' | 'enterprise';
	quantity: number; // Number of seats
	currentPeriodEnd: number;
}

// apps/web/src/lib/server/billing/stripe.ts

export async function createSubscription(
	customerId: string,
	plan: 'pro' | 'enterprise',
	quantity: number
): Promise<Subscription> {
	const priceId =
		plan === 'pro' ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_ENTERPRISE_PRICE_ID;

	const subscription = await stripe.subscriptions.create({
		customer: customerId,
		items: [{ price: priceId, quantity }],
		payment_behavior: 'default_incomplete',
		expand: ['latest_invoice.payment_intent']
	});

	return {
		id: subscription.id,
		customerId,
		status: subscription.status,
		plan,
		quantity,
		currentPeriodEnd: subscription.current_period_end * 1000
	};
}
```

## Implementation Roadmap

### Phase 1: Foundation (Months 1-2)

- [ ] Implement subscription billing (Stripe)
- [ ] Add team management basics
- [ ] Create free/pro tier separation

### Phase 2: Marketplace (Months 3-4)

- [ ] Build module registry
- [ ] Create marketplace UI
- [ ] Implement license verification

### Phase 3: Cloud Sync (Months 5-6)

- [ ] Implement sync protocol
- [ ] Build offline support
- [ ] Add conflict resolution

### Phase 4: Enterprise (Months 7-9)

- [ ] SSO/SAML module
- [ ] Audit logging
- [ ] Advanced RBAC
- [ ] Custom contracts

### Phase 5: Scale (Months 10-12)

- [ ] Multi-region deployment
- [ ] Performance optimization
- [ ] Advanced analytics
- [ ] Partner program

---

_Last Updated: 2025-02-15_
_Version: 1.0_
