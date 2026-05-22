---
name: projects-domain
description: Projects feature domain — files created, API shape, query keys, and nav registration pattern
metadata:
  type: project
---

The Projects domain was scaffolded with no existing backend (no `backend/apps/projects/` yet). The frontend targets these REST endpoints:

- `GET /api/projects` — list
- `GET /api/projects/:id` — detail
- `POST /api/projects` — create (body: name, description?, site?, status, startDate, templateId?)
- `PUT /api/projects/:id` — update
- `DELETE /api/projects/:id` — delete
- `GET /api/projects/:id/tasks` — list tasks for project
- `POST /api/projects/:id/tasks` — create task
- `PUT /api/projects/:id/tasks/:taskId` — update task (dates, status, progress, assignee)
- `DELETE /api/projects/:id/tasks/:taskId` — delete task
- `GET /api/projects/templates` — list templates
- `GET /api/projects/templates/:id` — get template
- Assignee picker reuses existing `GET /api/users`

**Query key factory** (`projectKeys` in `src/lib/projects-api.ts`):
```ts
projectKeys.all         // ['projects']
projectKeys.lists()     // ['projects', 'list']
projectKeys.detail(id)  // ['projects', 'detail', id]
projectKeys.tasks(id)   // ['projects', 'tasks', id]
projectKeys.templates() // ['projects', 'templates']
projectKeys.users()     // ['projects', 'users']
```

**Files created:**
- `frontend/src/lib/projects-api.ts` — all types + API functions
- `frontend/src/routes/_appbar/_sidebar/projects.tsx` — layout route (Outlet + auth guard)
- `frontend/src/routes/_appbar/_sidebar/projects/index.tsx` — list + New Project dialog
- `frontend/src/routes/_appbar/_sidebar/projects/$id.tsx` — Gantt + Tasks table detail

**Nav registration:**
- `_appbar.tsx` — `FolderKanban` icon, `can('projects', 'read')` guard, `isProjectsActive` flag
- `_sidebar.tsx` — `projects` key with single "All Projects" link, permission `projects`

**Why:** Backend for projects does not exist yet — the frontend is built optimistically against the expected API shape.

**How to apply:** When the backend is created, match these endpoint paths exactly. The `projects` permission key needs to be registered in the roles system for the nav items to be visible.
