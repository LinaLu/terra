# Add Cards to Board — Design Spec

**Date:** 2026-07-18
**Scope:** Cards feature only. Shareable links are a separate spec.

---

## Overview

Users can navigate from the board list to a board detail page, where they see the board's columns and can add cards to any column. Columns are stored in the database so boards can support different column sets in the future. For now, three default columns (Good, Bad, Actions) are seeded automatically when a board is created. Cards have text content, an author name, and a server-assigned creation timestamp. No editing or deleting cards in this iteration.

---

## Data Model

### New table: `columns`

| Column | Type | Notes |
|---|---|---|
| `id` | integer | primary key, autoincrement |
| `board_id` | integer | foreign key → `boards.id` |
| `name` | string | display name, e.g. `"Good"`, `"Bad"`, `"Actions"` |
| `position` | integer | display order, 1-indexed |

### New table: `cards`

| Column | Type | Notes |
|---|---|---|
| `id` | integer | primary key, autoincrement |
| `column_id` | integer | foreign key → `columns.id` |
| `content` | string | card text, non-null |
| `author` | string | free-text name, non-null |
| `created_at` | datetime | set server-side on creation, non-null |

Cards belong to a column; a column belongs to a board. The board is not stored directly on the card — queries go through `column_id`.

### Board creation seeding

When a board is created (`POST /api/boards`), the server immediately creates three default columns for it:

| name | position |
|---|---|
| Good | 1 |
| Bad | 2 |
| Actions | 3 |

---

## API

### Existing endpoint (updated)
- `POST /api/boards` — creates a board **and** seeds its three default columns. Response unchanged: `{ id, name }`.

### Existing endpoint unchanged
- `GET /api/boards` — list all boards

### New endpoints

**Get board by id**
```
GET /api/boards/{board_id}
```
Returns `{ id, name }`. Returns 404 if not found.

**Get columns for a board**
```
GET /api/boards/{board_id}/columns
```
Returns columns ordered by `position` ascending: `[{ id, board_id, name, position }, ...]`. Returns 404 if the board does not exist.

**Get cards for a board**
```
GET /api/boards/{board_id}/cards
```
Returns all cards for the board (across all columns) ordered by `created_at` ascending: `[{ id, column_id, content, author, created_at }, ...]`. Returns 404 if the board does not exist.

**Create a card**
```
POST /api/boards/{board_id}/cards
Body: { "column_id": integer, "content": string, "author": string }
```
Returns the created card `{ id, column_id, content, author, created_at }` with status 201. Returns 404 if the board does not exist or if `column_id` does not belong to this board. Returns 422 if `column_id`, `content`, or `author` are missing.

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
    ├── Column (dynamic, one per column returned by API)
    │   ├── [Card items]
    │   └── CardForm
    ├── Column
    │   ├── [Card items]
    │   └── CardForm
    └── ...
```

### Component responsibilities

**`BoardPage`**
- On mount: fetches board name (`getBoardById`), columns (`getColumns`), and cards (`getCards`) — columns and cards fetched in parallel after the board is confirmed to exist.
- Groups cards by `column_id` and passes each group to its `Column`.
- Renders one `Column` per entry returned by the columns endpoint, in order.
- Owns all card state. Provides `onCardCreated(card)` callback to each `Column`, which appends the new card to the correct column's array — no full refetch on create.
- Shows loading and error states at the page level.

**`Column`**
- Receives: `column` (`{ id, name }`), `cards`, `boardId`, `onCardCreated`.
- Renders the column name, the list of cards, and a `CardForm` at the bottom.
- Stateless with respect to fetch status.

**`CardForm`**
- Receives: `boardId`, `columnId`, `onCardCreated`.
- Manages its own open/closed state and field values (`content`, `author`).
- Renders an "Add a card" button when closed; expands inline to show a `content` textarea, `author` text input, and Submit button when open.
- On submit: calls `cardApi.createCard(boardId, { column_id, content, author })`, fires `onCardCreated` with the returned card, then collapses and clears fields.

### `api.ts` additions

```ts
boardApi.getBoardById(id: number): Promise<Board>
columnApi.getColumns(boardId: number): Promise<Column[]>
cardApi.getCards(boardId: number): Promise<Card[]>
cardApi.createCard(boardId: number, payload: { column_id: number; content: string; author: string }): Promise<Card>
```

New interfaces:

```ts
interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
}

interface Card {
  id: number;
  column_id: number;
  content: string;
  author: string;
  created_at: string; // ISO 8601
}
```

---

## Data Flow

1. `BoardPage` mounts → fetches board name; on success, fetches columns and cards in parallel.
2. Cards grouped by `column_id` → `BoardPage` renders one `Column` per column, passing its cards.
3. User opens `CardForm` in a column → fills in content and author → submits.
4. `CardForm` calls `cardApi.createCard` with `column_id` → on success fires `onCardCreated(newCard)`.
5. `BoardPage` appends `newCard` to the correct column's array → `Column` re-renders with the new card.

---

## Out of scope

- Card editing and deletion
- Adding, renaming, or reordering columns (columns are read-only in this iteration)
- Shareable / public board links (separate spec)
- User authentication (author is free-text)
