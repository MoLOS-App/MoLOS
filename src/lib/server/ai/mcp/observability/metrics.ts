/**
 * MCP Metrics Collection
 *
 * Collects and aggregates metrics for MCP operations.
 */

/**
 * Metric type
 */
type MetricType = 'counter' | 'gauge' | 'histogram';

/**
 * Metric value
 */
interface MetricValue {
	count: number;
	sum: number;
	min: number;
	max: number;
	values: number[];
	maxValues: number;
}

/**
 * Metric with tags
 */
interface TaggedMetric {
	type: MetricType;
	value: MetricValue;
	tags: Record<string, string>;
	updatedAt: number;
}

/**
 * Metrics summary
 */
export interface MetricsSummary {
	requests: {
		total: number;
		errors: number;
		avgDurationMs: number;
	};
	tools: {
		totalCalls: number;
		mostCalled: string[];
		avgDurationMs: number;
		errorRate: number;
	};
	resources: {
		totalReads: number;
		avgDurationMs: number;
		errorRate: number;
	};
	prompts: {
		totalGets: number;
		avgDurationMs: number;
		errorRate: number;
	};
	cache: {
		hitRate: number;
		hits: number;
		misses: number;
	};
	rateLimit: {
		hitRate: number;
		total: number;
	};
}

/**
 * Metrics collector class
 */
class MCPMetrics {
	private metrics = new Map<string, TaggedMetric>();
	private counter = 0;

	/**
	 * Increment a counter metric
	 */
	incrementCounter(
		name: string,
		value = 1,
		tags?: Record<string, string>
	): void {
		const key = this.makeKey(name, tags);
		const metric = this.getOrCreateMetric(key, 'counter', tags);

		metric.value.count += value;
		metric.value.sum += value;
		metric.value.max = Math.max(metric.value.max, value);
		metric.value.min = Math.min(metric.value.min, value);
		metric.updatedAt = Date.now();
	}

	/**
	 * Record a timing value (histogram)
	 */
	recordTiming(
		name: string,
		durationMs: number,
		tags?: Record<string, string>
	): void {
		const key = this.makeKey(name, tags);
		const metric = this.getOrCreateMetric(key, 'histogram', tags);

		metric.value.count++;
		metric.value.sum += durationMs;
		metric.value.min = Math.min(metric.value.min, durationMs);
		metric.value.max = Math.max(metric.value.max, durationMs);

		// Keep last 100 values for percentile calculations
		metric.value.values.push(durationMs);
		if (metric.value.values.length > metric.value.maxValues) {
			metric.value.values.shift();
		}

		metric.updatedAt = Date.now();
	}

	/**
	 * Set a gauge value
	 */
	recordGauge(
		name: string,
		value: number,
		tags?: Record<string, string>
	): void {
		const key = this.makeKey(name, tags);
		const metric = this.getOrCreateMetric(key, 'gauge', tags);

		metric.value.count++;
		metric.value.sum += value;
		metric.value.max = Math.max(metric.value.max, value);
		metric.value.min = Math.min(metric.value.min, value);
		metric.updatedAt = Date.now();
	}

	/**
	 * Get a metric value
	 */
	getMetric(name: string, tags?: Record<string, string>): TaggedMetric | undefined {
		const key = this.makeKey(name, tags);
		return this.metrics.get(key);
	}

	/**
	 * Get metrics summary
	 */
	getSummary(): MetricsSummary {
		const now = Date.now();

		// Request metrics
		const requestMetrics = this.metrics.get('mcp.requests.total');
		const errorMetrics = this.metrics.get('mcp.requests.errors');
		const durationMetrics = this.metrics.get('mcp.requests.duration');

		// Tool metrics
		const toolCalls = this.metrics.get('mcp.tools.calls');
		const toolErrors = this.metrics.get('mcp.tools.errors');
		const toolDuration = this.metrics.get('mcp.tools.duration');

		// Resource metrics
		const resourceReads = this.metrics.get('mcp.resources.reads');
		const resourceErrors = this.metrics.get('mcp.resources.errors');
		const resourceDuration = this.metrics.get('mcp.resources.duration');

		// Prompt metrics
		const promptGets = this.metrics.get('mcp.prompts.gets');
		const promptErrors = this.metrics.get('mcp.prompts.errors');
		const promptDuration = this.metrics.get('mcp.prompts.duration');

		// Cache metrics
		const cacheHits = this.metrics.get('mcp.cache.hits');
		const cacheMisses = this.metrics.get('mcp.cache.misses');

		// Rate limit metrics
		const rateLimitHits = this.metrics.get('mcp.ratelimit.hits');

		const cacheHitValue = cacheHits?.value.count ?? 0;
		const cacheMissValue = cacheMisses?.value.count ?? 0;
		const totalCacheOps = cacheHitValue + cacheMissValue;

		return {
			requests: {
				total: requestMetrics?.value.count ?? 0,
				errors: errorMetrics?.value.count ?? 0,
				avgDurationMs: durationMetrics
					? durationMetrics.value.sum / durationMetrics.value.count
					: 0
			},
			tools: {
				totalCalls: toolCalls?.value.count ?? 0,
				mostCalled: this.getTopTools(),
				avgDurationMs: toolDuration
					? toolDuration.value.sum / toolDuration.value.count
					: 0,
				errorRate:
					toolCalls && toolErrors
						? toolErrors.value.count / toolCalls.value.count
						: 0
			},
			resources: {
				totalReads: resourceReads?.value.count ?? 0,
				avgDurationMs: resourceDuration
					? resourceDuration.value.sum / resourceDuration.value.count
					: 0,
				errorRate:
					resourceReads && resourceErrors
						? resourceErrors.value.count / resourceReads.value.count
						: 0
			},
			prompts: {
				totalGets: promptGets?.value.count ?? 0,
				avgDurationMs: promptDuration
					? promptDuration.value.sum / promptDuration.value.count
					: 0,
				errorRate:
					promptGets && promptErrors
						? promptErrors.value.count / promptGets.value.count
						: 0
			},
			cache: {
				hitRate: totalCacheOps > 0 ? cacheHitValue / totalCacheOps : 0,
				hits: cacheHitValue,
				misses: cacheMissValue
			},
			rateLimit: {
				hitRate:
					requestMetrics && rateLimitHits
						? rateLimitHits.value.count / requestMetrics.value.count
						: 0,
				total: rateLimitHits?.value.count ?? 0
			}
		};
	}

	/**
	 * Get top tools by call count
	 */
	private getTopTools(limit = 5): string[] {
		const toolMetrics: Array<{ name: string; count: number }> = [];

		for (const [key, metric] of this.metrics) {
			if (key.startsWith('mcp.tools.call.') && metric.type === 'counter') {
				const toolName = key.replace('mcp.tools.call.', '');
				toolMetrics.push({ name: toolName, count: metric.value.count });
			}
		}

		return toolMetrics
			.sort((a, b) => b.count - a.count)
			.slice(0, limit)
			.map((m) => m.name);
	}

	/**
	 * Reset all metrics
	 */
	reset(): void {
		this.metrics.clear();
	}

	/**
	 * Clean up old metrics (older than 1 hour)
	 */
	cleanup(): void {
		const now = Date.now();
		const maxAge = 60 * 60 * 1000; // 1 hour

		for (const [key, metric] of this.metrics) {
			if (now - metric.updatedAt > maxAge) {
				this.metrics.delete(key);
			}
		}
	}

	/**
	 * Make a metric key from name and tags
	 */
	private makeKey(name: string, tags?: Record<string, string>): string {
		if (!tags) {
			return name;
		}

		const tagString = Object.entries(tags)
			.map(([k, v]) => `${k}=${v}`)
			.sort()
			.join(',');

		return `${name}?${tagString}`;
	}

	/**
	 * Get or create a metric
	 */
	private getOrCreateMetric(
		key: string,
		type: MetricType,
		tags?: Record<string, string>
	): TaggedMetric {
		let metric = this.metrics.get(key);

		if (!metric) {
			metric = {
				type,
				value: {
					count: 0,
					sum: 0,
					min: type === 'gauge' ? 0 : Infinity,
					max: 0,
					values: [],
					maxValues: 100
				},
				tags: tags ?? {},
				updatedAt: Date.now()
			};
			this.metrics.set(key, metric);
		}

		return metric;
	}
}

/**
 * Singleton metrics instance
 */
export const mcpMetrics = new MCPMetrics();

// Cleanup old metrics every hour
setInterval(() => {
	mcpMetrics.cleanup();
}, 60 * 60 * 1000);
