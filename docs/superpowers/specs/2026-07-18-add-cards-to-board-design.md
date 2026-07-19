# Add Cards to Board — Design Spec

**Date:** 2026-07-18
**Scope:** Cards feature only. Shareable links are a separate spec.

---

## Overview

Users can navigate from the board list to a board detail page, where they see three fixed columns (Good, Bad, Actions) and can add cards to any column. Cards have text content, an author name, and a server-assigned creation timestamp. No editing or deleting cards in this iteration.

---

## Data Model

### New table: `cards`

| Column | Type | Notes |
|---|---|---|
| `id` | integer | primary key, autoincrement |
| `board_id` | integer | foreign key → `boards.id` |
| `column` | string | one of `"good"`, `"bad"`, `"actions"` |
| `content` | string | card text, non-null |
| `author` | string | free-text name, non-null |
| `created_at` | datetime | set server-side on creation, non-null |

`column` is validated server-side against the fixed set `{"good", "bad", "actions"}`. The client never sends `created_at`.

---

## API

### Existing endpoint unchanged
- `GET /api/boards` — list all boards
- `POST /api/boards` — create a board

### New endpoints

**Get board by id**
```
GET /api/boards/{board_id}
```
Returns `{ id, name }`. Returns 404 if not found.

**Get cards for a board**
```
GET /api/boards/{board_id}/cards
```
Returns a list of cards ordered by `created_at` ascending. Returns 404 if the board does not exist.

**Create a card**
```
POST /api/boards/{board_id}/cards
Body: { "column": "good" | "bad" | "actions", "content": string, "author": string }
```
Returns the created card `{ id, board_id, column, content, author, created_at }` with status 201. Returns 404 if the board does not exist. Returns 422 if `column` is not one of the three valid values, or if `content` or `author` are missing.

---

## Frontend

### Routing

Add `react-router-dom`. Two routes:
- `/` — board list (existing)
- `/boards/:id` — board detail page (internal; will be superseded by the shareable-link spec)

### Component structure

```
App
├── BoardList (route: /)
│   └── [Board items as <Link> to /boards/:id]
└── BoardPage (route: /boards/:id)
    ├── Column (Good)
    │   ├── [Card items]
    │   └── CardForm
    ├── Column (Bad)
    │   ├── [Card items]
    │   └── CardForm
    └── Column (Actions)
        ├── [Card items]
        └── CardForm
```

### Component responsibilities

**`BoardPage`**
- On mount: fetches board name (`getBoardById`) and all cards (`getCards`) in parallel.
- Splits cards into three arrays by `column` and passes each to its `Column`.
- Owns all card state. Provides `onCardCreated(card)` callback to each `Column`, which appends the new card to the correct column array — no full refetch on create.
- Shows loading and error states at the page level.

**`Column`**
- Receives: `label` (display name), `columnKey` (`"good"` | `"bad"` | `"actions"`), `cards`, `onCardCreated`.
- Renders the list of cards and a `CardForm` at the bottom.
- Stateless with respect to fetch status.

**`CardForm`**
- Manages its own open/closed state and field values (`content`, `author`).
- Renders an "Add a card" button when closed; expands inline to show a `content` textarea, `author` text input, and Submit button when open.
- On submit: calls `cardApi.createCard(boardId, { column, content, author })`, fires `onCardCreated` with the returned card, then collapses and clears fields.

### `api.ts` additions

```ts
boardApi.getBoardById(id: number): Promise<Board>
cardApi.getCards(boardId: number): Promise<Card[]>
cardApi.createCard(boardId: number, payload: { column: string; content: string; author: string }): Promise<Card>
```

New `Card` interface:
```ts
interface Card {
  id: number;
  board_id: number;
  column: string;
  content: string;
  author: string;
  created_at: string; // ISO 8601
}
```

---

## Data Flow

1. `BoardPage` mounts → parallel fetch of board name and cards.
2. Cards split by `column` → passed to three `Column` components.
3. User opens `CardForm` in a column → fills in content and author → submits.
4. `CardForm` calls `cardApi.createCard` → on success fires `onCardCreated(newCard)`.
5. `BoardPage` appends `newCard` to the correct column array → `Column` re-renders with the new card.

---

## Out of scope

- Card editing and deletion
- Configurable columns
- Shareable / public board links (separate spec)
- User authentication (author is free-text)
