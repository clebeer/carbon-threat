# Feature Spec: Editable Dashboard Layout

**Date:** 2026-05-13  
**Status:** Implemented  
**Phase:** 3

## Summary

Allow users to customize their dashboard layout by dragging and resizing widgets. Layouts are persisted per-user on the server.

## Backend

### Migration `014_dashboard_layouts.js`

Creates `dashboard_layouts` table:

| Column | Type |
|---|---|
| id | UUID PK |
| user_id | UUID FK → users UNIQUE |
| layout_config | JSONB |
| updated_at | timestamp |

### Controller `dashboardController.js`

- **`GET /api/dashboard/layout`** — Returns the user's saved layout or defaults.
- **`PUT /api/dashboard/layout`** — Saves layout. Body: `{layout: LayoutItem[]}`.
- **`POST /api/dashboard/layout/reset`** — Clears saved layout, returns defaults.

## Frontend

### Store `store/dashboardStore.ts` (Zustand)

- `layout: LayoutItem[]` — Current widget positions
- `isLoaded / isDirty` — State flags
- `loadLayout()` — Fetch from server on mount
- `setLayout(layout)` — Optimistic local update
- `persistLayout()` — Debounced save to server
- `resetLayout()` — Reset to defaults via server

### Default Layout

7 widgets in a 12-column grid:
- `stats` (12×3) — Summary statistics
- `stride-chart` (5×4) — STRIDE category distribution
- `severity-chart` (7×4) — Severity breakdown
- `risk-heatmap` (12×4) — Risk matrix
- `top-threats` (7×5) — Top threats table
- `system-info` (5×5) — System information
- `recent-scans` (12×4) — Recent vulnerability scans

### API Client `api/dashboard.ts`

- `getDashboardLayout()` — GET
- `saveDashboardLayout(layout)` — PUT
- `resetDashboardLayout()` — POST reset

## Dependencies

- `react-grid-layout` — For drag/resize grid (to be integrated in DashboardView refactor)