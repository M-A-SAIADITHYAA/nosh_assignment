# Nosh — Dish Management Dashboard

> **Full Stack Intern Assignment: Draft Editing, Backend Validation, and Safe Updates with Optimistic Concurrency Control (OCC) & Real-Time SSE Synchronization.**

---

## 📑 Table of Contents
1. [Overview](#-overview)
2. [Prerequisites](#-prerequisites)
3. [Quickstart Setup & Run](#-quickstart-setup--run)
4. [Environment Configuration](#-environment-configuration)
5. [API Specification & Examples](#-api-specification--examples)
6. [Architecture & Key Design Decisions](#-architecture--key-design-decisions)
7. [Optional Bonus: Real-Time External Updates](#-optional-bonus-real-time-external-updates)
8. [Step-by-Step Verification Guide](#-step-by-step-verification-guide)
9. [Automated Test Suite](#-automated-test-suite)
10. [Known Limitations & Future Scope](#-known-limitations--future-scope)
11. [Project Time Spent & Disclosures](#-project-time-spent--disclosures)

---

## 🌟 Overview

The **Nosh Dish Dashboard** provides a robust, resilient menu management interface built with React, Node.js (Express), and SQLite. It implements strict optimistic concurrency control, zero-loss local draft editing, backend business validation, and real-time Server-Sent Events (SSE) synchronization.

### Core Guarantees:
- **Zero Loss Drafts:** Edits remain client-side drafts until explicit save. Network errors or 409 conflicts never erase uncommitted user input.
- **Optimistic Concurrency Control (OCC):** Prevents lost updates through atomic `(version = expectedVersion)` conditional updates. Stale writes receive HTTP `409 Conflict`.
- **Backend Validation:** Published dishes must strictly possess a non-empty name and a valid HTTP/HTTPS image URL.
- **Idempotent Seeding:** Reseeding (`npm run seed`) loads missing dishes without duplicating records or resetting user edits.
- **Real-Time Synchronization (Bonus):** Dashboard automatically streams saved changes across browser windows via SSE without overwriting active local drafts.

---

## 💻 Prerequisites

- **Node.js:** v18.0.0 or later (Tested on Node v22.22.0)
- **npm:** v9.0.0 or later (Tested on npm 10.9.4)
- **OS:** macOS, Linux, or Windows (WSL / PowerShell)

---

## 🚀 Quickstart Setup & Run

### 1. Clone & Install Dependencies
From the repository root:
```bash
# Installs root, backend, and frontend packages
npm run install:all
```
*(Alternatively, run `npm install` in the root, `backend/`, and `frontend/` directories).*

### 2. Seed Database
```bash
# Seed the official supplied dishes idempotently (version 1)
npm run seed

# (Optional) Seed base dishes PLUS test fixtures for invalid URLs / broken images
npm run seed:fixtures
```

### 3. Start Development Servers
```bash
# Runs backend on http://localhost:5001 and frontend on http://localhost:5173 concurrently
npm run dev
```

Open your browser at **`http://localhost:5173`**.

---

## ⚙️ Environment Configuration

### Backend (`backend/.env` / `backend/.env.example`):
```env
PORT=5001
DATABASE_PATH=./data/dishes.db
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

### Frontend (`frontend/.env.example`):
```env
# Optional: Left blank by default to utilize Vite's transparent proxy
VITE_API_BASE_URL=
```

---

## 📡 API Specification & Examples

### 1. `GET /dishes`
Returns all menu dishes with their current publication status and integer version number.

**Example Request:**
```bash
curl -s http://localhost:5001/dishes
```

**Example Response (`200 OK`):**
```json
[
  {
    "dishId": "1",
    "dishName": "Jeera Rice",
    "imageUrl": "https://nosh-assignment.s3.ap-south-1.amazonaws.com/jeera-rice.jpg",
    "isPublished": true,
    "version": 1
  },
  {
    "dishId": "2",
    "dishName": "Paneer Tikka",
    "imageUrl": "https://nosh-assignment.s3.ap-south-1.amazonaws.com/paneer-tikka.jpg",
    "isPublished": true,
    "version": 1
  }
]
```

---

### 2. `PATCH /dishes/:dishId`
Atomically updates the name and explicit published status of a dish if and only if `expectedVersion` matches the stored database version. Increments `version` by 1.

**Request Payload:**
| Field | Type | Description |
|---|---|---|
| `dishName` | `string` | Updated dish title (must be non-empty after trimming if `isPublished: true`). |
| `isPublished` | `boolean` | Explicit publication state. **Never a blind toggle.** |
| `expectedVersion`| `integer` | The version the client originally loaded and edited from (>= 1). |

**Example 1: Successful Update (`200 OK`)**
```bash
curl -i -X PATCH http://localhost:5001/dishes/1 \
  -H "Content-Type: application/json" \
  -d '{"dishName": "Jeera Rice Supreme", "isPublished": true, "expectedVersion": 1}'
```
*Response (`200 OK`):*
```json
{
  "dishId": "1",
  "dishName": "Jeera Rice Supreme",
  "imageUrl": "https://nosh-assignment.s3.ap-south-1.amazonaws.com/jeera-rice.jpg",
  "isPublished": true,
  "version": 2
}
```

**Example 2: Conflict Error (`409 Conflict`)**
Triggered when another update has already changed the dish's version:
```bash
curl -i -X PATCH http://localhost:5001/dishes/1 \
  -H "Content-Type: application/json" \
  -d '{"dishName": "Stale Edit", "isPublished": false, "expectedVersion": 1}'
```
*Response (`409 Conflict`):*
```json
{
  "error": "Conflict: Dish has been modified by another update.",
  "message": "Your draft expected version 1, but the server is currently at version 2.",
  "currentDish": {
    "dishId": "1",
    "dishName": "Jeera Rice Supreme",
    "imageUrl": "https://nosh-assignment.s3.ap-south-1.amazonaws.com/jeera-rice.jpg",
    "isPublished": true,
    "version": 2
  },
  "currentVersion": 2,
  "expectedVersion": 1
}
```

**Example 3: Validation Error (`400 Bad Request`)**
Attempting to publish an empty or whitespace name:
```bash
curl -i -X PATCH http://localhost:5001/dishes/1 \
  -H "Content-Type: application/json" \
  -d '{"dishName": "   ", "isPublished": true, "expectedVersion": 2}'
```
*Response (`400 Bad Request`):*
```json
{
  "error": "A published dish must have a non-empty name after trimming."
}
```

**Example 4: Invalid Image URL on Publish (`400 Bad Request`)**
```bash
curl -i -X PATCH http://localhost:5001/dishes/test-invalid-url \
  -H "Content-Type: application/json" \
  -d '{"dishName": "Valid Name", "isPublished": true, "expectedVersion": 1}'
```
*Response (`400 Bad Request`):*
```json
{
  "error": "A published dish must have a valid HTTP or HTTPS image URL."
}
```

---

### 3. `GET /events` (Optional Bonus: SSE Stream)
Streams real-time Server-Sent Events to dashboard clients whenever dishes are updated.
```bash
curl -N http://localhost:5001/events
```
*Stream output:*
```
data: {"type":"CONNECTED","clientId":"1729000000-xyz"}

data: {"type":"DISH_UPDATED","dish":{"dishId":"1","dishName":"Jeera Rice Supreme","imageUrl":"...","isPublished":true,"version":2},"timestamp":"..."}
```

---

## 🏛️ Architecture & Key Design Decisions

### System Architecture Diagram
```
┌────────────────────────────────────────────────────────┐
│                   React 18 Dashboard                   │
│                                                        │
│  ┌──────────────────┐           ┌──────────────────┐   │
│  │ Local Draft State│           │   EventSource    │   │
│  │ (Unsaved Badges) │           │  (Live SSE Sync) │   │
│  └────────┬─────────┘           └────────▲─────────┘   │
└───────────┼──────────────────────────────┼─────────────┘
            │ PATCH (expectedVersion)      │ SSE Stream:
            │                              │ "DISH_UPDATED"
┌───────────▼──────────────────────────────┴─────────────┐
│                 Express Backend Service                │
│                                                        │
│  • Field Type & Business Validation                    │
│  • Optimistic Concurrency Guard                        │
│  • SSE Broadcaster & Heartbeat Manager                 │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│              SQLite (better-sqlite3 / WAL)             │
│                                                        │
│  • Atomic conditional updates:                         │
│    WHERE dishId = ? AND version = ?                    │
│  • ACID Transactions & Idempotent Upsert Guards        │
└────────────────────────────────────────────────────────┘
```

### Key Design Decisions

#### 1. Why SQLite with Atomic Conditional Updates for OCC?
Instead of reading the record, checking the version in memory, and then issuing an update (which creates a race condition window under concurrent requests), the backend executes an atomic conditional SQL update:
```sql
UPDATE dishes
SET dishName = ?, isPublished = ?, version = version + 1, updatedAt = datetime('now')
WHERE dishId = ? AND version = ?
```
Under SQLite WAL (Write-Ahead Logging) mode, this update is serialized and executed as a single atomic transaction. If another concurrent request already incremented `version`, `changes` returns `0`. The backend then detects whether the dish is missing (`404`) or version mismatched (`409 Conflict`), guaranteeing zero race conditions even under heavy parallel load.

#### 2. Local-Only Draft State & Discard Flow
A server-side draft store introduces unnecessary network roundtrips and orphaned draft cleanup problems. Edits are stored purely in client-side React state keyed by `dishId`. The UI highlights unsaved cards with amber badges and displays the original saved values. Clicking **Discard** immediately purges the draft and restores loaded values.

#### 3. Idempotent Non-Destructive Seeding
The assignment requires that rerunning the seed command must neither duplicate dishes nor overwrite user edits. The seed script checks for each dish's existence (`SELECT dishId FROM dishes WHERE dishId = ?`). If a dish already exists, it is strictly skipped and preserved. If missing, it is inserted with `version = 1`.

---

## ⚡ Optional Bonus: Real-Time External Updates

The application includes full support for the **Optional Bonus**:
1. **Server-Sent Events (`/events`):** Whenever a dish is saved (via dashboard or an external client like curl/Postman), the backend broadcasts the updated dish to all active SSE subscribers.
2. **Draft Preservation Guarantee:**
   - If an external update arrives for a dish with **NO local draft**, the card seamlessly updates to the new saved version.
   - If the user currently has an **unsaved local draft** on that dish, the card **strictly keeps the draft safe** and renders an inline alert:
     > *"⚡ Remote update available (v2 arrived). Your draft is kept safe."*
     The user is offered options to *"Apply Remote (Discards Draft)"* or *"Keep Draft"*.
3. **Connection Handling & Cleanup:**
   - Sends periodic heartbeat comments (`: heartbeat`) every 15s to keep connections alive and prevent proxy timeouts.
   - When the client unmounts or leaves the page, the `EventSource` is closed and resources are reclaimed.
   - If SSE disconnects, the frontend automatically falls back to lightweight polling (`GET /dishes` every 4 seconds) and attempts reconnection.

---

## 🧪 Step-by-Step Verification Guide

### Check 1: Idempotent Seeding & Preservation of Edits
1. Seed the database:
   ```bash
   npm run seed
   ```
2. Modify dish `#1` via API:
   ```bash
   curl -s -X PATCH http://localhost:5001/dishes/1 \
     -H "Content-Type: application/json" \
     -d '{"dishName": "Jeera Rice Custom", "isPublished": true, "expectedVersion": 1}'
   ```
3. Re-run seed:
   ```bash
   npm run seed
   ```
4. Verify: Dish `#1` is marked as `[PRESERVED]`. Fetch `GET /dishes/1` and verify that the name remains `"Jeera Rice Custom"` and version remains `2`.

---

### Check 2: Draft Editing & Discard Behavior
1. Open the dashboard at `http://localhost:5173`.
2. Edit the name of dish `#1` to `"Temporary Edit"` and toggle its status.
3. Observe:
   - Card border glows amber.
   - Badge displays `"Unsaved Draft"`.
   - Subtitle displays original saved values.
   - Save button is enabled.
4. Verify database: Fetch `curl -s http://localhost:5001/dishes/1`. Notice the database still has the original value!
5. Click **Discard**: The draft immediately resets to the original values, and the amber indicator disappears.

---

### Check 3: Backend Restart Persistence
1. Save an update to dish `#2` (e.g. rename to `"Paneer Tikka Smoked"`).
2. Note that the version incremented to `2`.
3. Stop the backend server (`Ctrl+C` in terminal).
4. Restart the backend server (`npm run dev:backend`).
5. Refresh the browser page (`F5`).
6. Observe: Dish `#2` retains `"Paneer Tikka Smoked"` with version `2`.

---

### Check 4: Backend Validation (Empty Name & Invalid Image URL)
1. **Empty Name Rejection:**
   In the dashboard, delete the name of a published dish and click Save.
   Or via curl:
   ```bash
   curl -i -X PATCH http://localhost:5001/dishes/1 \
     -H "Content-Type: application/json" \
     -d '{"dishName": "   ", "isPublished": true, "expectedVersion": 2}'
   ```
   **Result:** Backend rejects with `400 Bad Request` (`"A published dish must have a non-empty name after trimming"`). Draft is preserved in UI.
2. **Invalid Image URL Rejection (Verified with Test Fixture):**
   Seed the test fixtures:
   ```bash
   npm run seed:fixtures
   ```
   Dish `test-invalid-url` was seeded with `imageUrl: "not-a-valid-url"` and `isPublished: false`.
   Attempt to publish it:
   ```bash
   curl -i -X PATCH http://localhost:5001/dishes/test-invalid-url \
     -H "Content-Type: application/json" \
     -d '{"dishName": "Valid Dish Title", "isPublished": true, "expectedVersion": 1}'
   ```
   **Result:** Backend rejects with `400 Bad Request` (`"A published dish must have a valid HTTP or HTTPS image URL"`). The database record remains unpublished and unchanged.

---

### Check 5: Two-Tab Concurrency Conflict (Tab A vs Tab B)
1. Open `http://localhost:5173` in **Tab A** and **Tab B**.
2. Both tabs load Dish `#3` (`Rabdi`, version 1).
3. In **Tab A**: Edit name to `"Rabdi Delight"`, click **Save**.
   - Tab A saves successfully and advances to version 2.
4. In **Tab B**: Without refreshing, edit Dish `#3` name to `"Rabdi Pistachio"`, click **Save**.
5. **Result in Tab B:**
   - Tab B receives `409 Conflict`.
   - Tab B displays an alert banner explaining that another update modified the dish to version 2 while Tab B expected version 1.
   - Tab B's draft (`"Rabdi Pistachio"`) is **strictly preserved**.
   - Tab B offers an explicit `"Reload Server Version"` button with a warning that it discards the draft.
   - Clicking Reload restores Tab B to Tab A's `"Rabdi Delight"` (version 2).

---

### Check 6: Backend Outage / Failure Simulation
1. Open the dashboard.
2. Edit dish `#4` name to `"Biryani Draft In Flight"`.
3. Terminate the backend server in the terminal.
4. Click **Save Changes** on the card.
5. **Result:**
   - UI catches the network error.
   - Card displays: *"Network failure or backend unreachable. Your draft has been kept safe—you can retry saving when the connection recovers."*
   - Draft remains completely intact and editable.
6. Restart the backend server and click **Save Changes** again. The request succeeds and clears the draft.

---

### Check 7: External Update Real-Time Synchronization (Bonus)
1. Open the dashboard at `http://localhost:5173`.
2. Notice the top navbar pill: `"Live Sync Active (SSE)"`.
3. In an external terminal, update dish `#5` via curl:
   ```bash
   curl -s -X PATCH http://localhost:5001/dishes/5 \
     -H "Content-Type: application/json" \
     -d '{"dishName": "Alfredo Pasta Gourmet", "isPublished": true, "expectedVersion": 1}'
   ```
4. **Observe in Dashboard:** Dish `#5` updates in real time to `"Alfredo Pasta Gourmet"` and version 2 without any manual page reload!
5. Now start editing Dish `#5` in the UI to create a local draft.
6. Trigger another external curl update:
   ```bash
   curl -s -X PATCH http://localhost:5001/dishes/5 \
     -H "Content-Type: application/json" \
     -d '{"dishName": "Alfredo Pasta Remote 3", "isPublished": true, "expectedVersion": 2}'
   ```
7. **Observe:** The UI preserves your local draft and shows a `"Remote Update Available"` banner with the option to inspect or apply.

---

## 🔬 Automated Test Suite

The backend includes a comprehensive automated test suite testing every requirement using Node's native test runner:

```bash
npm test
```

### Verified Test Cases:
```
✔ A. Idempotent seed: rerunning does not create duplicates or overwrite existing edits
✔ B. GET /dishes returns all dishes with version and boolean published status
✔ C. GET /dishes/:dishId returns single dish or 404 for unknown ID
✔ D. PATCH /dishes/:dishId atomically updates name & status, incrementing version
✔ E. PATCH does not implement status update as a blind toggle
✔ F. PATCH with outdated expectedVersion returns 409 Conflict without modifying database
✔ G. Concurrent PATCH requests: exactly one succeeds, others receive 409 Conflict
✔ H. Publishing dish with empty name (or whitespace) is rejected with 400
✔ I. Publishing dish with invalid image URL is rejected with 400 (verified with test data)
✔ J. Invalid payload types return 400 Bad Request
✔ K. Changes survive backend restart
```

---

## 📌 Known Limitations & Future Scope

In alignment with the assignment specification:
- **Authentication & Authorization:** User roles and permissions are intentionally excluded.
- **Image Uploads:** Image URLs are validated via RFC standards without fetching image payloads from external networks.
- **Pagination:** Returns all items; cursor-based pagination would be added for scale (>10,000 dishes).

---

## ⏱️ Project Time Spent & Disclosures

- **Approximate Time Spent:** ~3.5 hours
  - Backend API, Database schema & Atomic OCC: 1 hour
  - Validation rules & Idempotent seeding: 45 mins
  - Frontend drafts, UI states & conflict resolution: 1 hour
  - Real-Time SSE live sync (Optional Bonus): 30 mins
  - Automated tests & documentation: 30 mins
- **Optional Bonus:** Implemented (SSE live synchronization with draft isolation & fallback polling).
- **AI & Tools Disclosure:** Antigravity AI assistant was used for scaffolding boilerplate, test automation, and code formatting. All business logic, concurrency control, and draft management are authored and understood in accordance with the assignment guidelines.
