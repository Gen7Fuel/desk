---
name: projects-domain
description: Projects feature domain — files created, API shape, query keys, and nav registration pattern
metadata:
  type: project
---

**UPDATE (2026-07-14, code review on feature/cdn-admin):** The backend now exists at `backend/apps/projects/` (`project.model.js`, `task.model.js`, `project-template.model.js`, `projects.routes.js`, plus a passing test file). The "no backend yet" note below is stale — endpoints match what was originally speculated almost exactly.

**CRITICAL gotcha found in review — User model has no firstName/lastName:** `backend/apps/users/user.model.js` only has `email`, `role`, `permissionOverrides`. No model anywhere in the backend (checked `Personnel` too — it only has a single `name` field) has `firstName`/`lastName`. Yet `projects.routes.js` does `.populate('assignee', 'firstName lastName')` and `.populate('createdBy', 'firstName lastName')` against the `User` ref, and the frontend types (`ProjectUser`, `Project.createdBy`, `ProjectTask.assignee` in `projects-api.ts`) assume these fields exist and are non-optional strings. At runtime they are `undefined`. This crashes `frontend/src/routes/_appbar/_sidebar/projects/$id.tsx`'s `initials()` helper (`user.firstName[0]` on `undefined` throws) anywhere an assignee `Avatar` renders — i.e. the first time any task is assigned to anyone. `projects/index.tsx`'s `ProjectCard` survives only because it happens to use optional chaining (`createdBy.firstName?.[0]`) but still renders blank names.
**How to apply:** Before building anything else on top of assignee/createdBy display, this needs a real fix — either add `firstName`/`lastName` to the `User` schema, or have Projects populate/display `email` (the only field that actually exists), or introduce a display-name resolution layer. Don't assume `ProjectUser.firstName`/`.lastName` are safe to dereference until this is fixed.

Separately, unassigning a task is fully broken end-to-end: frontend's `TaskDialog` sends `assignee: form.assignee || undefined` (never `null`), and `JSON.stringify` drops `undefined` keys, so the field is never sent. Even if it were sent as `null`, the backend's `PUT /projects/:id/tasks/:taskId` does `assignee: assignee ?? undefined` which converts `null` back to `undefined` and Mongoose/Mongo drop it from the update. Both sides need fixing for "Unassigned" to ever work.

---

Original scaffold notes (endpoint shape mostly still accurate) below.

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
