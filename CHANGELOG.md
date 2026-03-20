# Changelog

All notable changes to the MoLOS project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-03-20

### Changed

- **Module Version Updates**:
  - MoLOS-Tasks: v1.0.4 → v1.1.0
  - MoLOS-LLM-Council: v1.0.0 → v1.1.0
  - MoLOS-Markdown: v1.0.0 → v1.1.0

### Technical

- Updated modules.config.ts to reference v1.1.0 for all released modules
- Minor release cycle for module ecosystem improvements

## [1.0.1] - 2026-03-18

### Added

- **Module Version Updates**:
  - MoLOS-LLM-Council updated to v1.0.1
  - MoLOS-Markdown updated to v1.0.1
  - MoLOS-Tasks remains at v1.0.4

### Changed

- **CI/CD Simplification**:
  - Removed automated release pipeline (release.yml)
  - Removed test workflow (test.yml)
  - Simplified publish.yml to only build on version tags
  - Switched to manual release workflow per simplified architecture

- **Module Configuration**:
  - Separated dev and prod module configurations
  - Development uses module branches for latest code
  - Production uses module tags for reproducible builds
  - NODE_ENV controls which configuration is used

- **Database Migration Safety**:
  - Banned `drizzle-kit generate` command to prevent journal/SQL desync
  - Enforced manual migration creation with descriptive names
  - Improved migration system safety and naming conventions

### Fixed

- **Auth Configuration**:
  - Fixed HTTP deployments to use single ORIGIN environment variable
  - Improved authentication consistency across deployment types

### Technical

- Manual release workflow for faster, user-controlled releases
- Production Docker builds default to NODE_ENV=production
- Removed automated changeset-based versioning

## [1.0.0] - 2026-03-13

### Added

- Automated release system with Changesets and PR labels
- Release manager agent for managing versions and releases
- GitHub Actions workflows for automated versioning
- **Docker Improvements**:
  - Proper privilege dropping with `gosu` for secure container startup
  - Volume permission handling in entrypoint script
  - Automatic database backups before migrations

### Changed

- Consolidated migration system with improved error handling
- Switched to tag-based module dependencies for reproducible builds
- Improved container entrypoint with better security model

### Technical

- First stable release
- Production-ready Docker image with security hardening
- All core modules verified and tested

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
