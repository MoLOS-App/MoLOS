# 🛠️ Rules to Code: Architectural Guidelines

To maintain structure and consistency in the molos/ SvelteKit application, contributors must follow these obligations:

## 1. Database Schema Guidelines

| Rule                | Location & Naming Convention                                                                                                               | Example                                                                               |
| :------------------ | :----------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| **Schema Location** | Every module's schema definition must reside in their own folder under `src/lib/server/db/schema`.                                         | `src/lib/server/db/schema/tasks/`                                                     |
| **File Naming**     | Each module must have its own schema files divided in their object declaration type `<object_type>.ts`.                                    | `src/lib/server/db/schema/tasks/enums.ts`, `src/lib/server/db/schema/tasks/tables.ts` |
| **Prefixing**       | All database elements (tables, enums, relations) belonging to a module must use that module's name as a prefix for clarity and separation. | `tasks_tasklist`, `tasks_status_enum`, `knowledge_note_table`                         |

## 2. Modules and UI Guidelines

| Rule                | Location & Usage                                                                                                                                            | Purpose                                                                            |
| :------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- |
| **Module Routing**  | Each main module must have its own path under the SvelteKit grouping `src/routes/(modules)`.                                                                | `src/routes/(modules)/tasks`, `src/routes/(modules)/routines`                      |
| **Base Components** | All reusable, stylized UI components (`Button`, `Card`, `Input`) must be placed in `src/lib/components/ui`.                                                 | Ensures visual consistency across the entire application.                          |
| **New Components**  | If a page requires a new type of component, it must be created in `src/lib/components/ui` first, and then imported and used on the main module Svelte page. | Prevents duplicate or non-standard styling within individual modules.              |
| **Data Retrieval**  | Data fetching for UI pages should be done server-side using SvelteKit's `+page.server.ts` or `load` functions where possible.                               | Improves performance, reduces waterfall requests, and keeps secrets on the server. |

## 3. API Guidelines

The API is handled implicitly by SvelteKit's `+server.js/.ts` files within the `src/routes/api/` directory.

### API Documentation:

(Still under documentation)

### Best Practice:

All data access should be secured, and API endpoints should be **versioned** or **clearly named** to support both the web frontend and the mobile-android/ client.
