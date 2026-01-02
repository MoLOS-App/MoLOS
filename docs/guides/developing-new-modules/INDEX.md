# Developing New Modules in MoLOS - Complete Guide

This guide provides comprehensive instructions for developing new modules in the MoLOS SvelteKit application. It is based on the **Tasks module**, a mature implementation that demonstrates best practices and standardized patterns.

## Overview

MoLOS uses a modular architecture where each feature area (health tracking, task management, etc.) is organized as a separate module. This approach ensures:

- **Separation of Concerns**: Each module handles its own domain logic
- **Maintainability**: Clear boundaries between features
- **Scalability**: Easy to add new features without affecting existing ones
- **Consistency**: Standardized patterns across all modules (based on Tasks module)

## Module Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── modules/{module-name}/     # Module-specific components
│   │   └── ui/                        # Shared UI components
│   ├── models/{module-name}/          # TypeScript interfaces/types
│   ├── repositories/{module-name}/    # Data access layer
│   ├── services/{module-name}/        # Business logic (optional)
│   ├── server/
│   │   └── db/schema/{module-name}/   # Database schema (separate directory)
│   │       └── tables.ts              # All table definitions
│   └── config/modules/{module-name}/  # Module configuration
│       └── config.ts                  # Module configuration file
├── routes/
│   ├── api/{module-name}/             # API endpoints
│   │   ├── +server.ts                 # Main CRUD endpoints
│   │   ├── sub-entity/                # Sub-entity endpoints
│   │   └── +server.ts
│   └── ui/(modules)/{module-name}/    # UI routes
│       ├── +layout.server.ts          # Layout data loading
│       ├── +layout.svelte             # Layout wrapper
│       ├── dashboard/                 # Dashboard page
│       ├── another-page/              # Other pages
│       └── +page.svelte               # Index page (redirects to dashboard)
```

## Development Steps (Click to View Detailed Guide)

Follow these steps in order to create a new module:

### 1. **[Database Schema Setup](docs/guides/developing-new-modules/01-database-schema.md)**

- Location and naming conventions
- Table definitions
- Key rules for schema design
- Schema exports

### 2. **[TypeScript Models](docs/guides/developing-new-modules/02-typescript-models.md)**

- Interface definitions
- Type aliases
- Model patterns

### 3. **[Repository Layer](docs/guides/developing-new-modules/03-repository-layer.md)**

- Base repository
- Entity-specific repositories
- CRUD operations
- Complex queries
- Repository patterns

### 4. **[API Endpoints](docs/guides/developing-new-modules/04-api-endpoints.md)**

- Main endpoint CRUD operations
- Sub-entity endpoints
- Authentication and validation
- Error handling
- API patterns

### 5. **[UI Routes and Layout](docs/guides/developing-new-modules/05-ui-routes.md)**

- Layout server loading
- Layout structure
- Dashboard pages
- Index redirects
- Other module pages
- Route patterns

### 6. **[UI Components](docs/guides/developing-new-modules/06-ui-components.md)**

- Basic entity components
- Dialog/modal forms
- Component patterns
- Event handlers
- Accessibility

### 7. **[Module Configuration](docs/guides/developing-new-modules/07-module-configuration.md)**

- Configuration structure
- Navigation definition
- Registration in module registry
- Configuration patterns

### 8. **[Client-Side Data Management](docs/guides/developing-new-modules/08-client-side-data.md)**

- Svelte stores
- Derived stores
- Data fetching functions
- Store patterns

### 9. **[Testing](docs/guides/developing-new-modules/09-testing.md)**

- Repository tests
- API tests
- Component tests
- Testing patterns
- Coverage goals

### 10. **[Best Practices & Common Patterns](docs/guides/developing-new-modules/10-best-practices.md)**

- Code quality guidelines
- Performance optimization
- User experience patterns
- Database best practices
- Common patterns (timestamps, JSON fields, user isolation, sub-entities)
- Module checklist

### 11. **[Deployment & Troubleshooting](docs/guides/developing-new-modules/11-deployment-troubleshooting.md)**

- Deployment checklist
- Common issues
- Debugging tips
- Resources

## Quick Reference

### 10-Step Module Checklist

- [ ] Database schema created with proper naming
- [ ] TypeScript models/interfaces defined
- [ ] Repositories with CRUD operations
- [ ] API endpoints with auth checks
- [ ] UI routes and layout
- [ ] UI components
- [ ] Module configuration
- [ ] Client-side data management
- [ ] Tests written (>80% coverage)
- [ ] Documentation complete

## Tasks Module - Reference Implementation

The **Tasks module** is the canonical reference implementation. Use it as a template:

- **Database**: `src/lib/server/db/schema/tasks/tables.ts`
- **Models**: `src/lib/models/tasks/index.ts`
- **Repositories**: `src/lib/repositories/tasks/`
- **API**: `src/routes/ui/MoLOS-Tasks/`
- **UI**: `src/routes/ui/(modules)/tasks/`
- **Components**: `src/lib/components/modules/tasks/`
- **Config**: `src/lib/config/modules/tasks/config.ts`

## Guide Philosophy

This guide emphasizes:

- **Consistency**: All modules follow the same patterns
- **Developer Experience**: Clear, well-organized structure
- **AI-Friendly**: Modular guide that works well with AI agents and code generation
- **Practical**: Real examples from the Tasks module
- **Comprehensive**: Covers all aspects of module development

## File Organization

Each section is in its own file for easy reference and AI processing:

```
docs/guides/developing-new-modules/
├── INDEX.md (this file)
├── 01-database-schema.md
├── 02-typescript-models.md
├── 03-repository-layer.md
├── 04-api-endpoints.md
├── 05-ui-routes.md
├── 06-ui-components.md
├── 07-module-configuration.md
├── 08-client-side-data.md
├── 09-testing.md
├── 10-best-practices.md
└── 11-deployment-troubleshooting.md
```

## Getting Started

1. **Start with the overview**: Read this INDEX file
2. **Pick a guide section**: Based on what you're working on
3. **Follow the patterns**: Each section has working examples
4. **Reference the Tasks module**: Use it as implementation guide
5. **Use the checklist**: Track your progress

## For AI Agents

When generating module code:

1. Read the relevant section(s) of this guide
2. Reference the Tasks module structure
3. Follow the patterns exactly
4. Include proper error handling and user isolation
5. Add TypeScript types for all data
6. Implement comprehensive tests
