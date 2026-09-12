# Wheelio MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a desktop-Chrome random wheel that creates normalized entries from text or a single image and selects them with a smooth, fair animation.

**Architecture:** A Vite React/TypeScript client owns a single expiring session in `localStorage` and renders the chat, SVG wheel, editor, history, and result modal. A stateless FastAPI service validates multipart requests and delegates ambiguous text, tables, and images to a LangChain/LangGraph extraction flow using a configurable OpenRouter model. FastAPI serves the built client in production under the same origin.

**Tech Stack:** React, TypeScript, Vite, SVG, Python 3.12, FastAPI, Pydantic v2, LangChain, LangGraph, OpenRouter, Uvicorn.

**Spec:** `docs/superpowers/specs/2026-09-12-wheelio-mvp-design.md`

## Global Constraints

- Support only a modern desktop Chrome browser in the MVP.
- Persist exactly one unnamed wheel, its transcript, picked history, and removal preference for 30 minutes of inactivity; renew expiry on relevant interaction.
- Accept a single PNG or JPEG image per submission, maximum 2 MiB; do not retain images or server-side session data.
- Parse unambiguous simple newline/comma lists in the browser; route tables, natural-language requests, ambiguous text, and images through FastAPI and OpenRouter.
- Use LangChain and LangGraph; configure the OpenRouter API key and model only through server environment variables.
- Return strict JSON success/clarification/error results, never raw model prose.
- Default remove-on-pick to checked, spin for four seconds, select each remaining entry with equal probability, and retain picked history in order.
- Do not add accounts, a database, rate limiting, retries, mobile layouts, custom colors, sound, confetti, multiple wheels, multi-image inputs, undo, timestamps, or automated tests.
- Use manual acceptance verification for every task; do not add a test framework.

---

## Planned File Structure

| Path | Responsibility |
| --- | --- |
| `.gitignore` | Ignore Python, Node, environment, and build artifacts. |
| `README.md` | Local setup, environment variables, run commands, and manual acceptance checklist. |
| `backend/pyproject.toml` | Python package metadata and runtime dependencies. |
| `backend/app/config.py` | Read and validate server configuration. |
| `backend/app/schemas.py` | Pydantic request/result contracts and extraction result union. |
| `backend/app/validation.py` | PNG/JPEG and 2 MiB upload validation. |
| `backend/app/graph.py` | LangGraph extraction workflow and strict result coercion. |
| `backend/app/main.py` | FastAPI endpoint and production static-file serving. |
| `frontend/package.json` | Frontend scripts and dependencies. |
| `frontend/src/types.ts` | Client session, transcript, and API types. |
| `frontend/src/lib/entries.ts` | Local-list detection, parsing, normalization, and deduplication. |
| `frontend/src/lib/session.ts` | One-session local storage persistence and expiry. |
| `frontend/src/api.ts` | Multipart extraction client. |
| `frontend/src/App.tsx` | Screen-level state, replacement confirmation, and workflow wiring. |
| `frontend/src/components/ChatPanel.tsx` | Prompt, one-image upload, transcript, loading and error states. |
| `frontend/src/components/WheelPanel.tsx` | SVG wheel, entry editing, removal setting, history, reset, and empty state. |
| `frontend/src/components/ResultModal.tsx` | Selected-value modal with close/spin-again controls. |
| `frontend/src/styles.css` | Desktop layout and interaction styles. |

## Shared Contracts

```ts
// frontend/src/types.ts
export type Entry = { id: string; value: string };
export type TranscriptItem = {
  id: string;
  role: "user" | "system";
  text: string;
};
export type WheelSession = {
  entries: Entry[];
  picks: string[];
  transcript: TranscriptItem[];
  removeOnPick: boolean;
  expiresAt: number;
};
export type ExtractionResult =
  | { kind: "success"; entries: string[]; sourceColumn?: string }
  | { kind: "clarification"; message: string; availableColumns: string[] }
  | { kind: "error"; message: string };
```

```python
# backend/app/schemas.py
class SuccessResult(BaseModel):
    kind: Literal["success"] = "success"
    entries: list[str]
    source_column: str | None = Field(default=None, serialization_alias="sourceColumn")

class ClarificationResult(BaseModel):
    kind: Literal["clarification"] = "clarification"
    message: str
    available_columns: list[str] = Field(default_factory=list, serialization_alias="availableColumns")

class ErrorResult(BaseModel):
    kind: Literal["error"] = "error"
    message: str

ExtractionResult = SuccessResult | ClarificationResult | ErrorResult
```

### Task 1: Scaffold the two-application repository

**Files:**
- Create: `.gitignore`
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Modify: `README.md`

**Interfaces:**
- Produces: a Python FastAPI package runnable with `uvicorn app.main:app --reload`, and a React package runnable with `npm run dev`.

- [ ] **Step 1: Create the Python project manifest**

Create `backend/pyproject.toml` with Python 3.12, `fastapi`, `uvicorn[standard]`, `pydantic-settings`, `python-multipart`, `langchain`, `langgraph`, and `langchain-openai` as runtime dependencies. Configure a `wheelio-backend` package and `app` package discovery.

- [ ] **Step 2: Create the Vite React project manifest**

Create `frontend/package.json` with `dev`, `build`, and `preview` scripts and React, React DOM, TypeScript, Vite, and the React Vite plugin. Configure `vite.config.ts` to build into `../backend/app/static` so FastAPI can serve production assets.

- [ ] **Step 3: Add the minimum client entry point**

Create `frontend/index.html` with `<div id="root"></div>`, and create `frontend/src/main.tsx` that renders `<App />` under `React.StrictMode`. Temporarily create `frontend/src/App.tsx` returning `<main>Wheelio</main>` so the build has a concrete entry.

- [ ] **Step 4: Add ignored artifacts and setup documentation**

Ignore `.venv/`, `__pycache__/`, `.env`, `node_modules/`, `dist/`, and `backend/app/static/`. Update `README.md` with these exact local setup commands:

```bash
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -e .
cd ../frontend && npm install
```

- [ ] **Step 5: Verify both scaffolds manually**

Run:

```bash
cd backend && .venv/bin/python -c "import fastapi; print('backend dependencies installed')"
cd frontend && npm run build
```

Expected: the Python import succeeds and Vite writes production assets to `backend/app/static`.

- [ ] **Step 6: Commit the scaffold**

```bash
git add .gitignore README.md backend frontend
git commit -m "chore: scaffold Wheelio client and server"
```

### Task 2: Define server configuration, contracts, and upload validation

**Files:**
- Create: `backend/app/config.py`
- Create: `backend/app/schemas.py`
- Create: `backend/app/validation.py`

**Interfaces:**
- Produces: `Settings.openrouter_api_key`, `Settings.openrouter_model`, `validate_upload(upload: UploadFile | None) -> bytes | None`, and the `ExtractionResult` union used by Tasks 4 and 5.

- [ ] **Step 1: Implement server settings**

Define a `Settings(BaseSettings)` class that reads `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`; make both required. Set `OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"` as a constant. Cache a `get_settings()` factory with `functools.lru_cache`.

- [ ] **Step 2: Implement the result models**

Create the three exact Pydantic models in the shared contract. Add `model_config = ConfigDict(extra="forbid", populate_by_name=True)` to each result class; declare `source_column: str | None = Field(default=None, serialization_alias="sourceColumn")` and `available_columns: list[str] = Field(default_factory=list, serialization_alias="availableColumns")`. Configure FastAPI responses with `response_model_by_alias=True` so the JSON contract is camelCase while Python remains snake_case. Set error text only in server code, never pass provider exception text through to the browser.

- [ ] **Step 3: Implement upload validation**

Write `validate_upload` to return `None` without an upload. For an upload, accept exactly `image/png` and `image/jpeg`, then read at most `2 * 1024 * 1024 + 1` bytes. Raise `ValueError("Upload a PNG or JPEG image no larger than 2 MB.")` for an unsupported type or oversized payload; otherwise return the bytes.

- [ ] **Step 4: Manually verify contract and validation behavior**

Run a short Python command that constructs `SuccessResult(entries=["Ada"])` and prints `model_dump_json()`. In a temporary interactive check, pass a `2 * 1024 * 1024 + 1` byte JPEG-like upload and confirm the exact validation message is raised.

- [ ] **Step 5: Commit the server boundary**

```bash
git add backend/app/config.py backend/app/schemas.py backend/app/validation.py
git commit -m "feat: add extraction contracts and upload validation"
```

### Task 3: Implement local entry parsing and expiring browser session storage

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/lib/entries.ts`
- Create: `frontend/src/lib/session.ts`

**Interfaces:**
- Produces: `parseSimpleList(text: string): string[] | null`, `normalizeEntries(values: string[]): Entry[]`, `loadSession(now: number): WheelSession | null`, and `saveSession(session: WheelSession, now: number): WheelSession`.
- Consumes: the `Entry`, `TranscriptItem`, and `WheelSession` definitions from `frontend/src/types.ts`.

- [ ] **Step 1: Define browser data types**

Add the exact TypeScript types in the shared contract. Use one storage key, `wheelio:session:v1`, and `const SESSION_TTL_MS = 30 * 60 * 1000` in `session.ts`.

- [ ] **Step 2: Implement normalization and deduplication**

In `entries.ts`, trim each value and reject blanks. Use a lowercased trimmed key for deduplication. Convert values that are name-like (letters, spaces, apostrophes, and hyphens) to title case; preserve any value containing `@`, a digit, or punctuation other than a name separator. Give each retained value a `crypto.randomUUID()` id.

- [ ] **Step 3: Detect only unambiguous local lists**

Have `parseSimpleList` return `null` when text contains tabs, looks like a multi-column comma row, or includes an instruction before the list. Otherwise split multiline text on newlines and a one-line list on commas, then return the raw values. The caller passes non-null output to `normalizeEntries`.

- [ ] **Step 4: Implement expiry-safe local storage**

Make `loadSession(now)` parse the stored JSON defensively. If it is missing, invalid, or `expiresAt <= now`, remove the key and return `null`. Make `saveSession(session, now)` return and persist `{ ...session, expiresAt: now + SESSION_TTL_MS }`. Provide `clearSession()` to remove the key.

- [ ] **Step 5: Manually verify client utilities**

Temporarily invoke the functions through the Vite development console. Confirm ` Alice ,alice\nBOB ` yields `Alice` and `Bob`; confirm `Name,ID\nAda,1` returns `null`; confirm a stored session with an expired timestamp is removed.

- [ ] **Step 6: Commit local parsing and persistence**

```bash
git add frontend/src/types.ts frontend/src/lib
git commit -m "feat: add local entry parsing and expiring session storage"
```

### Task 4: Build the LangGraph extraction workflow

**Files:**
- Create: `backend/app/graph.py`

**Interfaces:**
- Consumes: `Settings`, `ExtractionResult`, and optionally validated image bytes from Task 2.
- Produces: `async def extract_entries(prompt: str, image_bytes: bytes | None, image_media_type: str | None) -> ExtractionResult` for Task 5.

- [ ] **Step 1: Define the structured model response schema**

In `graph.py`, define a private Pydantic `ModelExtraction` with `status: Literal["success", "clarification", "error"]`, `entries: list[str] = []`, `source_column: str | None = None`, `message: str | None = None`, and `available_columns: list[str] = []`.

- [ ] **Step 2: Create the model and graph state**

Instantiate `ChatOpenAI` with `model=settings.openrouter_model`, `api_key=settings.openrouter_api_key`, `base_url=OPENROUTER_BASE_URL`, `timeout=60`, and `max_retries=0`. Define a TypedDict state containing `prompt`, `image_bytes`, `image_media_type`, and `result`.

- [ ] **Step 3: Implement the single extraction node**

Build one LangGraph node that sends a concise system instruction: extract only requested entries; infer a name column only when no column is requested; return clarification plus detected headers if selection is uncertain; and emit the structured schema only. Attach an `image_url` data URL when image bytes are present. Invoke the model with structured output, normalize non-empty success entries by trimming and case-insensitive dedupe, and convert empty success lists to `ErrorResult(message="No usable entries were found.")`.

- [ ] **Step 4: Compile and invoke the graph**

Compile a `StateGraph` with `START -> extract -> END`. In `extract_entries`, invoke it under a 60-second `asyncio.wait_for`; return `ErrorResult(message="Extraction could not be completed. Please try a clearer input.")` for timeouts or provider exceptions. Do not retry.

- [ ] **Step 5: Manually verify graph configuration behavior**

Run the backend with intentionally missing `OPENROUTER_API_KEY`; confirm startup or first extraction reports a clear configuration error. With a valid configured model, manually send a simple table request and confirm the endpoint contract is structured rather than free-form prose.

- [ ] **Step 6: Commit the extraction graph**

```bash
git add backend/app/graph.py
git commit -m "feat: add OpenRouter extraction graph"
```

### Task 5: Expose the stateless FastAPI extraction endpoint

**Files:**
- Create: `backend/app/main.py`

**Interfaces:**
- Consumes: `validate_upload` and `extract_entries`.
- Produces: `POST /api/extract` accepting `prompt: str` and optional `image: UploadFile`, returning the serialized `ExtractionResult`; serves `backend/app/static` for all non-API production routes.

- [ ] **Step 1: Add the multipart endpoint**

Create `POST /api/extract` using `Form("")` for `prompt` and `File(None)` for `image`. Validate the image before invoking the graph. Translate `ValueError` into HTTP 400 with the exact safe validation message. Pass `image.content_type` only with successfully read bytes.

- [ ] **Step 2: Preserve the wheel on all non-success results**

Return `SuccessResult`, `ClarificationResult`, and `ErrorResult` with HTTP 200 so the client can display each as a transcript item without conflating product-level outcomes with transport failure. Reserve HTTP 500 for an unexpected server failure and respond with `{"detail":"The service is unavailable. Please try again."}`.

- [ ] **Step 3: Serve the production SPA**

If `backend/app/static/index.html` exists, mount static assets and add a final catch-all GET route that returns `index.html`. Register API routes first so the SPA fallback cannot intercept `/api/extract`.

- [ ] **Step 4: Manually verify HTTP behavior**

Start `uvicorn app.main:app --reload` from `backend`. Use `curl -F 'prompt=Alice,Bob' http://localhost:8000/api/extract` to confirm a JSON result. Use a 3 MiB JPEG upload to confirm HTTP 400 and the exact validation copy. Refresh a non-API route after a production build and confirm it returns the SPA.

- [ ] **Step 5: Commit the API**

```bash
git add backend/app/main.py
git commit -m "feat: expose stateless extraction API"
```

### Task 6: Add the browser API client and chat submission flow

**Files:**
- Create: `frontend/src/api.ts`
- Create: `frontend/src/components/ChatPanel.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `parseSimpleList`, `normalizeEntries`, `saveSession`, and `ExtractionResult`.
- Produces: `requestExtraction(prompt: string, image: File | null): Promise<ExtractionResult>` and a `ChatPanel` that calls `onSubmit(prompt, image)`.

- [ ] **Step 1: Implement multipart client calls**

Create `requestExtraction` with `FormData`, append `prompt`, append `image` only when non-null, and call `fetch("/api/extract", { method: "POST", body: formData })`. Convert non-OK responses to `{ kind: "error", message: "The service is unavailable. Please try again." }`; parse successful JSON into `ExtractionResult`.

- [ ] **Step 2: Implement the chat panel**

Use a textarea, file input limited to `accept="image/png,image/jpeg"`, and Submit button. Render the transcript in order. While `isLoading`, disable Submit and show `Extracting entries…`; the parent will also disable spinning. Display clarification/error results as system transcript messages.

- [ ] **Step 3: Wire the local-first submission decision**

In `App.tsx`, append the user's prompt to the transcript. If there is no image and `parseSimpleList(prompt)` returns values, normalize locally and proceed as a success. Otherwise call `requestExtraction`. Convert returned strings using `normalizeEntries` before replacing state, so backend and local values follow the same UI identity rule.

- [ ] **Step 4: Handle failed and unclear submission**

For clarification/error, append only its message to the transcript and leave the entries, picks, and removal state intact. For a successful empty normalized list, append `No usable entries were found.` and leave the wheel intact.

- [ ] **Step 5: Manually verify chat behavior**

Use `Alice, Bob` and verify it creates a wheel without a network request. Submit a tab-separated table with “pick IDs” and verify the loading state and request. Submit an invalid image and verify the previous wheel remains unchanged with a chat error.

- [ ] **Step 6: Commit chat and client API**

```bash
git add frontend/src/api.ts frontend/src/components/ChatPanel.tsx frontend/src/App.tsx frontend/src/styles.css
git commit -m "feat: add local-first chat extraction flow"
```

### Task 7: Implement session lifecycle, entry editing, and replacement/reset confirmation

**Files:**
- Create: `frontend/src/components/ConfirmDialog.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/ChatPanel.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `WheelSession`, `loadSession`, `saveSession`, `clearSession`, and normalized `Entry[]`.
- Produces: session restoration; confirmed wheel replacement and reset; `onEntriesChange(entries: Entry[])` and `onReset()` props for Task 8's wheel panel.

- [ ] **Step 1: Restore and persist one active session**

On application mount, call `loadSession(Date.now())`. Initialize a blank session with `removeOnPick: true` if none exists. Persist through `saveSession` after successful extraction/replacement, direct entry edits, picks, reset, and transcript changes; reset the expiry during those actions.

- [ ] **Step 2: Add replacement confirmation**

Before applying successful extracted entries when `entries.length > 0`, open `ConfirmDialog` with: `Replace the current wheel? Its entries and picked history will be discarded.` Provide Cancel and Replace. Cancel does not alter session; Replace sets entries, clears picks, appends `Created wheel with N entries.` (and source-column wording when supplied), then saves.

- [ ] **Step 3: Add reset confirmation**

Open `ConfirmDialog` from Reset with: `Clear this wheel and its picked history?` Confirm clears entries, picks, transcript, and local storage. Cancel leaves all session state unchanged.

- [ ] **Step 4: Add direct entry editing contract**

Expose an editor callback that accepts newline-separated entry values, sends them through `normalizeEntries`, clears picks after a confirmed applied change, and renews the session. Keep it disabled during an extraction request or wheel spin.

- [ ] **Step 5: Manually verify restoration and confirmations**

Create a wheel, refresh the page, and confirm it restores. Change the stored expiry in DevTools to the past, reload, and confirm it is cleared. Attempt a new successful extraction and select Cancel, then verify the old wheel remains. Confirm reset and verify all local state is removed.

- [ ] **Step 6: Commit session lifecycle work**

```bash
git add frontend/src/App.tsx frontend/src/components/ConfirmDialog.tsx frontend/src/components/ChatPanel.tsx frontend/src/styles.css
git commit -m "feat: add wheel session lifecycle and confirmations"
```

### Task 8: Build the SVG wheel, history, and result modal

**Files:**
- Create: `frontend/src/components/WheelPanel.tsx`
- Create: `frontend/src/components/ResultModal.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `Entry[]`, `picks: string[]`, `removeOnPick`, `isBusy`, `onEntriesChange`, and `onPick(value: string, remove: boolean)`.
- Produces: `WheelPanel` and `ResultModal` behavior used by the application root.

- [ ] **Step 1: Draw the wheel from entry data**

In `WheelPanel`, calculate equal angular slices from `entries.length`, generate SVG arc paths, and assign colors by cycling a fixed high-contrast palette. Render labels only when `entries.length <= 12`; for larger wheels show no per-segment labels and keep the pointer visible. Render `Wheel is empty` and a disabled Start button when no entries remain.

- [ ] **Step 2: Implement fair four-second spin state**

When Start is pressed, choose `winnerIndex = crypto.getRandomValues(new Uint32Array(1))[0] % entries.length` before animation. Calculate a final rotation containing at least five full turns plus the angle that places that entry under the fixed pointer. Apply CSS `transform: rotate(...)` with a 4000 ms easing transition. Keep an `isSpinning` state and block all supplied controls while true.

- [ ] **Step 3: Apply selection only after animation**

At the transition completion, append the winner value to `picks`. If remove-on-pick is true, remove that entry by id; otherwise retain all entries. Call the supplied state callback, renew the expiry, and open `ResultModal` with the winner.

- [ ] **Step 4: Build the result modal**

Render the selected value with Close and Spin Again. Close only hides the modal. Spin Again hides it and triggers the same Start path if entries remain; it uses the current removal setting. Do not add sound, confetti, timestamps, undo, or a separate history-clear action.

- [ ] **Step 5: Render editing, history, and remove setting**

Place the checked-by-default `Remove the picked students from wheel` checkbox, newline entry editor, selection-order history list, and Reset control beside the wheel. Repeated values in history must remain visible if removal is disabled.

- [ ] **Step 6: Manually verify selection paths**

Create a three-entry wheel and complete several spins. Confirm each takes about four seconds, produces one result modal, records selection order, removes winners when checked, preserves repeats when unchecked, disables controls while spinning, and disables Start after the final removed entry.

- [ ] **Step 7: Commit wheel interaction work**

```bash
git add frontend/src/components/WheelPanel.tsx frontend/src/components/ResultModal.tsx frontend/src/App.tsx frontend/src/styles.css
git commit -m "feat: add animated random selection wheel"
```

### Task 9: Finish production integration and manual acceptance documentation

**Files:**
- Modify: `README.md`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: all prior client and server interfaces.
- Produces: a same-origin production deployment path and an explicit MVP acceptance checklist.

- [ ] **Step 1: Finish desktop layout and busy-state integration**

Use a two-column desktop layout: chat on one side, wheel workspace on the other. During any extraction, disable Start, entry editing, upload, submit, and reset; during a spin, disable the same controls. Keep the current wheel visible while extraction is loading.

- [ ] **Step 2: Document environment and run commands**

Add this configuration section to `README.md`:

```bash
export OPENROUTER_API_KEY="..."
export OPENROUTER_MODEL="your-vision-capable-openrouter-model"
cd backend && .venv/bin/uvicorn app.main:app --reload
cd frontend && npm run dev
```

Document the production sequence: `cd frontend && npm run build`, then `cd backend && .venv/bin/uvicorn app.main:app`.

- [ ] **Step 3: Add the exact manual acceptance checklist**

Add checklist items for: simple newline and comma lists; local case-insensitive dedupe; CSV/TSV header behavior; requested and missing column behavior; valid PNG/JPEG extraction; invalid type and >2 MiB rejection; no image retention; missing configuration; 60-second provider failure; session refresh/expiry; replacement and reset cancellation/confirmation; four-second spin; removal enabled/disabled and repeat history; empty state; result modal Close/Spin Again; and no raw model prose in the UI.

- [ ] **Step 4: Run final manual acceptance**

Build the frontend and start FastAPI against production static assets. Complete every README checklist item in Chrome, recording any failed item before changing code. Confirm all navigation and `/api/extract` requests use the same origin.

- [ ] **Step 5: Commit integration and documentation**

```bash
git add README.md frontend/src/App.tsx frontend/src/styles.css backend/app/main.py
git commit -m "docs: add Wheelio MVP runbook and acceptance checklist"
```

## Plan Self-Review

- **Spec coverage:** Tasks 1–5 cover the React/FastAPI/OpenRouter/LangGraph architecture and strict stateless API. Tasks 3, 6, and 7 cover local parsing, normalization, one-wheel local persistence, 30-minute expiry, transcript, editing, confirmation, and failures. Task 8 covers all spin, removal, history, modal, and visual constraints. Task 9 covers same-origin deployment and the required manual acceptance checks.
- **Placeholder scan:** This plan contains no implementation placeholders; the intentionally generic `your-vision-capable-openrouter-model` is an environment value selected by the deployer, not a code gap.
- **Type consistency:** `Entry`, `WheelSession`, `ExtractionResult`, `validate_upload`, `extract_entries`, `parseSimpleList`, `normalizeEntries`, and `saveSession` are defined before later tasks consume them. Task 2 configures camelCase response aliases (`sourceColumn`, `availableColumns`) to match the TypeScript contract.
