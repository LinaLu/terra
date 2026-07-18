# Vanity URLs for Board Sharing

**Date:** 2026-07-18  
**Status:** Approved

## Summary

Add shareable short-code URLs for retrospective boards so team members can access a board by pasting a link (e.g., in Slack) without requiring authentication. Links expire after 24 hours by default. The board persists after expiry; a new link can be generated at any time.

## Data Model

Two new nullable columns on the existing `boards` table:

| Column | Type | Notes |
|---|---|---|
| `short_code` | `VARCHAR(6)`, unique, nullable | `NULL` means no active link |
| `link_expires_at` | `TIMESTAMP`, nullable | `NULL` means no active link |

- When a new link is generated, both columns are written atomically (overwriting any previous values).
- On every read, `link_expires_at > now()` is checked; an expired link is treated as absent without clearing the columns.
- Short codes are 6 characters, alphanumeric `[a-z0-9]`, generated randomly with a collision check against all existing codes in the table (active or expired).

## API Endpoints

### `POST /api/boards/{id}/link`
Generate (or regenerate) a share link for a board.

- Generates a fresh `short_code` and sets `link_expires_at = now() + LINK_EXPIRY_SECONDS`.
- Overwrites any previously active link silently.
- Returns the short code and expiry timestamp.
- Returns 404 if the board does not exist.

### `GET /b/{code}`
Resolve a short code to a board.

- Looks up the board by `short_code`.
- Returns board data if found and `link_expires_at > now()`.
- Returns 404 (with message `"Link expired or not found"`) if the code is expired or never existed. No distinction is made between these cases.

### `GET /api/boards/{id}`
Get a single board by internal ID. Needed for the normal (non-shared) board navigation flow.

### `GET /api/boards` (updated)
The existing list endpoint response is extended to include `short_code` and `link_expires_at` per board, so the frontend can display link status without extra requests.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `LINK_EXPIRY_SECONDS` | `86400` | Link lifetime in seconds (24h). Set to a small value in test environments. |

## Frontend

**Routing:** React Router is added with two routes:
- `/` — existing board list view
- `/b/:code` — public board view, loaded by short code

**Board list view changes:**
- Each board card shows its link status.
- If an active (non-expired) link exists: display the shareable URL with a copy-to-clipboard button.
- If no active link: show a "Generate link" button that calls `POST /api/boards/{id}/link` and immediately displays the result.

**Board view (`/b/:code`):**
- On mount, calls `GET /b/{code}`.
- On success: renders the board name (and future board content).
- On 404: renders a specific "This link has expired or is invalid" message — not a generic 404 page, no auth wall.

The public board view is a destination only; it has no navigation back into the app's main flow.

## Error Handling

- **Expired / unknown code:** HTTP 404, message `"Link expired or not found"`. Frontend renders a dedicated expired-link page.
- **Code collision on generation:** Retry up to 5 times with a new random code. If all 5 attempts collide, return HTTP 500. With ~2 billion possible codes and a small board count, this is effectively unreachable.
- **Regenerating an active link:** Allowed at any time. Old code stops working immediately upon overwrite. No confirmation required.

## Testing

**Backend (pytest):**

| Scenario | Assertion |
|---|---|
| Generate link | `short_code` is set, `link_expires_at ≈ now() + LINK_EXPIRY_SECONDS` |
| Resolve active link | `GET /b/{code}` returns 200 with board data |
| Resolve expired link | With `LINK_EXPIRY_SECONDS=1`: generate, sleep 2s, assert 404 |
| Resolve unknown code | `GET /b/{nonexistent}` returns 404 |
| Regenerate link | Old code returns 404; new code returns 200 |
| Collision retry (unit) | Generation function retries on collision, raises after 5 |

**Frontend (manual — no test suite yet):**
- Board list shows "Generate link" for a board with no active link.
- After generating, the shareable URL appears with a copy button.
- `/b/<valid-code>` renders the board name.
- `/b/<expired-code>` and `/b/<invalid-code>` both render the expired-link message.

## Out of Scope

- Authentication or access control on shared links.
- Multiple concurrent active links per board.
- Link history or audit trail.
- Board content beyond the name (cards, columns) — this feature only makes the board accessible; content is a separate concern.
