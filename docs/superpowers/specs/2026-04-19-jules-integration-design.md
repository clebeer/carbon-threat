# Jules Integration — Design Spec

**Date:** 2026-04-19  
**Status:** Approved  
**Author:** Clebeer

---

## Overview

Integrate Google Jules (AI coding agent) into Carbon Threat to allow users to trigger automated vulnerability remediation from security findings (OSV Scanner, SAST) and manage Jules sessions through a dedicated panel.

**API:** `https://jules.googleapis.com` (v1alpha)  
**Auth:** `X-Goog-Api-Key` header — key stored server-side in `JULES_API_KEY` env var

---

## Scope

- Trigger Jules sessions directly from OSV/SAST vulnerability findings
- Full session management panel (list, detail, plan approval, activity feed)
- Configurable automation mode per session (auto PR or manual approval)
- Status polling every 5 seconds until terminal state

Out of scope: ATT&CK/pentest findings trigger, WebSocket real-time updates, Redis queue.

---

## Architecture

### Approach
Stateless proxy integration: backend proxies Jules API calls and persists session metadata in Postgres. Frontend polls for status updates. No new infrastructure required.

### File Structure

```
ct.client/src/
  pages/Jules/
    JulesPage.tsx                  # Dedicated tab — sessions list
    JulesSessionDetail.tsx         # Drawer with plan, activities, approve button
  components/Jules/
    JulesButton.tsx                # "Remediar com Jules" inline button
    JulesCreateSessionModal.tsx    # Modal: source, mode, prompt
    JulesActivityFeed.tsx          # Activity timeline component
    JulesStatusBadge.tsx           # Colored status badge
  stores/julesStore.ts             # Zustand store for sessions state

td.server/src/
  integrations/jules/
    jules.client.js                # HTTP client for jules.googleapis.com
    jules.service.js               # Business logic
  controllers/
    jules.controller.js            # REST endpoints /api/jules/*
  repositories/
    jules.repository.js            # Postgres queries
  db/migrations/
    XXXX_create_jules_sessions.js  # Migration
```

---

## Database

### Table: `jules_sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Internal ID |
| `jules_session_id` | varchar | ID from Jules API |
| `finding_id` | varchar | OSV/SAST finding ID |
| `finding_type` | varchar | `osv` or `sast` |
| `source_name` | varchar | Jules source (GitHub repo) |
| `prompt` | text | Prompt sent to Jules |
| `automation_mode` | varchar | `AUTO_CREATE_PR` or `REQUIRE_APPROVAL` |
| `status` | varchar | `pending`, `planning`, `awaiting_approval`, `running`, `done`, `error` |
| `plan_summary` | text | Plan from Jules (nullable) |
| `pr_url` | varchar | Created PR URL (nullable) |
| `created_by` | integer FK → users | User who triggered |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

## Backend

### Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/jules/sources` | List GitHub repos connected to Jules |
| `POST` | `/api/jules/sessions` | Create session from a finding |
| `GET` | `/api/jules/sessions` | List sessions (paginated) |
| `GET` | `/api/jules/sessions/:id` | Session detail + activities |
| `POST` | `/api/jules/sessions/:id/approve` | Approve plan (REQUIRE_APPROVAL mode) |
| `POST` | `/api/jules/sessions/:id/message` | Send additional message to Jules |
| `DELETE` | `/api/jules/sessions/:id` | Remove session from local history |

### Session Creation Flow

1. Frontend sends `POST /api/jules/sessions` with `{ finding_id, source_name, automation_mode, prompt_override? }`
2. Backend fetches finding data (CVE/description + affected file) from DB
3. Backend auto-generates prompt: `"Fix vulnerability [CVE-ID]: [description] in file [path]. [prompt_override if provided]"`
4. Calls `POST /v1alpha/sessions` on Jules API with source, prompt, automationMode
5. Persists record in `jules_sessions` with status `pending`
6. Returns created session to frontend

### Status Polling

- Frontend calls `GET /api/jules/sessions/:id` every 5s while status ∉ `{done, error}`
- Backend calls `GET /v1alpha/sessions/{jules_session_id}/activities` on Jules API
- Parses activities to determine current status and extract plan_summary / pr_url
- Updates local record and returns to frontend

### jules.client.js

Thin HTTP client (using `node-fetch` or `axios` — already available) with:
- Base URL: `https://jules.googleapis.com`
- Header: `X-Goog-Api-Key: ${process.env.JULES_API_KEY}`
- Methods: `getSources()`, `createSession()`, `getActivities()`, `approvePlan()`, `sendMessage()`

---

## Frontend

### Dedicated Tab `/jules`

- **JulesPage:** Table of sessions — columns: Finding, Repo, Status (badge), Date, PR Link
- **JulesSessionDetail:** Drawer with prompt sent, Jules plan, activity feed (JulesActivityFeed), "Approve Plan" button (visible when `awaiting_approval`), PR link when `done`

### Inline in Findings (OSV Scanner / SAST)

- **JulesButton:** `Remediar com Jules` button on each vulnerability row/detail
- Disabled with tooltip when `JULES_API_KEY` not configured
- Opens **JulesCreateSessionModal:**
  - Dropdown: select connected GitHub repo (source)
  - Toggle: Auto PR / Manual Approval
  - Textarea: pre-filled prompt (editable by user)
  - Confirm button

### Status Badge Colors

| Status | Color |
|---|---|
| `pending` | gray |
| `planning` | blue (pulsing) |
| `awaiting_approval` | yellow |
| `running` | blue (pulsing) |
| `done` | green |
| `error` | red |

### Zustand Store (`julesStore.ts`)

```ts
interface JulesStore {
  sessions: JulesSession[]
  activeSessions: Set<string>      // IDs being polled
  fetchSessions: () => Promise<void>
  createSession: (payload) => Promise<JulesSession>
  pollSession: (id: string) => void
  stopPolling: (id: string) => void
  approvePlan: (id: string) => Promise<void>
}
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `JULES_API_KEY` not set | Endpoints return `503`; frontend disables Jules button with tooltip |
| Jules API `401` | Return error with message "API Key inválida ou expirada" + link to settings |
| Jules API `429` | Retry with exponential backoff (3 attempts: 1s, 2s, 4s) |
| Jules API `5xx` | Mark session as `error`, store error message in `plan_summary` |
| Finding not found | `404` with descriptive message |

---

## Configuration

```env
JULES_API_KEY=<key from jules.google.com/settings>
```

No UI for key management in this iteration — key is set via environment variable only.

---

## Testing

- **Unit tests** (`td.server/test/`): `jules.service.js` with mocked `jules.client.js`
- **Integration tests**: `jules.repository.js` with real Knex/Postgres (follows existing project pattern)
- **Frontend**: Component tests for `JulesCreateSessionModal` and `JulesStatusBadge`
