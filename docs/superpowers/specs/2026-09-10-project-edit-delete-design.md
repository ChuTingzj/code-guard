# Project config edit & delete

## Goal

Allow admins to edit or delete already-connected projects from the 项目管理 (`/projects`) page.

## Decisions

- **Editable fields:** name, accessToken (empty means leave unchanged), enabled
- **Immutable in UI:** platform, repoFullName
- **Delete:** browser confirm, then hard `DELETE`
- **UX:** inline expand edit on the list row; only one row expanded at a time
- **Related data:** normal delete rejects with 409; force delete (`?force=true`) cascades documents, review tasks/records/issues, then the project

## Backend

Reuse existing endpoints:

- `PATCH /api/v1/projects/:id` — name, accessToken, enabled
- `DELETE /api/v1/projects/:id` — hard delete after related-data guard
- `DELETE /api/v1/projects/:id?force=true` — cascade related rows then delete

`ProjectsService.remove` must:

1. 404 if project missing
2. Count related documents and tasks
3. Without force: 409 with `data.canForce: true` and message「项目下仍有文档或评审任务，无法删除」when either count &gt; 0
4. With force: transactionally delete issues → records → tasks → documents → project
5. Otherwise delete

## Frontend

- Server actions `updateProject` / `deleteProject` on the projects page (same pattern as `createProject`)
- Client `ProjectListItem`: collapsed row with 编辑 / 删除; expanded form for save/cancel
- On conflict error, show **强制删除** with a stronger confirm, then call delete with `force=true`
- Surface API error messages near the list or on the item

## Out of scope

- Changing platform / repoFullName
- Soft-delete-only flow
