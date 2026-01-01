# Developing and Testing MoLOS Modules

This guide provides instructions for developing and testing MoLOS modules, including external modules.

## Testing Modules

### Running Tests for a Specific Module

To run tests for a specific module, use the following command:

```bash
npm run test:unit -- --run "ModuleName" --reporter=default
```

Replace `ModuleName` with the name of the module you want to test. For example, to test the MoLOS-Tasks module:

```bash
npm run test:unit -- --run "MoLOS-Tasks" --reporter=default
```

### Test Configuration

The test configuration is set up in `vite.config.ts` with the following key points:

- **Node Modules Exclusion**: The test configuration excludes `**/node_modules/**` to prevent running tests from dependency packages.
- **Symlink Handling**: Tests are configured to not preserve symlinks (`preserveSymlinks: false`) for proper path resolution in external modules.

### External Module Testing

When testing external modules that are symlinked into the main application:

1. **Dependencies**: Ensure the external module's `package.json` includes all necessary dependencies, such as `better-sqlite3` for database operations.
2. **Import Paths**: Adjust import paths in test files to correctly reference the main application's modules from the symlinked location.
3. **Database Handling**: External module repositories should accept database instances as constructor parameters for testability.

### Test Structure

Module tests typically include:

- **Repository Tests**: Test data access layer functionality
- **Component Tests**: Test UI components (client-side)
- **Store Tests**: Test Svelte stores
- **API Tests**: Test API endpoints

### Best Practices

- Always exclude `node_modules` from test discovery
- Use in-memory databases for repository tests
- Mock external dependencies appropriately
- Ensure test isolation between modules

## Development Workflow

1. Develop your module code
2. Write comprehensive tests
3. Run tests with the module-specific command
4. Fix any failing tests
5. Ensure all tests pass before integration

## Troubleshooting

### Common Issues

- **Import Errors**: Check that import paths are correct for symlinked modules
- **Missing Dependencies**: Add required dependencies to the module's `package.json`
- **Database Issues**: Ensure database instances are properly passed to repositories in tests

### Debugging Tests

Use verbose output to see detailed test results:

```bash
npm run test:unit -- --run "ModuleName" --reporter=verbose
```

Count passing tests:

```bash
npm run test:unit -- --run "ModuleName" --reporter=verbose | grep -c "✓"