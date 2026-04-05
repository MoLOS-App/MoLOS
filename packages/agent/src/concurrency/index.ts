/**
 * Concurrency Module
 *
 * Provides lane-based concurrency primitives for isolating tool execution
 * and preventing concurrent access to shared resources.
 *
 * @module concurrency
 */

// Re-export all public types and classes
export { type Lane, AsyncLane, LaneManager, globalLaneManager } from './lane.js';
