// Re-export from @molos/database package
// This provides backward compatibility while migrating to the new package structure
export { db, schema } from '@molos/database';

// Re-export all schema items for convenience
export * from '@molos/database/schema';
