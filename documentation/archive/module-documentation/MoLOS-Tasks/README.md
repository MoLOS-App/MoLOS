# MoLOS-Tasks Module - Implementation Guide

> **Version:** 1.0  
> **Last Updated:** 2026-02-24  
> **Status:** Ready for Implementation

---

## Overview

This folder contains the complete implementation plan for enhancing the MoLOS-Tasks module with Linear-style features and MCP/AI integration.

**Key Objectives:**

- Add Linear-style task management (subtasks, labels, time tracking)
- Implement comments and attachments
- Add saved views/filters
- Keep existing Kanban board functional
- Provide 13 MCP tools for external AI agents
- No internal AI API calls (external agents only via MCP)

---

## Documentation Structure

```
MoLOS-Tasks/
├── README.md                   # This file - overview and navigation
├── 01-database-plan.md         # Database schema updates and migration
├── 02-backend-services.md       # Service layer implementation
├── 03-api-layer.md             # API endpoint specifications
├── 04-mcp-integration.md        # MCP tools for external AI agents
├── 05-ui-components.md         # UI component strategy (no code)
├── 06-pages-integration.md       # Page updates and routing
├── 07-testing-strategy.md        # Testing approach and acceptance criteria
├── 08-tasks-checklist.md        # Detailed implementation tasks
└── api-endpoints.md             # Complete API reference
```

---

## Quick Start

### For Implementation

1. **Review the plan** - Read through all documentation files
2. **Set up environment** - Ensure database and dependencies are ready
3. **Follow the tasks** - Use `08-tasks-checklist.md` as your guide
4. **Implement in order** - Follow phases sequentially (01 → 02 → 03 → ...)

### For External AI Agents

**MCP Tools Available:**

- `get_tasks` - Retrieve tasks with optional context
- `get_task_with_context` - Get full context (subtasks, comments, attachments)
- `get_project_overview` - Get project-level analytics
- `get_user_patterns` - Analyze user behavior patterns
- `bulk_create_tasks` - Create multiple tasks
- `bulk_update_tasks` - Update multiple tasks
- `bulk_delete_tasks` - Delete multiple tasks
- `create_project` - Create new project
- `get_projects` - Retrieve projects
- `get_areas` - Retrieve areas
- `update_daily_log` - Update daily log entry
- `global_search` - Search across all entities

**Usage:**

```typescript
// External AI agents call via MCP
const tasks = await mcpClient.callTool('get_tasks', {
	userId: 'user-123',
	filters: { status: ['todo', 'in_progress'] },
	includeContext: true // Returns enriched data
});
```

---

## Implementation Phases

| Phase                  | Duration | Files                     | Status     |
| ---------------------- | -------- | ------------------------- | ---------- |
| 01 - Database          | 1 week   | `01-database-plan.md`     | ⏳ Pending |
| 02 - Backend Services  | 1 week   | `02-backend-services.md`  | ⏳ Pending |
| 03 - API Layer         | 3 days   | `03-api-layer.md`         | ⏳ Pending |
| 04 - MCP Integration   | 3 days   | `04-mcp-integration.md`   | ⏳ Pending |
| 05 - UI Components     | 1 week   | `05-ui-components.md`     | ⏳ Pending |
| 06 - Pages Integration | 2 days   | `06-pages-integration.md` | ⏳ Pending |
| 07 - Testing           | 2 days   | `07-testing-strategy.md`  | ⏳ Pending |

---

## Success Criteria

- [ ] Database migration successful (no data loss)
- [ ] All new services implemented and tested
- [ ] All 13 MCP tools accessible via MCP
- [ ] API endpoints working with new features
- [ ] Kanban board functional with new status columns
- [ ] Linear-style list view working
- [ ] Task detail panel with comments/attachments
- [ ] All acceptance tests passing
- [ ] Performance targets met (API p95 < 200ms)
- [ ] No external AI API calls from module

---

## Support

**Questions?** Refer to specific documentation files for detailed information.

**Need help?** Check the main MoLOS documentation at `/documentation/README.md`

---

**Ready to start implementation!** → Begin with `08-tasks-checklist.md`
