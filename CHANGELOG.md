# Changelog

All notable changes to the MoLOS project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Automated release system with Changesets and PR labels
- Release manager agent for managing versions and releases
- GitHub Actions workflows for automated versioning

## [0.3.0] - 2026-03-09

### Added

- **Module Activation in Welcome Flow**: New users can now select which modules to activate during initial setup
  - New Step 3: "Customize your workspace" with module selection interface
  - Default modules pre-selected: dashboard, ai, MoLOS-Tasks, MoLOS-Markdown
  - Mandatory modules (dashboard, ai) displayed as "Always Active"
  - Smooth transitions and comprehensive error handling

- **New API Endpoint**: `POST /api/settings/external-modules/activate-bulk`
  - Bulk activate multiple modules during welcome flow
  - Validates minimum required modules (dashboard, ai, MoLOS-Tasks, MoLOS-Markdown)
  - Robust error handling and authentication

- **UI Components**:
  - `ModuleCard` component: Individual module card with toggle control
  - `ModuleGrid` component: Responsive grid layout for module selection
  - Follows MoLOS design patterns with full accessibility support

- **Server Action**: `activateModules` in welcome flow
  - Handles module activation form submission
  - Validates user authentication and module selection
  - Activates modules in database with proper error handling

- **Comprehensive Test Suite**: 136 test cases covering all aspects
  - API endpoint tests
  - Server action tests
  - UI component tests
  - Integration tests
  - Edge cases and error scenarios

### Changed

- Enhanced onboarding experience with personalized module selection
- Improved user control over initial workspace configuration

### Technical

- Uses Svelte 5 runes ($state, $props, $derived)
- Follows existing MoLOS design patterns
- No database schema changes required
- Comprehensive error handling and logging

## [0.1.0] - 2025-01-01

### Added

- Initial release of MoLOS
- Modular architecture with plugin system
- Core modules: Tasks, Goals, Finance, Health, Meals
- AI integration capabilities
- SQLite database with Drizzle ORM
- SvelteKit frontend with Tailwind CSS
- Docker deployment support
- Better-auth authentication

### Changed

- Migrated from plugin-based to module-based architecture
- Improved database schema organization

### Security

- Implemented secure session management
- Added environment-based configuration
