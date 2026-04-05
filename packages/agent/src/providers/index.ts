/**
 * Providers Module - AI Provider Abstraction and Fallback System
 *
 * ## Purpose
 * This module provides a comprehensive AI provider abstraction layer that enables
 * seamless failover between different LLM providers (OpenAI, Anthropic, OpenRouter, etc.)
 * with intelligent rate limiting, error classification, and cooldown management.
 *
 * ## Provider Pattern
 * - **Unified Interface**: All providers implement the same `LanguageModelV2/V3` interface
 * - **Multi-Key Support**: Distributes requests across multiple API keys for higher throughput
 * - **Protocol Mapping**: Provider-specific model names → unified protocol identifiers
 * - **Options Passthrough**: Provider-specific options (thinking levels, temperature) supported
 *
 * ## Fallback Strategy (Progressive Degradation)
 * 1. **Primary Provider**: Try the best/requested model first
 * 2. **Fallback Models**: Try alternative models in order of preference
 * 3. **Error Classification**: Categorize errors to determine retry vs abort
 * 4. **Cooldown Tracking**: Avoid hammering failing providers with exponential backoff
 * 5. **Format Errors**: Non-retriable (abort immediately), all others trigger fallback
 *
 * ## Rate Limiting Pattern
 * - **Per-Provider Cooldowns**: Each provider/model gets independent cooldown tracking
 * - **Exponential Backoff**: 1min → 5min → 25min → 1hr cap for standard errors
 * - **Billing Errors**: Longer cooldowns (5hr → 10hr → 20hr → 24hr cap)
 * - **24-Hour Reset**: Error counts reset if no failure within 24 hours
 *
 * ## Multi-Key Auth Profile Rotation
 * - **Per-Provider Profiles**: Multiple API keys per provider with automatic rotation
 * - **Transient Error Tracking**: Rate limits and overloads trigger cooldown + rotation
 * - **Permanent Error Handling**: Auth failures deactivate the key permanently
 * - **Recovery Probing**: Async checks to verify cooled-down profiles have recovered
 *
 * ## AI Context Optimization Tips
 * - Factory enables provider switching without code changes - cache provider instances
 * - Multi-key expansion distributes token load across keys for higher rate limits
 * - Cooldown tracking prevents wasted context on known-failing providers
 * - Error classification provides actionable debugging info (auth vs rate_limit vs format)
 * - AuthProfileManager handles per-key rotation within a provider
 *
 * ## Module Structure
 * - `factory.ts` - Provider creation, model config, multi-key expansion
 * - `fallback.ts` - Fallback chain orchestration with error handling
 * - `cooldown.ts` - Rate limiting with exponential backoff
 * - `error-classifier.ts` - Error categorization for failover decisions
 * - `auth-profiles.ts` - Multi-key rotation with transient error tracking
 *
 * @example
 * // Create a provider with fallback models
 * const chain = createFallbackChain(models, cooldownTracker, errorClassifier);
 * const result = await chain.execute(providerFactory, messages, tools);
 *
 * @example
 * // Check if a provider is in cooldown before calling
 * if (!cooldownTracker.shouldSkip('openai', 'gpt-4o')) {
 *   const response = await callProvider();
 * }
 *
 * @example
 * // Use auth profiles for multi-key rotation
 * const authManager = new AuthProfileManager();
 * authManager.addProfile('openai', { id: 'key-1', apiKey: 'sk-...' });
 * authManager.addProfile('openai', { id: 'key-2', apiKey: 'sk-...' });
 *
 * const profile = authManager.getActiveProfile('openai');
 * if (authManager.isInCooldown('openai', profile.id)) {
 *   authManager.rotate('openai');
 * }
 */

// Re-export factory types and functions
export {
	createProvider,
	mapProvider,
	getProviderOptions,
	expandMultiKeyModels,
	extractProtocol,
	modelConfigFromString,
	validateModelConfig,
	createProviderConfigFromEnv,
	getProviderApiKeys,
	PROTOCOL_DEFAULTS,
	type LlmProvider,
	type ProviderConfig,
	type ModelConfig,
	type ThinkingLevel,
	type ProviderOptions
} from './factory.js';

// Re-export cooldown types and functions
export {
	CooldownTracker,
	getStandardCooldown,
	getBillingCooldown,
	formatCooldownDuration,
	isRetriableReason,
	describeFailoverReason,
	type CooldownEntry,
	type CooldownTrackerConfig,
	type FailoverReason
} from './cooldown.js';

// Re-export error classifier types and functions
export {
	ErrorClassifier,
	createErrorClassifier,
	classifyError,
	FailoverError,
	classify,
	isRetriable,
	type ClassifiedError,
	type ErrorClassifierConfig,
	DEFAULT_PATTERNS
} from './error-classifier.js';

// Re-export fallback chain types and functions
export {
	FallbackChain,
	createFallbackChain,
	FallbackExhaustedError,
	parseModelRef,
	resolveCandidates,
	modelKey,
	type FallbackCandidate,
	type FallbackAttempt,
	type FallbackResult,
	type FallbackChainConfig,
	type ProviderRunResult,
	type ProviderRunFunction
} from './fallback.js';

// Re-export auth profile types and functions
export {
	AuthProfileManager,
	createAuthProfileManager,
	formatProfileCooldown,
	type AuthProfile,
	type AuthProfileConfig,
	type AuthProfileManagerConfig
} from './auth-profiles.js';
